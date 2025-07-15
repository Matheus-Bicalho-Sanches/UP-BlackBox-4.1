using System;
using System.Collections.Generic;
using System.Net.Http.Headers;
using System.Runtime.InteropServices;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Linq;
using System.Security.Cryptography;

namespace ProfitDLL;

#region Struturas para exemplo
public struct CandleTrade
{
    public CandleTrade(double close, double vol, double open, double max, double min, int qtd, string asset, DateTime date)
    {
        Close = close;
        Vol = vol;
        Qtd = qtd;
        Asset = asset;
        Date = date;
        Open = open;
        Max = max;
        Min = min;
    }

    public double Close { get; set; }
    public double Vol { get; set; }
    public double Max { get; set; }
    public double Min { get; set; }
    public double Open { get; set; }
    public int Qtd { get; set; }
    public string Asset { get; set; }
    public DateTime Date { get; set; }
}
public struct Trade
{
    public Trade(double price, double vol, int qtd, string asset, string date)
    {
        Price = price;
        Qtd = qtd;
        Asset = asset;
        Date = date;
        Vol = vol;
    }

    public double Price { get; }
    public double Vol { get; }
    public int Qtd { get; }
    public string Asset { get; }
    public string Date { get; }
}
#endregion

public enum NResult : int
{
    NL_INTERNAL_ERROR = unchecked((int)0x80000001),
    NL_NOT_INITIALIZED,
    NL_INVALID_ARGS,
    NL_WAITING_SERVER,
    NL_NO_LOGIN,
    NL_NO_LICENSE,
    NL_PASSWORD_HASH_SHA1,
    NL_PASSWORD_HASH_MD5,
    NL_OUT_OF_RANGE,
    NL_MARKET_ONLY,
    NL_NO_POSITION,
    NL_NOT_FOUND,
    NL_VERSION_NOT_SUPPORTED,
    NL_OCO_NO_RULES,
    NL_EXCHANGE_UNKNOWN,
    NL_NO_OCO_DEFINED,
    NL_INVALID_SERIE,
    NL_LICENSE_NOT_ALLOWED,
    NL_NOT_HARD_LOGOUT,
    NL_SERIE_NO_HISTORY,
    NL_ASSET_NO_DATA,
    NL_SERIE_NO_DATA,
    NL_HAS_STRATEGY_RUNNING,
    NL_SERIE_NO_MORE_HISTORY,
    NL_SERIE_MAX_COUNT,
    NL_DUPLICATE_RESOURCE,
    NL_UNSIGNED_CONTRACT,
    NL_NO_PASSWORD,
    NL_NO_USER,
    NL_FILE_ALREADY_EXISTS,
    NL_INVALID_TICKER,
    NL_NOT_MASTER_ACCOUNT
}

[Flags]
public enum OfferBookFlags : uint
{
    OB_LAST_PACKET = 1
}

partial class DLLConnector
{
    private static string ReadPassword()
    {
        Console.Write("Senha: ");

        var retVal = "";
        while (true)
        {
            var keyInfo = Console.ReadKey(intercept: true);
            var key = keyInfo.Key;

            if (key == ConsoleKey.Enter)
            {
                break;
            }

            if (key == ConsoleKey.Backspace && retVal.Length > 0)
            {
                retVal = retVal[..^1];

                var (left, top) = Console.GetCursorPosition();
                Console.SetCursorPosition(left - 1, top);

                Console.Write(" ");
                Console.SetCursorPosition(left - 1, top);
            }
            else if (!char.IsControl(keyInfo.KeyChar))
            {
                Console.Write("*");
                retVal += keyInfo.KeyChar;
            }
        }

        Console.WriteLine();

        return retVal;
    }

    private const string dll_path = @"ProfitDLL.dll";   // @Preencher com o caminho da DLL

    // TActionType = (atAdd = 0, atEdit = 1, atDelete = 2, atDeleteFrom = 3, atFullBook = 4);
    #region Types
    public struct TConnectorOffer(double price, long qtd, int agent, long offerId, DateTime date)
    {
        public long Qtd { get; set; } = qtd;
        public long OfferID { get; set; } = offerId;
        public int Agent { get; set; } = agent;
        public double Price { get; set; } = price;
        public DateTime Date { get; set; } = date;
    }

    public struct TGroupPrice
    {
        public int Qtd { get; set; }
        public int Count { get; set; }
        public double Price { get; set; }

        public TGroupPrice(double price, int count, int qtd)
        {
            this.Qtd = qtd;
            this.Price = price;
            this.Count = count;
        }
    }
    public struct TPosition
    {
        public int CorretoraID;
        public string AccountID;
        public string Titular;
        public string Ticker;
        public int IntradayPosition;
        public double Price;
        public double AvgSellPrice;
        public int SellQtd;
        public double AvgBuyPrice;
        public int BuyQtd;
        public int CustodyD1;
        public int CustodyD2;
        public int CustodyD3;
        public int Blocked;
        public int Pending;
        public int Allocated;
        public int Provisioned;
        public int QtdPosition;
        public int Available;

        public override string ToString()
        {
            return $"Corretora: {CorretoraID}, AccountID: {AccountID}, Titular: {Titular}, Ticker: {Ticker}, IntradayPosition: {IntradayPosition}, Price: {Price}, AvgSellPrice: {AvgSellPrice}, AvgBuyPrice: {AvgBuyPrice}, BuyQtd: {BuyQtd}, SellQtd: {SellQtd}";
        }
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct TAssetID
    {
        [MarshalAs(UnmanagedType.LPWStr)]
        public string Ticker;
        [MarshalAs(UnmanagedType.LPWStr)]
        public string Bolsa;
        public int Feed;
    };
    #endregion

    #region obj garbage KeepAlive
    public static TAssetListCallback _assetListCallback = new TAssetListCallback(AssetListCallback);
    public static TAssetListInfoCallback _assetListInfoCallback = new TAssetListInfoCallback(AssetListInfoCallback);
    public static TAssetListInfoCallbackV2 _assetListInfoCallbackV2 = new TAssetListInfoCallbackV2(AssetListInfoCallbackV2);
    public static TStateCallback _stateCallback = new TStateCallback(StateCallback);
    public static TNewDailyCallback _newDailyCallback = new TNewDailyCallback(NewDailyCallback);
    public static TPriceBookCallback _priceBookCallback = new TPriceBookCallback(PriceBookCallback);
    public static TOfferBookCallback _offerBookCallbackV2 = new TOfferBookCallback(OfferBookCallbackV2);
    public static TProgressCallBack _progressCallBack = new TProgressCallBack(ProgressCallBack);
    public static TNewTinyBookCallBack _newTinyBookCallBack = new TNewTinyBookCallBack(NewTinyBookCallBack);
    public static TAccountCallback _accountCallback = new TAccountCallback(AccountCallback);
    public static TChangeStateTickerCallback _changeStateTickerCallback = new TChangeStateTickerCallback(ChangeStateTickerCallback);
    public static TTheoreticalPriceCallback _theoreticalPriceCallback = new TTheoreticalPriceCallback(TheoreticalPriceCallback);
    public static TAdjustHistoryCallbackV2 _adjustHistoryCallbackV2 = new TAdjustHistoryCallbackV2(AdjustHistoryCallbackV2);
    public static TConnectorOrderCallback _orderCallback = new TConnectorOrderCallback(OrderCallback);
    public static TConnectorAccountCallback _orderHistoryCallback = new TConnectorAccountCallback(OrderHistoryCallback);

    public static TConnectorTradeCallback _TradeCallback = new TConnectorTradeCallback(TradeCallback);
    public static TConnectorTradeCallback _HistoryTradeCallback = new TConnectorTradeCallback(HistoryTradeCallback);

    #endregion

    #region variables
    public static Queue<Trade> Traders = new Queue<Trade>();
    private static readonly object TradeLock = new object();

    public static Queue<Trade> HistTraders = new Queue<Trade>();
    private static readonly object HistLock = new object();

    public static List<TGroupPrice> m_lstPriceSell = new List<TGroupPrice>();
    public static List<TGroupPrice> m_lstPriceBuy = new List<TGroupPrice>();

    public static List<TConnectorOffer> m_lstOfferSell = new List<TConnectorOffer>();
    public static List<TConnectorOffer> m_lstOfferBuy = new List<TConnectorOffer>();

    public static bool bAtivo = false;
    public static bool bMarketConnected = false;

    static readonly CultureInfo provider = CultureInfo.InvariantCulture;
    #endregion

    #region consts
    private const string dateFormat = "dd/MM/yyyy HH:mm:ss.fff";
    #endregion

    #region Error Codes

    //////////////////////////////////////////////////////////////////////////////
    // Error Codes
    public const int NL_OK = 0x00000000;  // OK

    #endregion

    #region Delegates

    ////////////////////////////////////////////////////////////////////////////////
    // WARNING: Não utilizar funções da dll dentro do CALLBACK
    ////////////////////////////////////////////////////////////////////////////////
    //Callback do stado das diferentes conexões
    public delegate void TStateCallback(int nResult, int result);
    ////////////////////////////////////////////////////////////////////////////////
    //Callback com informações marketData
    public delegate void TTradeCallback(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string date, uint tradeNumber, double price, double vol, int qtd, int buyAgent, int sellAgent, int tradeType, int bIsEdit);
    public delegate void TNewDailyCallback(TAssetID TAssetIDRec, [MarshalAs(UnmanagedType.LPWStr)] string date, double sOpen, double sHigh, double sLow, double sClose, double sVol, double sAjuste, double sMaxLimit, double sMinLimit, double sVolBuyer, double sVolSeller, int nQtd, int nNegocios, int nContratosOpen, int nQtdBuyer, int nQtdSeller, int nNegBuyer, int nNegSeller);
    public delegate void THistoryTradeCallback(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string date, uint tradeNumber, double price, double vol, int qtd, int buyAgent, int sellAgent, int tradeType);
    public delegate void TProgressCallBack(TAssetID assetId, int nProgress);
    public delegate void TNewTinyBookCallBack(TAssetID assetId, double price, int qtd, int side);

    ////////////////////////////////////////////////////////////////////////////////
    //Callback de alteração em ordens

    public delegate void TChangeCotation(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string date, uint tradeNumber, double sPrice);

    public delegate void TAssetListCallback(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string strName);
    public delegate void TConnectorOrderCallback(TConnectorOrderIdentifier orderId);
    public delegate void TConnectorAccountCallback(TConnectorAccountIdentifier accountId);

    public delegate void TConnectorTradeCallback(TConnectorAssetIdentifier a_Asset, nint a_pTrade, [MarshalAs(UnmanagedType.U4)] TConnectorTradeCallbackFlags a_nFlags);

    public delegate void TAdjustHistoryCallbackV2(TAssetID assetId,
        double dValue,
        [MarshalAs(UnmanagedType.LPWStr)] string adjustType,
        [MarshalAs(UnmanagedType.LPWStr)] string strObserv,
        [MarshalAs(UnmanagedType.LPWStr)] string dtAjuste,
        [MarshalAs(UnmanagedType.LPWStr)] string dtDeliber,
        [MarshalAs(UnmanagedType.LPWStr)] string dtPagamento,
        int nFlags,
        double dMult);

    public delegate void TAssetListInfoCallback(
        TAssetID assetId,
        [MarshalAs(UnmanagedType.LPWStr)] string strName,
        [MarshalAs(UnmanagedType.LPWStr)] string strDescription,
        int nMinOrderQtd,
        int nMaxOrderQtd,
        int nLote,
        int stSecurityType,
        int ssSecuritySubType,
        double sMinPriceInc,
        double sContractMultiplier,
        [MarshalAs(UnmanagedType.LPWStr)] string validityDate,
        [MarshalAs(UnmanagedType.LPWStr)] string strISIN);

    public delegate void TAssetListInfoCallbackV2(
        TAssetID assetId,
        [MarshalAs(UnmanagedType.LPWStr)] string strName,
        [MarshalAs(UnmanagedType.LPWStr)] string strDescription,
        int nMinOrderQtd,
        int nMaxOrderQtd,
        int nLote,
        int stSecurityType,
        int ssSecuritySubType,
        double sMinPriceInc,
        double sContractMultiplier,
        [MarshalAs(UnmanagedType.LPWStr)] string validityDate,
        [MarshalAs(UnmanagedType.LPWStr)] string strISIN,
        [MarshalAs(UnmanagedType.LPWStr)] string strSetor,
        [MarshalAs(UnmanagedType.LPWStr)] string strSubSetor,
        [MarshalAs(UnmanagedType.LPWStr)] string strSegmento);

    public delegate void TChangeStateTickerCallback(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string strDate, int nState);

    public delegate void TInvalidTickerCallback(TConnectorAssetIdentifier assetId);

    public delegate void TTheoreticalPriceCallback(TAssetID assetId, double dTheoreticalPrice, Int64 nTheoreticalQtd);

    public delegate void THistoryCallBack(TAssetID AssetID, int nCorretora, int nQtd, int nTradedQtd, int nLeavesQtd, int Side, double sPrice, double sStopPrice, double sAvgPrice, long nProfitID,
        [MarshalAs(UnmanagedType.LPWStr)] string TipoOrdem,
        [MarshalAs(UnmanagedType.LPWStr)] string Conta,
        [MarshalAs(UnmanagedType.LPWStr)] string Titular,
        [MarshalAs(UnmanagedType.LPWStr)] string ClOrdID,
        [MarshalAs(UnmanagedType.LPWStr)] string Status,
        [MarshalAs(UnmanagedType.LPWStr)] string Date);

    public delegate void TOrderChangeCallBack(TAssetID assetId, int nCorretora, int nQtd, int nTradedQtd, int nLeavesQtd, int Side, double sPrice, double sStopPrice, double sAvgPrice, long nProfitID,
        [MarshalAs(UnmanagedType.LPWStr)] string TipoOrdem,
        [MarshalAs(UnmanagedType.LPWStr)] string Conta,
        [MarshalAs(UnmanagedType.LPWStr)] string Titular,
        [MarshalAs(UnmanagedType.LPWStr)] string ClOrdID,
        [MarshalAs(UnmanagedType.LPWStr)] string Status,
        [MarshalAs(UnmanagedType.LPWStr)] string Date,
        [MarshalAs(UnmanagedType.LPWStr)] string TextMessage);

    public delegate void TOrderChangeCallBackV2(TAssetID assetId, int nCorretora, int nQtd, int nTradedQtd, int nLeavesQtd, int Side, int nValidity, double sPrice, double sStopPrice, double sAvgPrice, long nProfitID,
        [MarshalAs(UnmanagedType.LPWStr)] string TipoOrdem,
        [MarshalAs(UnmanagedType.LPWStr)] string Conta,
        [MarshalAs(UnmanagedType.LPWStr)] string Titular,
        [MarshalAs(UnmanagedType.LPWStr)] string ClOrdID,
        [MarshalAs(UnmanagedType.LPWStr)] string Status,
        [MarshalAs(UnmanagedType.LPWStr)] string Date,
        [MarshalAs(UnmanagedType.LPWStr)] string LastUpdate,
        [MarshalAs(UnmanagedType.LPWStr)] string CloseDate,
        [MarshalAs(UnmanagedType.LPWStr)] string ValidityDate,
        [MarshalAs(UnmanagedType.LPWStr)] string TextMessage);

    ////////////////////////////////////////////////////////////////////////////////
    //Callback com a lista de contas
    public delegate void TAccountCallback(int nCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string CorretoraNomeCompleto,
        [MarshalAs(UnmanagedType.LPWStr)] string AccountID,
        [MarshalAs(UnmanagedType.LPWStr)] string NomeTitular);

    ////////////////////////////////////////////////////////////////////////////////
    //Callback com informações marketData
    public delegate void TPriceBookCallback(TAssetID assetId, int nAction, int nPosition, int Side, int nQtd, int nCount, double sPrice, IntPtr pArraySell, IntPtr pArrayBuy);

    public delegate void TOfferBookCallback(TAssetID assetId, int nAction, int nPosition, int Side, int nQtd, int nAgent, Int64 nOfferID, double sPrice, int bHasPrice, int bHasQtd, int bHasDate, int bHasOfferID, int bHasAgent,
        [MarshalAs(UnmanagedType.LPWStr)] string date,
        IntPtr pArraySell, IntPtr pArrayBuy);

    #endregion

    #region DLL Functions
    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int DLLInitializeMarketLogin(
        [MarshalAs(UnmanagedType.LPWStr)] string activationKey,
        [MarshalAs(UnmanagedType.LPWStr)] string user,
        [MarshalAs(UnmanagedType.LPWStr)] string password,
        TStateCallback stateCallback,
        TTradeCallback newTradeCallback,
        TNewDailyCallback newDailyCallback,
        TPriceBookCallback priceBookCallback,
        TOfferBookCallback offerBookCallback,
        THistoryTradeCallback newHistoryCallback,
        TProgressCallBack progressCallBack,
        TNewTinyBookCallBack newTinyBookCallBack);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int DLLInitializeLogin(
        [MarshalAs(UnmanagedType.LPWStr)] string activationKey,
        [MarshalAs(UnmanagedType.LPWStr)] string user,
        [MarshalAs(UnmanagedType.LPWStr)] string password,
        TStateCallback stateCallback,
        THistoryCallBack historyCallBack,
        TOrderChangeCallBack orderChangeCallBack,
        TAccountCallback accountCallback,
        TTradeCallback newTradeCallback,
        TNewDailyCallback newDailyCallback,
        TPriceBookCallback priceBookCallback,
        TOfferBookCallback offerBookCallback,
        THistoryTradeCallback newHistoryCallback,
        TProgressCallBack progressCallBack,
        TNewTinyBookCallBack newTinyBookCallBack);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetServerAndPort(
        [MarshalAs(UnmanagedType.LPWStr)] string strServer,
        [MarshalAs(UnmanagedType.LPWStr)] string strPort);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetServerClock(
        ref double serverClock,
        ref int nYear, ref int nMonth, ref int nDay, ref int nHour, ref int nMin, ref int nSec, ref int nMilisec);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetLastDailyClose(
        [MarshalAs(UnmanagedType.LPWStr)] string strTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string strBolsa,
        ref double dClose,
        int bAdjusted);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern IntPtr GetPosition(
        [MarshalAs(UnmanagedType.LPWStr)] string accountID,
        [MarshalAs(UnmanagedType.LPWStr)] string corretora,
        [MarshalAs(UnmanagedType.LPWStr)] string ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string bolsa);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetChangeCotationCallback(TChangeCotation a_ChangeCotation);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetAssetListCallback(TAssetListCallback AssetListCallback);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetOfferBookCallbackV2(TOfferBookCallback OfferBookCallbackV2);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetAssetListInfoCallback(TAssetListInfoCallback AssetListInfoCallback);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetAssetListInfoCallbackV2(TAssetListInfoCallbackV2 AssetListInfoCallbackV2);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetInvalidTickerCallback(TInvalidTickerCallback InvalidTickerCallback);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetChangeStateTickerCallback(TChangeStateTickerCallback a_changeStateTickerCallback);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetTheoreticalPriceCallback(TTheoreticalPriceCallback a_theoreticalPriceCallback);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetAdjustHistoryCallbackV2(TAdjustHistoryCallbackV2 AdjustHistoryCallbackV2);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetOrderChangeCallbackV2(TOrderChangeCallBackV2 OrderChangeCallbackV2);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetOrderCallback(TConnectorOrderCallback orderCallback);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetOrderHistoryCallback(TConnectorAccountCallback orderHistoryCallback);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetTradeCallbackV2(TConnectorTradeCallback a_TradeCallbackV2);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetHistoryTradeCallbackV2(TConnectorTradeCallback a_HistoryTradeCallbackV2);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SetEnabledLogToDebug(int bEnabled);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SubscribeTicker(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int UnsubscribeTicker(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SubscribePriceBook(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int UnsubscribePriceBook(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SubscribeOfferBook(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int UnsubscribeOfferBook(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SubscribeAdjustHistory(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetHistoryTrades(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa,
        [MarshalAs(UnmanagedType.LPWStr)] string dtDateStart,
        [MarshalAs(UnmanagedType.LPWStr)] string dtDateEnd);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int FreePointer(IntPtr pointer, int nSize);


    ////////////////////////////////////////////////////////////////////////////////
    // Roteamento
    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern Int64 SendStopBuyOrder(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDAccount,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string sSenha,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa,
        double sPrice, double sStopPrice, int nAmount);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern Int64 SendStopSellOrder(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDAccount,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string sSenha,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa,
        double sPrice, double sStopPrice, int nAmount);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SendChangeOrder(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDAccount,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string sSenha,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcClOrdID,
        double sPrice, int nAmount);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SendCancelOrder(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDAccount,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcClOrdID,
        [MarshalAs(UnmanagedType.LPWStr)] string sSenha);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SendCancelAllOrders(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDAccount,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string sSenha);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SendCancelOrders(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDAccount,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string sSenha,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern Int64 SendZeroPosition(
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDAccount,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcIDCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcTicker,
        [MarshalAs(UnmanagedType.LPWStr)] string pwcBolsa,
        [MarshalAs(UnmanagedType.LPWStr)] string sSenha,
        double sPrice);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern long SendBuyOrder(
        [MarshalAs(UnmanagedType.LPWStr)] string IDAccount,
        [MarshalAs(UnmanagedType.LPWStr)] string IDCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string Senha,
        [MarshalAs(UnmanagedType.LPWStr)] string Ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string Bolsa,
        double sPrice, int nAmount);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern long SendSellOrder(
        [MarshalAs(UnmanagedType.LPWStr)] string IDAccount,
        [MarshalAs(UnmanagedType.LPWStr)] string IDCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string Senha,
        [MarshalAs(UnmanagedType.LPWStr)] string Ticker,
        [MarshalAs(UnmanagedType.LPWStr)] string Bolsa,
        double sPrice, int nAmount);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetOrder([MarshalAs(UnmanagedType.LPWStr)] string clOrdId);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern long SendOrder([In] ref TConnectorSendOrder sendOrder);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SendChangeOrderV2([In] ref TConnectorChangeOrder changeOrder);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SendCancelOrderV2([In] ref TConnectorCancelOrder cancelOrder);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SendCancelOrdersV2([In] ref TConnectorCancelOrders cancelOrders);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int SendCancelAllOrdersV2([In] ref TConnectorCancelAllOrders cancelAllOrders);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern long SendZeroPositionV2([In] ref TConnectorZeroPosition zeroPosition);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetAccountCount();

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetAccounts(int startSource, int startDest, int count, [Out][MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 2)] TConnectorAccountIdentifierOut[] accounts);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetAccountDetails(ref TConnectorTradingAccountOut account);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetSubAccountCount(ref TConnectorAccountIdentifier masterAccountID);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetSubAccounts(ref TConnectorAccountIdentifier masterAccountID, int startSource, int startDest, int count, [Out][MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 3)] TConnectorAccountIdentifierOut[] accounts);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetPositionV2(ref TConnectorTradingAccountPosition position);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int GetOrderDetails(ref TConnectorOrderOut order);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int HasOrdersInInterval([In] ref TConnectorAccountIdentifier a_AccountID, SystemTime a_dtStart, SystemTime a_dtEnd);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int EnumerateOrdersByInterval([In] ref TConnectorAccountIdentifier a_AccountID, byte a_OrderVersion, SystemTime a_dtStart, SystemTime a_dtEnd, IntPtr a_Param, TConnectorEnumerateOrdersProc a_Callback);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int EnumerateAllOrders([In] ref TConnectorAccountIdentifier a_AccountID, byte a_OrderVersion, IntPtr a_Param, TConnectorEnumerateOrdersProc a_Callback);

    [DllImport(dll_path, CallingConvention = CallingConvention.StdCall)]
    public static extern int TranslateTrade(nint a_pTrade, ref TConnectorTrade a_Trade);

    #endregion

    #region Client Functions

    public static void InvalidTickerCallback(TConnectorAssetIdentifier assetId)
    {
        if (string.IsNullOrWhiteSpace(strAssetListFilter) && strAssetListFilter == assetId.Ticker)
        {
            WriteSync($"InvalidTickerCallback: {assetId.Ticker}");
        }
    }

    ////////////////////////////////////////////////////////////////////////////////
    //Callback de alterãção em ordens
    public static void ChangeCotationCallback(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string date, uint tradeNumber, double sPrice)
    {
        WriteSync("changeCotationCallback: " + assetId.Ticker + " : " + date + " : " + sPrice);
    }

    public static void AssetListCallback(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string strName)
    {
        if (string.IsNullOrWhiteSpace(strAssetListFilter) || strAssetListFilter == assetId.Ticker)
        {
            WriteSync($"AssetListCallback: {assetId.Ticker} : {strName}");
        }
    }

    public static void AssetListInfoCallback(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string strName, [MarshalAs(UnmanagedType.LPWStr)] string strDescription, int nMinOrderQtd, int nMaxOrderQtd, int nLote, int stSecurityType, int ssSecuritySubType, double sMinPriceInc, double sContractMultiplier,
        [MarshalAs(UnmanagedType.LPWStr)] string validityDate, [MarshalAs(UnmanagedType.LPWStr)] string strISIN)
    {
        if ((string.IsNullOrWhiteSpace(strAssetListFilter) && !string.IsNullOrWhiteSpace(strISIN)) || strAssetListFilter == assetId.Ticker)
        {
            WriteSync($"AssetListInfoCallback: {assetId.Ticker} : {strName} - {strDescription} : ISIN: {strISIN}");
        }
    }

    public static void AssetListInfoCallbackV2(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string strName, [MarshalAs(UnmanagedType.LPWStr)] string strDescription, int nMinOrderQtd, int nMaxOrderQtd, int nLote, int stSecurityType, int ssSecuritySubType, double sMinPriceInc, double sContractMultiplier,
        [MarshalAs(UnmanagedType.LPWStr)] string validityDate, [MarshalAs(UnmanagedType.LPWStr)] string strISIN, [MarshalAs(UnmanagedType.LPWStr)] string strSetor, [MarshalAs(UnmanagedType.LPWStr)] string strSubSetor, [MarshalAs(UnmanagedType.LPWStr)] string strSegmento)
    {
        if ((string.IsNullOrWhiteSpace(strAssetListFilter) && !string.IsNullOrWhiteSpace(strISIN)) || strAssetListFilter == assetId.Ticker)
        {
            WriteSync($"AssetListInfoCallback: {assetId.Ticker} : {strName} - {strDescription} : ISIN: {strISIN} - Setor: {strSetor}");
        }
    }

    public static void ChangeStateTickerCallback(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string strDate, int nState)
    {
        WriteSync("changeStateTickerCallback: ticker=" + assetId.Ticker + " Date=" + strDate + " nState=" + nState);
    }

    ////////////////////////////////////////////////////////////////////////////////
    //Callback com a lista de contas
    public static void AccountCallback(int nCorretora,
        [MarshalAs(UnmanagedType.LPWStr)] string CorretoraNomeCompleto,
        [MarshalAs(UnmanagedType.LPWStr)] string AccountID,
        [MarshalAs(UnmanagedType.LPWStr)] string NomeTitular)
    {
        WriteSync($"AccountCallback: {AccountID} - {NomeTitular}");
    }

    public static void PriceBookCallback(TAssetID assetId, int nAction, int nPosition, int Side, int nQtd, int nCount, double sPrice, IntPtr pArraySell, IntPtr pArrayBuy)
    {
        List<TGroupPrice> lstBook;

        if (pArraySell != IntPtr.Zero)
        {
            DescriptaPriceArray(pArraySell, m_lstPriceSell);
        }

        if (pArrayBuy != IntPtr.Zero)
        {
            DescriptaPriceArray(pArrayBuy, m_lstPriceBuy);
        }

        if (Side == 0)
            lstBook = m_lstPriceBuy;
        else
            lstBook = m_lstPriceSell;

        TGroupPrice newPrice = new TGroupPrice(sPrice, nCount, nQtd);

        switch (nAction)
        {
            case 0:
                {
                    if (nPosition >= 0 && nPosition < lstBook.Count)
                        lstBook.Insert(lstBook.Count - nPosition, newPrice);
                }
                break;
            case 1:
                {
                    if (nPosition >= 0 && nPosition < lstBook.Count)
                    {
                        TGroupPrice currentPrice = lstBook[lstBook.Count - 1 - nPosition];
                        newPrice.Qtd += currentPrice.Qtd;
                        newPrice.Count += currentPrice.Count;
                    }
                }
                break;
            case 2:
                {
                    if (nPosition >= 0 && nPosition < lstBook.Count)
                        lstBook.RemoveAt(lstBook.Count - nPosition - 1);
                }
                break;
            case 3:
                {
                    if (nPosition >= 0 && nPosition < lstBook.Count)
                        lstBook.RemoveRange(lstBook.Count - nPosition - 1, nPosition + 1);
                }
                break;
            case 4:
                {
                    if (pArraySell != IntPtr.Zero)
                    {
                        DescriptaPriceArray(pArraySell, m_lstPriceSell);
                    }

                    if (pArrayBuy != IntPtr.Zero)
                    {
                        DescriptaPriceArray(pArrayBuy, m_lstPriceBuy);
                    }
                }
                break;
            default: break;
        }
    }

    public static void OfferBookCallbackV2(TAssetID assetId, int nAction, int nPosition, int Side, int nQtd, int nAgent, long nOfferID, double sPrice, int bHasPrice, int bHasQtd, int bHasDate, int bHasOfferID, int bHasAgent, [MarshalAs(UnmanagedType.LPWStr)] string date_str, IntPtr pArraySell, IntPtr pArrayBuy)
    {
        List<TConnectorOffer> lstBook;

        if (Side == 0)
            lstBook = m_lstOfferBuy;
        else
            lstBook = m_lstOfferSell;

        if (!DateTime.TryParseExact(date_str, "dd/MM/yyyy HH:mm:ss.fff", null, DateTimeStyles.None, out DateTime date))
        {
            date = DateTime.MinValue;
        }

        var offer = new TConnectorOffer(sPrice, nQtd, nAgent, nOfferID, date);

        switch (nAction)
        {
            case 0:
                {
                    if (nPosition >= 0 && nPosition < lstBook.Count)
                    {
                        lstBook.Insert(lstBook.Count - nPosition, offer);
                    }
                }
                break;
            case 1:
                {
                    if (nPosition >= 0 && nPosition < lstBook.Count)
                    {
                        TConnectorOffer currentOffer = lstBook[lstBook.Count - 1 - nPosition];
                        if (bHasQtd != 0)
                            currentOffer.Qtd += offer.Qtd;
                        if (bHasPrice != 0)
                            currentOffer.Price = offer.Price;
                        if (bHasOfferID != 0)
                            currentOffer.OfferID = offer.OfferID;
                        if (bHasAgent != 0)
                            currentOffer.Agent = offer.Agent;
                        if (bHasDate != 0)
                            currentOffer.Date = offer.Date;
                        lstBook[lstBook.Count - 1 - nPosition] = currentOffer;
                    }
                }
                break;
            case 2:
                {
                    if (nPosition >= 0 && nPosition < lstBook.Count)
                        lstBook.RemoveAt(lstBook.Count - nPosition - 1);
                }
                break;
            case 3:
                {
                    if (nPosition >= 0 && nPosition < lstBook.Count)
                        lstBook.RemoveRange(lstBook.Count - nPosition - 1, nPosition + 1);
                }
                break;
            case 4:
                {
                    if (pArraySell != IntPtr.Zero)
                    {
                        MarshalOfferBuffer(pArraySell, m_lstOfferSell);
                    }

                    if (pArrayBuy != IntPtr.Zero)
                    {
                        MarshalOfferBuffer(pArrayBuy, m_lstOfferBuy);
                    }
                }
                break;
            default: break;
        }
    }

    public static void TradeCallback(TConnectorAssetIdentifier a_Asset, nint a_pTrade, [MarshalAs(UnmanagedType.U4)] TConnectorTradeCallbackFlags a_nFlags)
    {
        var trade = new TConnectorTrade() { Version = 0 };

        if (TranslateTrade(a_pTrade, ref trade) == NL_OK)
        {
            WriteSync($"TradeCallback: {a_Asset}: {trade} | {a_nFlags}");
        }
    }

    public static void HistoryTradeCallback(TConnectorAssetIdentifier a_Asset, nint a_pTrade, [MarshalAs(UnmanagedType.U4)] TConnectorTradeCallbackFlags a_nFlags)
    {
        var trade = new TConnectorTrade() { Version = 0 };

        if (TranslateTrade(a_pTrade, ref trade) == NL_OK)
        {
            WriteSync($"HistoryTradeCallback: {a_Asset}: {trade} | {a_nFlags}");
        }
    }

    public static void NewDailyCallback(TAssetID assetId, [MarshalAs(UnmanagedType.LPWStr)] string date, double sOpen, double sHigh, double sLow,
        double sClose, double sVol, double sAjuste, double sMaxLimit, double sMinLimit, double sVolBuyer,
        double sVolSeller, int nQtd, int nNegocios, int nContratosOpen, int nQtdBuyer, int nQtdSeller, int nNegBuyer, int nNegSeller)
    {
        WriteSync($"NewDailyCallback: {assetId.Ticker}: {date} {sOpen} {sHigh} {sLow} {sClose}");
    }

    public static void ProgressCallBack(TAssetID assetId, int nProgress)
    {
        WriteSync("progressCallBack");
    }

    public static void NewTinyBookCallBack(TAssetID assetId, double price, int qtd, int side)
    {
        var sideName = side == 0 ? "buy" : "sell";
        WriteSync($"NewTinyBookCallBack: {assetId.Ticker}: {sideName} {price} {qtd}");
    }

    public static void TheoreticalPriceCallback(TAssetID assetId, double dTheoreticalPrice, Int64 nTheoreticalQtd)
    {
        WriteSync($"TheoreticalPriceCallback: {assetId.Ticker}: {dTheoreticalPrice}");
    }

    public static void AdjustHistoryCallbackV2(TAssetID assetId,
        double dValue,
        [MarshalAs(UnmanagedType.LPWStr)] string adjustType,
        [MarshalAs(UnmanagedType.LPWStr)] string strObserv,
        [MarshalAs(UnmanagedType.LPWStr)] string dtAjuste,
        [MarshalAs(UnmanagedType.LPWStr)] string dtDeliber,
        [MarshalAs(UnmanagedType.LPWStr)] string dtPagamento,
        int nFlags,
        double dMult)
    {
        WriteSync($"AdjustHistoryCallbackV2: {assetId.Ticker}: Value={dValue} Type={adjustType}");
    }

    public static void StateCallback(int nConnStateType, int result)
    {

        if (nConnStateType == 0)
        { // notificacoes de login
            if (result == 0)
            {
                WriteSync("Login: Conectado");
            }
            if (result == 1)
            {
                WriteSync("Login: Invalido");
            }
            if (result == 2)
            {
                WriteSync("Login: Senha invalida");
            }
            if (result == 3)
            {
                WriteSync("Login: Senha bloqueada");
            }
            if (result == 4)
            {
                WriteSync("Login: Senha Expirada");
            }
            if (result == 200)
            {
                WriteSync("Login: Erro Desconhecido");
            }
        }
        if (nConnStateType == 1)
        { // notificacoes de broker
            if (result == 0)
            {
                WriteSync("Broker: Desconectado");
            }
            if (result == 1)
            {
                WriteSync("Broker: Conectando");
            }
            if (result == 2)
            {
                WriteSync("Broker: Conectado");
            }
            if (result == 3)
            {
                WriteSync("Broker: HCS Desconectado");
            }
            if (result == 4)
            {
                WriteSync("Broker: HCS Conectando");
            }
            if (result == 5)
            {
                WriteSync("Broker: HCS Conectado");
            }
        }

        if (nConnStateType == 2)
        { // notificacoes de login no Market
            if (result == 0)
            {
                WriteSync("Market: Desconectado");
            }
            if (result == 1)
            {
                WriteSync("Market: Conectando");
            }
            if (result == 2)
            {
                WriteSync("Market: csConnectedWaiting");
            }
            if (result == 3)
            {
                bMarketConnected = false;
                WriteSync("Market: Não logado");
            }
            if (result == 4)
            {
                bMarketConnected = true;
                WriteSync("Market: Conectado");
            }
        }

        if (nConnStateType == 3)
        { // notificacoes de login no Market
            if (result == 0)
            {
                //Atividade: Valida
                bAtivo = true;
                WriteSync("Profit: Notificação de Atividade Valida");
            }
            else
            {
                //Atividade: Invalida
                bAtivo = false;
                WriteSync("Profit: Notificação de Atividade Invalida");
            }
        }
    }

    public static void OrderCallback(TConnectorOrderIdentifier orderId)
    {
        var order = new TConnectorOrderOut()
        {
            Version = 0,
            OrderID = orderId
        };

        if (GetOrderDetails(ref order) != NL_OK) { return; }

        order.AssetID.Ticker = new string(' ', order.AssetID.TickerLength);
        order.AssetID.Exchange = new string(' ', order.AssetID.ExchangeLength);
        order.TextMessage = new string(' ', order.TextMessageLength);

        if (GetOrderDetails(ref order) != NL_OK) { return; }

        WriteSync($"OrderCallback: {order.AssetID.Ticker} | {order.TradedQuantity} | {order.OrderSide} | {order.Price} | {order.AccountID.AccountID} | {order.OrderID.ClOrderID} | {order.OrderStatus} | {order.TextMessage}");
    }

    private static void OrderHistoryCallback(TConnectorAccountIdentifier accountId)
    {
        var count = 0;

        bool CountOrders([In] in TConnectorOrder a_Order, nint a_Param)
        {
            count++;

            return true;
        }

        var result = EnumerateAllOrders(ref accountId, 0, 0, CountOrders);

        if (result != NL_OK) { WriteSync($"{nameof(EnumerateAllOrders)}: {(NResult)result}"); }

        WriteSync($"{nameof(OrderHistoryCallback)}: Total orders: {count}");
    }

    public static void ServerClockPrint()
    {
        double serverClock = 0.0;
        int year = 0, month = 0, day = 0, hour = 0, min = 0, sec = 0, mili = 0;
        GetServerClock(ref serverClock, ref year, ref month, ref day, ref hour, ref min, ref sec, ref mili);
        WriteSync($"Server Clock: {hour}:{min}:{sec}.{mili}");
    }

    public static void DescriptaPriceArray(IntPtr pRetorno, List<TGroupPrice> lstPrice)
    {
        lstPrice.Clear();

        byte[] header = new byte[128];
        Marshal.Copy(pRetorno, header, 0, 128);

        var qtd = BitConverter.ToInt32(header, 0);
        var tam = BitConverter.ToInt32(header, 4);
        var pos = 8;

        byte[] pBuffer = new byte[tam];
        Marshal.Copy(pRetorno, pBuffer, 0, tam);

        WriteSync($"PriceBook: Qtd {qtd} Tam {tam}");

        for (int i = 0; i < qtd; i++)
        {
            var group = new TGroupPrice();

            group.Price = BitConverter.ToDouble(pBuffer, pos);
            pos += 8;

            group.Qtd = BitConverter.ToInt32(pBuffer, pos);
            pos += 4;

            group.Count = BitConverter.ToInt32(pBuffer, pos);
            pos += 4;

            //WriteSync($"Price {group.Price} Qtd {group.Qtd} Count {group.Count}");
            lstPrice.Add(group);
        }

        FreePointer(pRetorno, pos);
    }

    public static void MarshalOfferBuffer(IntPtr buffer, List<TConnectorOffer> lstOffer)
    {
        lstOffer.Clear();
        var offset = 0;

        // lê o cabeçalho
        var qtdOffer = Marshal.ReadInt32(buffer, offset);
        offset += 4;

        var pointerSize = Marshal.ReadInt32(buffer, offset);
        offset += 4;

        // lê as ofertas
        for (int i = 0; i < qtdOffer; i++)
        {
            var bufferOffer = new byte[53];
            Marshal.Copy(buffer + offset, bufferOffer, 0, 53);

            var offer = new TConnectorOffer();

            offer.Price = BitConverter.ToDouble(bufferOffer, 0);
            offer.Qtd = BitConverter.ToInt64(bufferOffer, 8);
            offer.Agent = BitConverter.ToInt32(bufferOffer, 16);
            offer.OfferID = BitConverter.ToInt64(bufferOffer, 20);

            //var length = BitConverter.ToUInt16(bufferOffer, 28);

            var strDate = bufferOffer[30..].Select(x => (char)x);

            offer.Date = DateTime.ParseExact(strDate.ToArray(), "dd/MM/yyyy HH:mm:ss.fff", null);

            lstOffer.Add(offer);

            offset += 53;
        }

        // lê o rodapé
        var trailer = new byte[pointerSize - offset];
        Marshal.Copy(buffer + offset, trailer, 0, trailer.Length);

        var flags = (OfferBookFlags)BitConverter.ToUInt32(trailer);

        WriteSync($"OfferBook: Qtd {qtdOffer} | Tam {pointerSize} | {flags}");

        FreePointer(buffer, pointerSize);
    }

    #endregion

    #region Exemplo de execucao

    static string strAssetListFilter = "";

    private static void SubscribeAsset()
    {
        //Selecionar ativo para callback

        string input;

        do
        {
            Console.Write("Insira o codigo do ativo e clique enter: ");
            input = Console.ReadLine().ToUpper();
        } while (!Regex.IsMatch(input, "[^:]+:[A-Za-z0-9]"));

        var split = input.Split(':');

        var retVal = SubscribeTicker(split[0], split[1]);

        if (retVal == NL_OK)
        {
            WriteSync("Subscribe com sucesso");
        }
        else
        {
            WriteSync($"Erro no subscribe: {retVal}");
        }
    }

    private static void DoSubscribeOfferBook()
    {
        //Selecionar ativo para callback

        string input;

        do
        {
            Console.Write("Insira o codigo do ativo e clique enter: ");
            input = Console.ReadLine().ToUpper();
        } while (!Regex.IsMatch(input, "[^:]+:[A-Za-z0-9]"));

        var split = input.Split(':');

        var retVal = SubscribeOfferBook(split[0], split[1]);

        if (retVal == NL_OK)
        {
            WriteSync("Subscribe com sucesso");
        }
        else
        {
            WriteSync($"Erro no subscribe: {(NResult)retVal}");
        }
    }

    private static void UnsubscribeAsset()
    {
        //Selecionar ativo para callback

        string input;

        do
        {
            Console.Write("Insira o codigo do ativo e clique enter: ");
            input = Console.ReadLine().ToUpper();
        } while (!Regex.IsMatch(input, "[^:]+:[A-Za-z0-9]"));

        var split = input.Split(':');

        var retVal = UnsubscribeTicker(split[0], split[1]);

        if (retVal == NL_OK)
        {
            WriteSync("Subscribe com sucesso");
        }
        else
        {
            WriteSync($"Erro no subscribe: {retVal}");
        }
    }

    private static void RequestHistory()
    {
        string input;

        do
        {
            Console.Write("Insira o codigo do ativo e clique enter (ex. PETR4:B): ");
            input = Console.ReadLine().ToUpper();
        } while (!Regex.IsMatch(input, "[^:]+:[A-Za-z0-9]"));

        var split = input.Split(':');

        var retVal = GetHistoryTrades(split[0], split[1], DateTime.Today.ToString(dateFormat), DateTime.Now.ToString(dateFormat));

        if (retVal == NL_OK)
        {
            WriteSync("GetHistoryTrades com sucesso");
        }
        else
        {
            WriteSync($"Erro no GetHistoryTrades: {retVal}");
        }
    }

    public static void RequestOrder()
    {
        WriteSync("Informe um ClOrdId: ");
        var retVal = GetOrder(Console.ReadLine());

        if (retVal == NL_OK)
        {
            WriteSync("GetOrder com sucesso");
        }
        else
        {
            WriteSync($"Erro no GetOrder: {retVal}");
        }
    }

    private static void DoGetPosition()
    {
        var assetId = ReadAssetID();
        var accountId = ReadAccountId();

        string input;
        do
        {
            Console.Write("Tipo da posição (1 - day trade, 2 - consolidado): ");
            input = Console.ReadLine();
        } while (input != "1" && input == "2");

        var positionType = (TConnectorPositionType)byte.Parse(input);

        var position = new TConnectorTradingAccountPosition()
        {
            Version = 1,
            AssetID = assetId,
            AccountID = accountId,
            PositionType = positionType
        };

        var retVal = GetPositionV2(ref position);

        if (retVal == NL_OK)
        {
            WriteSync($"{position.OpenSide} | {position.OpenAveragePrice} | {position.OpenQuantity}");
            WriteSync($"{position.DailyAverageBuyPrice} | {position.DailyAverageSellPrice} | {position.DailyBuyQuantity} | {position.DailySellQuantity}");
        }
        else
        {
            WriteSync($"Erro no GetPositionV2: {retVal}");
        }
    }

    private static TConnectorAccountIdentifier ReadAccountId()
    {
        string input;

        do
        {
            Console.Write("Código do conta (ex 1171:12345:1): ");
            input = Console.ReadLine();
        } while (!Regex.IsMatch(input, @"\d+:\d+(:\d+)?"));

        var numbers = input.Split(':');

        var retVal = new TConnectorAccountIdentifier()
        {
            Version = 0,
            BrokerID = int.Parse(numbers[0]),
            AccountID = numbers[1],
            SubAccountID = ""
        };

        if (numbers.Length == 3)
        {
            retVal.SubAccountID = numbers[2];
        }

        return retVal;
    }

    private static TConnectorAssetIdentifier ReadAssetID()
    {
        string input;

        do
        {
            Console.Write("Código do ativo (ex PETR4:B): ");
            input = Console.ReadLine().ToUpper();
        } while (!Regex.IsMatch(input, "[^:]+:[A-Za-z0-9]"));

        return new TConnectorAssetIdentifier()
        {
            Version = 0,
            Ticker = input[..input.IndexOf(':')],
            Exchange = input[(input.IndexOf(':') + 1)..]
        };
    }

    private static void DoZeroPosition()
    {
        string input;

        do
        {
            Console.Write("Código do ativo (ex PETR4:B): ");
            input = Console.ReadLine().ToUpper();
        } while (!Regex.IsMatch(input, "[^:]+:[A-Za-z0-9]"));

        var assetId = new TConnectorAssetIdentifier()
        {
            Version = 0,
            Ticker = input[..input.IndexOf(':')],
            Exchange = input[(input.IndexOf(':') + 1)..]
        };

        do
        {
            Console.Write("Código do conta (ex 1171:12345:1): ");
            input = Console.ReadLine();
        } while (!Regex.IsMatch(input, @"\d+:\d+(:\d+)?"));

        var numbers = input.Split(':');

        var accountId = new TConnectorAccountIdentifier()
        {
            Version = 0,
            BrokerID = int.Parse(numbers[0]),
            AccountID = numbers[1],
            SubAccountID = ""
        };

        if (numbers.Length == 3)
        {
            accountId.SubAccountID = numbers[2];
        }

        do
        {
            Console.Write("Tipo da posição (1 - day trade, 2 - consolidado): ");
            input = Console.ReadLine();
        } while (input != "1" && input == "2");

        var positionType = (TConnectorPositionType)byte.Parse(input);

        var zeroOrder = new TConnectorZeroPosition()
        {
            Version = 1,
            AssetID = assetId,
            AccountID = accountId,
            PositionType = positionType,
            Password = ReadPassword(),
            Price = -1
        };

        var retVal = SendZeroPositionV2(ref zeroOrder);

        if (retVal == NL_OK)
        {
            WriteSync($"Sucesso no SendZeroPositionV2: {retVal}");
        }
        else
        {
            WriteSync($"Erro no SendZeroPositionV2: {retVal}");
        }
    }

    private static void DoGetOrders()
    {
        var count = 0;

        bool EnumOrders([In] in TConnectorOrder a_Order, nint a_Param)
        {
            WriteSync($"{nameof(EnumOrders)}: {a_Order}");

            if (a_Order.Quantity == 100) { count++; }

            return true;
        }

        var accountId = ReadAccountId();

        var ret = EnumerateOrdersByInterval(ref accountId, 0, SystemTime.FromDateTime(DateTime.Now.AddHours(-1)), SystemTime.FromDateTime(DateTime.Now.AddMinutes(-1)), 0, EnumOrders);

        if (ret != NL_OK) { WriteSync($"{nameof(EnumerateOrdersByInterval)}: {(NResult)ret}"); }

        WriteSync($"{nameof(EnumerateOrdersByInterval)}: Orders with 100 quantity: {count}");
    }

    private static int StartDLL(string key, string user, string password)
    {
        int retVal;
        bool bRoteamento = true;
        if (bRoteamento)
        {
            retVal = DLLInitializeLogin(key, user, password, _stateCallback, null, null, _accountCallback, null, _newDailyCallback, _priceBookCallback, null, null, _progressCallBack, _newTinyBookCallBack);
        }
        else
        {
            retVal = DLLInitializeMarketLogin(key, user, password, _stateCallback, null, _newDailyCallback, _priceBookCallback, null, null, _progressCallBack, _newTinyBookCallBack);
        }

        if (retVal != NL_OK)
        {
            WriteSync($"Erro na inicialização: {retVal}");
        }
        else
        {
            SetTradeCallbackV2(_TradeCallback);
            SetHistoryTradeCallbackV2(_HistoryTradeCallback);
            SetOrderCallback(_orderCallback);
            SetOrderHistoryCallback(_orderHistoryCallback);
            SetOfferBookCallbackV2(_offerBookCallbackV2);
            SetAssetListInfoCallbackV2(_assetListInfoCallbackV2);
            SetAdjustHistoryCallbackV2(_adjustHistoryCallbackV2);
        }

        return retVal;
    }

    public static void Main(string[] args)
    {
        Console.Write("Chave de ativação: ");
        string key = Console.ReadLine();

        Console.Write("Usuário: ");
        string user = Console.ReadLine();

        string password = ReadPassword();

        if (StartDLL(key, user, password) != NL_OK)
        {
            return;
        }

        var terminate = false;
        while (!terminate)
        {
            try
            {
                if (bMarketConnected && bAtivo)
                {
                    WriteSync("Comando: ");

                    var input = Console.ReadLine();
                    switch (input)
                    {
                        case "subscribe":
                            SubscribeAsset();
                            break;
                        case "unsubscribe":
                            UnsubscribeAsset();
                            break;
                        case "offerbook":
                            DoSubscribeOfferBook();
                            break;
                        case "request history":
                            RequestHistory();
                            break;
                        case "request order":
                            RequestOrder();
                            break;
                        case "get position":
                            DoGetPosition();
                            break;
                        case "zero position":
                            DoZeroPosition();
                            break;
                        case "get orders":
                            DoGetOrders();
                            break;
                        case "exit":
                            terminate = true;
                            break;
                        default:
                            break;
                    }
                }
            }
            catch (Exception ex)
            {
                WriteSync(ex.Message);
            }
        }

    }

    private static readonly object writeLock = new object();
    private static void WriteSync(string text)
    {
        lock (writeLock)
        {
            Console.WriteLine(text);
        }
    }
    #endregion
}
