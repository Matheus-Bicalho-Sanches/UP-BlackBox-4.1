namespace Up5CandleAggregator.Models;

/// <summary>
/// Candle de 1 minuto agregado
/// </summary>
public class Candle
{
    public string Symbol { get; set; } = string.Empty;
    public string Exchange { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } // Timestamp do minuto (sem segundos)
    public double Open { get; set; }
    public double High { get; set; }
    public double Low { get; set; }
    public double Close { get; set; }
    public long Volume { get; set; }
    public double VolumeFinancial { get; set; }
    public int TickCount { get; set; }
    public bool IsClosed { get; set; } // Indica se o candle foi fechado (minuto encerrado)
}

