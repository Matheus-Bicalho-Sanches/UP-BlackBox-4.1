namespace Up5CandleAggregator.Config;

public class AggregatorConfig
{
    public NatsConfig Nats { get; set; } = new();
    public PostgresConfig Postgres { get; set; } = new();
    public AggregationConfig Aggregation { get; set; } = new();
}

public class NatsConfig
{
    public string Url { get; set; } = "nats://localhost:4222";
    public string SubjectPrefix { get; set; } = "up5";
    public string TickSubjectPattern { get; set; } = "up5.ticks.{exchange}.{symbol}";
    public string CandleSubjectPattern { get; set; } = "up5.candles.{exchange}.{symbol}.1m";
}

public class PostgresConfig
{
    public string ConnectionString { get; set; } = string.Empty;
    public int BatchSize { get; set; } = 100;
    public int BatchIntervalMs { get; set; } = 1000;
    public int MaxRetries { get; set; } = 5;
    public int RetryDelayMs { get; set; } = 100;
}

public class AggregationConfig
{
    public int CandleIntervalSeconds { get; set; } = 60;
    public int CloseDelaySeconds { get; set; } = 2;
    public int MaxCandlesInMemory { get; set; } = 1000;
}

