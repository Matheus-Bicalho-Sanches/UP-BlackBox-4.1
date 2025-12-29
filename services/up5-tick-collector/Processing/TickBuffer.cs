using System.Collections.Concurrent;

namespace Up5TickCollector.Processing;

/// <summary>
/// Buffer thread-safe circular para ticks
/// </summary>
public class TickBuffer
{
    private readonly ConcurrentQueue<TickEvent> _queue = new();
    private readonly int _maxSize;
    private int _currentSize = 0;

    public TickBuffer(int maxSize = 10000)
    {
        _maxSize = maxSize;
    }

    /// <summary>
    /// Adiciona um tick ao buffer (lock-free)
    /// </summary>
    public void Enqueue(TickEvent tick)
    {
        _queue.Enqueue(tick);
        var size = Interlocked.Increment(ref _currentSize);
        
        // Se exceder o tamanho máximo, remove o mais antigo
        if (size > _maxSize)
        {
            if (_queue.TryDequeue(out _))
            {
                Interlocked.Decrement(ref _currentSize);
            }
        }
    }

    /// <summary>
    /// Remove e retorna um tick do buffer
    /// </summary>
    public bool TryDequeue(out TickEvent? tick)
    {
        if (_queue.TryDequeue(out tick))
        {
            Interlocked.Decrement(ref _currentSize);
            return true;
        }
        return false;
    }

    /// <summary>
    /// Remove múltiplos ticks do buffer (até o limite especificado)
    /// </summary>
    public List<TickEvent> DequeueBatch(int maxCount)
    {
        var batch = new List<TickEvent>();
        while (batch.Count < maxCount && TryDequeue(out var tick) && tick != null)
        {
            batch.Add(tick);
        }
        return batch;
    }

    /// <summary>
    /// Retorna o tamanho atual do buffer
    /// </summary>
    public int Count => _currentSize;

    /// <summary>
    /// Limpa o buffer
    /// </summary>
    public void Clear()
    {
        while (_queue.TryDequeue(out _))
        {
            Interlocked.Decrement(ref _currentSize);
        }
    }
}

