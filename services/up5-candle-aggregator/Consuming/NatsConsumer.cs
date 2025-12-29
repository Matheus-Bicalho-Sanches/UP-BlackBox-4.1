using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using NATS.Client;
using Up5CandleAggregator.Config;
using Up5CandleAggregator.Models;

namespace Up5CandleAggregator.Consuming;

/// <summary>
/// Consome ticks do NATS e notifica o agregador
/// </summary>
public class NatsConsumer : IDisposable
{
    private readonly AggregatorConfig _config;
    private readonly ILogger<NatsConsumer> _logger;
    private IConnection? _connection;
    private IAsyncSubscription? _subscription;
    private readonly JsonSerializerOptions _jsonOptions;
    private bool _isDisposed = false;

    public event EventHandler<TickEvent>? TickReceived;

    public NatsConsumer(AggregatorConfig config, ILogger<NatsConsumer> logger)
    {
        _config = config;
        _logger = logger;
        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };
    }

    /// <summary>
    /// Conecta ao NATS e faz subscribe no padrão de ticks
    /// </summary>
    public void ConnectAndSubscribe()
    {
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

            // Subscribe em todos os tópicos de ticks (padrão wildcard)
            var subject = $"{_config.Nats.SubjectPrefix}.ticks.*.*";
            _subscription = _connection.SubscribeAsync(subject, (sender, args) =>
            {
                try
                {
                    var json = Encoding.UTF8.GetString(args.Message.Data);
                    var ticks = JsonSerializer.Deserialize<List<TickEvent>>(json, _jsonOptions);
                    
                    if (ticks != null)
                    {
                        foreach (var tick in ticks)
                        {
                            TickReceived?.Invoke(this, tick);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Erro ao processar mensagem do NATS");
                }
            });

            _logger.LogInformation("Subscribed em {Subject}", subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao conectar ao NATS");
            throw;
        }
    }

    public void Dispose()
    {
        if (_isDisposed) return;
        
        _subscription?.Unsubscribe();
        _connection?.Close();
        _connection?.Dispose();
        
        _isDisposed = true;
    }
}

