using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using MarketCollector;
using MarketCollector.Config;
using MarketCollector.Utils;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace MarketCollector;

class Program
{
    static void Main(string[] args)
    {
        Console.WriteLine("Market Collector Service - Iniciando...");

        // Tenta carregar variáveis de ambiente de um arquivo .env (opcional)
        LoadEnvFileIfExists();

        // Configuração
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddEnvironmentVariables() // Permite override via variáveis de ambiente
            .Build();

        var collectorConfig = new CollectorConfig();
        configuration.GetSection("CollectorConfig").Bind(collectorConfig);

        // Override com variáveis de ambiente se disponíveis (útil para .env)
        // Tenta ler do .env do Dll_Profit primeiro, depois variáveis de ambiente do sistema
        collectorConfig.ActivationKey = Environment.GetEnvironmentVariable("ACTIVATION_CODE") ?? collectorConfig.ActivationKey;
        collectorConfig.User = Environment.GetEnvironmentVariable("login") ?? collectorConfig.User;
        collectorConfig.Password = Environment.GetEnvironmentVariable("password") ?? collectorConfig.Password;
        // Tenta encontrar DLL automaticamente se não configurada
        var dllPathEnv = Environment.GetEnvironmentVariable("DLL_PATH");
        if (!string.IsNullOrWhiteSpace(dllPathEnv))
        {
            collectorConfig.DllPath = dllPathEnv;
        }
        else
        {
            var foundDll = DllPathResolver.FindDllPath(collectorConfig.DllPath);
            if (foundDll != null)
            {
                collectorConfig.DllPath = foundDll;
                Console.WriteLine($"DLL encontrada em: {foundDll}");
                
                // Copia a DLL e dependências para o diretório do executável
                var copiedPath = CopyDllToOutputDirectory(foundDll, Directory.GetCurrentDirectory());
                if (copiedPath != null)
                {
                    collectorConfig.DllPath = copiedPath;
                }
            }
            else
            {
                Console.WriteLine($"AVISO: DLL não encontrada automaticamente. Usando caminho configurado: {collectorConfig.DllPath}");
            }
        }
        
        collectorConfig.NatsUrl = Environment.GetEnvironmentVariable("NATS_URL") ?? collectorConfig.NatsUrl;

        // Validar configuração
        if (string.IsNullOrWhiteSpace(collectorConfig.ActivationKey) ||
            string.IsNullOrWhiteSpace(collectorConfig.User) ||
            string.IsNullOrWhiteSpace(collectorConfig.Password))
        {
            Console.Error.WriteLine("ERRO: Configure ACTIVATION_CODE, login e password no appsettings.json ou variáveis de ambiente");
            Console.Error.WriteLine("Dica: Você pode criar um arquivo .env ou configurar variáveis de ambiente do sistema");
            Environment.Exit(1);
        }

        // Logger
        using var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder
                .AddConfiguration(configuration.GetSection("Logging"))
                .AddConsole();
        });

        var logger = loggerFactory.CreateLogger<CollectorService>();

        // Criar e inicializar serviço
        using var collector = new CollectorService(collectorConfig, logger);

        try
        {
            collector.Initialize();
            Console.WriteLine("Market Collector Service rodando. Pressione Ctrl+C para parar.");

            // Mantém o programa rodando
            var waitHandle = new ManualResetEvent(false);
            Console.CancelKeyPress += (sender, e) =>
            {
                e.Cancel = true;
                waitHandle.Set();
            };
            waitHandle.WaitOne();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Erro fatal no CollectorService");
            Console.Error.WriteLine($"ERRO: {ex.Message}");
            Environment.Exit(1);
        }
        finally
        {
            Console.WriteLine("Finalizando Market Collector Service...");
        }
    }

    /// <summary>
    /// Tenta carregar variáveis de ambiente de um arquivo .env (formato simples: KEY=value)
    /// Procura primeiro em Dll_Profit/.env (padrão do projeto), depois no diretório atual
    /// </summary>
    private static void LoadEnvFileIfExists()
    {
        // Tenta encontrar o workspace root (onde está Dll_Profit)
        var currentDir = Directory.GetCurrentDirectory();
        var possibleEnvPaths = new List<string>
        {
            Path.Combine(currentDir, ".env"), // Diretório atual primeiro
        };

        // Tenta caminhos relativos ao workspace root
        var possibleRootPaths = new[]
        {
            Path.Combine(currentDir, "..", "..", "Dll_Profit", ".env"), // services/market_collector -> raiz -> Dll_Profit
            Path.Combine(currentDir, "..", "Dll_Profit", ".env"), // se estiver em outro lugar
        };

        foreach (var rootPath in possibleRootPaths)
        {
            var fullPath = Path.GetFullPath(rootPath);
            if (File.Exists(fullPath))
            {
                possibleEnvPaths.Insert(0, fullPath); // Prioriza workspace root
            }
        }

        // Tenta também procurar pelo nome da pasta Dll_Profit no caminho atual ou acima
        var searchDir = currentDir;
        for (int i = 0; i < 5; i++) // Limita busca até 5 níveis acima
        {
            var dllProfitEnv = Path.Combine(searchDir, "Dll_Profit", ".env");
            if (File.Exists(dllProfitEnv))
            {
                possibleEnvPaths.Insert(0, dllProfitEnv);
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
                Console.WriteLine($"Carregando .env de: {fullPath}");
                try
                {
                    var lines = File.ReadAllLines(fullPath);
                    foreach (var line in lines)
                    {
                        var trimmed = line.Trim();
                        if (string.IsNullOrWhiteSpace(trimmed) || trimmed.StartsWith("#"))
                            continue;

                        var idx = trimmed.IndexOf('=');
                        if (idx > 0)
                        {
                            var key = trimmed.Substring(0, idx).Trim();
                            var value = trimmed.Substring(idx + 1).Trim().Trim('"', '\'');
                            
                            // Só define se não existir já na variável de ambiente
                            if (Environment.GetEnvironmentVariable(key) == null)
                            {
                                Environment.SetEnvironmentVariable(key, value);
                            }
                        }
                    }
                    Console.WriteLine("Variáveis do .env carregadas");
                    return;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Aviso: Erro ao ler .env: {ex.Message}");
                }
            }
        }
    }

    /// <summary>
    /// Copia a DLL e suas dependências para o diretório do executável
    /// Retorna o caminho da DLL copiada, ou null se houver erro
    /// </summary>
    private static string? CopyDllToOutputDirectory(string dllPath, string outputDir)
    {
        try
        {
            var dllDir = Path.GetDirectoryName(dllPath) ?? "";
            var dllFileName = Path.GetFileName(dllPath);
            var targetDllPath = Path.Combine(outputDir, dllFileName);

            // Copia a DLL principal
            if (!File.Exists(targetDllPath) || File.GetLastWriteTime(dllPath) > File.GetLastWriteTime(targetDllPath))
            {
                File.Copy(dllPath, targetDllPath, overwrite: true);
                Console.WriteLine($"DLL copiada para: {targetDllPath}");
            }

            // Copia dependências comuns (se existirem)
            var dependencies = new[] { "libcrypto-1_1-x64.dll", "libssl-1_1-x64.dll", "libeay32.dll", "ssleay32.dll" };
            foreach (var dep in dependencies)
            {
                var sourceDep = Path.Combine(dllDir, dep);
                var targetDep = Path.Combine(outputDir, dep);
                if (File.Exists(sourceDep) && (!File.Exists(targetDep) || File.GetLastWriteTime(sourceDep) > File.GetLastWriteTime(targetDep)))
                {
                    File.Copy(sourceDep, targetDep, overwrite: true);
                    Console.WriteLine($"Dependência copiada: {dep}");
                }
            }

            // Copia arquivos .dat necessários (se existirem)
            var datFiles = new[] { "ServerAddr6.dat", "HadesSSLServerAddr3.dat", "InfoSSLServerAddr3.dat" };
            foreach (var dat in datFiles)
            {
                var sourceDat = Path.Combine(dllDir, dat);
                var targetDat = Path.Combine(outputDir, dat);
                if (File.Exists(sourceDat) && (!File.Exists(targetDat) || File.GetLastWriteTime(sourceDat) > File.GetLastWriteTime(targetDat)))
                {
                    File.Copy(sourceDat, targetDat, overwrite: true);
                }
            }

            // Retorna o caminho da DLL copiada
            return targetDllPath;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Aviso: Erro ao copiar DLL: {ex.Message}");
            // Retorna null para usar o caminho original
            return null;
        }
    }
}
