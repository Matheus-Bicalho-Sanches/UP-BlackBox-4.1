using System.Text.Json.Serialization;

namespace MarketCollector.Models;

/// <summary>
/// Atualização incremental do livro de ofertas (delta).
/// Publicado no tópico: order_book.updates.{symbol}
/// </summary>
public class OrderBookUpdateEvent
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "order_book_update";

    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;

    /// <summary>
    /// Epoch float64: segundos desde 1970-01-01 UTC, com fração para milissegundos
    /// </summary>
    [JsonPropertyName("timestamp")]
    public double Timestamp { get; set; }

    /// <summary>
    /// Código de ação: 0=atAdd, 1=atEdit, 2=atDelete, 3=atDeleteFrom, 4=atFullBook
    /// </summary>
    [JsonPropertyName("action")]
    public int Action { get; set; }

    /// <summary>
    /// 0 = bid (compra), 1 = ask (venda)
    /// </summary>
    [JsonPropertyName("side")]
    public int Side { get; set; }

    [JsonPropertyName("position")]
    public int? Position { get; set; }

    [JsonPropertyName("price")]
    public double? Price { get; set; }

    [JsonPropertyName("quantity")]
    public long? Quantity { get; set; }

    [JsonPropertyName("offer_count")]
    public int? OfferCount { get; set; }
}
