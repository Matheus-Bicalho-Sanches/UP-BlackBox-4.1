using System;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Logging;
using Up5TickCollector.Config;
using Up5TickCollector.Core;
using Up5TickCollector.DataTypes;
using Up5TickCollector.Processing;
using Up5TickCollector.Utils;

namespace Up5TickCollector.Core;

/// <summary>
/// Wrapper de alto nível para a ProfitDLL
/// Singleton thread-safe com callbacks não-bloqueantes
/// </summary>
public class ProfitDllConnector : IDisposable
{
    private readonly CollectorConfig _config;
    private readonly ILogger<ProfitDllConnector> _logger;
    private readonly ConcurrentQueue<TickEvent> _tickQueue = new();
    private readonly ConcurrentQueue<PriceBookEvent> _priceBookQueue = new();
    private readonly ConcurrentQueue<OfferBookEvent> _offerBookQueue = new();
    
    private bool _isInitialized = false;
    private bool _isDisposed = false;
    
    // Keep delegates alive (GC não deve coletar)
    private ProfitDllInterop.TStateCallback? _stateCallback;
    private ProfitDllInterop.TConnectorTradeCallback? _tradeCallbackV2;
    private ProfitDllInterop.TPriceBookCallbackV2? _priceBookCallbackV2;
    private ProfitDllInterop.TOfferBookCallbackV2? _offerBookCallbackV2;
    
    private readonly ConcurrentDictionary<string, bool> _subscribedAssets = new();

    // Events
    public event Action<TickEvent>? OnTickReceived;
    public event Action<PriceBookEvent>? OnPriceBookUpdated;
    public event Action<OfferBookEvent>? OnOfferBookUpdated;
    public event Action<ConnectionState>? OnConnectionStateChanged;

    public ProfitDllConnector(CollectorConfig config, ILogger<ProfitDllConnector> logger)
    {
        _config = config;
        _logger = logger;
    }

    /// <summary>
    /// Inicializa a conexão com a DLL
    /// </summary>
    public void Initialize()
    {
        if (_isInitialized)
        {
            _logger.LogWarning("ProfitDllConnector já está inicializado");
            return;
        }

        try
        {
            // Configura diretório da DLL
            if (!string.IsNullOrEmpty(_config.ProfitDll.DllPath))
            {
                ProfitDllInterop.SetDllDirectoryPath(_config.ProfitDll.DllPath);
            }

            // Configura callbacks antes de inicializar
            SetupCallbacks();

            // Inicializa DLL
            var result = ProfitDllInterop.DLLInitializeMarketLogin(
                _config.ProfitDll.ActivationKey,
                _config.ProfitDll.User,
                _config.ProfitDll.Password,
                _stateCallback!,
                IntPtr.Zero, // newTradeCallback - não usado, usamos V2
                IntPtr.Zero, // newDailyCallback
                IntPtr.Zero, // priceBookCallback - não usado, usamos V2
                IntPtr.Zero, // offerBookCallback - não usado, usamos V2
                IntPtr.Zero, // historyTradeCallback - não usado, usamos V2
                IntPtr.Zero, // progressCallback
                IntPtr.Zero  // tinyBookCallback
            );

            if (result != ProfitDllInterop.NL_OK)
            {
                throw new Exception($"Falha ao inicializar DLL: código {result:X8}");
            }

            // Configura callbacks V2
            ProfitDllInterop.SetTradeCallbackV2(_tradeCallbackV2!);
            ProfitDllInterop.SetPriceBookCallbackV2(_priceBookCallbackV2!);
            ProfitDllInterop.SetOfferBookCallbackV2(_offerBookCallbackV2!);

            _isInitialized = true;
            _logger.LogInformation("ProfitDllConnector inicializado com sucesso");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao inicializar ProfitDllConnector");
            throw;
        }
    }

    private void SetupCallbacks()
    {
        // State callback
        _stateCallback = (stateType, result) =>
        {
            try
            {
                _logger.LogDebug("State callback: type={StateType}, result={Result}", stateType, result);

                if (stateType == ProfitDllInterop.CONNECTION_STATE_MARKET_DATA)
                {
                    if (result == ProfitDllInterop.MARKET_CONNECTED)
                    {
                        _logger.LogInformation("Market data conectado!");
                        OnConnectionStateChanged?.Invoke(ConnectionState.Connected);
                    }
                    else if (result == ProfitDllInterop.MARKET_DISCONNECTED)
                    {
                        _logger.LogWarning("Market data desconectado");
                        OnConnectionStateChanged?.Invoke(ConnectionState.Disconnected);
                    }
                    else if (result == ProfitDllInterop.MARKET_CONNECTING)
                    {
                        _logger.LogInformation("Conectando ao market data...");
                        OnConnectionStateChanged?.Invoke(ConnectionState.Connecting);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no state callback");
            }
        };

        // Trade callback V2
        _tradeCallbackV2 = (assetId, pTrade, flags) =>
        {
            try
            {
                // Traduz o ponteiro para estrutura
                var trade = new TConnectorTrade();
                var translateResult = ProfitDllInterop.TranslateTrade(pTrade, ref trade);
                
                if (translateResult != ProfitDllInterop.NL_OK)
                {
                    _logger.LogWarning("Falha ao traduzir trade: {Result}", translateResult);
                    return;
                }

                // Cria evento (não bloqueia o callback)
                var tradeDateTime = trade.TradeDate.ToDateTime();
                double timestamp;
                
                if (tradeDateTime != DateTime.MinValue)
                {
                    var dateTimeOffset = new DateTimeOffset(tradeDateTime, TimeSpan.Zero);
                    timestamp = dateTimeOffset.ToUnixTimeSeconds() + (trade.TradeDate.Milliseconds / 1000.0);
                }
                else
                {
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                }
                
                var tickEvent = new TickEvent
                {
                    Symbol = assetId.Ticker ?? string.Empty,
                    Exchange = assetId.Exchange ?? string.Empty,
                    Timestamp = timestamp,
                    Price = trade.Price,
                    Quantity = trade.Quantity,
                    VolumeFinancial = trade.Volume,
                    TradeId = trade.TradeNumber,
                    TradeType = trade.TradeType,
                    BuyAgent = trade.BuyAgent,
                    SellAgent = trade.SellAgent,
                    IsEdit = (flags & ProfitDllInterop.TC_IS_EDIT) != 0
                };

                // Enfileira (lock-free, não bloqueia)
                _tickQueue.Enqueue(tickEvent);
                
                // Conta para monitoramento
                TickCounter.Increment(tickEvent.Symbol, tickEvent.Exchange);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no trade callback");
            }
        };

        // Price book callback V2
        _priceBookCallbackV2 = (assetId, action, position, side, qtd, count, price, pArraySell, pArrayBuy) =>
        {
            try
            {
                var bookEvent = new PriceBookEvent
                {
                    Symbol = assetId.Ticker ?? string.Empty,
                    Exchange = assetId.Bolsa ?? string.Empty,
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    Action = action,
                    Position = position,
                    Side = side,
                    Quantity = qtd,
                    Count = count,
                    Price = price
                };

                _priceBookQueue.Enqueue(bookEvent);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no price book callback");
            }
        };

        // Offer book callback V2
        _offerBookCallbackV2 = (assetId, action, position, side, qtd, agent, offerId, price, hasPrice, hasQtd, hasDate, hasOfferId, hasAgent, date, pArraySell, pArrayBuy) =>
        {
            try
            {
                var offerEvent = new OfferBookEvent
                {
                    Symbol = assetId.Ticker ?? string.Empty,
                    Exchange = assetId.Bolsa ?? string.Empty,
                    Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    Action = action,
                    Position = position,
                    Side = side,
                    Quantity = qtd,
                    Agent = agent,
                    OfferId = offerId,
                    Price = price,
                    Date = date ?? string.Empty
                };

                _offerBookQueue.Enqueue(offerEvent);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no offer book callback");
            }
        };
    }

    /// <summary>
    /// Processa eventos enfileirados (chamado por worker thread)
    /// </summary>
    public void ProcessQueuedEvents()
    {
        // Processa ticks
        while (_tickQueue.TryDequeue(out var tick))
        {
            OnTickReceived?.Invoke(tick);
        }

        // Processa price books
        while (_priceBookQueue.TryDequeue(out var book))
        {
            OnPriceBookUpdated?.Invoke(book);
        }

        // Processa offer books
        while (_offerBookQueue.TryDequeue(out var offer))
        {
            OnOfferBookUpdated?.Invoke(offer);
        }
    }

    /// <summary>
    /// Inscreve em um ativo
    /// </summary>
    public bool Subscribe(string ticker, string exchange)
    {
        if (!_isInitialized)
        {
            _logger.LogWarning("DLL não inicializada. Não é possível inscrever em {Ticker}", ticker);
            return false;
        }

        var key = $"{ticker}:{exchange}";
        if (_subscribedAssets.ContainsKey(key))
        {
            _logger.LogDebug("Ativo {Ticker} já está inscrito", ticker);
            return true;
        }

        try
        {
            var result = ProfitDllInterop.SubscribeTicker(ticker, exchange);
            
            if (result == ProfitDllInterop.NL_OK)
            {
                _subscribedAssets[key] = true;
                _logger.LogInformation("Inscrito em {Ticker} ({Exchange})", ticker, exchange);
                return true;
            }
            else
            {
                _logger.LogWarning("Falha ao inscrever em {Ticker}: código {Result:X8}", ticker, result);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao inscrever em {Ticker}", ticker);
            return false;
        }
    }

    /// <summary>
    /// Desinscreve de um ativo
    /// </summary>
    public bool Unsubscribe(string ticker, string exchange)
    {
        if (!_isInitialized)
        {
            return false;
        }

        var key = $"{ticker}:{exchange}";
        if (!_subscribedAssets.ContainsKey(key))
        {
            return true; // Já não está inscrito
        }

        try
        {
            var result = ProfitDllInterop.UnsubscribeTicker(ticker, exchange);
            if (result == ProfitDllInterop.NL_OK)
            {
                _subscribedAssets.TryRemove(key, out _);
                _logger.LogInformation("Desinscrito de {Ticker} ({Exchange})", ticker, exchange);
                return true;
            }
            else
            {
                _logger.LogWarning("Falha ao desinscrever de {Ticker}: código {Result:X8}", ticker, result);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao desinscrever de {Ticker}", ticker);
            return false;
        }
    }

    /// <summary>
    /// Retorna lista de ativos subscritos
    /// </summary>
    public List<string> GetSubscribedAssets()
    {
        return _subscribedAssets.Keys.ToList();
    }

    /// <summary>
    /// Finaliza a DLL
    /// </summary>
    public void Shutdown()
    {
        if (!_isInitialized)
        {
            return;
        }

        try
        {
            // Desinscreve de todos os ativos
            foreach (var key in _subscribedAssets.Keys.ToList())
            {
                var parts = key.Split(':');
                if (parts.Length == 2)
                {
                    ProfitDllInterop.UnsubscribeTicker(parts[0], parts[1]);
                }
            }
            _subscribedAssets.Clear();

            // Finaliza DLL
            ProfitDllInterop.DLLFinalize();
            _isInitialized = false;
            _logger.LogInformation("ProfitDllConnector finalizado");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao finalizar ProfitDllConnector");
        }
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        Shutdown();
        _isDisposed = true;
    }
}

