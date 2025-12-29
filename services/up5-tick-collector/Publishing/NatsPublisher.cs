using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using NATS.Client;
using Up5TickCollector.Config;
using Up5TickCollector.Publishing;
using Up5TickCollector.Processing;

namespace Up5TickCollector.Publishing;

/// <summary>
/// Publicador de eventos no NATS message bus
/// </summary>
public class NatsPublisher : IEventPublisher, IDisposable
{
    private readonly CollectorConfig _config;
    private readonly ILogger<NatsPublisher> _logger;
    private IConnection? _connection;
    private readonly JsonSerializerOptions _jsonOptions;
    private bool _isDisposed = false;

    public NatsPublisher(CollectorConfig config, ILogger<NatsPublisher> logger)
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
    /// Publica um batch de ticks
    /// </summary>
    public async Task PublishTickBatchAsync(List<TickEvent> ticks)
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
            // Agrupa por símbolo para publicar em tópicos separados
            var grouped = ticks.GroupBy(t => $"{t.Exchange}.{t.Symbol}");

            foreach (var group in grouped)
            {
                var subject = $"{_config.Nats.SubjectPrefix}.ticks.{group.Key}";
                var json = JsonSerializer.Serialize(group.ToList(), _jsonOptions);
                var data = Encoding.UTF8.GetBytes(json);

                _connection.Publish(subject, data);
            }

            _logger.LogDebug("Publicado batch de {Count} ticks no NATS", ticks.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao publicar ticks no NATS");
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Publica atualização de price book
    /// </summary>
    public async Task PublishPriceBookAsync(PriceBookEvent book)
    {
        if (_connection == null || _connection.State != ConnState.CONNECTED)
        {
            return;
        }

        try
        {
            var subject = $"{_config.Nats.SubjectPrefix}.book.{book.Exchange}.{book.Symbol}";
            var json = JsonSerializer.Serialize(book, _jsonOptions);
            var data = Encoding.UTF8.GetBytes(json);

            _connection.Publish(subject, data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao publicar price book no NATS");
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Publica atualização de offer book
    /// </summary>
    public async Task PublishOfferBookAsync(OfferBookEvent offer)
    {
        if (_connection == null || _connection.State != ConnState.CONNECTED)
        {
            return;
        }

        try
        {
            var subject = $"{_config.Nats.SubjectPrefix}.offers.{offer.Exchange}.{offer.Symbol}";
            var json = JsonSerializer.Serialize(offer, _jsonOptions);
            var data = Encoding.UTF8.GetBytes(json);

            _connection.Publish(subject, data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao publicar offer book no NATS");
        }

        await Task.CompletedTask;
    }

    /// <summary>
    /// Verifica se está conectado
    /// </summary>
    public Task<bool> IsConnectedAsync()
    {
        return Task.FromResult(_connection != null && _connection.State == ConnState.CONNECTED);
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _connection?.Close();
        _connection?.Dispose();
        _connection = null;
        _isDisposed = true;
    }
}

