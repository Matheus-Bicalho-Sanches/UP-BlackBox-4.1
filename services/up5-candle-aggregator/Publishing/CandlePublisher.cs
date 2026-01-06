using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using NATS.Client;
using Up5CandleAggregator.Config;
using Up5CandleAggregator.Models;

namespace Up5CandleAggregator.Publishing;

/// <summary>
/// Publica candles atualizados no NATS
/// </summary>
public class CandlePublisher : IDisposable
{
    private readonly AggregatorConfig _config;
    private readonly ILogger<CandlePublisher> _logger;
    private IConnection? _connection;
    private readonly JsonSerializerOptions _jsonOptions;
    private bool _isDisposed = false;

    public CandlePublisher(AggregatorConfig config, ILogger<CandlePublisher> logger)
    {
        _config = config;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };
    }

    /// <summary>
    /// Conecta ao NATS
    /// </summary>
    public void Connect()
    {
        if (_connection != null && _connection.State == ConnState.CONNECTED)
        {
            return;
        }

        try
        {
            var opts = ConnectionFactory.GetDefaultOptions();
            opts.Url = _config.Nats.Url;
            opts.AllowReconnect = true;
            opts.MaxReconnect = Options.ReconnectForever;
            opts.ReconnectWait = 2000;
            opts.AsyncErrorEventHandler = (sender, args) =>
            {
                _logger.LogError("Erro NATS: {Error}", args.Error);
            };

            _connection = new ConnectionFactory().CreateConnection(opts);
            _logger.LogInformation("Conectado ao NATS em {Url}", _config.Nats.Url);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao conectar ao NATS");
            throw;
        }
    }

    /// <summary>
    /// Publica um candle atualizado
    /// </summary>
    public void PublishCandle(Candle candle)
    {
        if (_connection == null || _connection.State != ConnState.CONNECTED)
        {
            _logger.LogWarning("NATS não conectado. Tentando reconectar...");
            Connect();
            if (_connection == null || _connection.State != ConnState.CONNECTED)
            {
                _logger.LogError("Não foi possível conectar ao NATS");
                return;
            }
        }

        try
        {
            var subject = _config.Nats.CandleSubjectPattern
                .Replace("{exchange}", candle.Exchange)
                .Replace("{symbol}", candle.Symbol);
            
            var json = JsonSerializer.Serialize(candle, _jsonOptions);
            var data = Encoding.UTF8.GetBytes(json);

            _connection.Publish(subject, data);
            _logger.LogDebug("Candle publicado: {Subject}", subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao publicar candle no NATS");
        }
    }

    public void Dispose()
    {
        if (_isDisposed) return;
        
        _connection?.Close();
        _connection?.Dispose();
        
        _isDisposed = true;
    }
}

