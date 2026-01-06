using System.Collections.Generic;
using System.Text;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using Up5CandleAggregator.Config;
using Up5CandleAggregator.Models;

namespace Up5CandleAggregator.Persistence;

/// <summary>
/// Persiste candles no PostgreSQL/TimescaleDB
/// </summary>
public class PostgresCandlePersistence : IDisposable
{
    private readonly AggregatorConfig _config;
    private readonly ILogger<PostgresCandlePersistence> _logger;
    private readonly Queue<Candle> _pendingCandles = new();
    private readonly Timer _persistTimer;
    private readonly object _lockObject = new();
    private bool _isDisposed = false;

    public PostgresCandlePersistence(AggregatorConfig config, ILogger<PostgresCandlePersistence> logger)
    {
        _config = config;
        _logger = logger;
        
        // Timer para persistir candles em batch
        _persistTimer = new Timer(PersistBatch, null, 
            _config.Postgres.BatchIntervalMs, 
            _config.Postgres.BatchIntervalMs);
    }

    /// <summary>
    /// Adiciona um candle à fila de persistência
    /// </summary>
    public void EnqueueCandle(Candle candle)
    {
        if (!candle.IsClosed)
        {
            return; // Só persiste candles fechados
        }

        lock (_lockObject)
        {
            _pendingCandles.Enqueue(candle);
        }
    }

    /// <summary>
    /// Persiste batch de candles (chamado pelo timer)
    /// </summary>
    private void PersistBatch(object? state)
    {
        List<Candle> candlesToPersist;

        lock (_lockObject)
        {
            if (_pendingCandles.Count == 0)
            {
                return;
            }

            candlesToPersist = new List<Candle>();
            var batchSize = Math.Min(_config.Postgres.BatchSize, _pendingCandles.Count);
            
            for (int i = 0; i < batchSize; i++)
            {
                if (_pendingCandles.TryDequeue(out var candle))
                {
                    candlesToPersist.Add(candle);
                }
            }
        }

        if (candlesToPersist.Count == 0)
        {
            return;
        }

        PersistCandles(candlesToPersist);
    }

    /// <summary>
    /// Persiste candles no PostgreSQL
    /// </summary>
    private void PersistCandles(List<Candle> candles)
    {
        var retries = 0;
        var maxRetries = _config.Postgres.MaxRetries;

        while (retries < maxRetries)
        {
            try
            {
                using var conn = new NpgsqlConnection(_config.Postgres.ConnectionString);
                conn.Open();

                using var cmd = new NpgsqlCommand();
                cmd.Connection = conn;

                var values = new List<string>();
                var parameters = new List<NpgsqlParameter>();
                var paramIndex = 0;

                foreach (var candle in candles)
                {
                    var valueParts = new List<string>();
                    
                    // Symbol
                    var paramName = $"@p{paramIndex}";
                    valueParts.Add(paramName);
                    parameters.Add(new NpgsqlParameter(paramName, NpgsqlDbType.Text) { Value = candle.Symbol });
                    paramIndex++;
                    
                    // Exchange
                    paramName = $"@p{paramIndex}";
                    valueParts.Add(paramName);
                    parameters.Add(new NpgsqlParameter(paramName, NpgsqlDbType.Text) { Value = candle.Exchange });
                    paramIndex++;
                    
                    // Timestamp
                    paramName = $"@p{paramIndex}";
                    valueParts.Add(paramName);
                    parameters.Add(new NpgsqlParameter(paramName, NpgsqlDbType.TimestampTz) { Value = candle.Timestamp });
                    paramIndex++;
                    
                    // Open
                    paramName = $"@p{paramIndex}";
                    valueParts.Add(paramName);
                    parameters.Add(new NpgsqlParameter(paramName, NpgsqlDbType.Double) { Value = candle.Open });
                    paramIndex++;
                    
                    // High
                    paramName = $"@p{paramIndex}";
                    valueParts.Add(paramName);
                    parameters.Add(new NpgsqlParameter(paramName, NpgsqlDbType.Double) { Value = candle.High });
                    paramIndex++;
                    
                    // Low
                    paramName = $"@p{paramIndex}";
                    valueParts.Add(paramName);
                    parameters.Add(new NpgsqlParameter(paramName, NpgsqlDbType.Double) { Value = candle.Low });
                    paramIndex++;
                    
                    // Close
                    paramName = $"@p{paramIndex}";
                    valueParts.Add(paramName);
                    parameters.Add(new NpgsqlParameter(paramName, NpgsqlDbType.Double) { Value = candle.Close });
                    paramIndex++;
                    
                    // Volume
                    paramName = $"@p{paramIndex}";
                    valueParts.Add(paramName);
                    parameters.Add(new NpgsqlParameter(paramName, NpgsqlDbType.Bigint) { Value = candle.Volume });
                    paramIndex++;
                    
                    // VolumeFinancial
                    paramName = $"@p{paramIndex}";
                    valueParts.Add(paramName);
                    parameters.Add(new NpgsqlParameter(paramName, NpgsqlDbType.Double) { Value = candle.VolumeFinancial });
                    paramIndex++;
                    
                    values.Add($"({string.Join(", ", valueParts)})");
                }

                var sql = $@"
                    INSERT INTO candles_1m (symbol, exchange, ts_minute_utc, o, h, l, c, v, vf)
                    VALUES {string.Join(", ", values)}
                    ON CONFLICT (symbol, ts_minute_utc) DO UPDATE SET
                        o = EXCLUDED.o,
                        h = EXCLUDED.h,
                        l = EXCLUDED.l,
                        c = EXCLUDED.c,
                        v = EXCLUDED.v,
                        vf = EXCLUDED.vf
                ";

                cmd.CommandText = sql;
                
                foreach (var param in parameters)
                {
                    cmd.Parameters.Add(param);
                }

                cmd.ExecuteNonQuery();
                
                _logger.LogDebug("Persistidos {Count} candles no PostgreSQL", candles.Count);
                return; // Sucesso
            }
            catch (Exception ex)
            {
                retries++;
                _logger.LogWarning(ex, "Erro ao persistir candles (tentativa {Retry}/{MaxRetries})", retries, maxRetries);
                
                if (retries < maxRetries)
                {
                    Thread.Sleep(_config.Postgres.RetryDelayMs * retries);
                }
                else
                {
                    _logger.LogError(ex, "Falha ao persistir {Count} candles após {MaxRetries} tentativas", candles.Count, maxRetries);
                    // Recoloca os candles na fila para tentar novamente depois
                    lock (_lockObject)
                    {
                        foreach (var candle in candles)
                        {
                            _pendingCandles.Enqueue(candle);
                        }
                    }
                }
            }
        }
    }

    public void Dispose()
    {
        if (_isDisposed) return;
        
        _persistTimer?.Dispose();
        
        // Persiste candles pendentes antes de fechar
        if (_pendingCandles.Count > 0)
        {
            var remaining = new List<Candle>();
            lock (_lockObject)
            {
                while (_pendingCandles.TryDequeue(out var candle))
                {
                    remaining.Add(candle);
                }
            }
            
            if (remaining.Count > 0)
            {
                PersistCandles(remaining);
            }
        }
        
        _isDisposed = true;
    }
}

