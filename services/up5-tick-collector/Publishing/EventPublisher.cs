namespace Up5TickCollector.Publishing;

/// <summary>
/// Interface para publicação de eventos
/// </summary>
public interface IEventPublisher
{
    Task PublishTickBatchAsync(List<Processing.TickEvent> ticks);
    Task PublishPriceBookAsync(Processing.PriceBookEvent book);
    Task PublishOfferBookAsync(Processing.OfferBookEvent offer);
    Task<bool> IsConnectedAsync();
}

