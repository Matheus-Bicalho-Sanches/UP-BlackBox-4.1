using System.Collections.Generic;
using System.Threading.Tasks;
using Up5TickCollector.Processing;

namespace Up5TickCollector.Persistence;

/// <summary>
/// Interface para persistência de ticks
/// </summary>
public interface ITickPersistence
{
    Task PersistBatchAsync(List<TickEvent> ticks);
    Task<bool> IsConnectedAsync();
}

