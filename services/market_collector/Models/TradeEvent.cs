using System;
using System.Text.Json.Serialization;

namespace MarketCollector.Models;

/// <summary>
/// Evento de trade (tick) em tempo real recebido da DLL.
/// Publicado no tópico: trades.{symbol}
/// </summary>
public class TradeEvent
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "trade";

    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;

    /// <summary>
    /// Epoch float64: segundos desde 1970-01-01 UTC, com fração para milissegundos
    /// </summary>
    [JsonPropertyName("timestamp")]
    public double Timestamp { get; set; }

    [JsonPropertyName("price")]
    public double Price { get; set; }

    [JsonPropertyName("quantity")]
    public long Quantity { get; set; }

    [JsonPropertyName("volume_financial")]
    public double? VolumeFinancial { get; set; }

    [JsonPropertyName("trade_id")]
    public uint TradeId { get; set; }

    [JsonPropertyName("trade_type")]
    public int? TradeType { get; set; }

    [JsonPropertyName("buy_agent")]
    public int? BuyAgent { get; set; }

    [JsonPropertyName("sell_agent")]
    public int? SellAgent { get; set; }

    [JsonPropertyName("is_edit")]
    public bool IsEdit { get; set; }
}
