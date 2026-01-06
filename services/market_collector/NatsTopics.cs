namespace MarketCollector;

/// <summary>
/// Constantes para os tópicos/canais NATS conforme definido no Passo 1 do plano.
/// Formato: {tipo}.{symbol} ou {tipo}.{symbol}.{timeframe}
/// </summary>
public static class NatsTopics
{
    /// <summary>
    /// Trades em tempo real: trades.{symbol}
    /// Exemplo: trades.WINZ25
    /// </summary>
    public static string Trades(string symbol) => $"trades.{symbol.ToUpperInvariant()}";

    /// <summary>
    /// Trades históricos: history_trades.{symbol}
    /// Exemplo: history_trades.PETR4
    /// </summary>
    public static string HistoryTrades(string symbol) => $"history_trades.{symbol.ToUpperInvariant()}";

    /// <summary>
    /// Snapshots do order book: order_book.snapshots.{symbol}
    /// Exemplo: order_book.snapshots.WINZ25
    /// </summary>
    public static string OrderBookSnapshots(string symbol) => $"order_book.snapshots.{symbol.ToUpperInvariant()}";

    /// <summary>
    /// Updates incrementais do order book: order_book.updates.{symbol}
    /// Exemplo: order_book.updates.WINZ25
    /// </summary>
    public static string OrderBookUpdates(string symbol) => $"order_book.updates.{symbol.ToUpperInvariant()}";

    /// <summary>
    /// Ofertas por agente: order_book.offers.{symbol}
    /// Exemplo: order_book.offers.WINZ25
    /// </summary>
    public static string OrderBookOffers(string symbol) => $"order_book.offers.{symbol.ToUpperInvariant()}";

    /// <summary>
    /// Candles derivados: candles.{symbol}.{timeframe}
    /// Exemplo: candles.WINZ25.1m
    /// </summary>
    public static string Candles(string symbol, string timeframe) => $"candles.{symbol.ToUpperInvariant()}.{timeframe.ToLowerInvariant()}";

    /// <summary>
    /// Indicadores: indicators.{symbol}.{timeframe}
    /// Exemplo: indicators.WINZ25.1m
    /// </summary>
    public static string Indicators(string symbol, string timeframe) => $"indicators.{symbol.ToUpperInvariant()}.{timeframe.ToLowerInvariant()}";
}
