using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Npgsql;
using Up5TickCollector.Config;
using Up5TickCollector.Processing;

namespace Up5TickCollector.Persistence;

/// <summary>
/// Persistência de ticks em PostgreSQL/TimescaleDB
/// Batch insertion otimizado com retry automático
/// </summary>
public class PostgresPersistence : ITickPersistence, IDisposable
{
    private readonly CollectorConfig _config;
    private readonly ILogger<PostgresPersistence> _logger;
    private readonly SemaphoreSlim _connectionSemaphore = new(1, 1);
    private NpgsqlConnection? _connection;
    private readonly Queue<List<TickEvent>> _pendingBatches = new();
    private readonly object _batchLock = new();
    private bool _isDisposed = false;

    public PostgresPersistence(CollectorConfig config, ILogger<PostgresPersistence> logger)
    {
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Conecta ao PostgreSQL
    /// </summary>
    public async Task ConnectAsync()
    {
        if (_connection != null && _connection.State == System.Data.ConnectionState.Open)
        {
            return;
        }

        await _connectionSemaphore.WaitAsync();
        try
        {
            if (_connection != null)
            {
                await _connection.DisposeAsync();
            }

            _connection = new NpgsqlConnection(_config.Postgres.ConnectionString);
            await _connection.OpenAsync();
            
            // Verifica se a tabela existe
            await EnsureTableExistsAsync();
            
            _logger.LogInformation("Conectado ao PostgreSQL");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao conectar ao PostgreSQL");
            throw;
        }
        finally
        {
            _connectionSemaphore.Release();
        }
    }

    private async Task EnsureTableExistsAsync()
    {
        if (_connection == null)
        {
            return;
        }

        var createTableSql = @"
            CREATE TABLE IF NOT EXISTS ticks_raw (
                symbol VARCHAR(20) NOT NULL,
                exchange VARCHAR(10) NOT NULL,
                price DOUBLE PRECISION NOT NULL,
                volume BIGINT NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL,
                trade_id BIGINT,
                buy_agent INTEGER,
                sell_agent INTEGER,
                trade_type SMALLINT,
                volume_financial DOUBLE PRECISION,
                is_edit BOOLEAN DEFAULT FALSE
            );

            CREATE INDEX IF NOT EXISTS idx_ticks_raw_symbol_timestamp ON ticks_raw(symbol, timestamp);
            CREATE INDEX IF NOT EXISTS idx_ticks_raw_timestamp ON ticks_raw(timestamp);
        ";

        try
        {
            using var cmd = new NpgsqlCommand(createTableSql, _connection);
            await cmd.ExecuteNonQueryAsync();
            
            // Tenta criar hypertable (pode falhar se TimescaleDB não estiver instalado)
            try
            {
                var hypertableSql = "SELECT create_hypertable('ticks_raw', 'timestamp', if_not_exists => TRUE);";
                using var cmd2 = new NpgsqlCommand(hypertableSql, _connection);
                await cmd2.ExecuteNonQueryAsync();
                _logger.LogInformation("Hypertable criada/verificada no TimescaleDB");
            }
            catch
            {
                _logger.LogWarning("TimescaleDB não disponível. Continuando sem hypertable.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao criar/verificar tabela");
        }
    }

    /// <summary>
    /// Persiste um batch de ticks
    /// </summary>
    public async Task PersistBatchAsync(List<TickEvent> ticks)
    {
        if (ticks.Count == 0)
        {
            return;
        }

        if (_connection == null || _connection.State != System.Data.ConnectionState.Open)
        {
            try
            {
                await ConnectAsync();
            }
            catch
            {
                // Se não conseguir conectar, enfileira para retry posterior
                lock (_batchLock)
                {
                    _pendingBatches.Enqueue(ticks);
                }
                return;
            }
        }

        for (int attempt = 1; attempt <= _config.Postgres.MaxRetries; attempt++)
        {
            try
            {
                await _connectionSemaphore.WaitAsync();
                try
                {
                    // Constrói INSERT múltiplo com VALUES
                    var values = new List<string>();
                    var parameters = new List<NpgsqlParameter>();
                    var paramIndex = 0;

                    foreach (var tick in ticks)
                    {
                        var valueParts = new List<string>();
                        foreach (var field in new[] { "symbol", "exchange", "price", "volume", "timestamp", "trade_id", "buy_agent", "sell_agent", "trade_type", "volume_financial", "is_edit" })
                        {
                            var paramName = $"@p{paramIndex}";
                            valueParts.Add(paramName);
                            
                            NpgsqlParameter param;
                            switch (field)
                            {
                                case "symbol":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Varchar);
                                    param.Value = tick.Symbol;
                                    break;
                                case "exchange":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Varchar);
                                    param.Value = tick.Exchange;
                                    break;
                                case "price":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Double);
                                    param.Value = tick.Price;
                                    break;
                                case "volume":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Bigint);
                                    param.Value = tick.Quantity;
                                    break;
                                case "timestamp":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.TimestampTz);
                                    var dateTimeOffset = DateTimeOffset.FromUnixTimeSeconds((long)tick.Timestamp);
                                    // PostgreSQL requer DateTime com Kind=UTC
                                    param.Value = dateTimeOffset.UtcDateTime;
                                    break;
                                case "trade_id":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Bigint);
                                    param.Value = tick.TradeId > 0 ? (object)(long)tick.TradeId : DBNull.Value;
                                    break;
                                case "buy_agent":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Integer);
                                    param.Value = tick.BuyAgent != 0 ? (object?)tick.BuyAgent : DBNull.Value;
                                    break;
                                case "sell_agent":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Integer);
                                    param.Value = tick.SellAgent != 0 ? (object?)tick.SellAgent : DBNull.Value;
                                    break;
                                case "trade_type":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Smallint);
                                    param.Value = tick.TradeType != 0 ? (object?)(short)tick.TradeType : DBNull.Value;
                                    break;
                                case "volume_financial":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Double);
                                    param.Value = tick.VolumeFinancial;
                                    break;
                                case "is_edit":
                                    param = new NpgsqlParameter(paramName, NpgsqlTypes.NpgsqlDbType.Boolean);
                                    param.Value = tick.IsEdit;
                                    break;
                                default:
                                    continue;
                            }
                            parameters.Add(param);
                            paramIndex++;
                        }
                        values.Add($"({string.Join(", ", valueParts)})");
                    }

                    var sql = $@"
                        INSERT INTO ticks_raw (
                            symbol, exchange, price, volume, timestamp, trade_id,
                            buy_agent, sell_agent, trade_type, volume_financial, is_edit
                        )
                        VALUES {string.Join(", ", values)}
                        ON CONFLICT DO NOTHING
                    ";

                    using var cmd = new NpgsqlCommand(sql, _connection);
                    foreach (var param in parameters)
                    {
                        cmd.Parameters.Add(param);
                    }
                    await cmd.ExecuteNonQueryAsync();

                    _logger.LogDebug("Persistido batch de {Count} ticks no PostgreSQL", ticks.Count);
                    return; // Sucesso
                }
                finally
                {
                    _connectionSemaphore.Release();
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Tentativa {Attempt} de persistência falhou", attempt);
                
                if (attempt < _config.Postgres.MaxRetries)
                {
                    await Task.Delay(_config.Postgres.RetryDelayMs * attempt);
                }
                else
                {
                    _logger.LogError("Todas as tentativas de persistência falharam para batch de {Count} ticks", ticks.Count);
                    // Enfileira para retry posterior
                    lock (_batchLock)
                    {
                        _pendingBatches.Enqueue(ticks);
                    }
                }
            }
        }
    }

    /// <summary>
    /// Processa batches pendentes (chamado periodicamente)
    /// </summary>
    public async Task ProcessPendingBatchesAsync()
    {
        List<List<TickEvent>> batchesToProcess;
        
        lock (_batchLock)
        {
            if (_pendingBatches.Count == 0)
            {
                return;
            }
            
            batchesToProcess = new List<List<TickEvent>>();
            while (_pendingBatches.Count > 0)
            {
                batchesToProcess.Add(_pendingBatches.Dequeue());
            }
        }

        foreach (var batch in batchesToProcess)
        {
            await PersistBatchAsync(batch);
        }
    }

    /// <summary>
    /// Verifica se está conectado
    /// </summary>
    public Task<bool> IsConnectedAsync()
    {
        return Task.FromResult(_connection != null && _connection.State == System.Data.ConnectionState.Open);
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _connection?.Close();
        _connection?.DisposeAsync().AsTask().Wait();
        _connectionSemaphore.Dispose();
        _isDisposed = true;
    }
}

