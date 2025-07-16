from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from dll_login import login_profit, get_accounts, get_positions, send_order, get_orders, get_order_by_profitid
import os
import firebase_admin
from firebase_admin import credentials, firestore
from ctypes import byref, c_double, c_int, c_longlong, c_wchar_p, create_unicode_buffer, cast
import threading
import time
import uuid

# Aqui você importaria a função real de login da DLL
# from profit_dll import login_profit

app = FastAPI()

# Configuração de CORS para permitir o frontend acessar o backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# --- Firebase Admin SDK ---
FIREBASE_CRED_PATH = os.path.join(os.path.dirname(__file__), 'secrets', 'up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_CRED_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()

# ---- Routers ----
from routers.strategies import router as strategies_router
from routers.allocations import router as allocations_router
app.include_router(strategies_router)
app.include_router(allocations_router)

# ------------------------------------------------------------
# DLL login (trading) – realiza automaticamente na inicialização
# ------------------------------------------------------------
# Se o login já estiver ativo, a função simplesmente retornará
# sucesso e não fará nada. Isto garante que os endpoints de
# ordem funcionem mesmo se o usuário esquecer de acessar a rota
# /login manualmente.

@app.on_event("startup")
def startup_event():
    """Efetua login na ProfitDLL assim que o backend inicia."""
    try:
        result = login_profit()
        if result.get("success"):
            print("[STARTUP] Login DLL realizado com sucesso.")
        else:
            # Exibe log completo para facilitar diagnóstico, mas não
            # interrompe o startup – possibilita nova tentativa via /login.
            print(f"[STARTUP] Falha no login DLL: {result.get('log')}")
    except Exception as err:
        # Não impede a aplicação de subir, mas avisa nos logs
        print(f"[STARTUP] Exceção ao tentar login DLL: {err}")

def atualizar_ordem_firebase(order_id, novos_dados):
    """
    Atualiza o documento da ordem na coleção ordensDLL pelo campo OrderID.
    novos_dados: dict com os campos a atualizar (ex: {"statusEnvio": "executada"})
    """
    ordens_ref = db.collection('ordensDLL').where('OrderID', '==', str(order_id)).stream()
    updated = False
    for doc in ordens_ref:
        doc_ref = db.collection('ordensDLL').document(doc.id)
        doc_ref.update(novos_dados)
        print(f"Ordem {order_id} atualizada no Firebase.")
        updated = True
    # Silenciar caso a ordem ainda não tenha sido gravada — evita spam de log
    return updated

def atualizar_posicoes_firebase(account_id):
    """
    Atualiza a coleção posicoesDLL para o cliente account_id, calculando a posição líquida e preço médio de cada ativo a partir das ordens EXECUTADAS em ordensDLL.
    Só considera ordens com Status 'Filled' ou TradedQuantity > 0, e usa a quantidade executada (TradedQuantity).
    O preço médio é calculado usando preco_medio_executado se existir, senão price.
    """
    print(f"[posicoesDLL] Atualizando posições para account_id={account_id}")
    ordens_ref = db.collection('ordensDLL').where('account_id', '==', account_id).stream()
    pos_map = {}
    for doc in ordens_ref:
        ordem = doc.to_dict()
        ticker = ordem.get('ticker')
        side = ordem.get('side')
        status = ordem.get('Status')
        traded_qty = float(ordem.get('TradedQuantity', 0))
        # Usar preco_medio_executado se existir, senão price
        price = float(ordem.get('preco_medio_executado', ordem.get('price', 0)))
        # Só considera ordens executadas (parcial ou totalmente)
        if not ticker or traded_qty == 0:
            continue
        if ticker not in pos_map:
            pos_map[ticker] = {'ticker': ticker, 'quantity': 0, 'totalBuy': 0, 'totalSell': 0, 'avgPrice': 0}
        if side == 'buy':
            pos_map[ticker]['quantity'] += traded_qty
            pos_map[ticker]['totalBuy'] += traded_qty * price
        elif side == 'sell':
            pos_map[ticker]['quantity'] -= traded_qty
            pos_map[ticker]['totalSell'] += traded_qty * price
    # Calcula preço médio ponderado das compras
    for pos in pos_map.values():
        pos['avgPrice'] = pos['quantity'] > 0 and pos['totalBuy'] / (pos['quantity'] if pos['quantity'] != 0 else 1) or 0
    # Salva as posições na coleção posicoesDLL (um doc por ticker por cliente)
    for ticker, pos in pos_map.items():
        doc_id = f"{account_id}_{ticker}"
        db.collection('posicoesDLL').document(doc_id).set({
            'account_id': account_id,
            'ticker': ticker,
            'quantity': pos['quantity'],
            'avgPrice': pos['avgPrice'],
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
    print(f"[posicoesDLL] Posições atualizadas para {account_id}: {list(pos_map.keys())}")

def atualizar_posicoes_firebase_strategy(strategy_id):
    """
    Consolida posições por estratégia usando ordensDLL com strategy_id.
    Salva em collection strategyPositions (doc id: f"{strategy_id}_{ticker}").
    """
    print(f"[strategyPositions] Recalculando posições para strategy_id={strategy_id}")
    ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).stream()
    pos_map = {}
    for doc in ordens_ref:
        o = doc.to_dict()
        if not o:
            continue
        ticker = o.get('ticker')
        side = o.get('side')
        qty = float(o.get('TradedQuantity') or o.get('quantity') or 0)
        price = float(o.get('preco_medio_executado', o.get('price', 0)))
        status = o.get('Status')
        if qty == 0 or (status and status.lower() not in ('filled','partially filled','executada')):
            continue
        if ticker not in pos_map:
            pos_map[ticker] = {'qty':0,'totalBuy':0}
        if side=='buy':
            pos_map[ticker]['qty'] += qty
            pos_map[ticker]['totalBuy'] += qty*price
        elif side=='sell':
            pos_map[ticker]['qty'] -= qty
    # salvar
    for t,vals in pos_map.items():
        avg = vals['qty']>0 and vals['totalBuy']/vals['qty'] or 0
        db.collection('strategyPositions').document(f"{strategy_id}_{t}").set({
            'strategy_id': strategy_id,
            'ticker': t,
            'quantity': vals['qty'],
            'avgPrice': avg,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
    print(f"[strategyPositions] Atualizado strategy_id={strategy_id} tickers={list(pos_map.keys())}")

@app.post("/login")
def login():
    try:
        result = login_profit()
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=401, detail=result["log"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/accounts")
def accounts():
    result = get_accounts()
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result.get("log", "Erro desconhecido"))

@app.get("/subaccounts")
def list_subaccounts():
    """Retorna lista de pares BrokerID / AccountID / SubAccountID disponíveis na DLL."""
    try:
        from dll_login import profit_dll
        from profitTypes import TConnectorAccountIdentifier, TConnectorAccountIdentifierOut
        from ctypes import byref

        contas = []
        total = profit_dll.GetAccountCount()
        for i in range(total):
            acc_out = TConnectorAccountIdentifierOut()
            # Alocar buffers para strings
            acc_id_buf = create_unicode_buffer(32)
            sub_buf = create_unicode_buffer(32)
            acc_out.AccountID = cast(acc_id_buf, c_wchar_p)
            acc_out.SubAccountID = cast(sub_buf, c_wchar_p)

            profit_dll.GetAccounts(i, i, 1, byref(acc_out))

            account_id_str = acc_id_buf.value

            # Consulta subcontas para esta conta
            acc_in = TConnectorAccountIdentifier(
                Version=0,
                BrokerID=acc_out.BrokerID,
                AccountID=account_id_str,
                SubAccountID="",
                Reserved=0
            )
            try:
                sub_cnt = profit_dll.GetSubAccountCount(byref(acc_in))
            except Exception as err:
                print(f"[SUBACCOUNTS] Erro GetSubAccountCount conta {account_id_str}: {err}")
                sub_cnt = 0

            if sub_cnt and sub_cnt > 0:
                SubArray = TConnectorAccountIdentifierOut * sub_cnt
                subs = SubArray()
                for idx in range(sub_cnt):
                    a_buf = create_unicode_buffer(32)
                    s_buf = create_unicode_buffer(32)
                    subs[idx].AccountID = cast(a_buf, c_wchar_p)
                    subs[idx].SubAccountID = cast(s_buf, c_wchar_p)

                profit_dll.GetSubAccounts(byref(acc_in), 0, 0, sub_cnt, subs)
                for j in range(sub_cnt):
                    s = subs[j]
                    contas.append({
                        "BrokerID": s.BrokerID,
                        "AccountID": s.AccountID,
                        "SubAccountID": s.SubAccountID
                    })
            else:
                contas.append({
                    "BrokerID": acc_out.BrokerID,
                    "AccountID": account_id_str,
                    "SubAccountID": ""
                })

        return {"subaccounts": contas}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/positions")
def positions(account_id: str = None, broker_id: int = None, ticker: str = None, exchange: str = None, sub_account: str = None, position_type: str = None):
    result = get_positions(account_id, broker_id, ticker, exchange, sub_account, position_type)
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result.get("log", "Erro desconhecido"))

@app.post("/order")
async def order(request: Request):
    data = await request.json()
    print("[ORDER] payload recebido:", data)
    account_id = data.get("account_id")
    broker_id = data.get("broker_id")
    ticker = data.get("ticker")
    quantity = data.get("quantity")
    price = data.get("price")
    side = data.get("side")
    exchange = data.get("exchange")
    master_batch_id = data.get("master_batch_id")
    master_base_qty = data.get("master_base_qty")
    sub_account = data.get("sub_account", "")
    strategy_id = data.get("strategy_id")

    # -------------------- NOVO FLUXO: MASTER POR ESTRATÉGIA --------------------
    if account_id == "MASTER":
        if not strategy_id:
            raise HTTPException(status_code=400, detail="strategy_id é obrigatório quando account_id == 'MASTER'.")

        # Buscar alocações da estratégia
        alloc_ref = db.collection("strategyAllocations").where("strategy_id", "==", strategy_id).stream()
        allocations_raw = []
        for doc in alloc_ref:
            d = doc.to_dict()
            d["_id"] = doc.id
            allocations_raw.append(d)

        print("[ORDER] Allocations brutas:")
        for a in allocations_raw:
            print(f"  id={a.get('_id')} account={a.get('account_id')} broker={a.get('broker_id')} valor={a.get('valor_investido')} updatedAt={a.get('updatedAt')}")

        # Deduplicar por (account_id, broker_id) mantendo o mais recente (updatedAt) se houver
        allocations_map = {}
        for alloc in allocations_raw:
            key = (alloc.get("account_id"), str(alloc.get("broker_id")))
            if key not in allocations_map:
                allocations_map[key] = alloc
            else:
                # Se existir updatedAt, usa o mais novo
                existing = allocations_map[key]
                ts_existing = existing.get("updatedAt")
                ts_new = alloc.get("updatedAt")
                if ts_new and (not ts_existing or ts_new > ts_existing):
                    allocations_map[key] = alloc

        allocations = list(allocations_map.values())

        # Priorizar contas com maior valor investido
        allocations.sort(key=lambda a: float(a.get('valor_investido', 0)), reverse=True)

        if not allocations:
            raise HTTPException(status_code=404, detail="Nenhuma alocação encontrada para esta estratégia.")

        print("[ORDER] Allocations após deduplicação:")
        for a in allocations:
            print(f"  account={a.get('account_id')} broker={a.get('broker_id')} valor={a.get('valor_investido')}")

        import uuid, math
        print(f"[ORDER] MASTER por estratégia {strategy_id}. BaseQty={quantity}. Total allocations encontrados: {len(allocations)}")
        if not master_batch_id:
            master_batch_id = str(uuid.uuid4())

        results = []
        for alloc in allocations:
            valor_inv = float(alloc.get("valor_investido", 0))
            fator = valor_inv / 10000
            qty_calc = max(1, int(math.floor(quantity * fator)))
            print(f"[ORDER] Conta {alloc['account_id']} (Broker {alloc['broker_id']}) – valor_inv={valor_inv:.2f} fator={fator:.4f} qty_calc={qty_calc}")
            if qty_calc <= 0:
                results.append({"account_id": alloc["account_id"], "success": False, "log": "Quantidade calculada = 0, ordem ignorada.", "valor_inv": valor_inv})
                continue

            res = send_order(
                alloc["account_id"],
                int(alloc["broker_id"]),
                ticker,
                qty_calc,
                price,
                side,
                exchange,
                master_batch_id,
                master_base_qty or quantity,
                "",
                strategy_id,
            )
            results.append({"account_id": alloc["account_id"], "valor_inv": valor_inv, "qty_calc": qty_calc, **res})
            if res.get("success"):
                try:
                    atualizar_posicoes_firebase(alloc["account_id"])
                except Exception:
                    pass

        return {"master_batch_id": master_batch_id, "results": results}

    # -------------------- FLUXO ANTIGO (conta individual) --------------------
    result = send_order(account_id, broker_id, ticker, quantity, price, side, exchange, master_batch_id, master_base_qty, sub_account, strategy_id)
    if result["success"]:
        atualizar_posicoes_firebase(account_id)
        # Se há strategy_id, também atualizar posições da estratégia
        if strategy_id:
            try:
                atualizar_posicoes_firebase_strategy(strategy_id)
            except Exception:
                pass
        return result
    else:
        raise HTTPException(status_code=400, detail=result["log"])

@app.get("/orders")
def orders(account_id: str, broker_id: int):
    result = get_orders(account_id, broker_id)
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=500, detail=result.get("log", "Erro desconhecido"))

@app.get("/order_by_profitid")
def order_by_profitid(profit_id: int):
    result = get_order_by_profitid(profit_id)
    if result["success"]:
        return result
    else:
        raise HTTPException(status_code=404, detail=result.get("log", "Ordem não encontrada"))

@app.post("/logoff")
def logoff():
    try:
        from dll_login import profit_dll
        result = profit_dll.DLLFinalize()
        print(f"[logoff] DLLFinalize retornou: {result}")
    except Exception as e:
        print(f"[logoff] Erro ao finalizar DLL: {e}")
    return {"success": True, "log": "Logoff realizado com sucesso."}

@app.get("/contasDll")
def get_contas_dll():
    contas_ref = db.collection('contasDll').stream()
    contas = []
    for doc in contas_ref:
        data = doc.to_dict()
        data['AccountID'] = data.get('AccountID') or data.get('account_id')
        contas.append(data)
    return {"contas": contas}

@app.post("/edit_order")
def edit_order(
    account_id: str = Body(...),
    broker_id: int = Body(...),
    order_id: int = Body(...),
    price: float = Body(...),
    quantity: int = Body(...),
    sub_account_id: str = Body(None),
    password: str = Body("")
):
    try:
        print("[EDIT_ORDER] Iniciando importação de dll_login...")
        import dll_login
        print("[EDIT_ORDER] dll_login importado com sucesso. Dir:", dir(dll_login))
        from dll_login import profit_dll
        print("[EDIT_ORDER] Importando TConnectorChangeOrder...")
        try:
            from dll_login import TConnectorChangeOrder, TConnectorAccountIdentifier, TConnectorOrderIdentifier
        except Exception as e:
            print("[EDIT_ORDER] Erro ao importar TConnectorChangeOrder:", e)
            return {"success": False, "log": f"Erro ao importar TConnectorChangeOrder: {str(e)}"}
        change_order = TConnectorChangeOrder()
        change_order.Version = 0
        change_order.Price = price
        change_order.StopPrice = -1
        change_order.Quantity = quantity
        # Pega a senha de roteamento automaticamente
        password = os.getenv("roteamento", "")
        change_order.Password = password
        change_order.AccountID = TConnectorAccountIdentifier()
        change_order.AccountID.Version = 0
        change_order.AccountID.BrokerID = broker_id
        change_order.AccountID.AccountID = account_id
        change_order.AccountID.SubAccountID = sub_account_id or ""
        change_order.AccountID.Reserved = 0
        change_order.OrderID = TConnectorOrderIdentifier()
        change_order.OrderID.Version = 0
        change_order.OrderID.LocalOrderID = int(order_id)
        change_order.OrderID.ClOrdID = ""
        # DEBUG: Printar todos os campos antes de enviar para a DLL
        print("[EDIT_ORDER][DEBUG] Campos enviados para edição de ordem:")
        print(f"  AccountID: {change_order.AccountID.AccountID} (type: {type(change_order.AccountID.AccountID)})")
        print(f"  BrokerID: {change_order.AccountID.BrokerID} (type: {type(change_order.AccountID.BrokerID)})")
        print(f"  SubAccountID: {change_order.AccountID.SubAccountID} (type: {type(change_order.AccountID.SubAccountID)})")
        print(f"  Reserved: {change_order.AccountID.Reserved} (type: {type(change_order.AccountID.Reserved)})")
        print(f"  OrderID.LocalOrderID: {change_order.OrderID.LocalOrderID} (type: {type(change_order.OrderID.LocalOrderID)})")
        print(f"  OrderID.ClOrdID: {change_order.OrderID.ClOrdID} (type: {type(change_order.OrderID.ClOrdID)})")
        print(f"  Version: {change_order.Version} (type: {type(change_order.Version)})")
        print(f"  Price: {change_order.Price} (type: {type(change_order.Price)})")
        print(f"  StopPrice: {change_order.StopPrice} (type: {type(change_order.StopPrice)})")
        print(f"  Quantity: {change_order.Quantity} (type: {type(change_order.Quantity)})")
        print(f"  Password: {change_order.Password} (type: {type(change_order.Password)})")
        ret = profit_dll.SendChangeOrderV2(byref(change_order))
        if ret == 0:
            return {"success": True, "log": "Ordem editada com sucesso!"}
        else:
            return {"success": False, "log": f"Erro ao editar ordem. Código: {ret}"}
    except Exception as e:
        print("[EDIT_ORDER] Exceção geral:", e)
        return {"success": False, "log": f"Exceção ao editar ordem: {str(e)}"}

@app.post("/cancel_order")
def cancel_order(
    account_id: str = Body(...),
    broker_id: int = Body(...),
    order_id: int = Body(...),
    sub_account_id: str = Body(None),
    password: str = Body("")
):
    print("[CANCEL_ORDER][DEBUG] Parâmetros recebidos:")
    print(f"  account_id: {account_id} (type: {type(account_id)})")
    print(f"  broker_id: {broker_id} (type: {type(broker_id)})")
    print(f"  order_id: {order_id} (type: {type(order_id)})")
    print(f"  sub_account_id: {sub_account_id} (type: {type(sub_account_id)})")
    print(f"  password: {password} (type: {type(password)})")
    try:
        from dll_login import profit_dll
        from ctypes import byref
        from dll_login import TConnectorCancelOrder, TConnectorAccountIdentifier, TConnectorOrderIdentifier
        cancel_order = TConnectorCancelOrder()
        cancel_order.Version = 0
        cancel_order.Password = os.getenv("roteamento", "")
        cancel_order.AccountID = TConnectorAccountIdentifier()
        cancel_order.AccountID.Version = 0
        cancel_order.AccountID.BrokerID = broker_id
        cancel_order.AccountID.AccountID = account_id
        cancel_order.AccountID.SubAccountID = sub_account_id or ""
        cancel_order.AccountID.Reserved = 0
        cancel_order.OrderID = TConnectorOrderIdentifier()
        cancel_order.OrderID.Version = 0
        cancel_order.OrderID.LocalOrderID = int(order_id)
        cancel_order.OrderID.ClOrdID = ""
        ret = profit_dll.SendCancelOrderV2(byref(cancel_order))
        if ret == 0:
            return {"success": True, "log": "Ordem cancelada com sucesso!"}
        else:
            return {"success": False, "log": f"Erro ao cancelar ordem. Código: {ret}"}
    except Exception as e:
        return {"success": False, "log": f"Exceção ao cancelar ordem: {str(e)}"}

@app.post("/edit_orders_batch")
async def edit_orders_batch(request: Request):
    data = await request.json()
    master_batch_id = data.get("master_batch_id")
    new_price = float(data.get("price"))
    base_qty = int(data.get("baseQty"))
    # Buscar todas as ordens do batch
    ordens_ref = db.collection('ordensDLL').where('master_batch_id', '==', master_batch_id).stream()
    ordens = [doc.to_dict() for doc in ordens_ref]
    if not ordens:
        raise HTTPException(status_code=404, detail="Nenhuma ordem encontrada para este batch.")

    # Detectar se as ordens pertencem a uma estratégia específica
    strategy_ids = set(o.get('strategy_id') for o in ordens if o.get('strategy_id'))
    use_strategy_allocations = len(strategy_ids) == 1 and list(strategy_ids)[0]
    
    # Buscar valores investidos
    if use_strategy_allocations:
        # Usar alocações da estratégia específica
        strategy_id = list(strategy_ids)[0]
        print(f"[EDIT_ORDERS_BATCH] Usando alocações da estratégia: {strategy_id}")
        alloc_ref = db.collection("strategyAllocations").where("strategy_id", "==", strategy_id).stream()
        valor_map = {doc.to_dict()['account_id']: float(doc.to_dict().get('valor_investido', 0)) 
                    for doc in alloc_ref}
    else:
        # Usar valores totais das contas (Master Global)
        print(f"[EDIT_ORDERS_BATCH] Usando valores totais das contas (Master Global)")
        contas_ref = db.collection('contasDll').stream()
        valor_map = {c.get('AccountID'): float(c.get('Valor Investido', 0)) 
                    for c in (c_doc.to_dict() for c_doc in contas_ref)}

    # Manter apenas ordens em aberto (pendentes ou parcialmente executadas)
    STATUS_FECHADOS = {"Filled", "Cancelled", "Canceled", "Rejected"}
    ordens_editaveis = [
        o for o in ordens
        if (o.get("Status") not in STATUS_FECHADOS) and float(o.get("LeavesQuantity", o.get("quantity", 0))) > 0
    ]

    # Se nenhuma ordem puder ser editada, ainda atualizamos a cfg do iceberg e campo base_qty
    if not ordens_editaveis:
        # Atualizar master_base_qty mesmo assim (impacta próximas ordens)
        for ordem in ordens:
            ord_up_ref = db.collection('ordensDLL').where('OrderID', '==', str(ordem['OrderID'])).stream()
            for doc in ord_up_ref:
                db.collection('ordensDLL').document(doc.id).update({"master_base_qty": base_qty})
        if new_price is not None:
            db.collection('icebergs').document(master_batch_id).set({'price': new_price}, merge=True)
        return {"results": [], "detail": "Nenhuma ordem pendente para edição."}

    # Atualizar master_base_qty em todas as ordens do batch (inclusive preenchidas) para manter consistência
    for ordem in ordens:
        ordens_ref_update = db.collection('ordensDLL').where('OrderID', '==', str(ordem['OrderID'])).stream()
        for doc in ordens_ref_update:
            db.collection('ordensDLL').document(doc.id).update({"master_base_qty": base_qty})
    results = []
    for ordem in ordens_editaveis:
        valor = valor_map.get(ordem['account_id'], 0)
        fator = valor / 10000  # Usar o mesmo divisor fixo do envio da boleta Master
        nova_qtd = max(1, int(base_qty * fator))
        print(f"[EDIT_ORDERS_BATCH] Conta {ordem['account_id']}: valor={valor}, fator={fator:.4f}, nova_qtd={nova_qtd}")
        try:
            # Chama a edição de ordem existente
            from dll_login import profit_dll
            from dll_login import TConnectorChangeOrder, TConnectorAccountIdentifier, TConnectorOrderIdentifier
            from ctypes import byref
            change_order = TConnectorChangeOrder()
            change_order.Version = 0
            change_order.Price = new_price
            change_order.StopPrice = -1
            change_order.Quantity = nova_qtd
            change_order.Password = os.getenv("roteamento", "")
            change_order.AccountID = TConnectorAccountIdentifier()
            change_order.AccountID.Version = 0
            change_order.AccountID.BrokerID = ordem['broker_id']
            change_order.AccountID.AccountID = ordem['account_id']
            change_order.AccountID.SubAccountID = ordem.get('SubAccountID', "")
            change_order.AccountID.Reserved = 0
            change_order.OrderID = TConnectorOrderIdentifier()
            change_order.OrderID.Version = 0
            change_order.OrderID.LocalOrderID = int(ordem['OrderID'])
            change_order.OrderID.ClOrdID = ""
            ret = profit_dll.SendChangeOrderV2(byref(change_order))
            if ret == 0:
                results.append({"order_id": ordem['OrderID'], "success": True})
            else:
                results.append({"order_id": ordem['OrderID'], "success": False, "error": f"Erro código {ret}"})
        except Exception as e:
            results.append({"order_id": ordem['OrderID'], "success": False, "error": str(e)})
    # Atualizar preço no doc iceberg (para futuros envios)
    if new_price is not None:
        db.collection('icebergs').document(master_batch_id).set({'price': new_price}, merge=True)
    return {"results": results, "total_editable": len(ordens_editaveis), "total_skipped": len(ordens) - len(ordens_editaveis)}

@app.post("/cancel_orders_batch")
async def cancel_orders_batch(request: Request):
    data = await request.json()
    master_batch_id = data.get("master_batch_id")
    ordens_ref = db.collection('ordensDLL').where('master_batch_id', '==', master_batch_id).stream()
    ordens = [doc.to_dict() for doc in ordens_ref]
    if not ordens:
        raise HTTPException(status_code=404, detail="Nenhuma ordem encontrada para este batch.")
    results = []
    for ordem in ordens:
        try:
            from dll_login import profit_dll
            from dll_login import TConnectorCancelOrder, TConnectorAccountIdentifier, TConnectorOrderIdentifier
            from ctypes import byref
            cancel_order = TConnectorCancelOrder()
            cancel_order.Version = 0
            cancel_order.Password = os.getenv("roteamento", "")
            cancel_order.AccountID = TConnectorAccountIdentifier()
            cancel_order.AccountID.Version = 0
            cancel_order.AccountID.BrokerID = ordem['broker_id']
            cancel_order.AccountID.AccountID = ordem['account_id']
            cancel_order.AccountID.SubAccountID = ordem.get('SubAccountID', "")
            cancel_order.AccountID.Reserved = 0
            cancel_order.OrderID = TConnectorOrderIdentifier()
            cancel_order.OrderID.Version = 0
            cancel_order.OrderID.LocalOrderID = int(ordem['OrderID'])
            cancel_order.OrderID.ClOrdID = ""
            ret = profit_dll.SendCancelOrderV2(byref(cancel_order))
            if ret == 0:
                results.append({"order_id": ordem['OrderID'], "success": True})
            else:
                results.append({"order_id": ordem['OrderID'], "success": False, "error": f"Erro código {ret}"})
        except Exception as e:
            results.append({"order_id": ordem['OrderID'], "success": False, "error": str(e)})
    return {"results": results}

@app.post("/order_iceberg")
def order_iceberg(data: dict = Body(...)):
    """
    Endpoint para ordem iceberg simples (conta individual).
    """
    iceberg_id = str(uuid.uuid4())
    account_id = data.get("account_id")
    broker_id = data.get("broker_id")
    ticker = data.get("ticker")
    quantity_total = int(data.get("quantity_total"))
    lote = int(data.get("lote"))
    price = float(data.get("price"))
    side = data.get("side")
    exchange = data.get("exchange")
    sub_account = data.get("sub_account", "")
    strategy_id = data.get("strategy_id")

    # Cria/atualiza doc do iceberg no Firestore para controle dinâmico
    db.collection('icebergs').document(iceberg_id).set({
        'price': price,
        'total': quantity_total,
        'executed': 0,
        'halt': False,
        'createdAt': firestore.SERVER_TIMESTAMP
    })

    def iceberg_worker():
        quantidade_restante = quantity_total
        while quantidade_restante > 0:
            # Verifica flag halt e preço atualizado
            doc_cfg = db.collection('icebergs').document(iceberg_id).get()
            if doc_cfg.exists:
                cfg = doc_cfg.to_dict()
                if cfg.get('halt'):
                    print(f"[ICEBERG] Halt flag detectada, encerrando iceberg {iceberg_id}")
                    break
                price_atual = float(cfg.get('price', price))
            else:
                price_atual = price
            quantidade_envio = min(lote, quantidade_restante)
            # Envia ordem
            res = send_order(account_id, broker_id, ticker, quantidade_envio, price_atual, side, exchange, master_batch_id=iceberg_id, master_base_qty=quantity_total, sub_account=sub_account, strategy_id=strategy_id)
            if not res.get("success"):
                print(f"[ICEBERG] Falha ao enviar ordem: {res.get('log')}")
                break
            order_id = res["log"].split("ProfitID: ")[-1] if "ProfitID: " in res["log"] else None
            if not order_id:
                print(f"[ICEBERG] Não foi possível obter ProfitID da ordem.")
                break
            # Polling até execução (sem timeout ou 10h máx)
            for _ in range(36000):  # 10 horas
                ordem_doc = db.collection('ordensDLL').document(str(order_id)).get()
                if ordem_doc.exists:
                    ordem = ordem_doc.to_dict()
                    status = ordem.get("Status")
                    traded = float(ordem.get("TradedQuantity", 0))
                    if status == "Filled" or traded >= quantidade_envio:
                        # incrementa progresso
                        db.collection('icebergs').document(iceberg_id).update({'executed': firestore.Increment(traded)})
                        # Atualizar posições
                        try:
                            atualizar_posicoes_firebase(account_id)
                            if strategy_id:
                                atualizar_posicoes_firebase_strategy(strategy_id)
                        except Exception:
                            pass
                        break
                time.sleep(1)
            else:
                print(f"[ICEBERG] Timeout aguardando execução da ordem {order_id}")
                break
            quantidade_restante -= quantidade_envio
        print(f"[ICEBERG] Ordem iceberg {iceberg_id} finalizada.")

    threading.Thread(target=iceberg_worker, daemon=True).start()
    return {"success": True, "log": f"Ordem iceberg iniciada! ID: {iceberg_id}", "iceberg_id": iceberg_id}

@app.post("/order_iceberg_master")
def order_iceberg_master(data: dict = Body(...)):
    """
    Endpoint para ordem iceberg master (várias contas em ondas).
    """
    iceberg_id = str(uuid.uuid4())
    broker_id = data.get("broker_id")
    ticker = data.get("ticker")
    quantity_total = int(data.get("quantity_total"))
    lote = int(data.get("lote"))
    price = float(data.get("price"))
    side = data.get("side")
    exchange = data.get("exchange")
    group_size = int(data.get("group_size", 1))
    strategy_id = data.get("strategy_id")

    # cria doc do iceberg master também
    db.collection('icebergs').document(iceberg_id).set({
        'price': price,
        'total': quantity_total,
        'executed': 0,
        'halt': False,
        'createdAt': firestore.SERVER_TIMESTAMP
    })

    def iceberg_master_worker():
        # Obter contas participantes
        if strategy_id:
            allocSnap = db.collection('strategyAllocations').where('strategy_id', '==', strategy_id).stream()
            allocs = [a.to_dict() for a in allocSnap]
            contas = [{ 'AccountID': a['account_id'], 'BrokerID': int(a['broker_id']), 'valor_investido': float(a['valor_investido']) } for a in allocs]
        else:
            contas_data = get_accounts()
            contas = contas_data.get("accounts", [])
            contasDllSnap = db.collection('contasDll').stream()
            contasDll = [doc.to_dict() for doc in contasDllSnap]
            valorInvestidoMap = {c['AccountID']: float(c.get('Valor Investido', 0)) for c in contasDll}
            for c in contas:
                c['valor_investido'] = valorInvestidoMap.get(c['AccountID'], 0)

        # Ordenar contas por valor investido (decrescente) para priorizar contas maiores
        contas.sort(key=lambda c: c.get('valor_investido', 0), reverse=True)

        # Calcular quantidade proporcional para cada conta
        contas_proporcionais = []
        for acc in contas:
            valorInvestido = acc.get('valor_investido', 0)
            fator = valorInvestido / 10000
            quantidade = int(quantity_total * fator)
            if quantidade > 0:
                contas_proporcionais.append({
                    'AccountID': acc['AccountID'],
                    'BrokerID': acc['BrokerID'],
                    'quantidade': quantidade
                })
        # Dividir em grupos
        for i in range(0, len(contas_proporcionais), group_size):
            grupo = contas_proporcionais[i:i+group_size]
            threads = []
            for conta in grupo:
                def iceberg_conta_worker(conta=conta):
                    quantidade_restante = conta['quantidade']
                    while quantidade_restante > 0:
                        # buscar config dinâmica antes de cada fatia
                        doc_cfg = db.collection('icebergs').document(iceberg_id).get()
                        if doc_cfg.exists and doc_cfg.to_dict().get('halt'):
                            print(f"[ICEBERG MASTER] Halt flag, encerrando conta {conta['AccountID']}")
                            return
                        price_cfg = doc_cfg.to_dict().get('price', price) if doc_cfg.exists else price

                        quantidade_envio = min(lote, quantidade_restante)
                        res = send_order(conta['AccountID'], conta['BrokerID'], ticker, quantidade_envio, price_cfg, side, exchange, master_batch_id=iceberg_id, master_base_qty=quantity_total, sub_account=conta.get('SubAccountID', ""), strategy_id=strategy_id)
                        if not res.get("success"):
                            print(f"[ICEBERG MASTER] Falha ao enviar ordem: {res.get('log')}")
                            break
                        order_id = res["log"].split("ProfitID: ")[-1] if "ProfitID: " in res["log"] else None
                        if not order_id:
                            print(f"[ICEBERG MASTER] Não foi possível obter ProfitID da ordem.")
                            break
                        # Polling até execução (sem timeout ou 10h máx)
                        for _ in range(36000):  # 10 horas
                            ordem_doc = db.collection('ordensDLL').document(str(order_id)).get()
                            if ordem_doc.exists:
                                ordem = ordem_doc.to_dict()
                                status = ordem.get("Status")
                                traded = float(ordem.get("TradedQuantity", 0))
                                if status == "Filled" or traded >= quantidade_envio:
                                    # incrementa progresso
                                    db.collection('icebergs').document(iceberg_id).update({'executed': firestore.Increment(traded)})
                                    break
                            time.sleep(1)
                        else:
                            print(f"[ICEBERG MASTER] Timeout aguardando execução da ordem {order_id}")
                            break
                        quantidade_restante -= quantidade_envio
                    print(f"[ICEBERG MASTER] Conta {conta['AccountID']} finalizada.")
                t = threading.Thread(target=iceberg_conta_worker, daemon=True)
                threads.append(t)
                t.start()
            # Esperar todas as contas do grupo terminarem
            for t in threads:
                t.join()
        print(f"[ICEBERG MASTER] Ordem iceberg master {iceberg_id} finalizada.")

    threading.Thread(target=iceberg_master_worker, daemon=True).start()
    return {"success": True, "log": f"Ordem iceberg master iniciada! ID: {iceberg_id}", "iceberg_id": iceberg_id}

# --------------------- NOVA ROTA: FECHAR/REDUZIR MASTER BATCH ---------------------

# Fecha (zera) ou reduz somente as contas que tiveram execução em um master_batch.
# Permite 3 tipos de envio: market, limit e iceberg.

@app.post("/close_master_batch")
async def close_master_batch(request: Request):
    data = await request.json()

    master_batch_id = data.get("master_batch_id")
    ticker = data.get("ticker")
    exchange = data.get("exchange")
    pct = float(data.get("pct", 1.0))
    order_type = data.get("order_type", "market").lower()  # market | limit | iceberg
    price = float(data.get("price", -1))   # -1 será tratado como Market
    lote = int(data.get("lote", 0))         # obrigatório p/ iceberg
    group_size = int(data.get("group_size", 1))

    if not master_batch_id or not ticker or not exchange:
        raise HTTPException(status_code=400, detail="master_batch_id, ticker e exchange são obrigatórios")

    if pct <= 0 or pct > 1:
        raise HTTPException(status_code=400, detail="pct deve estar entre 0 (exclusive) e 1 (inclusive)")

    # Coletar ordens que realmente executaram
    ordens_ref = db.collection('ordensDLL').where('master_batch_id', '==', master_batch_id).stream()
    exec_por_conta = {}
    side_original = None
    broker_map = {}
    for doc in ordens_ref:
        o = doc.to_dict()
        traded = float(o.get('TradedQuantity', 0))
        if traded <= 0:
            continue  # ignorar ordens não executadas
        key = (o['account_id'], o['broker_id'])
        exec_por_conta[key] = exec_por_conta.get(key, 0) + traded
        broker_map[key] = o['broker_id']
        if side_original is None:
            side_original = o.get('side')

    if not exec_por_conta:
        raise HTTPException(status_code=404, detail="Nenhuma execução encontrada para este master_batch")

    side_reverse = 'sell' if side_original == 'buy' else 'buy'
    close_batch_id = str(uuid.uuid4())

    results = []

    def enviar_ordem(account_id, broker_id, qty):
        return send_order(account_id, broker_id, ticker, qty, price, side_reverse, exchange, master_batch_id=close_batch_id, master_base_qty=qty)

    if order_type in ("market", "limit"):
        # Enviar 1 ordem por conta
        for (acc_id, brk_id), qtd_exec in exec_por_conta.items():
            qty_final = max(1, int(qtd_exec * pct))
            res = enviar_ordem(acc_id, brk_id, qty_final)
            results.append({"account_id": acc_id, "success": res.get("success"), "log": res.get("log")})

    elif order_type == "iceberg":
        if lote <= 0:
            raise HTTPException(status_code=400, detail="lote deve ser > 0 para ordem iceberg")

        def iceberg_conta_worker(acc_id, brk_id, qty_total):
            qtd_restante = qty_total
            while qtd_restante > 0:
                qtd_envio = min(lote, qtd_restante)
                res = enviar_ordem(acc_id, brk_id, qtd_envio)
                if not res.get("success"):
                    print(f"[CLOSE ICEBERG] Falha ao enviar ordem: {res.get('log')}")
                    break
                order_id = res["log"].split("ProfitID: ")[-1] if "ProfitID: " in res["log"] else None
                if not order_id:
                    break
                # Espera execução (máximo 2 minutos)
                for _ in range(120):
                    doc = db.collection('ordensDLL').document(str(order_id)).get()
                    if doc.exists:
                        d = doc.to_dict()
                        traded = float(d.get('TradedQuantity', 0))
                        status = d.get('Status')
                        if status == 'Filled' or traded >= qtd_envio:
                            break
                    time.sleep(1)
                else:
                    print(f"[CLOSE ICEBERG] Timeout aguardando execução da ordem {order_id}")
                    break
                qtd_restante -= qtd_envio
            print(f"[CLOSE ICEBERG] Conta {acc_id} zerada/reduzida.")

        # Agrupar por waves
        keys = list(exec_por_conta.keys())
        for i in range(0, len(keys), group_size):
            grupo = keys[i:i+group_size]
            threads = []
            for key in grupo:
                acc_id, brk_id = key
                qty_final = max(1, int(exec_por_conta[key] * pct))
                t = threading.Thread(target=iceberg_conta_worker, args=(acc_id, brk_id, qty_final), daemon=True)
                threads.append(t)
                t.start()
            for t in threads:
                t.join()
        results.append({"success": True, "log": "Iceberg batch iniciado"})
    else:
        raise HTTPException(status_code=400, detail="order_type inválido. Use market, limit ou iceberg")

    # Atualizar posições de cada conta processada
    for (acc_id, _), _qty in exec_por_conta.items():
        atualizar_posicoes_firebase(acc_id)

    return {"close_batch_id": close_batch_id, "results": results}

@app.get("/positions_strategy")
def positions_strategy(strategy_id: str):
    docs = db.collection('strategyPositions').where('strategy_id','==',strategy_id).stream()
    positions = [d.to_dict() for d in docs]
    return {'positions': positions} 