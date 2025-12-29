using System;
using System.Text;
using System.Text.Json;
using MarketCollector.Config;
using MarketCollector.DataTypes;
using MarketCollector.Models;
using MarketCollector.Utils;
using Microsoft.Extensions.Logging;
using NATS.Client;

namespace MarketCollector;

/// <summary>
/// Serviço principal que coleta dados da DLL e publica no NATS
/// </summary>
public class CollectorService : IDisposable
{
    private readonly CollectorConfig _config;
    private readonly ILogger<CollectorService> _logger;
    private IConnection? _natsConnection;
    private readonly JsonSerializerOptions _jsonOptions;
    private bool _isInitialized = false;

    // Keep delegates alive (GC não deve coletar)
    private DLLInterop.TStateCallback? _stateCallback;
    private DLLInterop.TConnectorTradeCallback? _tradeCallbackV2;
    private DLLInterop.TConnectorTradeCallback? _historyTradeCallbackV2;
    private DLLInterop.TPriceBookCallbackV2? _priceBookCallbackV2;
    private DLLInterop.TOfferBookCallbackV2? _offerBookCallbackV2;

    public CollectorService(CollectorConfig config, ILogger<CollectorService> logger)
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
    /// Inicializa o serviço: conecta ao NATS e inicializa a DLL
    /// </summary>
    public void Initialize()
    {
        if (_isInitialized)
        {
            _logger.LogWarning("CollectorService já está inicializado");
            return;
        }

        try
        {
            // Conecta ao NATS
            _logger.LogInformation("Conectando ao NATS em {NatsUrl}...", _config.NatsUrl);
            var opts = ConnectionFactory.GetDefaultOptions();
            opts.Url = _config.NatsUrl;
            opts.AllowReconnect = true;
            opts.MaxReconnect = Options.ReconnectForever;
            opts.ReconnectWait = 2000;
            opts.AsyncErrorEventHandler = (sender, args) =>
            {
                _logger.LogError("Erro NATS: {Error}", args.Error);
            };

            _natsConnection = new ConnectionFactory().CreateConnection(opts);
            _logger.LogInformation("Conectado ao NATS com sucesso");

            // Configura callbacks antes de inicializar DLL
            SetupCallbacks();

            // Inicializa DLL
            InitializeDLL();

            _isInitialized = true;
            _logger.LogInformation("CollectorService inicializado com sucesso");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao inicializar CollectorService");
            throw;
        }
    }

    private void SetupCallbacks()
    {
        // State callback
        _stateCallback = (stateType, result) =>
        {
            _logger.LogDebug("State callback: type={StateType}, result={Result}", stateType, result);

            if (stateType == DLLInterop.CONNECTION_STATE_MARKET_DATA)
            {
                if (result == DLLInterop.MARKET_CONNECTED)
                {
                    _logger.LogInformation("Market data conectado! Inscrevendo símbolos...");
                    SubscribeSymbols();
                }
                else if (result == DLLInterop.MARKET_DISCONNECTED || result == DLLInterop.MARKET_CONNECTING)
                {
                    _logger.LogWarning("Market data desconectado ou conectando... result={Result}", result);
                }
            }
        };

        // Trade callback V2 (tempo real)
        _tradeCallbackV2 = (assetId, pTrade, flags) =>
        {
            try
            {
                var tradeStruct = new TConnectorTrade();
                var result = DLLInterop.TranslateTrade(pTrade, ref tradeStruct);

                if (result == DLLInterop.NL_OK)
                {
                    var symbol = assetId.Ticker?.ToUpperInvariant() ?? "UNKNOWN";
                    var tradeEvent = new TradeEvent
                    {
                        Symbol = symbol,
                        Timestamp = DateTimeUtils.ToEpochFloat64(tradeStruct.TradeDate.ToDateTime()),
                        Price = tradeStruct.Price,
                        Quantity = tradeStruct.Quantity,
                        VolumeFinancial = tradeStruct.Volume,
                        TradeId = tradeStruct.TradeNumber,
                        TradeType = tradeStruct.TradeType,
                        BuyAgent = tradeStruct.BuyAgent != 0 ? tradeStruct.BuyAgent : null,
                        SellAgent = tradeStruct.SellAgent != 0 ? tradeStruct.SellAgent : null,
                        IsEdit = (flags & 1) != 0 // TC_IS_EDIT flag
                    };

                    PublishTradeEvent(tradeEvent);
                }
                else
                {
                    _logger.LogWarning("TranslateTrade falhou para trade: result={Result}", result);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar trade callback");
            }
        };

        // History trade callback V2
        _historyTradeCallbackV2 = (assetId, pTrade, flags) =>
        {
            try
            {
                var tradeStruct = new TConnectorTrade();
                var result = DLLInterop.TranslateTrade(pTrade, ref tradeStruct);

                if (result == DLLInterop.NL_OK)
                {
                    var symbol = assetId.Ticker?.ToUpperInvariant() ?? "UNKNOWN";
                    var historyEvent = new HistoryTradeEvent
                    {
                        Symbol = symbol,
                        Timestamp = DateTimeUtils.ToEpochFloat64(tradeStruct.TradeDate.ToDateTime()),
                        Price = tradeStruct.Price,
                        Quantity = tradeStruct.Quantity,
                        VolumeFinancial = tradeStruct.Volume,
                        TradeId = tradeStruct.TradeNumber,
                        TradeType = tradeStruct.TradeType,
                        BuyAgent = tradeStruct.BuyAgent != 0 ? tradeStruct.BuyAgent : null,
                        SellAgent = tradeStruct.SellAgent != 0 ? tradeStruct.SellAgent : null
                    };

                    PublishHistoryTradeEvent(historyEvent);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar history trade callback");
            }
        };

        // PriceBook callback V2
        _priceBookCallbackV2 = (assetId, action, position, side, qtd, count, price, pArraySell, pArrayBuy) =>
        {
            try
            {
                var symbol = assetId.Ticker?.ToUpperInvariant() ?? "UNKNOWN";
                var timestamp = DateTimeUtils.ToEpochFloat64(DateTime.UtcNow);

                // Action 4 = atFullBook (snapshot completo)
                if (action == 4 && (pArraySell != IntPtr.Zero || pArrayBuy != IntPtr.Zero))
                {
                    var snapshot = ParseBookSnapshot(assetId, pArraySell, pArrayBuy, timestamp);
                    if (snapshot != null)
                    {
                        PublishOrderBookSnapshot(snapshot);
                    }
                }
                else
                {
                    // Update incremental
                    var update = new OrderBookUpdateEvent
                    {
                        Symbol = symbol,
                        Timestamp = timestamp,
                        Action = action,
                        Side = side,
                        Position = position >= 0 ? position : null,
                        Price = price > 0 ? price : null,
                        Quantity = qtd > 0 ? qtd : null,
                        OfferCount = count > 0 ? count : null
                    };

                    PublishOrderBookUpdate(update);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar price book callback");
            }
        };

        // OfferBook callback V2
        _offerBookCallbackV2 = (assetId, action, position, side, qtd, agent, offerId, price, hasPrice, hasQtd, hasDate, hasOfferId, hasAgent, date, pArraySell, pArrayBuy) =>
        {
            try
            {
                var symbol = assetId.Ticker?.ToUpperInvariant() ?? "UNKNOWN";
                var offerEvent = new OrderBookOfferEvent
                {
                    Symbol = symbol,
                    Timestamp = DateTimeUtils.ToEpochFloat64(DateTime.UtcNow),
                    Action = action,
                    Side = side,
                    Position = position >= 0 ? position : null,
                    Quantity = hasQtd != 0 ? qtd : null,
                    AgentId = hasAgent != 0 ? agent : null,
                    OfferId = hasOfferId != 0 ? offerId : null,
                    Price = hasPrice != 0 && price > 0 ? price : null
                };

                PublishOrderBookOffer(offerEvent);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar offer book callback");
            }
        };

        // Registra callbacks V2 na DLL
        DLLInterop.SetTradeCallbackV2(_tradeCallbackV2);
        DLLInterop.SetHistoryTradeCallbackV2(_historyTradeCallbackV2);
        DLLInterop.SetPriceBookCallbackV2(_priceBookCallbackV2);
        DLLInterop.SetOfferBookCallbackV2(_offerBookCallbackV2);

        _logger.LogInformation("Callbacks configurados");
    }

    private void InitializeDLL()
    {
        _logger.LogInformation("Inicializando DLL Profit: {DllPath}", _config.DllPath);

        // Define o diretório da DLL para que o DllImport possa encontrá-la
        DLLInterop.SetDllDirectoryPath(_config.DllPath);
        
        // Verifica se a DLL existe
        if (!File.Exists(_config.DllPath))
        {
            throw new FileNotFoundException($"DLL não encontrada: {_config.DllPath}");
        }

        var result = DLLInterop.DLLInitializeMarketLogin(
            _config.ActivationKey,
            _config.User,
            _config.Password,
            _stateCallback!,
            IntPtr.Zero, // newTradeCallback - usando V2
            IntPtr.Zero, // newDailyCallback - não usado
            IntPtr.Zero, // priceBookCallback - usando V2
            IntPtr.Zero, // offerBookCallback - usando V2
            IntPtr.Zero, // historyTradeCallback - usando V2
            IntPtr.Zero, // progressCallback - não usado
            IntPtr.Zero  // tinyBookCallback - não usado
        );

        if (result != DLLInterop.NL_OK)
        {
            throw new Exception($"Falha ao inicializar DLL: código {result:X8}");
        }

        _logger.LogInformation("DLL inicializada com sucesso");
    }

    private void SubscribeSymbols()
    {
        foreach (var symbolConfig in _config.Symbols)
        {
            var parts = symbolConfig.Split(':');
            var ticker = parts[0];
            var exchange = parts.Length > 1 ? parts[1] : _config.DefaultExchange;

            _logger.LogInformation("Inscrevendo símbolo: {Ticker} na exchange {Exchange}", ticker, exchange);

            // Subscribe ticker (trades)
            var result1 = DLLInterop.SubscribeTicker(ticker, exchange);
            if (result1 == DLLInterop.NL_OK)
            {
                _logger.LogInformation("Subscribed ticker: {Ticker}", ticker);
            }
            else
            {
                _logger.LogWarning("Falha ao inscrever ticker {Ticker}: código {Code}", ticker, result1);
            }

            // Subscribe price book
            var result2 = DLLInterop.SubscribePriceBook(ticker, exchange);
            if (result2 == DLLInterop.NL_OK)
            {
                _logger.LogInformation("Subscribed price book: {Ticker}", ticker);
            }

            // Subscribe offer book
            var result3 = DLLInterop.SubscribeOfferBook(ticker, exchange);
            if (result3 == DLLInterop.NL_OK)
            {
                _logger.LogInformation("Subscribed offer book: {Ticker}", ticker);
            }
        }
    }

    // Métodos auxiliares para parse de arrays (simplificado por enquanto - pode ser melhorado depois)
    private OrderBookSnapshotEvent? ParseBookSnapshot(DataTypes.TAssetID assetId, IntPtr pArraySell, IntPtr pArrayBuy, double timestamp)
    {
        // TODO: Implementar parse completo dos arrays conforme documentação da DLL
        // Por enquanto, retornamos null - snapshots serão reconstruídos pelos updates
        return null;
    }

    // Métodos de publicação NATS
    private void PublishTradeEvent(TradeEvent tradeEvent)
    {
        try
        {
            var topic = NatsTopics.Trades(tradeEvent.Symbol);
            var json = JsonSerializer.Serialize(tradeEvent, _jsonOptions);
            var data = Encoding.UTF8.GetBytes(json);
            _natsConnection?.Publish(topic, data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao publicar trade event");
        }
    }

    private void PublishHistoryTradeEvent(HistoryTradeEvent historyEvent)
    {
        try
        {
            var topic = NatsTopics.HistoryTrades(historyEvent.Symbol);
            var json = JsonSerializer.Serialize(historyEvent, _jsonOptions);
            var data = Encoding.UTF8.GetBytes(json);
            _natsConnection?.Publish(topic, data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao publicar history trade event");
        }
    }

    private void PublishOrderBookSnapshot(OrderBookSnapshotEvent snapshot)
    {
        try
        {
            var topic = NatsTopics.OrderBookSnapshots(snapshot.Symbol);
            var json = JsonSerializer.Serialize(snapshot, _jsonOptions);
            var data = Encoding.UTF8.GetBytes(json);
            _natsConnection?.Publish(topic, data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao publicar order book snapshot");
        }
    }

    private void PublishOrderBookUpdate(OrderBookUpdateEvent update)
    {
        try
        {
            var topic = NatsTopics.OrderBookUpdates(update.Symbol);
            var json = JsonSerializer.Serialize(update, _jsonOptions);
            var data = Encoding.UTF8.GetBytes(json);
            _natsConnection?.Publish(topic, data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao publicar order book update");
        }
    }

    private void PublishOrderBookOffer(OrderBookOfferEvent offer)
    {
        try
        {
            var topic = NatsTopics.OrderBookOffers(offer.Symbol);
            var json = JsonSerializer.Serialize(offer, _jsonOptions);
            var data = Encoding.UTF8.GetBytes(json);
            _natsConnection?.Publish(topic, data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao publicar order book offer");
        }
    }

    public void Dispose()
    {
        _logger.LogInformation("Finalizando CollectorService...");

        try
        {
            DLLInterop.DLLFinalize();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao finalizar DLL");
        }
        finally
        {
            _natsConnection?.Close();
            _natsConnection?.Dispose();
            _natsConnection = null;
        }
    }
}
