using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Up5TickCollector.Config;
using Up5TickCollector.Core;
using Up5TickCollector.Processing;

namespace Up5TickCollector.Core;

/// <summary>
/// Gerenciador de estado de conexão com auto-reconexão
/// </summary>
public class ConnectionManager : IDisposable
{
    private readonly CollectorConfig _config;
    private readonly ILogger<ConnectionManager> _logger;
    private readonly ProfitDllConnector _connector;
    private ConnectionState _currentState = ConnectionState.Disconnected;
    private CancellationTokenSource? _monitorCancellation;
    private Task? _monitorTask;
    private int _reconnectAttempts = 0;
    private bool _isDisposed = false;

    public event Action<ConnectionState>? OnStateChanged;

    public ConnectionState CurrentState
    {
        get => _currentState;
        private set
        {
            if (_currentState != value)
            {
                _currentState = value;
                OnStateChanged?.Invoke(value);
                _logger.LogInformation("Estado de conexão alterado para: {State}", value);
            }
        }
    }

    public ConnectionManager(
        CollectorConfig config,
        ILogger<ConnectionManager> logger,
        ProfitDllConnector connector)
    {
        _config = config;
        _logger = logger;
        _connector = connector;
        
        // Subscribe to connector events
        _connector.OnConnectionStateChanged += OnConnectorStateChanged;
    }

    /// <summary>
    /// Inicia o monitoramento de conexão
    /// </summary>
    public void Start()
    {
        if (_monitorTask != null)
        {
            return;
        }

        _monitorCancellation = new CancellationTokenSource();
        _monitorTask = Task.Run(() => MonitorConnection(_monitorCancellation.Token));
        
        _logger.LogInformation("ConnectionManager iniciado");
    }

    /// <summary>
    /// Para o monitoramento
    /// </summary>
    public void Stop()
    {
        _monitorCancellation?.Cancel();
        _monitorTask?.Wait(TimeSpan.FromSeconds(5));
        _monitorTask = null;
        _monitorCancellation?.Dispose();
        _monitorCancellation = null;
    }

    private void OnConnectorStateChanged(ConnectionState state)
    {
        CurrentState = state;

        if (state == ConnectionState.Disconnected && _config.ProfitDll.AutoReconnect)
        {
            _logger.LogInformation("Conexão perdida. Iniciando reconexão automática...");
            _ = Task.Run(() => AttemptReconnectAsync());
        }
        else if (state == ConnectionState.Connected)
        {
            _reconnectAttempts = 0; // Reset contador ao conectar
        }
    }

    private async Task AttemptReconnectAsync()
    {
        if (!_config.ProfitDll.AutoReconnect)
        {
            return;
        }

        while (CurrentState == ConnectionState.Disconnected && !_monitorCancellation?.Token.IsCancellationRequested == true)
        {
            _reconnectAttempts++;
            var delay = Math.Min(
                _config.ProfitDll.ReconnectDelayMs * (int)Math.Pow(2, _reconnectAttempts - 1),
                60000 // Max 60 segundos
            );

            _logger.LogInformation("Tentativa de reconexão {Attempt} em {Delay}ms", _reconnectAttempts, delay);
            CurrentState = ConnectionState.Reconnecting;

            await Task.Delay(delay, _monitorCancellation?.Token ?? CancellationToken.None);

            try
            {
                _connector.Initialize();
                // O estado será atualizado via callback
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro na tentativa de reconexão {Attempt}", _reconnectAttempts);
                CurrentState = ConnectionState.Error;
            }
        }
    }

    private async Task MonitorConnection(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                // Health check periódico
                if (CurrentState == ConnectionState.Connected)
                {
                    // Verifica se ainda está conectado (pode adicionar ping/heartbeat aqui)
                }

                await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no monitor de conexão");
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
        
        if (_connector != null)
        {
            _connector.OnConnectionStateChanged -= OnConnectorStateChanged;
        }

        _isDisposed = true;
    }
}

