namespace Up5TickCollector.Config;

public class CollectorConfig
{
    public ProfitDllConfig ProfitDll { get; set; } = new();
    public ProcessingConfig Processing { get; set; } = new();
    public NatsConfig Nats { get; set; } = new();
    public PostgresConfig Postgres { get; set; } = new();
    public FirestoreConfig Firestore { get; set; } = new();
}

public class ProfitDllConfig
{
    public string DllPath { get; set; } = "ProfitDLL.dll";
    public string ActivationKey { get; set; } = string.Empty;
    public string User { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool AutoReconnect { get; set; } = true;
    public int ReconnectDelayMs { get; set; } = 5000;
}

public class ProcessingConfig
{
    public int WorkerThreads { get; set; } = 4;
    public int BufferSize { get; set; } = 10000;
    public int BatchSize { get; set; } = 50;
    public int BatchIntervalMs { get; set; } = 100;
}

public class NatsConfig
{
    public string Url { get; set; } = "nats://localhost:4222";
    public string SubjectPrefix { get; set; } = "up5";
}

public class PostgresConfig
{
    public string ConnectionString { get; set; } = string.Empty;
    public int BatchSize { get; set; } = 200;
    public int BatchIntervalMs { get; set; } = 500;
    public int MaxRetries { get; set; } = 5;
    public int RetryDelayMs { get; set; } = 100;
}

public class FirestoreConfig
{
    public string ProjectId { get; set; } = string.Empty;
    public string CollectionName { get; set; } = "activeSubscriptions";
    public string? CredentialsPath { get; set; } // Caminho para arquivo JSON de credenciais
    public string? PrivateKey { get; set; } // Chave privada (de variável de ambiente)
    public string? ClientEmail { get; set; } // Email do cliente (de variável de ambiente)
}

