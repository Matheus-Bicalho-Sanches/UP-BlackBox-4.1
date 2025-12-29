using System;
using System.IO;
using System.Runtime.InteropServices;
using MarketCollector.DataTypes;

namespace MarketCollector;

/// <summary>
/// Interop com ProfitDLL.dll - declarações de funções e tipos básicos
/// Baseado no exemplo C# existente, focado apenas em market data (não trading)
/// </summary>
public static class DLLInterop
{
    // Caminho da DLL - será configurado dinamicamente
    private const string DLL_PATH = "ProfitDLL.dll";
    
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool SetDllDirectory(string lpPathName);
    
    /// <summary>
    /// Define o diretório onde a DLL está localizada (adiciona ao PATH do processo)
    /// Isso permite que o DllImport encontre a DLL mesmo que não esteja no diretório atual
    /// </summary>
    public static void SetDllDirectoryPath(string dllPath)
    {
        var dllDir = Path.GetDirectoryName(Path.GetFullPath(dllPath));
        if (!string.IsNullOrWhiteSpace(dllDir) && Directory.Exists(dllDir))
        {
            // Adiciona o diretório da DLL ao PATH do processo para que dependências também sejam encontradas
            SetDllDirectory(dllDir);
        }
    }

    #region Constantes de Estado

    // Connection State Types
    public const int CONNECTION_STATE_LOGIN = 0;
    public const int CONNECTION_STATE_ROTEAMENTO = 1;
    public const int CONNECTION_STATE_MARKET_DATA = 2;
    public const int CONNECTION_STATE_MARKET_LOGIN = 3;

    // Market Data Connection States
    public const int MARKET_DISCONNECTED = 0;
    public const int MARKET_CONNECTING = 1;
    public const int MARKET_WAITING = 2;
    public const int MARKET_NOT_LOGGED = 3;
    public const int MARKET_CONNECTED = 4;

    // Error Codes
    public const int NL_OK = 0x00000000;

    #endregion

    #region Delegates (Callbacks)

    /// <summary>
    /// Callback de mudança de estado de conexão
    /// </summary>
    public delegate void TStateCallback(int stateType, int result);

    /// <summary>
    /// Callback de trade em tempo real (V2 - usando TConnectorTrade)
    /// </summary>
    public delegate void TConnectorTradeCallback(
        TConnectorAssetIdentifier assetId,
        nint pTrade,
        uint flags);

    // Note: Trade histórico usa o mesmo callback que trade em tempo real (TConnectorTradeCallback)

    /// <summary>
    /// Callback de PriceBook (V2 - usando Int64 para quantidade)
    /// </summary>
    public delegate void TPriceBookCallbackV2(
        TAssetID assetId,
        int action,
        int position,
        int side,
        long qtd,
        int count,
        double price,
        IntPtr pArraySell,
        IntPtr pArrayBuy);

    /// <summary>
    /// Callback de OfferBook (V2)
    /// </summary>
    public delegate void TOfferBookCallbackV2(
        TAssetID assetId,
        int action,
        int position,
        int side,
        long qtd,
        int agent,
        long offerId,
        double price,
        int hasPrice,
        int hasQtd,
        int hasDate,
        int hasOfferId,
        int hasAgent,
        [MarshalAs(UnmanagedType.LPWStr)] string date,
        IntPtr pArraySell,
        IntPtr pArrayBuy);

    /// <summary>
    /// Callback de progresso para requisições históricas
    /// </summary>
    public delegate void TProgressCallback(
        TConnectorAssetIdentifier assetId,
        int progress);

    #endregion

    #region DLL Functions - Market Data Login

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int DLLInitializeMarketLogin(
        [MarshalAs(UnmanagedType.LPWStr)] string activationKey,
        [MarshalAs(UnmanagedType.LPWStr)] string user,
        [MarshalAs(UnmanagedType.LPWStr)] string password,
        TStateCallback stateCallback,
        IntPtr newTradeCallback,  // Null para V1, vamos usar SetTradeCallbackV2 depois
        IntPtr newDailyCallback,  // Null - não usado na V1
        IntPtr priceBookCallback, // Null para V1, vamos usar SetPriceBookCallbackV2 depois
        IntPtr offerBookCallback, // Null para V1, vamos usar SetOfferBookCallbackV2 depois
        IntPtr historyTradeCallback, // Null para V1, vamos usar SetHistoryTradeCallbackV2 depois
        IntPtr progressCallback,  // Null - não crítico na V1
        IntPtr tinyBookCallback); // Null - não usado na V1

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int DLLFinalize();

    #endregion

    #region DLL Functions - Subscription

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int SubscribeTicker(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int UnsubscribeTicker(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int SubscribePriceBook(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int UnsubscribePriceBook(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int SubscribeOfferBook(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int UnsubscribeOfferBook(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    #endregion

    #region DLL Functions - Callbacks V2

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetTradeCallbackV2(TConnectorTradeCallback tradeCallback);

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetHistoryTradeCallbackV2(TConnectorTradeCallback historyTradeCallback);

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetPriceBookCallbackV2(TPriceBookCallbackV2 priceBookCallback);

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetOfferBookCallbackV2(TOfferBookCallbackV2 offerBookCallback);

    #endregion

    #region DLL Functions - Trade Translation

    /// <summary>
    /// Traduz um ponteiro de trade para a estrutura TConnectorTrade
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int TranslateTrade(nint pTrade, ref TConnectorTrade tradeStruct);

    #endregion

    #region DLL Functions - Historical Data

    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int GetHistoryTrades(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange,
        [MarshalAs(UnmanagedType.LPWStr)] string dateStart,
        [MarshalAs(UnmanagedType.LPWStr)] string dateEnd);

    #endregion
}
