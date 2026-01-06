using System;
using System.IO;
using System.Runtime.InteropServices;
using Up5TickCollector.DataTypes;

namespace Up5TickCollector.Core;

/// <summary>
/// Interop com ProfitDLL.dll - declarações P/Invoke completas
/// Baseado na documentação profitdll_manual_llm_friendly.json
/// </summary>
public static class ProfitDllInterop
{
    private const string DLL_PATH = "ProfitDLL.dll";

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool SetDllDirectory(string lpPathName);

    /// <summary>
    /// Define o diretório onde a DLL está localizada
    /// </summary>
    public static void SetDllDirectoryPath(string dllPath)
    {
        var dllDir = Path.GetDirectoryName(Path.GetFullPath(dllPath));
        if (!string.IsNullOrWhiteSpace(dllDir) && Directory.Exists(dllDir))
        {
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
    public const int NL_WAITING_SERVER = 0x00000001;
    public const int NL_ERR_INVALID_ARGS = unchecked((int)0x80000001);

    // Trade Callback Flags
    public const uint TC_IS_EDIT = 0x00000001;
    public const uint TC_LAST_PACKET = 0x00000002;

    #endregion

    #region Delegates (Callbacks)

    /// <summary>
    /// Callback de mudança de estado de conexão
    /// </summary>
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    public delegate void TStateCallback(int stateType, int result);

    /// <summary>
    /// Callback de trade em tempo real (V2 - usando TConnectorTrade)
    /// </summary>
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    public delegate void TConnectorTradeCallback(
        TConnectorAssetIdentifier assetId,
        nint pTrade,
        uint flags);

    /// <summary>
    /// Callback de PriceBook (V2)
    /// </summary>
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
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
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
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
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    public delegate void TProgressCallback(
        TConnectorAssetIdentifier assetId,
        int progress);

    #endregion

    #region DLL Functions - Initialization

    /// <summary>
    /// Inicializa a DLL apenas para market data (sem roteamento)
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int DLLInitializeMarketLogin(
        [MarshalAs(UnmanagedType.LPWStr)] string activationKey,
        [MarshalAs(UnmanagedType.LPWStr)] string user,
        [MarshalAs(UnmanagedType.LPWStr)] string password,
        TStateCallback stateCallback,
        IntPtr newTradeCallback,  // Null - usamos SetTradeCallbackV2
        IntPtr newDailyCallback,
        IntPtr priceBookCallback, // Null - usamos SetPriceBookCallbackV2
        IntPtr offerBookCallback, // Null - usamos SetOfferBookCallbackV2
        IntPtr historyTradeCallback, // Null - usamos SetHistoryTradeCallbackV2
        IntPtr progressCallback,
        IntPtr tinyBookCallback);

    /// <summary>
    /// Finaliza a DLL
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int DLLFinalize();

    #endregion

    #region DLL Functions - Subscription

    /// <summary>
    /// Inscreve em um ativo para receber trades
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int SubscribeTicker(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    /// <summary>
    /// Desinscreve de um ativo
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int UnsubscribeTicker(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    /// <summary>
    /// Inscreve em book de preços
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int SubscribePriceBook(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    /// <summary>
    /// Desinscreve de book de preços
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int UnsubscribePriceBook(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    /// <summary>
    /// Inscreve em book de ofertas
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int SubscribeOfferBook(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    /// <summary>
    /// Desinscreve de book de ofertas
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall, CharSet = CharSet.Unicode)]
    public static extern int UnsubscribeOfferBook(
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string exchange);

    #endregion

    #region DLL Functions - Callbacks V2

    /// <summary>
    /// Define callback de trades em tempo real (V2)
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetTradeCallbackV2(TConnectorTradeCallback tradeCallback);

    /// <summary>
    /// Define callback de trades históricos (V2)
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetHistoryTradeCallbackV2(TConnectorTradeCallback historyTradeCallback);

    /// <summary>
    /// Define callback de price book (V2)
    /// </summary>
    [DllImport(DLL_PATH, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetPriceBookCallbackV2(TPriceBookCallbackV2 priceBookCallback);

    /// <summary>
    /// Define callback de offer book (V2)
    /// </summary>
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
}

