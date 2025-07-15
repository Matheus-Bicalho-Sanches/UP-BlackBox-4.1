unit dataTypesU;

interface

uses
  WinApi.Windows;

type
{$POINTERMATH ON}
  PConnectorAccountIdentifierArrayOut = ^TConnectorAccountIdentifierOut;
  PByteArrayInOut         = ^Byte;
  PIntegerArrayInOut      = ^Integer;
{$POINTERMATH OFF}

  TTickerLength = 0..49;
  TTicker       = array [TTickerLength] of WideChar;
  TString0In    = array[0 .. 99] of WideChar;

  TConnectorOrderType = (
    cotMarket    = 1,
    cotLimit     = 2,
    cotStopLimit = 4
  );

  TConnectorOrderSide = (
    cosBuy  = 1,
    cosSell = 2
  );

  TConnectorAccountIdentifier = record
    Version : Byte;

    // V0
    BrokerID     : Integer;
    AccountID    : PWideChar;
    SubAccountID : PWideChar;
    Reserved     : Int64;
  end;
  PConnectorAccountIdentifier = ^TConnectorAccountIdentifier;

  TConnectorAccountIdentifierOut = record
    Version : Byte;

    // V0
    BrokerID           : Integer;
    AccountID          : TString0In;
    AccountIDLength    : Integer;
    SubAccountID       : TString0In;
    SubAccountIDLength : Integer;
    Reserved           : Int64;
  end;
  PConnectorAccountIdentifierOut = ^TConnectorAccountIdentifierOut;

  TConnectorAssetIdentifier = record
    Version : Byte;

    // V0
    Ticker   : PWideChar;
    Exchange : PWideChar;
    FeedType : Byte;
  end;

  TConnectorAssetIdentifierOut = record
    Version : Byte;

    // V0
    Ticker         : PWideChar;
    TickerLength   : Integer;
    Exchange       : PWideChar;
    ExchangeLength : Integer;
    FeedType : Byte;
  end;

  TConnectorOrderIdentifier = record
    Version : Byte;

    // V0
    LocalOrderID : Int64;
    ClOrderID    : PWideChar;
  end;

  TConnectorSendOrder = record
    Version : Byte;

    // V0
    AccountID : TConnectorAccountIdentifier;
    AssetID   : TConnectorAssetIdentifier;
    Password  : PWideChar;
    OrderType : Byte; // TConnectorOrderType
    OrderSide : Byte; // TConnectorOrderSide

    Price     : Double;
    StopPrice : Double;
    Quantity  : Int64;
  end;
  PConnectorSendOrder = ^TConnectorSendOrder;

  TConnectorChangeOrder = record
    Version : Byte;

    // V0
    AccountID : TConnectorAccountIdentifier;
    OrderID   : TConnectorOrderIdentifier;
    Password  : PWideChar;

    Price     : Double;
    StopPrice : Double;
    Quantity  : Int64;
  end;
  PConnectorChangeOrder = ^TConnectorChangeOrder;

  TConnectorCancelOrder = record
    Version : Byte;

    // V0
    AccountID : TConnectorAccountIdentifier;
    OrderID   : TConnectorOrderIdentifier;
    Password  : PWideChar;
  end;
  PConnectorCancelOrder = ^TConnectorCancelOrder;

  TConnectorCancelOrders = record
    Version : Byte;

    // V0
    AccountID : TConnectorAccountIdentifier;
    AssetID   : TConnectorAssetIdentifier;
    Password  : PWideChar;
  end;
  PConnectorCancelOrders = ^TConnectorCancelOrders;

  TConnectorCancelAllOrders = record
    Version : Byte;

    // V0
    AccountID : TConnectorAccountIdentifier;
    Password  : PWideChar;
  end;
  PConnectorCancelAllOrders = ^TConnectorCancelAllOrders;

  TConnectorZeroPosition = record
    Version : Byte;

    // V0
    AccountID : TConnectorAccountIdentifier;
    AssetID   : TConnectorAssetIdentifier;
    Password  : PWideChar;
    Price     : Double;

    // V1
    PositionType : Byte;
  end;
  PConnectorZeroPosition = ^TConnectorZeroPosition;

  TConnectorTradingAccountOut = record
    Version : Byte;

    // In Fields
    AccountID : TConnectorAccountIdentifier;

    // Out fields
    BrokerName         : PWideChar;
    BrokerNameLength   : Integer;

    OwnerName          : PWideChar;
    OwnerNameLength    : Integer;

    SubOwnerName       : PWideChar;
    SubOwnerNameLength : Integer;

    AccountFlags       : Cardinal;
  end;
  PConnectorTradingAccountOut = ^TConnectorTradingAccountOut;

  TConnectorTradingAccountPosition = record
    Version : Byte;

    // In Fields
    AccountID : TConnectorAccountIdentifier;
    AssetID   : TConnectorAssetIdentifier;

    // Out Fields
    OpenQuantity           : Int64;
    OpenAveragePrice       : Double;
    OpenSide               : Byte; // TBrokerOrderSide

    DailyAverageSellPrice  : Double;
    DailySellQuantity      : Int64;
    DailyAverageBuyPrice   : Double;
    DailyBuyQuantity       : Int64;

    DailyQuantityD1        : Int64;
    DailyQuantityD2        : Int64;
    DailyQuantityD3        : Int64;
    DailyQuantityBlocked   : Int64;
    DailyQuantityPending   : Int64;
    DailyQuantityAlloc     : Int64;
    DailyQuantityProvision : Int64;
    DailyQuantity          : Int64;
    DailyQuantityAvailable : Int64;

    // V1
    PositionType           : Byte;
  end;
  PConnectorTradingAccountPosition = ^TConnectorTradingAccountPosition;

  TConnectorOrder = record
    Version : Byte;

    OrderID           : TConnectorOrderIdentifier;
    AccountID         : TConnectorAccountIdentifier;
    AssetID           : TConnectorAssetIdentifier;

    Quantity          : Int64;
    TradedQuantity    : Int64;
    LeavesQuantity    : Int64;

    Price             : Double;
    StopPrice         : Double;
    AveragePrice      : Double;

    OrderSide         : Byte;
    OrderType         : Byte;
    OrderStatus       : Byte;
    ValidityType      : Byte;

    Date              : TSystemTime;
    LastUpdate        : TSystemTime;
    CloseDate         : TSystemTime;
    ValidityDate      : TSystemTime;

    TextMessage       : PWideChar;
  end;
  PConnectorOrder = ^TConnectorOrder;

  TConnectorOrderOut = record
    Version : Byte;

    // In Fields
    OrderID           : TConnectorOrderIdentifier;

                              // Out Fields
    AccountID         : TConnectorAccountIdentifierOut;
    AssetID           : TConnectorAssetIdentifierOut;

    Quantity          : Int64;
    TradedQuantity    : Int64;
    LeavesQuantity    : Int64;

    Price             : Double;
    StopPrice         : Double;
    AveragePrice      : Double;

    OrderSide         : Byte; // TBrokerOrderSide
    OrderType         : Byte; // TBrokerOrderType
    OrderStatus       : Byte; // TBrokerOrderStatus
    ValidityType      : Byte; // TBrokerTimeInForce

    Date              : TSystemTime;
    LastUpdate        : TSystemTime;
    CloseDate         : TSystemTime;
    ValidityDate      : TSystemTime;

    TextMessage       : PWideChar;
    TextMessageLength : Integer;
  end;
  PConnectorOrderOut = ^TConnectorOrderOut;

  TConnectorTrade = record
    Version     : Byte;
    TradeDate   : TSystemTime;
    TradeNumber : Cardinal;
    Price       : Double;
    Quantity    : Int64;
    Volume      : Double;
    BuyAgent    : Integer;
    SellAgent   : Integer;
    TradeType   : Byte;
  end;
  PConnectorTrade = ^TConnectorTrade;

  TConnectorEnumerateOrdersProc = function(
    const a_Order : PConnectorOrder;
    const a_Param : LPARAM
  ) : BOOL; stdcall;

const
  // TConnectorTradingAccountOut.Flags
  CA_IS_SUB_ACCOUNT : Cardinal = 1;
  CA_IS_ENABLED     : Cardinal = 2;

implementation

end.
