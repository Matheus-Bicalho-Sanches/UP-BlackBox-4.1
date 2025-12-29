using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace MarketCollector.Models;

/// <summary>
/// Snapshot completo do livro de ofertas (order book).
/// Publicado no tópico: order_book.snapshots.{symbol}
/// </summary>
public class OrderBookSnapshotEvent
{
    [JsonPropertyName("type")]
    public string Type { get; set; } = "order_book_snapshot";

    [JsonPropertyName("symbol")]
    public string Symbol { get; set; } = string.Empty;

    /// <summary>
    /// Epoch float64: segundos desde 1970-01-01 UTC, com fração para milissegundos
    /// </summary>
    [JsonPropertyName("timestamp")]
    public double Timestamp { get; set; }

    [JsonPropertyName("bids")]
    public List<BookLevel> Bids { get; set; } = new();

    [JsonPropertyName("asks")]
    public List<BookLevel> Asks { get; set; } = new();
}

/// <summary>
/// Representa um nível no livro de ofertas
/// </summary>
public class BookLevel
{
    [JsonPropertyName("level")]
    public int Level { get; set; }

    [JsonPropertyName("price")]
    public double Price { get; set; }

    [JsonPropertyName("quantity")]
    public long Quantity { get; set; }

    [JsonPropertyName("orders_count")]
    public int? OrdersCount { get; set; }
}
