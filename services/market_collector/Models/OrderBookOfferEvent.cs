using System.Text.Json.Serialization;

namespace MarketCollector.Models;

/// <summary>
/// Oferta individual por agente (tape reading).
/// Publicado no tópico: order_book.offers.{symbol}
/// </summary>
public class OrderBookOfferEvent
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "order_book_offer";

    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;

    /// <summary>
    /// Epoch float64: segundos desde 1970-01-01 UTC, com fração para milissegundos
    /// </summary>
    [JsonPropertyName("timestamp")]
    public double Timestamp { get; set; }

    /// <summary>
    /// Código da ação: 0=adicionar, 1=atualizar, 2=remover, etc.
    /// </summary>
    [JsonPropertyName("action")]
    public int Action { get; set; }

    [JsonPropertyName("position")]
    public int? Position { get; set; }

    /// <summary>
    /// 0 = bid, 1 = ask
    /// </summary>
    [JsonPropertyName("side")]
    public int Side { get; set; }

    [JsonPropertyName("quantity")]
    public long? Quantity { get; set; }

    [JsonPropertyName("agent_id")]
    public int? AgentId { get; set; }

    [JsonPropertyName("offer_id")]
    public long? OfferId { get; set; }

    [JsonPropertyName("price")]
    public double? Price { get; set; }
}
