using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Up5TickCollector.Config;
using Up5TickCollector.Core;
using Up5TickCollector.Processing;

namespace Up5TickCollector.Processing;

/// <summary>
/// Processador paralelo de ticks com batching e backpressure
/// </summary>
public class TickProcessor : IDisposable
{
    private readonly CollectorConfig _config;
    private readonly ILogger<TickProcessor> _logger;
    private readonly ProfitDllConnector _connector;
    private readonly TickBuffer _tickBuffer;
    private readonly Dictionary<string, List<TickEvent>> _batchBuffers = new();
    private readonly object _batchLock = new();
    
    private CancellationTokenSource? _cancellationTokenSource;
    private Task[]? _workerTasks;
    private bool _isDisposed = false;

    // Events
    public event Action<List<TickEvent>>? OnBatchReady;

    public TickProcessor(
        CollectorConfig config,
        ILogger<TickProcessor> logger,
        ProfitDllConnector connector)
    {
        _config = config;
        _logger = logger;
        _connector = connector;
        _tickBuffer = new TickBuffer(_config.Processing.BufferSize);
        
        // Subscribe to connector events
        _connector.OnTickReceived += OnTickReceived;
    }

    /// <summary>
    /// Inicia o processamento paralelo
    /// </summary>
    public void Start()
    {
        if (_workerTasks != null)
        {
            _logger.LogWarning("TickProcessor já está rodando");
            return;
        }

        _cancellationTokenSource = new CancellationTokenSource();
        _workerTasks = new Task[_config.Processing.WorkerThreads];

        _logger.LogInformation("Iniciando {ThreadCount} worker threads para processamento de ticks", _config.Processing.WorkerThreads);

        for (int i = 0; i < _config.Processing.WorkerThreads; i++)
        {
            var threadIndex = i;
            _workerTasks[i] = Task.Run(() => WorkerThread(threadIndex, _cancellationTokenSource.Token));
        }

        // Thread para processar eventos da DLL
        Task.Run(() => ProcessConnectorEvents(_cancellationTokenSource.Token));
    }

    /// <summary>
    /// Para o processamento
    /// </summary>
    public void Stop()
    {
        _cancellationTokenSource?.Cancel();
        
        if (_workerTasks != null)
        {
            Task.WaitAll(_workerTasks, TimeSpan.FromSeconds(5));
            _workerTasks = null;
        }

        _cancellationTokenSource?.Dispose();
        _cancellationTokenSource = null;
    }

    private void OnTickReceived(TickEvent tick)
    {
        // Enfileira no buffer (lock-free)
        _tickBuffer.Enqueue(tick);
    }

    private void ProcessConnectorEvents(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                // Processa eventos enfileirados na DLL
                _connector.ProcessQueuedEvents();
                
                Thread.Sleep(1); // Pequeno delay para não consumir CPU
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao processar eventos da DLL");
            }
        }
    }

    private void WorkerThread(int threadIndex, CancellationToken cancellationToken)
    {
        _logger.LogInformation("Worker thread {Index} iniciada", threadIndex);

        var lastBatchTime = DateTime.UtcNow;

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                // Tenta remover um batch do buffer
                var batch = _tickBuffer.DequeueBatch(_config.Processing.BatchSize);
                
                if (batch.Count > 0)
                {
                    // Agrupa por símbolo para batching inteligente
                    var grouped = batch.GroupBy(t => $"{t.Symbol}:{t.Exchange}");
                    
                    foreach (var group in grouped)
                    {
                        lock (_batchLock)
                        {
                            if (!_batchBuffers.ContainsKey(group.Key))
                            {
                                _batchBuffers[group.Key] = new List<TickEvent>();
                            }
                            _batchBuffers[group.Key].AddRange(group);
                        }
                    }

                    // Verifica se deve enviar batch (por tempo ou tamanho)
                    var now = DateTime.UtcNow;
                    var timeSinceLastBatch = (now - lastBatchTime).TotalMilliseconds;
                    
                    if (timeSinceLastBatch >= _config.Processing.BatchIntervalMs)
                    {
                        FlushBatches();
                        lastBatchTime = now;
                    }
                }
                else
                {
                    // Sem ticks, aguarda um pouco
                    Thread.Sleep(10);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no worker thread {Index}", threadIndex);
            }
        }

        // Flush final ao parar
        FlushBatches();
        
        _logger.LogInformation("Worker thread {Index} finalizada", threadIndex);
    }

    private void FlushBatches()
    {
        lock (_batchLock)
        {
            foreach (var kvp in _batchBuffers.ToList())
            {
                if (kvp.Value.Count > 0)
                {
                    var batch = new List<TickEvent>(kvp.Value);
                    kvp.Value.Clear();
                    
                    OnBatchReady?.Invoke(batch);
                }
            }
        }
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        Stop();
        _tickBuffer.Clear();
        
        if (_connector != null)
        {
            _connector.OnTickReceived -= OnTickReceived;
        }

        _isDisposed = true;
    }
}

