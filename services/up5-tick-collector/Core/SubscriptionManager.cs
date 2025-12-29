using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Google.Cloud.Firestore;
using Google.Apis.Auth.OAuth2;
using System.IO;
using Microsoft.Extensions.Logging;
using Up5TickCollector.Config;
using Up5TickCollector.Core;

namespace Up5TickCollector.Core;

/// <summary>
/// Gerenciador de inscrições dinâmicas de ativos
/// Sincroniza com Firestore collection activeSubscriptions
/// </summary>
public class SubscriptionManager : IDisposable
{
    private readonly CollectorConfig _config;
    private readonly ILogger<SubscriptionManager> _logger;
    private readonly ProfitDllConnector _connector;
    private FirestoreDb? _firestoreDb;
    private FirestoreChangeListener? _listener;
    private readonly Dictionary<string, SubscriptionInfo> _currentSubscriptions = new();
    private readonly object _subscriptionLock = new();
    private bool _isDisposed = false;

    private class SubscriptionInfo
    {
        public string Ticker { get; set; } = string.Empty;
        public string Exchange { get; set; } = string.Empty;
        public DateTime LastUpdated { get; set; }
    }

    public SubscriptionManager(
        CollectorConfig config,
        ILogger<SubscriptionManager> logger,
        ProfitDllConnector connector)
    {
        _config = config;
        _logger = logger;
        _connector = connector;
        
        // Subscribe to connection state changes para retry de subscriptions
        _connector.OnConnectionStateChanged += OnConnectorStateChanged;
    }
    
    private void OnConnectorStateChanged(Processing.ConnectionState state)
    {
        if (state == Processing.ConnectionState.Connected)
        {
            // Quando a DLL conectar, tenta fazer subscribe novamente nos ativos que falharam
            _ = Task.Run(async () =>
            {
                await Task.Delay(1000); // Pequeno delay para garantir que a DLL está pronta
                RetryFailedSubscriptions();
            });
        }
    }
    
    private void RetryFailedSubscriptions()
    {
        lock (_subscriptionLock)
        {
            foreach (var subscription in _currentSubscriptions.Values.ToList())
            {
                var key = $"{subscription.Ticker}:{subscription.Exchange}";
                var subscribedAssets = _connector.GetSubscribedAssets();
                
                if (!subscribedAssets.Contains(key))
                {
                    _logger.LogInformation("Tentando fazer subscribe novamente em {Ticker} ({Exchange}) após conexão", subscription.Ticker, subscription.Exchange);
                    var result = _connector.Subscribe(subscription.Ticker, subscription.Exchange);
                    if (result)
                    {
                        _logger.LogInformation("Subscribe bem-sucedido em {Ticker} ({Exchange})", subscription.Ticker, subscription.Exchange);
                    }
                    else
                    {
                        _logger.LogWarning("Falha ao fazer subscribe em {Ticker} ({Exchange})", subscription.Ticker, subscription.Exchange);
                    }
                }
            }
        }
    }

    /// <summary>
    /// Inicializa o gerenciador e conecta ao Firestore
    /// </summary>
    public async Task InitializeAsync()
    {
        if (string.IsNullOrEmpty(_config.Firestore.ProjectId))
        {
            _logger.LogWarning("Firestore ProjectId não configurado. SubscriptionManager não será inicializado.");
            return;
        }

        try
        {
            // Tenta configurar credenciais
            GoogleCredential? credential = null;
            
            // Opção 1: Arquivo de credenciais
            if (!string.IsNullOrEmpty(_config.Firestore.CredentialsPath) && File.Exists(_config.Firestore.CredentialsPath))
            {
                using var stream = new FileStream(_config.Firestore.CredentialsPath, FileMode.Open, FileAccess.Read);
                credential = GoogleCredential.FromStream(stream);
                _logger.LogInformation("Usando credenciais do arquivo: {Path}", _config.Firestore.CredentialsPath);
            }
            // Opção 2: Variável de ambiente GOOGLE_APPLICATION_CREDENTIALS
            else
            {
                var googleCredsPath = Environment.GetEnvironmentVariable("GOOGLE_APPLICATION_CREDENTIALS");
                
                if (!string.IsNullOrEmpty(googleCredsPath) && File.Exists(googleCredsPath))
                {
                    using var stream = new FileStream(googleCredsPath, FileMode.Open, FileAccess.Read);
                    credential = GoogleCredential.FromStream(stream);
                    _logger.LogInformation("Usando credenciais de GOOGLE_APPLICATION_CREDENTIALS: {Path}", googleCredsPath);
                }
            }
            
            // Opção 3: Credenciais via variáveis de ambiente (como no Next.js)
            if (credential == null)
            {
                var envPrivateKey = Environment.GetEnvironmentVariable("FIREBASE_PRIVATE_KEY");
                var envClientEmail = Environment.GetEnvironmentVariable("FIREBASE_CLIENT_EMAIL");
                var envPrivateKeyId = Environment.GetEnvironmentVariable("FIREBASE_PRIVATE_KEY_ID");
                var envClientId = Environment.GetEnvironmentVariable("FIREBASE_CLIENT_ID");
                var envCertUrl = Environment.GetEnvironmentVariable("FIREBASE_CERT_URL");
                
                if (!string.IsNullOrEmpty(envPrivateKey) && !string.IsNullOrEmpty(envClientEmail))
                {
                    try
                    {
                        var credJson = $@"{{
  ""type"": ""service_account"",
  ""project_id"": ""{_config.Firestore.ProjectId}"",
  ""private_key_id"": ""{envPrivateKeyId ?? ""}"",
  ""private_key"": ""{envPrivateKey.Replace("\\n", "\n")}"",
  ""client_email"": ""{envClientEmail}"",
  ""client_id"": ""{envClientId ?? ""}"",
  ""auth_uri"": ""https://accounts.google.com/o/oauth2/auth"",
  ""token_uri"": ""https://oauth2.googleapis.com/token"",
  ""auth_provider_x509_cert_url"": ""https://www.googleapis.com/oauth2/v1/certs"",
  ""client_x509_cert_url"": ""{envCertUrl ?? ""}""
}}";
                        credential = GoogleCredential.FromJson(credJson);
                        _logger.LogInformation("Usando credenciais de variáveis de ambiente FIREBASE_*");
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Erro ao criar credenciais a partir de variáveis de ambiente");
                    }
                }
            }
            
            // Opção 4: Config do appsettings.json
            if (credential == null && !string.IsNullOrEmpty(_config.Firestore.PrivateKey) && !string.IsNullOrEmpty(_config.Firestore.ClientEmail))
            {
                var credJson = $@"{{
  ""type"": ""service_account"",
  ""project_id"": ""{_config.Firestore.ProjectId}"",
  ""private_key_id"": """",
  ""private_key"": ""{_config.Firestore.PrivateKey.Replace("\\n", "\n")}"",
  ""client_email"": ""{_config.Firestore.ClientEmail}"",
  ""client_id"": """",
  ""auth_uri"": ""https://accounts.google.com/o/oauth2/auth"",
  ""token_uri"": ""https://oauth2.googleapis.com/token"",
  ""auth_provider_x509_cert_url"": ""https://www.googleapis.com/oauth2/v1/certs"",
  ""client_x509_cert_url"": """"
}}";
                credential = GoogleCredential.FromJson(credJson);
                _logger.LogInformation("Usando credenciais do appsettings.json");
            }
            
            // Cria FirestoreDb com ou sem credenciais
            if (credential != null)
            {
                var builder = new FirestoreDbBuilder
                {
                    ProjectId = _config.Firestore.ProjectId,
                    Credential = credential
                };
                _firestoreDb = builder.Build();
            }
            else
            {
                _logger.LogWarning("Nenhuma credencial encontrada. Tentando usar Application Default Credentials (pode falhar)...");
                // Tenta usar Application Default Credentials (ADC)
                _firestoreDb = FirestoreDb.Create(_config.Firestore.ProjectId);
            }
            
            _logger.LogInformation("Conectado ao Firestore: {ProjectId}", _config.Firestore.ProjectId);

            // Carrega subscriptions iniciais
            await LoadInitialSubscriptionsAsync();

            // Inicia listener em tempo real
            StartRealtimeListener();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao inicializar SubscriptionManager");
            throw;
        }
    }

    private async Task LoadInitialSubscriptionsAsync()
    {
        if (_firestoreDb == null)
        {
            return;
        }

        try
        {
            var collection = _firestoreDb.Collection(_config.Firestore.CollectionName);
            var snapshot = await collection.GetSnapshotAsync();

            _logger.LogInformation("Carregando {Count} subscriptions iniciais do Firestore", snapshot.Count);

            lock (_subscriptionLock)
            {
                foreach (var doc in snapshot.Documents)
                {
                    var data = doc.ToDictionary();
                    var ticker = doc.Id;
                    var exchange = data.ContainsKey("exchange") ? data["exchange"]?.ToString() ?? "B" : "B";

                    _currentSubscriptions[ticker] = new SubscriptionInfo
                    {
                        Ticker = ticker,
                        Exchange = exchange,
                        LastUpdated = DateTime.UtcNow
                    };

                    // Subscribe na DLL
                    _connector.Subscribe(ticker, exchange);
                }
            }

            _logger.LogInformation("Carregadas {Count} subscriptions", _currentSubscriptions.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao carregar subscriptions iniciais");
        }
    }

    private void StartRealtimeListener()
    {
        if (_firestoreDb == null)
        {
            return;
        }

        try
        {
            var collection = _firestoreDb.Collection(_config.Firestore.CollectionName);
            
            _listener = collection.Listen(snapshot =>
            {
                try
                {
                    ProcessSnapshot(snapshot);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Erro ao processar snapshot do Firestore");
                }
            });

            _logger.LogInformation("Listener do Firestore iniciado para collection {Collection}", _config.Firestore.CollectionName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao iniciar listener do Firestore");
        }
    }

    private void ProcessSnapshot(QuerySnapshot snapshot)
    {
        lock (_subscriptionLock)
        {
            var currentTickers = new HashSet<string>(_currentSubscriptions.Keys);
            var firestoreTickers = new HashSet<string>();

            // Processa documentos no snapshot
            foreach (var doc in snapshot.Documents)
            {
                var ticker = doc.Id;
                firestoreTickers.Add(ticker);

                var data = doc.ToDictionary();
                var exchange = data.ContainsKey("exchange") ? data["exchange"]?.ToString() ?? "B" : "B";

                if (!_currentSubscriptions.ContainsKey(ticker))
                {
                    // Nova subscription
                    _logger.LogInformation("Nova subscription detectada: {Ticker} ({Exchange})", ticker, exchange);
                    _currentSubscriptions[ticker] = new SubscriptionInfo
                    {
                        Ticker = ticker,
                        Exchange = exchange,
                        LastUpdated = DateTime.UtcNow
                    };

                    // Subscribe na DLL
                    if (!_connector.Subscribe(ticker, exchange))
                    {
                        _logger.LogWarning("Falha ao inscrever {Ticker} na DLL", ticker);
                    }
                }
                else
                {
                    // Atualiza informação existente
                    _currentSubscriptions[ticker].Exchange = exchange;
                    _currentSubscriptions[ticker].LastUpdated = DateTime.UtcNow;
                }
            }

            // Remove subscriptions que não estão mais no Firestore
            var toRemove = currentTickers.Except(firestoreTickers).ToList();
            foreach (var ticker in toRemove)
            {
                _logger.LogInformation("Subscription removida: {Ticker}", ticker);
                
                if (_currentSubscriptions.TryGetValue(ticker, out var info))
                {
                    _connector.Unsubscribe(info.Ticker, info.Exchange);
                    _currentSubscriptions.Remove(ticker);
                }
            }
        }
    }

    /// <summary>
    /// Retorna lista de subscriptions ativas
    /// </summary>
    public List<(string Ticker, string Exchange)> GetActiveSubscriptions()
    {
        lock (_subscriptionLock)
        {
            return _currentSubscriptions.Values
                .Select(s => (s.Ticker, s.Exchange))
                .ToList();
        }
    }

    public void Dispose()
    {
        if (_isDisposed)
        {
            return;
        }

        _listener?.StopAsync();
        _listener = null;
        _isDisposed = true;
    }
}

