unit functionWrapperU;

interface

uses
  dataTypesU,
  callbackTypeU,
  Winapi.Windows;

const
{$IFDEF CPUX64}
  {$IFDEF DEBUG}
    c_strDLLPath = 'ProfitDLL.dll';
  {$ELSE}
    c_strDLLPath = 'ProfitDLL64.dll';
  {$ENDIF}
{$ELSE}
  c_strDLLPath = 'ProfitDLL.dll';
{$ENDIF}
{$IFDEF DEBUG}
function SetServerAndPortRoteamento(strServer, strPort: PWideChar) : Integer; stdcall; external c_strDLLPath;
{$ENDIF}

function DLLInitializeLogin (
  const pwcActivationKey  : PWideChar;
  const pwcUser           : PWideChar;
  const pwcPassword       : PWideChar;
  StateCallback           : TStateCallback;

  HistoryCallback         : THistoryCallback;
  OrderChangeCallback     : TOrderChangeCallback;
  AccountCallback         : TAccountCallback;

  TradeCallback           : TTradeCallback;
  NewDailyCallback        : TDailyCallback;

  PriceBookCallback       : TPriceBookCallback;
  OfferBookCallback       : TOfferBookCallback;

  HistoryTradeCallback    : THistoryTradeCallback;
  ProgressCallback        : TProgressCallback;
  TinyBookCallback        : TTinyBookCallback
) : Integer; stdcall; external c_strDLLPath;

function DLLInitializeMarketLogin (
  const pwcActivationKey  : PWideChar;
  const pwcUser           : PWideChar;
  const pwcPassword       : PWideChar;
  StateCallback           : TStateCallback;
  TradeCallback           : TTradeCallback;
  NewDailyCallback        : TDailyCallback;

  PriceBookCallback       : TPriceBookCallback;
  OfferBookCallback       : TOfferBookCallback;

  HistoryTradeCallback    : THistoryTradeCallback;
  ProgressCallback        : TProgressCallback;
  TinyBookCallback        : TTinyBookCallback
) : Integer; stdcall; external c_strDLLPath;

function InitializeCustom (
  const pwcActivationKey  : PWideChar;
  StateCallback           : TStateCallback
) : Integer; stdcall; external c_strDLLPath;

function DLLFinalize: Integer; stdcall; external c_strDLLPath;

function  SetEnabledLogToDebug (a_bEnabled : Integer) : Integer; stdcall; external c_strDLLPath;
function  SetEnabledHistOrder  (a_bEnabled : Integer) : Integer; stdcall; external c_strDLLPath;


function SubscribeTicker          (const pwcTicker : PWideChar; const pwcBolsa : PWideChar) : Integer; stdcall; external c_strDLLPath;
function UnsubscribeTicker        (const pwcTicker : PWideChar; const pwcBolsa : PWideChar) : Integer; stdcall; external c_strDLLPath;

function SubscribePriceBook       (const pwcTicker : PWideChar; const pwcBolsa : PWideChar) : Integer; stdcall; external c_strDLLPath;
function UnsubscribePriceBook     (const pwcTicker : PWideChar; const pwcBolsa : PWideChar) : Integer; stdcall; external c_strDLLPath;

function SubscribeOfferBook       (const pwcTicker : PWideChar; const pwcBolsa : PWideChar) : Integer; stdcall; external c_strDLLPath;
function UnsubscribeOfferBook     (const pwcTicker : PWideChar; const pwcBolsa : PWideChar) : Integer; stdcall; external c_strDLLPath;

function SubscribeAdjustHistory   (const pwcTicker : PWideChar; const pwcBolsa : PWideChar) : Integer; stdcall; external c_strDLLPath;
function UnsubscribeAdjustHistory (const pwcTicker : PWideChar; const pwcBolsa : PWideChar) : Integer; stdcall; external c_strDLLPath;

function GetAgentNameByID         (nID : Integer  ) : PWideChar; stdcall; external c_strDLLPath;
function GetAgentShortNameByID    (nID : Integer  ) : PWideChar; stdcall; external c_strDLLPath;

function GetHistoryTrades         (const pwcTicker : PWideChar; const pwcBolsa : PWideChar; dtDateStart, dtDateEnd : PWideChar) : Integer; stdcall; external c_strDLLPath;
function GetSerieHistory          (const pwcTicker : PWideChar; const pwcBolsa : PWideChar; dtDateStart, dtDateEnd : PWideChar; const nQuoteNumberStart, nQuoteNumberEnd : Cardinal) : Integer; stdcall; external c_strDLLPath;

function RequestTickerInfo        (const pwcTicker : PWideChar; const pwcBolsa : PWideChar) : Integer; stdcall; external c_strDLLPath;

function GetLastDailyClose        (const pwcTicker, pwcBolsa: PWideChar; var a_dClose: Double; bAdjusted : Integer): Integer; stdcall; external c_strDLLPath;

function SendBuyOrder(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  sSenha         : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar;
  sPrice         : Double;
  nAmount        : Integer
): Int64; stdcall; external c_strDLLPath;

function SendSellOrder(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  sSenha         : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar;
  sPrice         : Double;
  nAmount        : Integer
): Int64; stdcall; external c_strDLLPath;

function SendStopBuyOrder(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  sSenha         : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar;
  sPrice         : Double;
  sStopPrice     : Double;
  nAmount        : Integer
): Int64; stdcall; external c_strDLLPath;

function SendStopSellOrder(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  sSenha         : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar;
  sPrice         : Double;
  sStopPrice     : Double;
  nAmount        : Integer
): Int64; stdcall; external c_strDLLPath;

function SendMarketSellOrder(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  sSenha         : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar;
  nAmount        : Integer
): Int64; stdcall; external c_strDLLPath;

function SendMarketBuyOrder(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  sSenha         : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar;
  nAmount        : Integer
): Int64; stdcall; external c_strDLLPath;

function SendChangeOrder(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  sSenha         : PWideChar;
  pwcClOrdID     : PWideChar;
  sPrice         : Double;
  nAmount        : Integer
): Integer; stdcall; external c_strDLLPath;

function SendCancelOrder(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  pwcClOrdId     : PWideChar;
  pwcSenha       : PWideChar
): Integer; stdcall; external c_strDLLPath;

function SendCancelAllOrders(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  pwcSenha       : PWideChar
): Integer; stdcall; external c_strDLLPath;

function SendCancelOrders(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  pwcSenha       : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar
): Integer; stdcall; external c_strDLLPath;

function SendZeroPosition(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar;
  pwcSenha       : PWideChar;
  sPrice         : Double
): Int64; stdcall; external c_strDLLPath;

function SendZeroPositionAtMarket(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar;
  pwcSenha       : PWideChar
): Int64; stdcall; external c_strDLLPath;

function GetOrders(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  dtStart        : PWideChar;
  dtEnd          : PWideChar
) : Integer; stdcall; external c_strDLLPath;

function GetOrder(pwcClOrdId : PWideChar): Integer; stdcall; external c_strDLLPath;

function GetOrderProfitID(nProfitId : Int64): Integer; stdcall; external c_strDLLPath;

function GetPosition(
  pwcIDAccount   : PWideChar;
  pwcIDCorretora : PWideChar;
  pwcTicker      : PWideChar;
  pwcBolsa       : PWideChar
): Pointer ; stdcall; external c_strDLLPath;

function GetAccount : Integer; stdcall; external c_strDLLPath;

function SetDayTrade(bUseDayTrade : Integer ): Integer ;stdcall; external c_strDLLPath;

// --- NEW --- //

function SendOrder             (const a_SendOrder    : PConnectorSendOrder)       : Int64;   stdcall; external c_strDLLPath;
function SendChangeOrderV2     (const a_ChangeOrder  : PConnectorChangeOrder)     : Integer; stdcall; external c_strDLLPath;
function SendCancelOrderV2     (const a_CancelOrder  : PConnectorCancelOrder)     : Integer; stdcall; external c_strDLLPath;
function SendCancelOrdersV2    (const a_CancelOrder  : PConnectorCancelOrders)    : Integer; stdcall; external c_strDLLPath;
function SendCancelAllOrdersV2 (const a_CancelOrder  : PConnectorCancelAllOrders) : Integer; stdcall; external c_strDLLPath;
function SendZeroPositionV2    (const a_ZeroPosition : PConnectorZeroPosition)    : Int64;   stdcall; external c_strDLLPath;

function GetAccountCount : Integer; stdcall; external c_strDLLPath;

function GetAccounts(
  const a_nStartSource : Integer;
  const a_nStartDest   : Integer;
  const a_nCount       : Integer;
  const a_arAccounts   : PConnectorAccountIdentifierArrayOut
) : Integer; stdcall; external c_strDLLPath;

function GetAccountDetails(var a_Account : TConnectorTradingAccountOut) : Integer; stdcall; external c_strDLLPath;

function GetSubAccountCount(const a_MasterAccountID : PConnectorAccountIdentifier) : Integer; stdcall; external c_strDLLPath;

function GetSubAccounts(
  const a_MasterAccountID : PConnectorAccountIdentifier;
  const a_nStartSource    : Integer;
  const a_nStartDest      : Integer;
  const a_nCount          : Integer;
  const a_arAccounts      : PConnectorAccountIdentifierArrayOut
) : Integer; stdcall; external c_strDLLPath;

function GetPositionV2(var a_Position : TConnectorTradingAccountPosition) : Integer; stdcall; external c_strDLLPath;

function GetOrderDetails(var a_Order : TConnectorOrderOut) : Integer; stdcall; external c_strDLLPath;

function HasOrdersInInterval(const a_AccountID : PConnectorAccountIdentifier; const a_dtStart : TSystemTime; const a_dtEnd : TSystemTime) : Integer; stdcall; external c_strDLLPath;

function EnumerateOrdersByInterval(
  const a_AccountID    : PConnectorAccountIdentifier;
  const a_OrderVersion : Byte;
  const a_dtStart      : TSystemTime;
  const a_dtEnd        : TSystemTime;
  const a_Param        : LPARAM;
  const a_Callback     : TConnectorEnumerateOrdersProc
) : Integer; stdcall; external c_strDLLPath;

function EnumerateAllOrders(
  const a_AccountID    : PConnectorAccountIdentifier;
  const a_OrderVersion : Byte;
  const a_Param        : LPARAM;
  const a_Callback     : TConnectorEnumerateOrdersProc
) : Integer; stdcall; external c_strDLLPath;

function TranslateTrade(const a_pTrade : Pointer; var a_Trade : TConnectorTrade) : Integer; stdcall; external c_strDLLPath;

function FreePointer(pPointer : Pointer; nStart : Integer): Integer ; stdcall; external c_strDLLPath;
function ConnectorSetServerAndPort(const strServer, strPort : String) : Integer; stdcall; external c_strDLLPath;
function ConnectorSetServerAndPortRoteamento(const strServer, strPort : String) : Integer; stdcall; external c_strDLLPath;
function SetServerAndPort(const strServer, strPort : PWideChar) : Integer; stdcall; external c_strDLLPath;
function GetLocationInfo(Addr : Pointer): PWideChar; stdcall; external c_strDLLPath;
function GetServerClock(var dtDate : TDateTime; var nYear, nMonth, nDay, nHour, nMin, nSec, nMilisec : Integer) : Integer; stdcall; external c_strDLLPath;

function  SetStateCallback             (const a_StateCallback            : TStateCallback)            : Integer; stdcall; external c_strDLLPath;
function  SetAssetListCallback         (const a_AssetListCallback        : TAssetListCallback)        : Integer; stdcall; external c_strDLLPath;
function  SetAssetListInfoCallback     (const a_AssetListInfoCallback    : TAssetListInfoCallback)    : Integer; stdcall; external c_strDLLPath;
function  SetAssetListInfoCallbackV2   (const a_AssetListInfoCallbackV2  : TAssetListInfoCallbackV2)  : Integer; stdcall; external c_strDLLPath;
function  SetInvalidTickerCallback     (const a_InvalidTickerCallback    : TInvalidTickerCallback)    : Integer; stdcall; external c_strDLLPath;
function  SetTradeCallback             (const a_TradeCallback            : TTradeCallback)            : Integer; stdcall; external c_strDLLPath;
function  SetHistoryTradeCallback      (const a_HistoryTradeCallback     : THistoryTradeCallback)     : Integer; stdcall; external c_strDLLPath;
function  SetDailyCallback             (const a_DailyCallback            : TDailyCallback)            : Integer; stdcall; external c_strDLLPath;
function  SetTheoreticalPriceCallback  (const a_TheoreticalPriceCallback : TTheoreticalPriceCallback) : Integer; stdcall; external c_strDLLPath;
function  SetTinyBookCallback          (const a_TinyBookCallback         : TTinyBookCallback)         : Integer; stdcall; external c_strDLLPath;
function  SetChangeCotationCallback    (const a_ChangeCotation           : TChangeCotation)           : Integer; stdcall; external c_strDLLPath;
function  SetChangeStateTickerCallback (const a_ChangeStateTicker        : TChangeStateTicker)        : Integer; stdcall; external c_strDLLPath;
function  SetSerieProgressCallback     (const a_SerieProgressCallback    : TProgressCallback)         : Integer; stdcall; external c_strDLLPath;
function  SetOfferBookCallback         (const a_OfferBookCallback        : TOfferBookCallback)        : Integer; stdcall; external c_strDLLPath;
function  SetOfferBookCallbackV2       (const a_OfferBookCallbackV2      : TOfferBookCallbackV2)      : Integer; stdcall; external c_strDLLPath;
function  SetPriceBookCallback         (const a_PriceBookCallback        : TPriceBookCallback)        : Integer; stdcall; external c_strDLLPath;
function  SetPriceBookCallbackV2       (const a_PriceBookCallbackV2      : TPriceBookCallbackV2)      : Integer; stdcall; external c_strDLLPath;
function  SetAdjustHistoryCallback     (const a_AdjustHistoryCallback    : TAdjustHistoryCallback)    : Integer; stdcall; external c_strDLLPath;
function  SetAdjustHistoryCallbackV2   (const a_AdjustHistoryCallbackV2  : TAdjustHistoryCallbackV2)  : Integer; stdcall; external c_strDLLPath;

function  SetTradeCallbackV2           (const a_TradeCallbackV2          : TConnectorTradeCallback)   : Integer; stdcall; external c_strDLLPath;
function  SetHistoryTradeCallbackV2    (const a_HistoryTradeCallbackV2   : TConnectorTradeCallback)   : Integer; stdcall; external c_strDLLPath;

function  SetAccountCallback           (const a_AccountCallback          : TAccountCallback)          : Integer; stdcall; external c_strDLLPath;
function  SetHistoryCallback           (const a_HistoryCallback          : THistoryCallback)          : Integer; stdcall; external c_strDLLPath;
function  SetHistoryCallbackV2         (const a_HistoryCallbackV2        : THistoryCallbackV2)        : Integer; stdcall; external c_strDLLPath;
function  SetOrderChangeCallback       (const a_OrderChangeCallback      : TOrderChangeCallback)      : Integer; stdcall; external c_strDLLPath;
function  SetOrderChangeCallbackV2     (const a_OrderChangeCallbackV2    : TOrderChangeCallbackV2)    : Integer; stdcall; external c_strDLLPath;

function  SetOrderCallback             (const a_OrderCallback            : TConnectorOrderCallback)   : Integer; stdcall; external c_strDLLPath;
function  SetOrderHistoryCallback      (const a_OrderHistoryCallback     : TConnectorAccountCallback) : Integer; stdcall; external c_strDLLPath;

implementation
end.
