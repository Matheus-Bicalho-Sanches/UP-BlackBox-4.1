import os
import sys
from ctypes import c_wchar_p, WINFUNCTYPE, c_int32, byref, c_longlong, create_unicode_buffer, cast, c_void_p, c_int, c_double, Structure, POINTER
from dotenv import load_dotenv
from firebase_admin import firestore

# Adiciona a pasta Dll_Profit ao sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Dll_Profit')))
from profit_dll import initializeDll
from profitTypes import TConnectorAccountIdentifierOut, TConnectorTradingAccountPosition, TConnectorAccountIdentifier, TConnectorAssetIdentifier, TConnectorSendOrder, TConnectorOrderSide, TConnectorOrderType, TConnectorOrderOut, TConnectorEnumerateOrdersProc, TConnectorOrder

# Carrega variáveis do .env se necessário
load_dotenv(dotenv_path=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Dll_Profit', '.env')))

DLL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Dll_Profit', 'ProfitDLL.dll'))

# Inicializa a DLL (faça isso uma vez só)
profit_dll = initializeDll(DLL_PATH)

dll_logs = []  # Lista global para armazenar logs temporariamente
orders_collected = []

def add_log(msg):
    dll_logs.append(msg)

# Callback de exemplo para logs do DLL
@WINFUNCTYPE(None, c_int32, c_int32)
def stateCallback(nType, nResult):
    type_map = {
        0: "Login",
        1: "Broker",
        2: "Market",
        3: "Ativação"
    }
    # Resultados comuns para cada tipo
    result_map = {
        0: "OK",
        1: "Conectando",
        2: "Sem conexão",
        4: "Conectando",
        5: "Conectado"
    }
    tipo = type_map.get(nType, f"Desconhecido ({nType})")
    resultado = result_map.get(nResult, f"Código {nResult}")
    msg = f"stateCallback: {tipo} ({nType}), status: {resultado} ({nResult})"
    # print(msg)  # silenciado para reduzir spam no console
    add_log(msg)

@TConnectorEnumerateOrdersProc
def collect_orders_callback(order_ptr, param):
    order = order_ptr.contents
    orders_collected.append({
        "OrderID": str(order.OrderID.LocalOrderID),
        "Ticker": getattr(order.AssetID, 'Ticker', ''),
        "Quantity": order.Quantity,
        "TradedQuantity": getattr(order, 'TradedQuantity', None),
        "LeavesQuantity": getattr(order, 'LeavesQuantity', None),
        "Price": order.Price,
        "StopPrice": getattr(order, 'StopPrice', None),
        "AveragePrice": getattr(order, 'AveragePrice', None),
        "OrderSide": getattr(order, 'OrderSide', None),
        "OrderType": getattr(order, 'OrderType', None),
        "Status": order.OrderStatus,
        "TextMessage": getattr(order, 'TextMessage', None)
    })
    return True

# Callback de alteração de ordem (versão simples)
OrderChangeCallbackType = WINFUNCTYPE(
    None, c_void_p, c_int, c_int, c_int, c_int, c_int, c_double, c_double, c_double, c_longlong,
    c_wchar_p, c_wchar_p, c_wchar_p, c_wchar_p, c_wchar_p, c_wchar_p, c_wchar_p
)

@OrderChangeCallbackType
def order_change_callback(rAssetID, nCorretora, nQtd, nTradedQtd, nLeavesQtd, nSide, dPrice, dStopPrice, dAvgPrice, nProfitID, TipoOrdem, Conta, Titular, ClOrdID, Status, Date, TextMessage):
    try:
        # Importa aqui para evitar import circular
        from main import atualizar_ordem_firebase, atualizar_posicoes_firebase, atualizar_posicoes_firebase_strategy, db
        # Log reduzido: remover prints detalhados para evitar poluição
        # print(f"[DLL] Alteração de ordem recebida: ProfitID={nProfitID}, Status={Status}, Traded={nTradedQtd}, Leaves={nLeavesQtd}")
        valor_executado = nTradedQtd * dAvgPrice
        atualizar_ordem_firebase(nProfitID, {
            "Status": Status,
            "TradedQuantity": nTradedQtd,
            "LeavesQuantity": nLeavesQtd,
            "TextMessage": TextMessage,
            "LastUpdate": Date,
            "valor_executado": valor_executado,
            "preco_medio_executado": dAvgPrice,
            "price": dPrice,
            "quantity": nQtd
        })
        # Buscar o account_id / strategy_id da ordem para atualizar as posições
        ordens_ref = db.collection('ordensDLL').where('OrderID', '==', str(nProfitID)).stream()
        updated = False
        for doc in ordens_ref:
            ordem = doc.to_dict()
            account_id = ordem.get('account_id')
            strategy_id = ordem.get('strategy_id')
            if account_id:
                atualizar_posicoes_firebase(account_id)
                updated = True
            if strategy_id:
                atualizar_posicoes_firebase_strategy(strategy_id)
        if not updated:
            # Evitar spam nos logs se a ordem ainda não estiver no Firestore
            pass
    except Exception:
        # Erros silenciosos para não poluir o log
        pass

def login_profit() -> dict:
    global dll_logs
    dll_logs = []  # Limpa logs antes do login
    activation_key = os.getenv("ACTIVATION_CODE", "SUA_CHAVE_AQUI")
    user = os.getenv("login", "")
    password = os.getenv("password", "")
    try:
        result = profit_dll.DLLInitializeLogin(
            c_wchar_p(activation_key),
            c_wchar_p(user),
            c_wchar_p(password),
            stateCallback, None, order_change_callback, None, None, None, None, None, None, None, None, None, None
        )
        logs_str = "\n".join(dll_logs)
        if result == 0:
            return {"success": True, "log": f"Login realizado com sucesso na DLL.\nUsuário: {user}\n" + logs_str}
        else:
            return {"success": False, "log": f"Erro no login da DLL. Código: {result}\nUsuário: {user}\n" + logs_str}
    except Exception as e:
        return {"success": False, "log": f"Exceção ao tentar login na DLL: {str(e)}"}

def get_accounts() -> dict:
    # print("get_accounts chamado")
    try:
        count = profit_dll.GetAccountCount()
        # print(f"Total de contas encontradas: {count}")
        accounts = []
        if count > 0:
            from profitTypes import TConnectorAccountIdentifierOut
            AccountArray = TConnectorAccountIdentifierOut * count
            accountIDs = AccountArray()
            profit_dll.GetAccounts(0, 0, count, accountIDs)
            for i in range(count):
                acc = accountIDs[i]
                # print(f"GetAccount({i}): BrokerID={acc.BrokerID}, AccountID={acc.AccountID}, SubAccountID={acc.SubAccountID}")
                accounts.append({
                    "BrokerID": acc.BrokerID,
                    "AccountID": acc.AccountID,
                    "SubAccountID": acc.SubAccountID
                })
        # print("Contas retornadas:", accounts)
        return {"success": True, "accounts": accounts}
    except Exception as e:
        print("Erro em get_accounts:", e)
        return {"success": False, "log": f"Erro ao obter contas: {str(e)}"}

def get_positions(account_id: str = None, broker_id: int = None, ticker: str = None, exchange: str = None, sub_account: str = None, position_type: str = None) -> dict:
    try:
        print(f"[get_positions] Parâmetros recebidos: account_id={account_id}, broker_id={broker_id}, ticker={ticker}, exchange={exchange}, sub_account={sub_account}, position_type={position_type}")
        positions = []
        if account_id and broker_id is not None:
            acc = TConnectorAccountIdentifierOut()
            acc.BrokerID = broker_id
            acc.AccountID = account_id
            acc.SubAccountID = sub_account if sub_account else ""
            acc.Version = 0
            acc.AccountIDLength = len(account_id)
            acc.SubAccountIDLength = len(sub_account) if sub_account else 0
            acc.Reserved = 0
            print(f"[get_positions] Buscando posição para AccountID={account_id}, BrokerID={broker_id}, Ticker={ticker}, Exchange={exchange}, SubAccountID={sub_account}, PositionType={position_type}")
            pos = TConnectorTradingAccountPosition()
            pos.Version = 1
            pos.PositionType = int(position_type) if position_type else 2
            pos.AccountID = TConnectorAccountIdentifier(
                Version=0,
                BrokerID=broker_id,
                AccountID=account_id,
                SubAccountID=sub_account if sub_account else "",
                Reserved=0
            )
            pos.AssetID = TConnectorAssetIdentifier(
                Version=0,
                Ticker=ticker if ticker else "",
                Exchange=exchange if exchange else "",
                FeedType=0
            )
            ret = profit_dll.GetPositionV2(byref(pos))
            print(f"[get_positions] Retorno GetPositionV2: {ret}")
            if ret == 0:
                print(f"[get_positions] Posição encontrada: Ticker={pos.AssetID.Ticker}, Quantity={pos.OpenQuantity}, AvgPrice={pos.OpenAveragePrice}")
                positions.append({
                    "AccountID": account_id,
                    "SubAccountID": sub_account if sub_account else "",
                    "Ticker": pos.AssetID.Ticker if hasattr(pos.AssetID, 'Ticker') else "",
                    "Quantity": pos.OpenQuantity,
                    "AvgPrice": pos.OpenAveragePrice
                })
            else:
                print(f"[get_positions] Nenhuma posição encontrada para a conta.")
        else:
            count = profit_dll.GetAccountCount()
            print(f"[get_positions] Total de contas encontradas: {count}")
            for i in range(count):
                acc = TConnectorAccountIdentifierOut()
                profit_dll.GetAccounts(i, i, 1, byref(acc))
                print(f"[get_positions] Conta {i}: AccountID={acc.AccountID}, BrokerID={acc.BrokerID}")
                pos = TConnectorTradingAccountPosition()
                pos.Version = 1
                pos.PositionType = int(position_type) if position_type else 2
                pos.AccountID = TConnectorAccountIdentifier(
                    Version=0,
                    BrokerID=acc.BrokerID,
                    AccountID=acc.AccountID,
                    SubAccountID=acc.SubAccountID,
                    Reserved=0
                )
                pos.AssetID = TConnectorAssetIdentifier(
                    Version=0,
                    Ticker=ticker if ticker else "",
                    Exchange=exchange if exchange else "",
                    FeedType=0
                )
                ret = profit_dll.GetPositionV2(byref(pos))
                print(f"[get_positions] Retorno GetPositionV2 para conta {i}: {ret}")
                if ret == 0:
                    print(f"[get_positions] Posição encontrada: Ticker={pos.AssetID.Ticker}, Quantity={pos.OpenQuantity}, AvgPrice={pos.OpenAveragePrice}")
                    positions.append({
                        "AccountID": acc.AccountID,
                        "SubAccountID": acc.SubAccountID,
                        "Ticker": pos.AssetID.Ticker if hasattr(pos.AssetID, 'Ticker') else "",
                        "Quantity": pos.OpenQuantity,
                        "AvgPrice": pos.OpenAveragePrice
                    })
                else:
                    print(f"[get_positions] Nenhuma posição encontrada para a conta {i}.")
        print(f"[get_positions] Total de posições retornadas: {len(positions)}")
        return {"success": True, "positions": positions}
    except Exception as e:
        print(f"[get_positions] Exceção: {str(e)}")
        return {"success": False, "log": f"Erro ao obter posições: {str(e)}"}

def send_order(account_id: str, broker_id: int, ticker: str, quantity: int, price: float, side: str, exchange: str, master_batch_id: str = None, master_base_qty: int = None, sub_account: str = "", strategy_id: str = None) -> dict:
    from profitTypes import TConnectorSendOrder, TConnectorAccountIdentifier, TConnectorAssetIdentifier, TConnectorOrderSide, TConnectorOrderType
    try:
        print(f"[send_order] Parâmetros recebidos:")
        print(f"  account_id={account_id}")
        print(f"  broker_id={broker_id}")
        print(f"  ticker={ticker}")
        print(f"  quantity={quantity}")
        print(f"  price={price}")
        print(f"  side={side}")
        print(f"  exchange={exchange}")
        print(f"  master_batch_id={master_batch_id}")
        print(f"  master_base_qty={master_base_qty}")
        password = os.getenv("roteamento", "")  # Senha de roteamento
        acc = TConnectorAccountIdentifier(
            Version=0,
            BrokerID=broker_id,
            AccountID=account_id,
            SubAccountID=sub_account,
            Reserved=0
        )
        asset = TConnectorAssetIdentifier(
            Version=0,
            Ticker=ticker,
            Exchange=exchange,
            FeedType=0
        )
        order = TConnectorSendOrder()
        order.Version = 1
        order.AccountID = acc
        order.AssetID = asset
        order.Password = password
        if price == -1:
            order.OrderType = TConnectorOrderType.Market.value
        else:
            order.OrderType = TConnectorOrderType.Limit.value
        order.OrderSide = TConnectorOrderSide.Buy.value if side == "buy" else TConnectorOrderSide.Sell.value
        order.Price = price
        order.StopPrice = 0.0
        order.Quantity = quantity
        print(f"[send_order] Struct montada:")
        print(f"  AccountID={order.AccountID.AccountID}")
        print(f"  BrokerID={order.AccountID.BrokerID}")
        print(f"  Ticker={order.AssetID.Ticker}")
        print(f"  Exchange={order.AssetID.Exchange}")
        print(f"  Quantity={order.Quantity}")
        print(f"  Price={order.Price}")
        print(f"  OrderType={order.OrderType} (0=Limit, 2=Market)")
        print(f"  OrderSide={order.OrderSide} (1=Buy, 2=Sell)")
        print(f"  Password={'***' if password else '[VAZIA]'}")
        # Envia ordem
        result = profit_dll.SendOrder(byref(order))
        print(f"[send_order] Resultado SendOrder: {result}")
        if result > 0:
            # Salva ordem no Firebase com LastUpdate
            from main import db
            import datetime
            # Definir prazo_liquidacao
            if ticker.upper() == 'LFTS11':
                prazo_liquidacao = 'D+1'
            else:
                prazo_liquidacao = 'D+2'
            ordem_data = {
                "OrderID": str(result),
                "account_id": account_id,
                "broker_id": broker_id,
                "ticker": ticker,
                "quantity": quantity,
                "price": price,
                "side": side,
                "exchange": exchange,
                "createdAt": datetime.datetime.now().isoformat(),
                "LastUpdate": firestore.SERVER_TIMESTAMP,
                "statusEnvio": "sucesso",
                "prazo_liquidacao": prazo_liquidacao,
                "valor_executado": 0
            }
            if master_batch_id:
                ordem_data["master_batch_id"] = master_batch_id
            if master_base_qty is not None:
                ordem_data["master_base_qty"] = master_base_qty
            if strategy_id:
                ordem_data["strategy_id"] = strategy_id
            print("Salvando ordem no Firebase:", ordem_data)
            try:
                db.collection("ordensDLL").document(str(result)).set(ordem_data)
            except Exception as e:
                print("[FIREBASE] Erro ao salvar ordem:", e)
            return {"success": True, "log": f"Ordem enviada com sucesso! ProfitID: {result}"}
        else:
            return {"success": False, "log": f"Erro ao enviar ordem. Código: {result}"}
    except Exception as e:
        print(f"[send_order] Exceção: {str(e)}")
        # Log especial para erros de index do Firestore
        if "index" in str(e).lower():
            print("[FIREBASE] Possível erro de index. Veja o link sugerido no log do Firebase Console.")
        return {"success": False, "log": f"Exceção ao enviar ordem: {str(e)}"}

def get_orders(account_id: str, broker_id: int) -> dict:
    global orders_collected
    orders_collected = []
    from profitTypes import TConnectorAccountIdentifier
    acc = TConnectorAccountIdentifier(
        Version=0,
        BrokerID=broker_id,
        AccountID=account_id,
        SubAccountID="",
        Reserved=0
    )
    # Chama EnumerateAllOrders com o callback
    profit_dll.EnumerateAllOrders(byref(acc), 0, 0, collect_orders_callback)
    return {"success": True, "orders": orders_collected}

def get_order_by_profitid(profit_id: int) -> dict:
    from profitTypes import TConnectorOrderOut, TConnectorOrderIdentifier
    from ctypes import byref, c_longlong, create_unicode_buffer, cast, c_wchar_p
    try:
        profit_id_ll = c_longlong(int(profit_id))
        order = TConnectorOrderOut()
        order.Version = 0
        order.OrderID.Version = 0
        order.OrderID.LocalOrderID = profit_id_ll.value
        order.OrderID.ClOrderID = ""
        # Alocar buffers para strings e fazer cast para c_wchar_p
        ticker_buf = create_unicode_buffer(32)
        exchange_buf = create_unicode_buffer(8)
        textmsg_buf = create_unicode_buffer(256)
        order.AssetID.Ticker = cast(ticker_buf, c_wchar_p)
        order.AssetID.Exchange = cast(exchange_buf, c_wchar_p)
        order.TextMessage = cast(textmsg_buf, c_wchar_p)
        ret = profit_dll.GetOrderProfitID(profit_id_ll)
        if ret == 0:
            ret_details = profit_dll.GetOrderDetails(byref(order))
            if ret_details == 0 and getattr(order.AccountID, 'AccountID', None):
                return {
                    "success": True,
                    "order": {
                        "OrderID": str(order.OrderID.LocalOrderID),
                        "Ticker": ticker_buf.value,
                        "Quantity": order.Quantity,
                        "TradedQuantity": getattr(order, 'TradedQuantity', None),
                        "LeavesQuantity": getattr(order, 'LeavesQuantity', None),
                        "Price": order.Price,
                        "StopPrice": getattr(order, 'StopPrice', None),
                        "AveragePrice": getattr(order, 'AveragePrice', None),
                        "OrderSide": getattr(order, 'OrderSide', None),
                        "OrderType": getattr(order, 'OrderType', None),
                        "Status": order.OrderStatus,
                        "TextMessage": textmsg_buf.value
                    }
                }
            else:
                return {"success": False, "log": f"Ordem não encontrada pelo ProfitID (GetOrderDetails ret={ret_details})"}
        else:
            return {"success": False, "log": f"ProfitID não encontrado (GetOrderProfitID ret={ret})"}
    except Exception as e:
        return {"success": False, "log": f"Erro ao buscar ordem por ProfitID: {str(e)}"}

class TConnectorAccountIdentifier(Structure):
    _fields_ = [
        ("Version", c_int),
        ("BrokerID", c_int),
        ("AccountID", c_wchar_p),
        ("SubAccountID", c_wchar_p),
        ("Reserved", c_longlong),
    ]

class TConnectorOrderIdentifier(Structure):
    _fields_ = [
        ("Version", c_int),
        ("LocalOrderID", c_longlong),
        ("ClOrdID", c_wchar_p),
    ]

class TConnectorChangeOrder(Structure):
    _fields_ = [
        ("Version", c_int),
        ("AccountID", TConnectorAccountIdentifier),
        ("OrderID", TConnectorOrderIdentifier),
        ("Password", c_wchar_p),
        ("Price", c_double),
        ("StopPrice", c_double),
        ("Quantity", c_longlong),
    ]

class TConnectorCancelOrder(Structure):
    _fields_ = [
        ("Version", c_int),
        ("AccountID", TConnectorAccountIdentifier),
        ("OrderID", TConnectorOrderIdentifier),
        ("Password", c_wchar_p),
    ]

if hasattr(profit_dll, 'SendChangeOrderV2'):
    profit_dll.SendChangeOrderV2.argtypes = [POINTER(TConnectorChangeOrder)]

if hasattr(profit_dll, 'SendCancelOrderV2'):
    profit_dll.SendCancelOrderV2.argtypes = [POINTER(TConnectorCancelOrder)] 