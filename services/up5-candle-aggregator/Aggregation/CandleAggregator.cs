using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Up5CandleAggregator.Config;
using Up5CandleAggregator.Models;

namespace Up5CandleAggregator.Aggregation;

/// <summary>
/// Agrega ticks em candles de 1 minuto
/// </summary>
public class CandleAggregator : IDisposable
{
    private readonly AggregatorConfig _config;
    private readonly ILogger<CandleAggregator> _logger;
    private readonly ConcurrentDictionary<string, Candle> _currentCandles = new();
    private readonly Timer _closeTimer;
    private readonly object _lockObject = new();

    public event EventHandler<Candle>? CandleUpdated;
    public event EventHandler<Candle>? CandleClosed;

    public CandleAggregator(AggregatorConfig config, ILogger<CandleAggregator> logger)
    {
        _config = config;
        _logger = logger;
        
        // Timer para fechar candles a cada minuto + delay
        var intervalMs = (_config.Aggregation.CandleIntervalSeconds + _config.Aggregation.CloseDelaySeconds) * 1000;
        _closeTimer = new Timer(CloseExpiredCandles, null, intervalMs, intervalMs);
    }

    /// <summary>
    /// Processa um tick e atualiza o candle correspondente
    /// </summary>
    public void ProcessTick(TickEvent tick)
    {
        try
        {
            var candleKey = GetCandleKey(tick.Symbol, tick.Exchange);
            var tickTimestamp = DateTimeOffset.FromUnixTimeSeconds((long)tick.Timestamp).UtcDateTime;
            var candleTimestamp = GetMinuteBucket(tickTimestamp);

            // Obtém ou cria o candle atual
            var candle = _currentCandles.GetOrAdd(candleKey, _ => new Candle
            {
                Symbol = tick.Symbol,
                Exchange = tick.Exchange,
                Timestamp = candleTimestamp,
                Open = tick.Price,
                High = tick.Price,
                Low = tick.Price,
                Close = tick.Price,
                Volume = 0,
                VolumeFinancial = 0,
                TickCount = 0,
                IsClosed = false
            });

            // Verifica se o tick pertence ao candle atual
            if (candle.Timestamp != candleTimestamp)
            {
                // Novo minuto - fecha o candle anterior e cria um novo
                lock (_lockObject)
                {
                    if (_currentCandles.TryGetValue(candleKey, out var oldCandle) && oldCandle.Timestamp == candle.Timestamp)
                    {
                        oldCandle.IsClosed = true;
                        CandleClosed?.Invoke(this, oldCandle);
                        _currentCandles.TryRemove(candleKey, out _);
                    }

                    candle = new Candle
                    {
                        Symbol = tick.Symbol,
                        Exchange = tick.Exchange,
                        Timestamp = candleTimestamp,
                        Open = tick.Price,
                        High = tick.Price,
                        Low = tick.Price,
                        Close = tick.Price,
                        Volume = tick.Quantity,
                        VolumeFinancial = tick.VolumeFinancial,
                        TickCount = 1,
                        IsClosed = false
                    };
                    _currentCandles[candleKey] = candle;
                }
            }
            else
            {
                // Atualiza o candle existente
                lock (_lockObject)
                {
                    candle.High = Math.Max(candle.High, tick.Price);
                    candle.Low = Math.Min(candle.Low, tick.Price);
                    candle.Close = tick.Price;
                    candle.Volume += tick.Quantity;
                    candle.VolumeFinancial += tick.VolumeFinancial;
                    candle.TickCount++;
                }
            }

            // Notifica atualização
            CandleUpdated?.Invoke(this, candle);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar tick para {Symbol} ({Exchange})", tick.Symbol, tick.Exchange);
        }
    }

    /// <summary>
    /// Obtém o candle atual para um símbolo/exchange
    /// </summary>
    public Candle? GetCurrentCandle(string symbol, string exchange)
    {
        var key = GetCandleKey(symbol, exchange);
        return _currentCandles.TryGetValue(key, out var candle) ? candle : null;
    }

    /// <summary>
    /// Fecha candles expirados (chamado pelo timer)
    /// </summary>
    private void CloseExpiredCandles(object? state)
    {
        try
        {
            var now = DateTime.UtcNow;
            var cutoffTime = now.AddSeconds(-_config.Aggregation.CloseDelaySeconds);
            var cutoffMinute = GetMinuteBucket(cutoffTime);

            var candlesToClose = new List<Candle>();

            lock (_lockObject)
            {
                foreach (var kvp in _currentCandles.ToList())
                {
                    var candle = kvp.Value;
                    if (candle.Timestamp < cutoffMinute && !candle.IsClosed)
                    {
                        candle.IsClosed = true;
                        candlesToClose.Add(candle);
                        _currentCandles.TryRemove(kvp.Key, out _);
                    }
                }
            }

            foreach (var candle in candlesToClose)
            {
                CandleClosed?.Invoke(this, candle);
                _logger.LogDebug("Candle fechado: {Symbol} ({Exchange}) em {Timestamp}", 
                    candle.Symbol, candle.Exchange, candle.Timestamp);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao fechar candles expirados");
        }
    }

    /// <summary>
    /// Obtém o bucket de minuto para um timestamp
    /// </summary>
    private DateTime GetMinuteBucket(DateTime timestamp)
    {
        return new DateTime(timestamp.Year, timestamp.Month, timestamp.Day, 
            timestamp.Hour, timestamp.Minute, 0, DateTimeKind.Utc);
    }

    /// <summary>
    /// Gera chave única para candle (symbol:exchange)
    /// </summary>
    private string GetCandleKey(string symbol, string exchange)
    {
        return $"{symbol}:{exchange}";
    }

    public void Dispose()
    {
        _closeTimer?.Dispose();
    }
}

