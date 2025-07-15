unit callbackWrapperU;

interface

uses
  callbackTypeU,
  SysUtils,
  TypInfo,
  Classes,
  System.Generics.Collections,
  dataTypesU,
  structs;
  procedure StateCallback                                      (nConnStateType , nResult : Integer) stdcall; forward;
  procedure AccountCallback                                                  (nCorretora : Integer;
                                           CorretoraNomeCompleto, AccountID, NomeTitular : PWideChar) stdcall; forward;

  procedure NewDailyCallback                                                   (rAssetID : TAssetIDRec;
                                                                                 pwcDate : PWideChar;
  sOpen, sHigh, sLow, sClose, sVol, sAjuste, sMaxLimit, sMinLimit, sVolBuyer, sVolSeller : Double;
           nQtd, nNegocios, nContratosOpen, nQtdBuyer, nQtdSeller, nNegBuyer, nNegSeller : Integer) stdcall; forward;
  procedure PriceBookCallback                                                  (rAssetID : TAssetIDRec ;
                                                nAction , nPosition, Side, nQtds, nCount : Integer;
                                                                                  sPrice : Double;
                                                                   pArraySell, pArrayBuy : Pointer)  stdcall; forward;
  procedure OfferBookCallback                                                  (rAssetID : TAssetIDRec ;
                                                  nAction, nPosition, Side, nQtd, nAgent : Integer;
                                                                                nOfferID : Int64;
                                                                                  sPrice : Double;
                                    bHasPrice, bHasQtd, bHasDate, bHasOfferID, bHasAgent : Char;
                                                                                pwcDate  : PWideChar;
                                                                   pArraySell, pArrayBuy : Pointer) stdcall; forward;
  procedure PriceBookCallbackV2(
    rAssetID   : TAssetIDRec ;
    nAction    : Integer;
    nPosition  : Integer;
    Side       : Integer;
    nQtds      : Int64;
    nCount     : Int64;
    sPrice     : Double;
    pArraySell : Pointer;
    pArrayBuy  : Pointer)  stdcall; forward;
  procedure OfferBookCallbackV2                                                (rAssetID : TAssetIDRec ;
                                                                nAction, nPosition, Side : Integer;
                                                                                    nQtd : Int64;
                                                                                  nAgent : Integer;
                                                                                nOfferID : Int64;
                                                                                  sPrice : Double;
                                    bHasPrice, bHasQtd, bHasDate, bHasOfferID, bHasAgent : Char;
                                                                                pwcDate  : PWideChar;
                                                                   pArraySell, pArrayBuy : Pointer) stdcall; forward;

  procedure ProgressCallback                                                   (rAssetID : TAssetIDRec;
                                                                               nProgress : Integer) stdcall; forward;
  procedure TinyBookCallback                                                  (rAssetID  : TAssetIDRec;
                                                                               sPrice    : Double;
                                                                             nQtd, nSide : Integer) stdcall; forward;
  procedure AssetListCallback                                                   (AssetID : TAssetIDRec;
                                                                                 pwcName : PWideChar) stdcall; forward;
  procedure AssetListInfoCallback                                              (rAssetID : TAssetIDRec;
                                                                 pwcName, pwcDescription : PwideChar;
                    nMinOrderQtd, nMaxOrderQtd, nLote, stSecurityType, ssSecuritySubType : Integer;
                                                 sMinPriceIncrement, sContractMultiplier : Double;
                                                                   strValidDate, strISIN : PwideChar) stdcall; forward;
  procedure AssetListInfoCallbackV2                                            (rAssetID : TAssetIDRec;
                                                                 pwcName, pwcDescription : PwideChar;
                    nMinOrderQtd, nMaxOrderQtd, nLote, stSecurityType, ssSecuritySubType : Integer;
                                                 sMinPriceIncrement, sContractMultiplier : Double;
                               strValidDate, strISIN, strSetor, strSubSetor, strSegmento : PwideChar) stdcall; forward;

  procedure InvalidTickerCallback(
    const AssetID : TConnectorAssetIdentifier
  ) stdcall; forward;

  procedure ChangeStateTickerCallback                                          (rAssetID : TAssetIDRec;
                                                                                 pwcDate : PWideChar;
                                                                                  nState : Integer) stdcall; forward;
  procedure AdjustHistoryCallback                                              (rAssetID : TAssetIDRec;
                                                                                  sValue : Double;
                              strAdjustType, strObserv, dtAjuste, dtDeliber, dtPagamento : PwideChar;
                                                                            nAffectPrice : Integer) stdcall; forward;
  procedure AdjustHistoryCallbackV2                                            (rAssetID : TAssetIDRec;
                                                                                  dValue : Double;
                              strAdjustType, strObserv, dtAjuste, dtDeliber, dtPagamento : PwideChar;
                                                                                  nFlags : Cardinal;
                                                                                   dMult : Double) stdcall; forward;
  procedure TheoreticalPriceCallback                                           (rAssetID : TAssetIDRec;
                                                                       sTheoreticalPrice : Double;
                                                                         nTheoreticalQtd : Int64) stdcall; forward;
  procedure ChangeCotationCallback                                             (rAssetID : TAssetIDRec;
                                                                                 pwcDate : PWideChar;
                                                                            nTradeNumber : Cardinal;
                                                                                  sPrice : Double) stdcall; forward;
  procedure OrderCallback(const a_OrderID : TConnectorOrderIdentifier) stdcall;
  procedure OrderHistoryCallback(const a_AccountID : TConnectorAccountIdentifier); stdcall;

  procedure TradeCallback(const a_Asset : TConnectorAssetIdentifier; const a_pTrade : Pointer; const a_nFlags : Cardinal); stdcall;
  procedure HistoryTradeCallback(const a_Asset : TConnectorAssetIdentifier; const a_pTrade : Pointer; const a_nFlags : Cardinal); stdcall;
implementation
uses
  frmClientU,
  enums,
  functionWrapperU,
  Winapi.Windows;
procedure StateCallback(nConnStateType , nResult : Integer) stdcall;
begin
  UpdateConnStatus(nConnStateType, nResult);
end;
procedure AccountCallback                                          (nCorretora : Integer;
                                 CorretoraNomeCompleto, AccountID, NomeTitular : PWideChar) stdcall;
begin
  GenericLogUpdate(Format('TAccountCallback: %d | %s | %s | %s', [nCorretora, CorretoraNomeCompleto, AccountId, NomeTitular]));
end;


procedure NewDailyCallback                                                   (rAssetID : TAssetIDRec;
                                                                               pwcDate : PWideChar;
sOpen, sHigh, sLow, sClose, sVol, sAjuste, sMaxLimit, sMinLimit, sVolBuyer, sVolSeller : Double;
         nQtd, nNegocios, nContratosOpen, nQtdBuyer, nQtdSeller, nNegBuyer, nNegSeller : Integer) stdcall;
begin
  GenericLogUpdate(Format('TNewDailyCallback '   +
                          #13#10 + 'Ticker: %s' +
                          #13#10 + 'Date:  %s'  +
                          #13#10 + 'Qtd:   %d'  +
                          #13#10 + 'Open:  %n'  +
                          #13#10 + 'High:  %n'  +
                          #13#10 + 'Low:   %n'  +
                          #13#10 + 'Close: %n'  +
                          #13#10 + 'Volume %n',
                          [rAssetId.pchTicker, pwcDate, nQtd, sOpen, sHigh, sLow, sClose, sVol]));
end;
procedure PriceBookCallback                       (rAssetID : TAssetIDRec ;
                   nAction , nPosition, Side, nQtds, nCount : Integer;
                                                     sPrice : Double;
                                      pArraySell, pArrayBuy : Pointer)  stdcall;
begin
  GenericLogUpdate(Format('TPriceBookCallback: %s | %d', [rAssetID.pchTicker, Side]));
  UpdatePriceBook(1, rAssetID, nAction, nPosition, Side, nQtds, nCount, sPrice, pArraySell, pArrayBuy);
end;
procedure PriceBookCallbackV2(
    rAssetID   : TAssetIDRec ;
    nAction    : Integer;
    nPosition  : Integer;
    Side       : Integer;
    nQtds      : Int64;
    nCount     : Int64;
    sPrice     : Double;
    pArraySell : Pointer;
    pArrayBuy  : Pointer); stdcall;
begin
  GenericLogUpdate(Format('TPriceBookCallbackV2: %s | %d', [rAssetID.pchTicker, Side]));
  UpdatePriceBook(2, rAssetID, nAction, nPosition, Side, nQtds, nCount, sPrice, pArraySell, pArrayBuy);
end;
procedure OfferBookCallback                       (rAssetID : TAssetIDRec ;
                     nAction, nPosition, Side, nQtd, nAgent : Integer;
                                                   nOfferID : Int64;
                                                     sPrice : Double;
       bHasPrice, bHasQtd, bHasDate, bHasOfferID, bHasAgent : Char;
                                                   pwcDate  : PWideChar;
                                      pArraySell, pArrayBuy : Pointer) stdcall;
begin
  UpdateOfferBook(1, rAssetID, nAction, nPosition, Side, nQtd, nAgent, nOfferID, sPrice, bHasPrice, bHasQtd, bHasDate, bHasOfferID, bHasAgent, pwcDate, pArraySell, pArrayBuy);
end;
procedure OfferBookCallbackV2                     (rAssetID : TAssetIDRec ;
                                   nAction, nPosition, Side : Integer;
                                                       nQtd : Int64;
                                                     nAgent : Integer;
                                                   nOfferID : Int64;
                                                     sPrice : Double;
       bHasPrice, bHasQtd, bHasDate, bHasOfferID, bHasAgent : Char;
                                                   pwcDate  : PWideChar;
                                      pArraySell, pArrayBuy : Pointer) stdcall;
begin
  UpdateOfferBook(2, rAssetID, nAction, nPosition, Side, nQtd, nAgent, nOfferID, sPrice, bHasPrice, bHasQtd, bHasDate, bHasOfferID, bHasAgent, pwcDate, pArraySell, pArrayBuy);
end;

procedure ProgressCallback( rAssetID  : TAssetIDRec; nProgress : Integer) stdcall;
begin
  GenericLogUpdate(Format('TProgressCallback: %s | %d',[rAssetId.pchTicker, nProgress]));
end;
procedure TinyBookCallback  (rAssetID  : TAssetIDRec;
                             sPrice    : Double;
                           nQtd, nSide : Integer) stdcall;
begin
  GenericLogUpdate(Format('TinyBookCallback: %s | %n | %d | %d', [rAssetID.pchTicker, sPrice, nQtd, nSide]));
end;
procedure AssetListCallback(AssetID : TAssetIDRec; pwcName : PWideChar) stdcall;
begin
  GenericLogUpdate(Format('AssetListCallback: %s | %s',[AssetId.pchTicker, pwcName]));
end;
procedure AssetListInfoCallback                                             (rAssetID : TAssetIDRec;
                                                               pwcName, pwcDescription : PwideChar;
                  nMinOrderQtd, nMaxOrderQtd, nLote, stSecurityType, ssSecuritySubType : Integer;
                                               sMinPriceIncrement, sContractMultiplier : Double;
                                                                 strValidDate, strISIN : PwideChar) stdcall;
begin
  GenericLogUpdate(Format('TAssetListInfoCallback: %s | %s | %s | %s | %s | %s |',[rAssetId.pchTicker, pwcName, strValidDate, strISIN,
                   GetEnumName(TypeInfo(TSecurityType), stSecurityType), GetEnumName(TypeInfo(TSecuritySubType), ssSecuritySubType)]));
end;
procedure AssetListInfoCallbackV2                                           (rAssetID : TAssetIDRec;
                                                               pwcName, pwcDescription : PwideChar;
                  nMinOrderQtd, nMaxOrderQtd, nLote, stSecurityType, ssSecuritySubType : Integer;
                                               sMinPriceIncrement, sContractMultiplier : Double;
                             strValidDate, strISIN, strSetor, strSubSetor, strSegmento : PwideChar) stdcall;
begin
  GenericLogUpdate(Format('TAssetListInfoCallbackV2: %s | %s | %s | %s | %s | %s | %s',[rAssetId.pchTicker, pwcName, strValidDate, strISIN, strSetor, strSubSetor, StrSegmento]));
end;
procedure ChangeStateTickerCallback(rAssetID : TAssetIDRec;
                                     pwcDate : PWideChar;
                                      nState : Integer) stdcall;
begin
  GenericLogUpdate(Format('TChangeStateTicker: %s | %s | %s',[rAssetId.pchTicker, pwcDate, GetEnumName(TypeInfo(TAssetStateType),nState)]));
end;
procedure AdjustHistoryCallback                            (rAssetID : TAssetIDRec;
                                                              sValue : Double;
          strAdjustType, strObserv, dtAjuste, dtDeliber, dtPagamento : PwideChar;
                                              nAffectPrice : Integer) stdcall;
begin
  GenericLogUpdate(Format('TAdjustHistoryCallback: %s | %n | %s | %s | %d',[rAssetId.pchTicker, sValue, strAdjustType, strObserv, nAffectPrice]));
end;
procedure AdjustHistoryCallbackV2                       (rAssetID : TAssetIDRec;
                                                            dValue : Double;
        strAdjustType, strObserv, dtAjuste, dtDeliber, dtPagamento : PwideChar;
                                                            nFlags : Cardinal;
                                                             dMult : Double) stdcall;
begin
  GenericLogUpdate(Format('TAdjustHistoryCallbackV2: %s | %n | %s | %s | %d | %n',[rAssetId.pchTicker, dValue, strAdjustType, strObserv, nFlags, dMult]));
end;
procedure TheoreticalPriceCallback(rAssetID : TAssetIDRec;
                           sTheoreticalPrice : Double;
                             nTheoreticalQtd : Int64) stdcall;
begin
  GenericLogUpdate(Format('TTheoreticalPriceCallback: %s | %n | %d',[rAssetId.pchTicker, sTheoreticalPrice, nTheoreticalQtd]));
end;
procedure ChangeCotationCallback(rAssetID   : TAssetIDRec;
                          pwcDate   : PWideChar;
                       nTradeNumber : Cardinal;
                             sPrice : Double) stdcall;
begin
  GenericLogUpdate(Format('TChangeCotationCallback: %s | %s | %n',[rAssetId.pchTicker, pwcDate, sPrice]));
end;

procedure OrderCallback(const a_OrderID : TConnectorOrderIdentifier) stdcall;
var
  Order : TConnectorOrderOut;
  nResult : Integer;
begin
  ZeroMemory(@Order, SizeOf(Order));
  Order.Version := 0;
  Order.OrderID := a_OrderID;

  nResult := GetOrderDetails(Order);

  if nResult = NL_OK then
    begin
      Order.AssetID.Ticker   := PWideChar(StringOfChar(' ', Order.AssetID.TickerLength));
      Order.AssetID.Exchange := PWideChar(StringOfChar(' ', Order.AssetID.ExchangeLength));
      Order.TextMessage      := PWideChar(StringOfChar(' ', Order.TextMessageLength));
      nResult := GetOrderDetails(Order);

      if nResult = NL_OK then
        begin
          GenericLogUpdate(Format('OrderCallback: %s | %d | %d | %n | %s | %s | %d | %s', [
            Trim(Order.AssetID.Ticker),
            Order.TradedQuantity,
            Order.OrderSide,
            Order.Price,
            Trim(Order.AccountID.AccountID),
            Trim(Order.OrderID.ClOrderID),
            Order.OrderStatus,
            Trim(Order.TextMessage)
          ] ));
        end;
    end;

  if nResult <> NL_OK then
    GenericLogUpdate('OrderCallback: ' + NResultToString(nResult));
end;

function CountOrders(const a_Order : PConnectorOrder; const a_Param : LPARAM) : BOOL; stdcall;
var
  pCount : PInteger;
begin
  // recebemos no a_Param o ponteiro do nCount que nos foi passado pelo OrderHistoryCallback
  pCount := PInteger(a_Param);
  pCount^ := pCount^ + 1;

  // continuanos até o final
  Result := True;
end;

procedure OrderHistoryCallback(const a_AccountID : TConnectorAccountIdentifier); stdcall;
var
  nCount      : Integer;
  strAccount  : String;
begin
  // passamos no a_Param o ponteiro do nCount para que CountOrders tenha acesso ao nCount
  EnumerateAllOrders(@a_AccountID, 0, LPARAM(@nCount), CountOrders);

  strAccount := a_AccountID.BrokerID.ToString + ':' + a_AccountID.AccountID;

  if a_AccountID.SubAccountID <> '' then
    strAccount := strAccount + ':' + a_AccountID.SubAccountID;

  GenericLogUpdate('OrderHistoryCallback: ' + strAccount + ' | Count=' + IntToStr(nCount));
end;

procedure InvalidTickerCallback(const AssetID : TConnectorAssetIdentifier) stdcall;
begin
  GenericLogUpdate(Format('TInvalidTickerCallback: %s | %s', [AssetID.Ticker, AssetID.Exchange]));
end;

procedure TradeCallback(const a_Asset : TConnectorAssetIdentifier; const a_pTrade : Pointer; const a_nFlags : Cardinal);
var
  ctTrade : TConnectorTrade;
  bIsEdit : Boolean;
begin
  ctTrade.Version := 0;
  if TranslateTrade(a_pTrade, ctTrade) = NL_OK then
    begin
      bIsEdit := (a_nFlags and TC_IS_EDIT) = TC_IS_EDIT;

      GenericLogUpdate(Format('TradeCallback: %s:%s | %n | %d | %s | %s', [a_Asset.Ticker, a_Asset.Exchange, ctTrade.Price, ctTrade.Quantity, GetEnumName(TypeInfo(TTradeType), ctTrade.TradeType), BoolToStr(bIsEdit, True)]));
    end;
end;

procedure HistoryTradeCallback(const a_Asset : TConnectorAssetIdentifier; const a_pTrade : Pointer; const a_nFlags : Cardinal);
var
  ctTrade : TConnectorTrade;
  dtDate  : TDateTime;
  bIsLast : Boolean;
begin
  ctTrade.Version := 0;
  if TranslateTrade(a_pTrade, ctTrade) = NL_OK then
    begin
      dtDate := SystemTimeToDateTime(ctTrade.TradeDate);
      bIsLast := (a_nFlags and TC_LAST_PACKET) = TC_LAST_PACKET;

      GenericLogUpdate(Format('THistoryTradeCallback: %s:%s | %s | %n | %d | %s | %s', [a_Asset.Ticker, a_Asset.Exchange, FormatDateTime('dd/mm/yyyy hh:nn:ss', dtDate), ctTrade.Price, ctTrade.Quantity, GetEnumName(TypeInfo(TTradeType), ctTrade.TradeType), BoolToStr(bIsLast, True)]));
    end;
end;

end.
