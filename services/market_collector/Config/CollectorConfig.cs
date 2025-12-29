namespace MarketCollector.Config;

/// <summary>
/// Configuração do CollectorService
/// </summary>
public class CollectorConfig
{
    /// <summary>
    /// Credenciais da DLL Profit
    /// </summary>
    public string ActivationKey { get; set; } = string.Empty;
    public string User { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// Caminho para ProfitDLL.dll
    /// </summary>
    public string DllPath { get; set; } = "ProfitDLL.dll";

    /// <summary>
    /// Configuração NATS
    /// </summary>
    public string NatsUrl { get; set; } = "nats://localhost:4222";

    /// <summary>
    /// Lista de símbolos para inscrever (formato: TICKER:EXCHANGE, ex: WINZ25:F)
    /// </summary>
    public List<string> Symbols { get; set; } = new();

    /// <summary>
    /// Exchange padrão (ex: "B" para Bovespa, "F" para BMF)
    /// </summary>
    public string DefaultExchange { get; set; } = "B";
}
