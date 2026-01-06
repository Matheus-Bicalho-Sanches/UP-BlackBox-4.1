using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Up5TickCollector.Config;
using Up5TickCollector.Core;
using Up5TickCollector.Persistence;
using Up5TickCollector.Publishing;
using Up5TickCollector.Processing;
using Up5TickCollector.Utils;
using DotNetEnv;

namespace Up5TickCollector;

class Program
{
    static async Task Main(string[] args)
    {
        // Carrega variáveis de ambiente do .env.local se existir
        LoadEnvFileIfExists();
        
        // Configuração
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddEnvironmentVariables()
            .Build();

        var config = new CollectorConfig();
        configuration.Bind(config);

        // Logging
        using var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder
                .AddConsole()
                .SetMinimumLevel(LogLevel.Information);
        });

        var logger = loggerFactory.CreateLogger<Program>();
        logger.LogInformation("=== UP 5.0 Tick Collector Iniciando ===");

        try
        {
            // Cria serviços
            var connector = new ProfitDllConnector(config, loggerFactory.CreateLogger<ProfitDllConnector>());
            var connectionManager = new ConnectionManager(config, loggerFactory.CreateLogger<ConnectionManager>(), connector);
            var tickProcessor = new TickProcessor(config, loggerFactory.CreateLogger<TickProcessor>(), connector);
            var natsPublisher = new NatsPublisher(config, loggerFactory.CreateLogger<NatsPublisher>());
            var postgresPersistence = new PostgresPersistence(config, loggerFactory.CreateLogger<PostgresPersistence>());
            var subscriptionManager = new SubscriptionManager(config, loggerFactory.CreateLogger<SubscriptionManager>(), connector);

            // Conecta ao NATS
            try
            {
                natsPublisher.Connect();
                logger.LogInformation("NATS conectado");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Erro ao conectar ao NATS. Continuando sem publicação...");
            }

            // Conecta ao PostgreSQL
            try
            {
                await postgresPersistence.ConnectAsync();
                logger.LogInformation("PostgreSQL conectado");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Erro ao conectar ao PostgreSQL. Continuando sem persistência...");
            }

            // Inicializa DLL PRIMEIRO (antes do SubscriptionManager)
            connector.Initialize();

            // Inicia ConnectionManager
            connectionManager.Start();

            // Aguarda conexão com market data antes de inicializar SubscriptionManager
            var connectionEvent = new ManualResetEventSlim(false);
            ConnectionState? currentState = null;
            
            connector.OnConnectionStateChanged += (state) =>
            {
                currentState = state;
                if (state == ConnectionState.Connected)
                {
                    connectionEvent.Set();
                }
            };

            // Aguarda até 30 segundos pela conexão
            if (connectionEvent.Wait(TimeSpan.FromSeconds(30)))
            {
                logger.LogInformation("Market data conectado. Inicializando SubscriptionManager...");
            }
            else
            {
                logger.LogWarning("Timeout aguardando conexão com market data. Inicializando SubscriptionManager mesmo assim...");
            }

            // Inicializa SubscriptionManager DEPOIS que a DLL está conectada
            try
            {
                await subscriptionManager.InitializeAsync();
                logger.LogInformation("SubscriptionManager inicializado");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Erro ao inicializar SubscriptionManager. Continuando sem sincronização Firestore...");
            }

            // Inicia TickProcessor
            tickProcessor.Start();

            // Subscribe to events
            tickProcessor.OnBatchReady += async (batch) =>
            {
                // Publica no NATS
                await natsPublisher.PublishTickBatchAsync(batch);
                
                // Persiste no PostgreSQL
                await postgresPersistence.PersistBatchAsync(batch);
            };

            connector.OnPriceBookUpdated += async (book) =>
            {
                await natsPublisher.PublishPriceBookAsync(book);
            };

            connector.OnOfferBookUpdated += async (offer) =>
            {
                await natsPublisher.PublishOfferBookAsync(offer);
            };

            // Task para processar batches pendentes do PostgreSQL
            var persistenceTask = Task.Run(async () =>
            {
                while (true)
                {
                    try
                    {
                        await postgresPersistence.ProcessPendingBatchesAsync();
                        await Task.Delay(TimeSpan.FromSeconds(5));
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Erro ao processar batches pendentes");
                    }
                }
            });

            logger.LogInformation("=== UP 5.0 Tick Collector Rodando ===");
            logger.LogInformation("Pressione Ctrl+C para parar");
            
            // Task para logar estatísticas periodicamente
            var statsTask = Task.Run(async () =>
            {
                while (true)
                {
                    await Task.Delay(TimeSpan.FromSeconds(30));
                    var counters = TickCounter.GetCounters();
                    var total = TickCounter.GetTotalTicks();
                    var tps = TickCounter.GetTicksPerSecond();
                    var uptime = TickCounter.GetUptime();
                    
                    logger.LogInformation("=== Estatísticas ===");
                    logger.LogInformation("Uptime: {Uptime}", uptime);
                    logger.LogInformation("Total de ticks: {Total}", total);
                    logger.LogInformation("Ticks/segundo: {Tps:F2}", tps);
                    if (counters.Count > 0)
                    {
                        logger.LogInformation("Ticks por ativo:");
                        foreach (var kvp in counters.OrderByDescending(x => x.Value).Take(10))
                        {
                            logger.LogInformation("  {Key}: {Value}", kvp.Key, kvp.Value);
                        }
                    }
                }
            });

            // Aguarda sinal de parada
            var cts = new CancellationTokenSource();
            Console.CancelKeyPress += (sender, e) =>
            {
                e.Cancel = true;
                cts.Cancel();
            };

            await Task.Delay(Timeout.Infinite, cts.Token);
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation("Parando serviço...");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Erro fatal no programa");
            Environment.Exit(1);
        }
    }
    
    /// <summary>
    /// Carrega variáveis de ambiente de arquivo .env.local se existir
    /// </summary>
    private static void LoadEnvFileIfExists()
    {
        var currentDir = Directory.GetCurrentDirectory();
        var possibleEnvPaths = new List<string>
        {
            Path.Combine(currentDir, ".env.local"), // Diretório atual primeiro
        };

        // Tenta caminhos relativos ao workspace root
        var possibleRootPaths = new[]
        {
            Path.Combine(currentDir, "..", "..", "..", ".env.local"), // services/up5-tick-collector -> raiz
            Path.Combine(currentDir, "..", "..", ".env.local"), // se estiver em outro lugar
        };

        foreach (var rootPath in possibleRootPaths)
        {
            var fullPath = Path.GetFullPath(rootPath);
            if (File.Exists(fullPath))
            {
                possibleEnvPaths.Insert(0, fullPath); // Prioriza workspace root
            }
        }

        // Procura recursivamente até encontrar
        var searchDir = currentDir;
        for (int i = 0; i < 5; i++) // Limita busca até 5 níveis acima
        {
            var envLocal = Path.Combine(searchDir, ".env.local");
            if (File.Exists(envLocal))
            {
                possibleEnvPaths.Insert(0, envLocal);
                break;
            }
            var parent = Directory.GetParent(searchDir);
            if (parent == null) break;
            searchDir = parent.FullName;
        }

        foreach (var envPath in possibleEnvPaths.Distinct())
        {
            var fullPath = Path.GetFullPath(envPath);
            if (File.Exists(fullPath))
            {
                Console.WriteLine($"Carregando .env.local de: {fullPath}");
                try
                {
                    Env.Load(fullPath);
                    Console.WriteLine("Variáveis do .env.local carregadas");
                    return;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Aviso: Erro ao ler .env.local: {ex.Message}");
                }
            }
        }
    }
}

