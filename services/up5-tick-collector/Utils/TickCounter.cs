using System.Collections.Concurrent;

namespace Up5TickCollector.Utils;

/// <summary>
/// Contador simples de ticks recebidos para monitoramento
/// </summary>
public static class TickCounter
{
    private static readonly ConcurrentDictionary<string, long> _counters = new();
    private static long _totalTicks = 0;
    private static DateTime _startTime = DateTime.UtcNow;

    public static void Increment(string symbol, string exchange)
    {
        var key = $"{exchange}.{symbol}";
        _counters.AddOrUpdate(key, 1, (k, v) => v + 1);
        Interlocked.Increment(ref _totalTicks);
    }

    public static Dictionary<string, long> GetCounters()
    {
        return _counters.ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
    }

    public static long GetTotalTicks()
    {
        return _totalTicks;
    }

    public static TimeSpan GetUptime()
    {
        return DateTime.UtcNow - _startTime;
    }

    public static double GetTicksPerSecond()
    {
        var uptime = GetUptime().TotalSeconds;
        return uptime > 0 ? _totalTicks / uptime : 0;
    }

    public static void Reset()
    {
        _counters.Clear();
        Interlocked.Exchange(ref _totalTicks, 0);
        _startTime = DateTime.UtcNow;
    }
}

