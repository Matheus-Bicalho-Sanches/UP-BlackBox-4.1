using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Up5CandleAggregator.Aggregation;
using Up5CandleAggregator.Config;
using Up5CandleAggregator.Consuming;
using Up5CandleAggregator.Models;
using Up5CandleAggregator.Persistence;
using Up5CandleAggregator.Publishing;

var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddEnvironmentVariables()
    .Build();

var config = new AggregatorConfig();
configuration.GetSection("Nats").Bind(config.Nats);
configuration.GetSection("Postgres").Bind(config.Postgres);
configuration.GetSection("Aggregation").Bind(config.Aggregation);

var loggerFactory = LoggerFactory.Create(builder =>
{
    builder
        .AddConfiguration(configuration.GetSection("Logging"))
        .AddConsole();
});

var logger = loggerFactory.CreateLogger<Program>();

logger.LogInformation("=== UP 5.0 Candle Aggregator ===");
logger.LogInformation("Iniciando serviço de agregação de candles...");

try
{
    // Cria componentes
    var aggregator = new CandleAggregator(config, loggerFactory.CreateLogger<CandleAggregator>());
    var natsConsumer = new NatsConsumer(config, loggerFactory.CreateLogger<NatsConsumer>());
    var candlePublisher = new CandlePublisher(config, loggerFactory.CreateLogger<CandlePublisher>());
    var persistence = new PostgresCandlePersistence(config, loggerFactory.CreateLogger<PostgresCandlePersistence>());

    // Conecta publishers
    candlePublisher.Connect();

    // Conecta consumer e faz subscribe
    natsConsumer.ConnectAndSubscribe();

    // Eventos: Tick -> Aggregator -> Publisher + Persistence
    natsConsumer.TickReceived += (sender, tick) =>
    {
        aggregator.ProcessTick(tick);
    };

    aggregator.CandleUpdated += (sender, candle) =>
    {
        // Publica candle atualizado no NATS
        candlePublisher.PublishCandle(candle);
    };

    aggregator.CandleClosed += (sender, candle) =>
    {
        // Persiste candle fechado
        persistence.EnqueueCandle(candle);
        // Também publica o candle fechado
        candlePublisher.PublishCandle(candle);
    };

    logger.LogInformation("Serviço iniciado com sucesso!");
    logger.LogInformation("Aguardando ticks do NATS...");

    // Mantém o processo rodando
    Console.CancelKeyPress += (sender, e) =>
    {
        e.Cancel = true;
        logger.LogInformation("Encerrando serviço...");
        natsConsumer.Dispose();
        candlePublisher.Dispose();
        persistence.Dispose();
        aggregator.Dispose();
        Environment.Exit(0);
    };

    // Aguarda indefinidamente
    Thread.Sleep(Timeout.Infinite);
}
catch (Exception ex)
{
    logger.LogError(ex, "Erro fatal ao iniciar serviço");
    Environment.Exit(1);
}
