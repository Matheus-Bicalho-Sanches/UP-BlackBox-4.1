namespace Up5TickCollector.Processing;

/// <summary>
/// Evento de tick processado
/// </summary>
public class TickEvent
{
    public string Symbol { get; set; } = string.Empty;
    public string Exchange { get; set; } = string.Empty;
    public double Timestamp { get; set; } // Epoch em segundos com fração para milissegundos
    public double Price { get; set; }
    public long Quantity { get; set; }
    public double VolumeFinancial { get; set; }
    public uint TradeId { get; set; }
    public byte TradeType { get; set; }
    public int BuyAgent { get; set; }
    public int SellAgent { get; set; }
    public bool IsEdit { get; set; }
}

/// <summary>
/// Evento de atualização de price book
/// </summary>
public class PriceBookEvent
{
    public string Symbol { get; set; } = string.Empty;
    public string Exchange { get; set; } = string.Empty;
    public double Timestamp { get; set; }
    public int Action { get; set; }
    public int Position { get; set; }
    public int Side { get; set; } // 1 = Buy, 2 = Sell
    public long Quantity { get; set; }
    public int Count { get; set; }
    public double Price { get; set; }
}

/// <summary>
/// Evento de atualização de offer book
/// </summary>
public class OfferBookEvent
{
    public string Symbol { get; set; } = string.Empty;
    public string Exchange { get; set; } = string.Empty;
    public double Timestamp { get; set; }
    public int Action { get; set; }
    public int Position { get; set; }
    public int Side { get; set; }
    public long Quantity { get; set; }
    public int Agent { get; set; }
    public long OfferId { get; set; }
    public double Price { get; set; }
    public string Date { get; set; } = string.Empty;
}

/// <summary>
/// Estado de conexão
/// </summary>
public enum ConnectionState
{
    Disconnected,
    Connecting,
    Connected,
    Reconnecting,
    Error
}

