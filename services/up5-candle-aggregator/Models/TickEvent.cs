namespace Up5CandleAggregator.Models;

/// <summary>
/// Evento de tick recebido do NATS
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

