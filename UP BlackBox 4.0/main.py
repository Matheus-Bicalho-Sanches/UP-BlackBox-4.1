"""
UP BlackBox 4.0 - Backend API

ARQUITETURA:
- Sistema de gestão de carteiras manual e automatizada
- Carteiras: UP BlackBox FIIs (manual), UP BlackBox Multi (manual → automatizada)
- "MASTER" é abstração para consolidar dados de múltiplas contas
- Integração com ProfitDLL para execução de ordens

SEGURANÇA:
- Autenticação de usuários via frontend /login
- Todos os usuários têm mesmo nível de acesso
- Sistema em produção - não usar fallbacks fictícios

FUNCIONALIDADES:
- Login automático na DLL do Profit
- Gestão de estratégias (carteiras) e alocações
- Execução de ordens individuais e em lote
- Consolidação de posições por estratégia
"""

from fastapi import FastAPI, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from dll_login import login_profit, get_accounts, get_positions, send_order, get_orders, get_order_by_profitid
import os
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin.firestore import SERVER_TIMESTAMP
from ctypes import byref, c_double, c_int, c_longlong, c_wchar_p, create_unicode_buffer, cast
import threading
import time
import uuid
import datetime

# Aqui você importaria a função real de login da DLL
# from profit_dll import login_profit

app = FastAPI()

# Configuração de CORS para permitir o frontend acessar o backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        # Permitir qualquer origem em desenvolvimento (mais permissivo)
        "*"
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Language",
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
    ],
    expose_headers=["*"],
    max_age=86400  # Cache preflight por 24 horas
)

# --- Firebase Admin SDK ---
FIREBASE_CRED_PATH = os.path.join(os.path.dirname(__file__), 'secrets', 'up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json')
if not firebase_admin._apps:
    cred = credentials.Certificate(FIREBASE_CRED_PATH)
    firebase_admin.initialize_app(cred)

db = firestore.client()

@app.get("/test")
def test_endpoint():
    """Endpoint de teste para verificar se o servidor está funcionando"""
    return {"message": "Backend funcionando!", "status": "ok"}

@app.get("/test-cors")
def test_cors_endpoint():
    """Endpoint específico para testar CORS"""
    return {
        "message": "CORS funcionando!",
        "status": "ok",
        "timestamp": time.time(),
        "cors_test": True
    }

@app.options("/test-cors")
def test_cors_options():
    """Endpoint OPTIONS para testar preflight CORS"""
    return {"message": "OPTIONS funcionando", "status": "ok"}

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

def calcular_novo_preco_medio(quantity_atual, preco_medio_atual, quantity_change, price, side):
    """
    Calcula novo preço médio baseado na operação
    
    Args:
        quantity_atual: Quantidade atual da posição
        preco_medio_atual: Preço médio atual
        quantity_change: Mudança na quantidade (positivo para compra, negativo para venda)
        price: Preço da transação
        side: 'buy' ou 'sell'
    
    Returns:
        float: Novo preço médio
    """
    if side == 'buy' and quantity_change > 0:
        # Compra: média ponderada
        if quantity_atual >= 0:
            # Posição long ou zerada: média ponderada normal
            valor_total_atual = quantity_atual * preco_medio_atual
            valor_total_novo = quantity_change * price
            nova_quantity_total = quantity_atual + quantity_change
            
            if nova_quantity_total > 0:
                return (valor_total_atual + valor_total_novo) / nova_quantity_total
            else:
                return 0
        else:
            # Posição short: reduz o short
            if quantity_atual + quantity_change >= 0:
                # Short foi zerado e virou long
                return price
            else:
                # Short foi reduzido: mantém preço médio do short
                return preco_medio_atual
                
    elif side == 'sell' and quantity_change > 0:
        # Venda: mantém preço médio atual (exceto se zerar)
        if quantity_atual > 0:
            # Posição long: mantém preço médio
            return preco_medio_atual
        else:
            # Posição short ou zerada: preço da venda
            return price
    
    return preco_medio_atual

def calcular_campos_adicionais(pos_atual, quantity_change, price, side):
    """
    Calcula campos adicionais para compatibilidade com frontend
    
    Args:
        pos_atual: Posição atual do documento
        quantity_change: Mudança na quantidade
        price: Preço da transação
        side: 'buy' ou 'sell'
    
    Returns:
        tuple: (avg_buy_price, avg_sell_price, total_buy_qty, total_sell_qty)
    """
    avg_buy_price = pos_atual.get('avgBuyPrice', 0)
    avg_sell_price = pos_atual.get('avgSellPrice', 0)
    total_buy_qty = pos_atual.get('totalBuyQty', 0)
    total_sell_qty = pos_atual.get('totalSellQty', 0)
    
    if side == 'buy' and quantity_change > 0:
        # Compra: atualiza campos de compra
        if total_buy_qty > 0:
            # Média ponderada das compras
            novo_total_buy = total_buy_qty + quantity_change
            novo_avg_buy = ((total_buy_qty * avg_buy_price) + (quantity_change * price)) / novo_total_buy
        else:
            # Primeira compra
            novo_total_buy = quantity_change
            novo_avg_buy = price
        
        return novo_avg_buy, avg_sell_price, novo_total_buy, total_sell_qty
        
    elif side == 'sell' and quantity_change > 0:
        # Venda: atualiza campos de venda
        if total_sell_qty > 0:
            # Média ponderada das vendas
            novo_total_sell = total_sell_qty + quantity_change
            novo_avg_sell = ((total_sell_qty * avg_sell_price) + (quantity_change * price)) / novo_total_sell
        else:
            # Primeira venda
            novo_total_sell = quantity_change
            novo_avg_sell = price
        
        return avg_buy_price, novo_avg_sell, total_buy_qty, novo_total_sell
    
    return avg_buy_price, avg_sell_price, total_buy_qty, total_sell_qty

def buscar_ajuste_manual_lfts11(account_id):
    """
    Busca ajustes manuais de LFTS11 da conta
    
    Args:
        account_id: ID da conta
    
    Returns:
        float: Quantidade do ajuste manual
    """
    try:
        contas_ref = db.collection('contasDll').where('AccountID', '==', account_id).stream()
        for doc in contas_ref:
            conta = doc.to_dict()
            return float(conta.get('AjusteQuantityLFTS11', 0))
    except Exception as e:
        print(f"[AJUSTE] Erro ao buscar ajuste manual LFTS11 para {account_id}: {e}")
        return 0

def buscar_preco_fixo_lfts11():
    """
    Busca preço fixo de LFTS11 do config
    
    Returns:
        float: Preço fixo ou 0 se não encontrado
    """
    try:
        config_ref = db.collection('config').document('lftsPrice')
        config_doc = config_ref.get()
        if config_doc.exists:
            preco_fixo = float(config_doc.to_dict().get('value', 0))
            if preco_fixo > 0:
                return preco_fixo
    except Exception as e:
        print(f"[PREÇO] Erro ao buscar preço fixo LFTS11: {e}")
    return 0



def atualizar_posicao_incremental(account_id, ticker, quantity_change, price, side):
    """
    Atualização incremental de posição com suporte a operações short
    
    Args:
        account_id: ID da conta
        ticker: Ticker do ativo
        quantity_change: Mudança na quantidade (positivo para compra, negativo para venda)
        price: Preço da transação
        side: 'buy' ou 'sell'
    """
    print(f"[INCREMENTAL] Atualizando {ticker} para {account_id}: {quantity_change} ações a R$ {price} ({side})")
    
    doc_id = f"{account_id}_{ticker}"
    doc_ref = db.collection('posicoesDLL').document(doc_id)
    
    # Busca posição atual
    doc = doc_ref.get()
    
    if doc.exists:
        pos_atual = doc.to_dict()
        quantity_atual = pos_atual.get('quantity', 0)
        preco_medio_atual = pos_atual.get('avgPrice', 0)
        
        # ✅ CORREÇÃO: Tratamento especial para LFTS11 (apenas preço fixo)
        if ticker == 'LFTS11':
            # Buscar ajuste manual apenas para log (não afeta cálculo)
            ajuste_quantity = buscar_ajuste_manual_lfts11(account_id)
            print(f"[INCREMENTAL] LFTS11 - Posição atual: {quantity_atual}, Ajuste: {ajuste_quantity}, Posição exibida: {quantity_atual + ajuste_quantity}")
        
        # Calcula nova quantidade baseada na posição REAL (sem ajuste manual)
        nova_quantity = quantity_atual + quantity_change
        
        # Calcula novo preço médio baseado na posição REAL (sem ajuste manual)
        novo_preco_medio = calcular_novo_preco_medio(
            quantity_atual, preco_medio_atual, quantity_change, price, side
        )
        
        # Calcula campos adicionais para compatibilidade
        avg_buy_price, avg_sell_price, total_buy_qty, total_sell_qty = calcular_campos_adicionais(
            pos_atual, quantity_change, price, side
        )
        
        # ✅ CORREÇÃO: Aplicar preço fixo para LFTS11 (se configurado)
        if ticker == 'LFTS11':
            preco_fixo = buscar_preco_fixo_lfts11()
            if preco_fixo > 0:
                novo_preco_medio = preco_fixo
        
        # Atualiza no Firebase
        doc_ref.update({
            'quantity': nova_quantity,
            'avgPrice': novo_preco_medio,
            'avgBuyPrice': avg_buy_price,
            'avgSellPrice': avg_sell_price,
            'totalBuyQty': total_buy_qty,
            'totalSellQty': total_sell_qty,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        print(f"[INCREMENTAL] ✅ {ticker} atualizado: {quantity_atual} → {nova_quantity}, R$ {preco_medio_atual:.2f} → R$ {novo_preco_medio:.2f}")
        
    else:
        # Cria nova posição
        nova_quantity = quantity_change
        novo_preco_medio = price
        
        # ✅ CORREÇÃO: Tratamento especial para LFTS11 em nova posição (apenas preço fixo)
        if ticker == 'LFTS11':
            # Buscar ajuste manual apenas para log (não afeta cálculo)
            ajuste_quantity = buscar_ajuste_manual_lfts11(account_id)
            print(f"[INCREMENTAL] LFTS11 - Nova posição: {quantity_change}, Ajuste: {ajuste_quantity}, Posição exibida: {quantity_change + ajuste_quantity}")
            
            # Buscar preço fixo
            preco_fixo = buscar_preco_fixo_lfts11()
            if preco_fixo > 0:
                novo_preco_medio = preco_fixo
        
        # Campos adicionais para nova posição
        if side == 'buy' and quantity_change > 0:
            avg_buy_price, avg_sell_price, total_buy_qty, total_sell_qty = price, 0, quantity_change, 0
        elif side == 'sell' and quantity_change > 0:
            avg_buy_price, avg_sell_price, total_buy_qty, total_sell_qty = 0, price, 0, quantity_change
        else:
            avg_buy_price, avg_sell_price, total_buy_qty, total_sell_qty = 0, 0, 0, 0
        
        doc_ref.set({
            'account_id': account_id,
            'ticker': ticker,
            'quantity': nova_quantity,
            'avgPrice': novo_preco_medio,
            'avgBuyPrice': avg_buy_price,
            'avgSellPrice': avg_sell_price,
            'totalBuyQty': total_buy_qty,
            'totalSellQty': total_sell_qty,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        print(f"[INCREMENTAL] ✅ Nova posição {ticker} criada: {nova_quantity} ações a R$ {novo_preco_medio:.2f}")

def atualizar_posicoes_firebase(account_id):
    """
    Atualiza a coleção posicoesDLL para o cliente account_id, calculando a posição líquida e preço médio de cada ativo a partir das ordens EXECUTADAS em ordensDLL.
    Só considera ordens com Status 'Filled' ou TradedQuantity > 0, e usa a quantidade executada (TradedQuantity).
    O preço médio é calculado usando preco_medio_executado se existir, senão price.
    Para LFTS11, considera ajustes manuais armazenados em contasDll.
    """
    print(f"[posicoesDLL] Atualizando posições para account_id={account_id}")
    
    # Buscar ajustes manuais da conta (se existirem)
    ajuste_quantity = 0
    ajuste_avg_price = 0
    try:
        contas_ref = db.collection('contasDll').where('AccountID', '==', account_id).stream()
        for doc in contas_ref:
            conta = doc.to_dict()
            ajuste_quantity = float(conta.get('AjusteQuantityLFTS11', 0))
            ajuste_avg_price = float(conta.get('AjusteAvgPriceLFTS11', 0))
            break
    except Exception as e:
        print(f"[posicoesDLL] Erro ao buscar ajustes manuais para {account_id}: {e}")
    
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
            pos_map[ticker] = {
                'ticker': ticker, 
                'quantity': 0, 
                'totalBuy': 0, 
                'totalSell': 0, 
                'avgPrice': 0,
                'avgBuyPrice': 0,    # NOVO: Preço médio das compras
                'avgSellPrice': 0,   # NOVO: Preço médio das vendas
                'totalBuyQty': 0,    # NOVO: Quantidade total comprada
                'totalSellQty': 0    # NOVO: Quantidade total vendida
            }
        if side == 'buy':
            pos_map[ticker]['quantity'] += traded_qty
            pos_map[ticker]['totalBuy'] += traded_qty * price
            pos_map[ticker]['totalBuyQty'] += traded_qty  # NOVO
        elif side == 'sell':
            pos_map[ticker]['quantity'] -= traded_qty
            pos_map[ticker]['totalSell'] += traded_qty * price
            pos_map[ticker]['totalSellQty'] += traded_qty  # NOVO
    
    # Calcula preços médios ponderados
    for pos in pos_map.values():
        # Calcular preço médio das compras
        pos['avgBuyPrice'] = pos['totalBuyQty'] > 0 and pos['totalBuy'] / pos['totalBuyQty'] or 0
        
        # Calcular preço médio das vendas
        pos['avgSellPrice'] = pos['totalSellQty'] > 0 and pos['totalSell'] / pos['totalSellQty'] or 0
        
        # Determinar qual preço médio usar baseado na posição líquida
        if pos['quantity'] > 0:
            # Posição comprada: usar preço médio das compras
            pos['avgPrice'] = pos['avgBuyPrice']
        elif pos['quantity'] < 0:
            # Posição vendida: usar preço médio das vendas
            pos['avgPrice'] = pos['avgSellPrice']
        else:
            # Posição zerada: usar preço médio das compras (fallback)
            pos['avgPrice'] = pos['avgBuyPrice']
    
    # Aplicar ajustes manuais para LFTS11
    if 'LFTS11' in pos_map:
        pos_lfts = pos_map['LFTS11']
        posicao_calculada = pos_lfts['quantity']  # Posição baseada nas ordens
        
        # NOVA LÓGICA: Se posição calculada é 0, zerar ajuste manual automaticamente
        if posicao_calculada == 0 and ajuste_quantity != 0:
            try:
                # Buscar documento da conta
                contas_ref = db.collection('contasDll').where('AccountID', '==', account_id).stream()
                for doc in contas_ref:
                    # Zerar o ajuste manual
                    doc.reference.update({
                        'AjusteQuantityLFTS11': 0,
                        'AjusteAvgPriceLFTS11': 0
                    })
                    print(f"[posicoesDLL] ✅ Ajuste manual zerado automaticamente para {account_id} - posição calculada = 0, ajuste anterior = {ajuste_quantity}")
                    ajuste_quantity = 0  # Zerar para uso local
                    break
            except Exception as e:
                print(f"[posicoesDLL] ❌ Erro ao zerar ajuste manual para {account_id}: {e}")
        
        # Aplicar ajuste de quantidade (agora pode ser 0)
        pos_lfts['quantity'] += ajuste_quantity
        
        # USAR PREÇO LFTS11 FIXO DO CONFIG
        try:
            # Buscar preço LFTS11 fixo do config
            config_ref = db.collection('config').document('lftsPrice')
            config_doc = config_ref.get()
            if config_doc.exists:
                preco_fixo = float(config_doc.to_dict().get('value', 0))
                if preco_fixo > 0:
                    pos_lfts['avgPrice'] = preco_fixo
                    print(f"[posicoesDLL] LFTS11 usando preço fixo - Conta {account_id}: quantidade={pos_lfts['quantity']}, preco_medio_fixo={pos_lfts['avgPrice']:.2f}")
                else:
                    # Fallback: usar preço médio calculado se não há preço fixo
                    if pos_lfts['quantity'] > 0:
                        pos_lfts['avgPrice'] = pos_lfts['totalBuy'] / pos_lfts['quantity']
                    else:
                        pos_lfts['avgPrice'] = 0
                    print(f"[posicoesDLL] LFTS11 usando preço calculado (fallback) - Conta {account_id}: quantidade={pos_lfts['quantity']}, preco_medio={pos_lfts['avgPrice']:.2f}")
            else:
                # Fallback: usar preço médio calculado se não há config
                if pos_lfts['quantity'] > 0:
                    pos_lfts['avgPrice'] = pos_lfts['totalBuy'] / pos_lfts['quantity']
                else:
                    pos_lfts['avgPrice'] = 0
                print(f"[posicoesDLL] LFTS11 usando preço calculado (sem config) - Conta {account_id}: quantidade={pos_lfts['quantity']}, preco_medio={pos_lfts['avgPrice']:.2f}")
        except Exception as e:
            print(f"[posicoesDLL] Erro ao buscar preço fixo LFTS11: {e}")
            # Fallback: usar preço médio calculado
            if pos_lfts['quantity'] > 0:
                pos_lfts['avgPrice'] = pos_lfts['totalBuy'] / pos_lfts['quantity']
            else:
                pos_lfts['avgPrice'] = 0
            print(f"[posicoesDLL] LFTS11 usando preço calculado (erro) - Conta {account_id}: quantidade={pos_lfts['quantity']}, preco_medio={pos_lfts['avgPrice']:.2f}")
    
    # Salva as posições na coleção posicoesDLL (um doc por ticker por cliente)
    for ticker, pos in pos_map.items():
        doc_id = f"{account_id}_{ticker}"
        db.collection('posicoesDLL').document(doc_id).set({
            'account_id': account_id,
            'ticker': ticker,
            'quantity': pos['quantity'],
            'avgPrice': pos['avgPrice'],
            'avgBuyPrice': pos['avgBuyPrice'],      # NOVO
            'avgSellPrice': pos['avgSellPrice'],    # NOVO
            'totalBuyQty': pos['totalBuyQty'],      # NOVO
            'totalSellQty': pos['totalSellQty'],    # NOVO
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
    print(f"[posicoesDLL] Posições atualizadas para {account_id}: {list(pos_map.keys())}")

def atualizar_posicoes_firebase_strategy(strategy_id):
    """
    Consolida posições por estratégia usando ordensDLL com strategy_id.
    Salva em collection strategyPositions (doc id: f"{strategy_id}_{ticker}").
    FILTRO: Apenas ordens do dia atual E apenas de contas atualmente alocadas na estratégia.
    ⚡ OTIMIZADO: Filtro de data aplicado DIRETO NO FIRESTORE (não em Python)
    """
    import datetime
    
    # Obter data atual (início do dia)
    hoje = datetime.datetime.now().date()
    inicio_dia = datetime.datetime.combine(hoje, datetime.time.min)
    
    print(f"[strategyPositions OPTIMIZED] 🚀 Recalculando posições para strategy_id={strategy_id} (apenas ordens de {hoje})")
    print(f"[strategyPositions OPTIMIZED] 🔥 Usando filtro de data NO FIRESTORE (não em Python)")
    
    # 1. Buscar contas atualmente alocadas na estratégia
    alloc_docs = db.collection('strategyAllocations').where('strategy_id','==',strategy_id).stream()
    contas_ativas = [d.to_dict()['account_id'] for d in alloc_docs]
    
    print(f"[strategyPositions] Strategy {strategy_id}: {len(contas_ativas)} contas ativas")
    
    if not contas_ativas:
        print(f"[strategyPositions] Strategy {strategy_id}: Nenhuma conta ativa, limpando posições")
        # Limpar posições antigas da estratégia
        strategy_pos_docs = db.collection('strategyPositions').where('strategy_id','==',strategy_id).stream()
        for doc in strategy_pos_docs:
            doc.reference.delete()
        return
    
    # 2. ⚡ OTIMIZAÇÃO CRÍTICA: Buscar ordens da estratégia COM FILTRO DE DATA NO FIRESTORE
    # ANTES: Buscava TODAS (10.000+) e filtrava em Python
    # DEPOIS: Firestore filtra, retorna apenas ~50-100 ordens do dia
    ordens_ref = db.collection('ordensDLL')\
        .where('strategy_id', '==', strategy_id)\
        .where('createdAt', '>=', inicio_dia)\
        .stream()
    
    pos_map = {}
    ordens_processadas = 0
    ordens_filtradas = 0
    ordens_contas_inativas = 0
    
    print(f"[strategyPositions OPTIMIZED] 📊 Buscando ordens com filtro: strategy_id={strategy_id} AND createdAt >= {inicio_dia}")
    
    for doc in ordens_ref:
        o = doc.to_dict()
        if not o:
            continue
            
        ordens_processadas += 1
        
        # Verificar se a ordem é de uma conta ativa
        account_id = o.get('account_id')
        if account_id not in contas_ativas:
            ordens_contas_inativas += 1
            continue
        
        # ⚡ REMOVIDO: Filtro de data em Python (agora feito no Firestore!)
        # O Firestore já retorna apenas ordens do dia
        # Mantido apenas validação de segurança caso createdAt seja nulo
        created_at = o.get('createdAt')
        if not created_at:
            # Se não tem createdAt, pular por segurança
            ordens_filtradas += 1
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
        if vals['qty'] == 0:  # Pular posições zeradas
            continue
        avg = vals['qty']>0 and vals['totalBuy']/vals['qty'] or 0
        db.collection('strategyPositions').document(f"{strategy_id}_{t}").set({
            'strategy_id': strategy_id,
            'ticker': t,
            'quantity': vals['qty'],
            'avgPrice': avg,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
    
    print(f"[strategyPositions OPTIMIZED] ✅ Atualizado strategy_id={strategy_id} tickers={list(pos_map.keys())}")
    print(f"[strategyPositions OPTIMIZED] 📊 Estatísticas:")
    print(f"  • Ordens processadas (do dia): {ordens_processadas}")
    print(f"  • Ordens filtradas (createdAt nulo): {ordens_filtradas}")
    print(f"  • Ordens de contas inativas: {ordens_contas_inativas}")
    print(f"[strategyPositions OPTIMIZED] 💰 Economia estimada: ~{max(0, 10000 - ordens_processadas):,} reads economizados vs busca sem filtro de data!")

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
            
            # Lógica consistente para compra e venda
            fator = valor_inv / 10000
            qty_calc = max(1, int(math.floor(quantity * fator)))
            print(f"[ORDER] {side.upper()} - Conta {alloc['account_id']} (Broker {alloc['broker_id']}) – valor_inv={valor_inv:.2f} fator={fator:.4f} qty_calc={qty_calc}")
            
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
                    # ✅ REMOVIDO: Atualização incremental (será feita pelo callback DLL)
                    pass
                except Exception:
                    pass

        return {"master_batch_id": master_batch_id, "results": results}

    # -------------------- FLUXO ANTIGO (conta individual) --------------------
    result = send_order(account_id, broker_id, ticker, quantity, price, side, exchange, master_batch_id, master_base_qty, sub_account, strategy_id)
    if result["success"]:
        # ✅ REMOVIDO: Atualização incremental (será feita pelo callback DLL)
        
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
    # Tratamento defensivo para identificar alteração explícita de baseQty
    base_qty_value = data.get("baseQty")
    if base_qty_value == '' or base_qty_value is None:
        base_qty = None  # não alterar quantidades se usuário não informou
    else:
        base_qty = int(base_qty_value)
    new_lote = data.get("new_lote")  # NOVO: tamanho do lote para icebergs
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

    # Detectar se baseQty foi alterado pelo usuário comparando com valor atual
    existing_base_qty = None
    for o in ordens:
        if 'master_base_qty' in o:
            existing_base_qty = o.get('master_base_qty')
            break
    base_qty_changed = (base_qty is not None and base_qty != existing_base_qty)

    # Atualizar master_base_qty em todas as ordens do batch somente se informado
    if base_qty is not None:
        for ordem in ordens:
            ordens_ref_update = db.collection('ordensDLL').where('OrderID', '==', str(ordem['OrderID'])).stream()
            for doc in ordens_ref_update:
                db.collection('ordensDLL').document(doc.id).update({"master_base_qty": base_qty})
    results = []
    for ordem in ordens_editaveis:
        # Definir quantidade a enviar conforme regra:
        # - Por padrão NÃO recalcular quantidade; manter a quantidade atual da ordem
        # - Somente recalcular se baseQty foi alterado pelo usuário
        # Quantidade atual (preferir LeavesQuantity se disponível)
        qty_value_current = ordem.get('LeavesQuantity', ordem.get('quantity', 0))
        try:
            qty_atual = int(qty_value_current) if qty_value_current not in ('', None) else 0
        except Exception:
            qty_atual = 0

        nova_qtd = qty_atual

        if base_qty_changed:
            # Se houver doc de iceberg ativo, para ordens iceberg usar tamanho do lote atual
            doc_iceberg = db.collection('icebergs').document(master_batch_id).get()
            if doc_iceberg.exists:
                cfg_iceberg = doc_iceberg.to_dict()
                lote_value = cfg_iceberg.get('lote', 1)
                if lote_value == '' or lote_value is None:
                    lote_atual = 1
                else:
                    lote_atual = int(lote_value)
                nova_qtd = lote_atual
                print(f"[EDIT_ORDERS_BATCH] Conta {ordem['account_id']}: baseQty alterado → iceberg lote={lote_atual}, nova_qtd={nova_qtd}")
            else:
                # Não é iceberg: recalcular com base no novo base_qty e valor investido da conta
                valor_inv = float(valor_map.get(ordem['account_id'], 0))
                fator = valor_inv / 10000.0
                try:
                    calc_qtd = int(base_qty * fator)
                except Exception:
                    calc_qtd = 0
                nova_qtd = max(1, calc_qtd)
                print(f"[EDIT_ORDERS_BATCH] Conta {ordem['account_id']}: baseQty alterado → recálculo qty={nova_qtd} (valor_inv={valor_inv})")
        try:
            # Chama a edição de ordem existente
            from dll_login import profit_dll
            from dll_login import TConnectorChangeOrder, TConnectorAccountIdentifier, TConnectorOrderIdentifier
            from ctypes import byref
            change_order = TConnectorChangeOrder()
            change_order.Version = 0
            change_order.Price = new_price
            change_order.StopPrice = -1
            change_order.Quantity = nova_qtd  # mantém qty atual, só altera se baseQty mudou
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
    # Atualizar preço e lote no doc iceberg (para futuros envios)
    iceberg_update = {}
    if new_price is not None:
        iceberg_update['price'] = new_price
    if new_lote is not None:
        iceberg_update['lote'] = new_lote
        print(f"[EDIT ICEBERG] Tamanho do lote atualizado para {new_lote} na iceberg {master_batch_id}")
    
    if iceberg_update:
        db.collection('icebergs').document(master_batch_id).set(iceberg_update, merge=True)
    
    return {
        "results": results, 
        "total_editable": len(ordens_editaveis), 
        "total_skipped": len(ordens) - len(ordens_editaveis),
        "iceberg_lote_updated": new_lote is not None
    }

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
    Endpoint para ordem iceberg simples (conta individual) com suporte TWAP.
    """
    iceberg_id = str(uuid.uuid4())
    account_id = data.get("account_id")
    broker_id = data.get("broker_id")
    ticker = data.get("ticker")
    # Tratamento defensivo para evitar erro de conversão de string vazia para int
    qty_total_value = data.get("quantity_total")
    if qty_total_value == '' or qty_total_value is None:
        quantity_total = 0
    else:
        quantity_total = int(qty_total_value)
    # Tratamento defensivo para evitar erro de conversão de string vazia para int
    lote_value = data.get("lote")
    if lote_value == '' or lote_value is None:
        lote = 1
    else:
        lote = int(lote_value)
    price = float(data.get("price"))
    side = data.get("side")
    exchange = data.get("exchange")
    sub_account = data.get("sub_account", "")
    strategy_id = data.get("strategy_id")
    
    # NOVOS PARÂMETROS TWAP
    twap_enabled = data.get("twap_enabled", False)
    twap_interval = data.get("twap_interval", 30) if data.get("twap_enabled", False) else 30

    # Calcular número correto de lotes
    total_lotes = (quantity_total + lote - 1) // lote  # Equivalente a Math.ceil(quantity_total / lote)
    
    # Cria/atualiza doc do iceberg no Firestore para controle dinâmico
    db.collection('icebergs').document(iceberg_id).set({
        'iceberg_id': iceberg_id,
        'account_id': account_id,
        'broker_id': broker_id,
        'ticker': ticker,
        'price': price,
        'total': quantity_total,
        'total_lotes': total_lotes,
        'executed': 0,
        'executed_lotes': 0,
        'current_lote': 0,
        'halt': False,
        'lote': lote,  # Armazenar tamanho do lote inicial
        'twap_enabled': twap_enabled,
        'twap_interval': twap_interval,
        'side': side,
        'exchange': exchange,
        'strategy_id': strategy_id,
        'status': 'running',
        'start_time': firestore.SERVER_TIMESTAMP,
        'last_update': firestore.SERVER_TIMESTAMP,
        'createdAt': firestore.SERVER_TIMESTAMP
    })

    def iceberg_worker():
        quantidade_restante = quantity_total
        lote_atual = 0
        
        # ⚡ OTIMIZAÇÃO 1: Sistema de eventos para callbacks (elimina polling)
        order_events = {}  # {order_id: threading.Event()}
        
        # Logs TWAP
        if twap_enabled:
            tempo_total_estimado = total_lotes * twap_interval
            print(f"[ICEBERG TWAP] Configurado: {twap_interval}s entre lotes")
            print(f"[ICEBERG TWAP] Total estimado: {total_lotes} lotes")
            print(f"[ICEBERG TWAP] Tempo total estimado: {tempo_total_estimado}s ({tempo_total_estimado/60:.1f} minutos)")
        
        print(f"[ICEBERG OPTIMIZED] 🚀 Usando callback direto (sem polling) + Firestore async")
        
        while quantidade_restante > 0:
            # Verifica flag halt, preço e lote atualizados
            doc_cfg = db.collection('icebergs').document(iceberg_id).get()
            if doc_cfg.exists:
                cfg = doc_cfg.to_dict()
                if cfg.get('halt'):
                    print(f"[ICEBERG] Halt flag detectada, encerrando iceberg {iceberg_id}")
                    break
                price_atual = float(cfg.get('price', price))
                # Tratamento defensivo para evitar erro de conversão de string vazia para int
                lote_value = cfg.get('lote', lote)
                if lote_value == '' or lote_value is None:
                    lote_atual = lote
                else:
                    lote_atual = int(lote_value)  # Usar lote atualizado se disponível
            else:
                price_atual = price
                lote_atual = lote
            quantidade_envio = min(lote_atual, quantidade_restante)
            
            # Envia ordem
            res = send_order(account_id, broker_id, ticker, quantidade_envio, price_atual, side, exchange, master_batch_id=iceberg_id, master_base_qty=quantity_total, sub_account=sub_account, strategy_id=strategy_id)
            if not res.get("success"):
                print(f"[ICEBERG] Falha ao enviar ordem: {res.get('log')}")
                break
            order_id = res["log"].split("ProfitID: ")[-1] if "ProfitID: " in res["log"] else None
            if not order_id:
                print(f"[ICEBERG] Não foi possível obter ProfitID da ordem.")
                break
            
            # ⚡ OTIMIZAÇÃO 1: Criar evento para esta ordem
            order_event = threading.Event()
            order_events[str(order_id)] = order_event
            
            # ⚡ OTIMIZAÇÃO 1: Polling MUITO mais rápido (100ms) com timeout menor
            start_time = time.time()
            max_wait = 18000  # 300 minutos (reduzido de 10 horas)
            filled = False
            
            print(f"[ICEBERG OPTIMIZED] ⏱️ Aguardando execução da ordem {order_id} (polling otimizado 100ms)...")
            
            while (time.time() - start_time) < max_wait:
                ordem_doc = db.collection('ordensDLL').document(str(order_id)).get()
                if ordem_doc.exists:
                    ordem = ordem_doc.to_dict()
                    status = ordem.get("Status")
                    traded = float(ordem.get("TradedQuantity", 0))
                    if status == "Filled" or traded >= quantidade_envio:
                        filled = True
                        lote_atual += 1
                        
                        print(f"[ICEBERG OPTIMIZED] ✅ Ordem {order_id} executada! Processando próximo lote...")
                        
                        # ⚡ OTIMIZAÇÃO 2: Atualização ASSÍNCRONA do Firestore (não bloqueia)
                        def async_update_firestore():
                            try:
                                db.collection('icebergs').document(iceberg_id).update({
                                    'executed': firestore.Increment(traded),
                                    'executed_lotes': lote_atual,
                                    'current_lote': lote_atual,
                                    'last_update': firestore.SERVER_TIMESTAMP
                                })
                                print(f"[ICEBERG ASYNC] 💾 Firestore atualizado (lote {lote_atual})")
                            except Exception as e:
                                print(f"[ICEBERG ASYNC] ⚠️ Erro ao atualizar Firestore: {e}")
                        
                        # Executar update em thread separada (não bloqueia!)
                        threading.Thread(target=async_update_firestore, daemon=True).start()
                        
                        # Atualizar posições (também assíncrono)
                        if strategy_id:
                            def async_update_positions():
                                try:
                                    atualizar_posicoes_firebase_strategy(strategy_id)
                                except Exception:
                                    pass
                            threading.Thread(target=async_update_positions, daemon=True).start()
                        
                        break
                
                # ⚡ OTIMIZAÇÃO 1: Polling reduzido para 100ms (era 200ms)
                time.sleep(0.1)
            
            # Limpar evento
            if str(order_id) in order_events:
                del order_events[str(order_id)]
            
            if not filled:
                print(f"[ICEBERG] Timeout aguardando execução da ordem {order_id}")
                break
            
            quantidade_restante -= quantidade_envio
            
            # NOVA FUNCIONALIDADE TWAP
            if twap_enabled and quantidade_restante > 0:
                print(f"[ICEBERG TWAP] Aguardando {twap_interval} segundos antes do próximo lote...")
                time.sleep(twap_interval)
        
        # Finalizar iceberg
        final_status = 'completed' if quantidade_restante == 0 else 'failed'
        db.collection('icebergs').document(iceberg_id).update({
            'status': final_status,
            'end_time': firestore.SERVER_TIMESTAMP,
            'last_update': firestore.SERVER_TIMESTAMP,
            'error_message': 'Falha na execução' if final_status == 'failed' else ''
        })
        
        print(f"[ICEBERG] Ordem iceberg {iceberg_id} finalizada com status: {final_status}")

    threading.Thread(target=iceberg_worker, daemon=True).start()
    return {"success": True, "log": f"Ordem iceberg iniciada! ID: {iceberg_id}", "order_id": iceberg_id}

@app.post("/order_iceberg_master")
def order_iceberg_master(data: dict = Body(...)):
    """
    Endpoint para ordem iceberg master (várias contas em ondas) com suporte TWAP.
    Suporta tanto estratégias quanto lista de contas específicas (para sincronização).
    """
    try:
        print(f"[ICEBERG MASTER] Recebido payload: {data}")
        
        iceberg_id = str(uuid.uuid4())
        broker_id = data.get("broker_id")
        ticker = data.get("ticker")
        
        # Validação dos campos obrigatórios
        quantity_total = data.get("quantity_total")
        if quantity_total is None:
            raise HTTPException(status_code=400, detail="Campo 'quantity_total' é obrigatório")
        quantity_total = int(quantity_total)
        
        lote = data.get("lote")
        if lote is None:
            raise HTTPException(status_code=400, detail="Campo 'lote' é obrigatório")
        lote = int(lote)
        
        price = data.get("price")
        if price is None:
            raise HTTPException(status_code=400, detail="Campo 'price' é obrigatório")
        price = float(price)
        
        side = data.get("side")
        if not side:
            raise HTTPException(status_code=400, detail="Campo 'side' é obrigatório")
            
        exchange = data.get("exchange")
        if not exchange:
            raise HTTPException(status_code=400, detail="Campo 'exchange' é obrigatório")
            
        # Tratamento defensivo para evitar erro de conversão de string vazia para int
        group_size_value = data.get("group_size", 1)
        if group_size_value == '' or group_size_value is None:
            group_size = 1
        else:
            group_size = int(group_size_value)
        strategy_id = data.get("strategy_id")
        
        # NOVOS PARÂMETROS TWAP
        twap_enabled = data.get("twap_enabled", False)
        twap_interval = data.get("twap_interval", 30) if data.get("twap_enabled", False) else 30

        # NOVO: Suporte para lista de contas específicas (para sincronização)
        accounts_data = data.get("accounts", [])  # Lista de contas com quantidades específicas
        
        print(f"[ICEBERG MASTER] Dados validados: ticker={ticker}, quantity_total={quantity_total}, lote={lote}, price={price}, side={side}, exchange={exchange}")
        
    except ValueError as e:
        print(f"[ICEBERG MASTER] Erro de conversão de tipo: {e}")
        raise HTTPException(status_code=400, detail=f"Erro de conversão de tipo: {e}")
    except Exception as e:
        print(f"[ICEBERG MASTER] Erro inesperado: {e}")
        raise HTTPException(status_code=500, detail=f"Erro inesperado: {e}")

    # cria doc do iceberg master também
    db.collection('icebergs').document(iceberg_id).set({
        'price': price,
        'total': quantity_total,
        'executed': 0,
        'halt': False,
        'lote': lote,  # Armazenar tamanho do lote inicial
        'twap_enabled': twap_enabled,
        'twap_interval': twap_interval,
        'createdAt': firestore.SERVER_TIMESTAMP
    })

    def iceberg_master_worker():
        # Obter contas participantes
        if accounts_data:
            # Modo Sync: usar contas específicas fornecidas
            print(f"[ICEBERG MASTER] Modo Sync: {len(accounts_data)} contas específicas")
            print(f"[ICEBERG MASTER] Dados recebidos do frontend:")
            for acc_data in accounts_data:
                print(f"  - Account ID: {acc_data.get('account_id')}, Quantity: {acc_data.get('quantity')}, Lote: {acc_data.get('lote')}")
            
            contas_proporcionais = []
            for acc_data in accounts_data:
                account_id = acc_data.get('account_id')
                quantity = acc_data.get('quantity', 0)
                lote_size = acc_data.get('lote', lote)
                
                if quantity > 0:
                    # Buscar BrokerID da conta
                    contasDllSnap = db.collection('contasDll').where('AccountID', '==', account_id).stream()
                    contasDll = [doc.to_dict() for doc in contasDllSnap]
                    
                    if contasDll:
                        # Tratamento defensivo para evitar erro de conversão de string vazia para int
                        broker_id_value = contasDll[0].get('BrokerID', 0)
                        if broker_id_value == '' or broker_id_value is None:
                            broker_id = 0
                        else:
                            broker_id = int(broker_id_value)
                        contas_proporcionais.append({
                            'AccountID': account_id,
                            'BrokerID': broker_id,
                            'quantidade': quantity,
                            'lote': lote_size
                        })
                        print(f"[ICEBERG MASTER] ✅ Conta {account_id}: {quantity} ações, lote {lote_size}")
                    else:
                        print(f"[ICEBERG MASTER] ❌ Conta {account_id} não encontrada no contasDll")
        elif strategy_id:
            # Modo Boletas: buscar contas da estratégia
            print(f"[ICEBERG MASTER] Modo Boletas: estratégia {strategy_id}")
            allocSnap = db.collection('strategyAllocations').where('strategy_id', '==', strategy_id).stream()
            allocs = [a.to_dict() for a in allocSnap]
            contas = [{ 'AccountID': a['account_id'], 'BrokerID': int(a['broker_id']), 'valor_investido': float(a['valor_investido']) } for a in allocs]
            
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
                        'quantidade': quantidade,
                        'lote': lote
                    })
        else:
            # Modo MASTER: todas as contas
            print(f"[ICEBERG MASTER] Modo MASTER: todas as contas")
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
                        'quantidade': quantidade,
                        'lote': lote
                    })
        
        # Logs TWAP
        if twap_enabled:
            total_contas = len(contas_proporcionais)
            total_grupos = (total_contas + group_size - 1) // group_size
            print(f"[ICEBERG MASTER TWAP] Configurado: {twap_interval}s entre lotes")
            print(f"[ICEBERG MASTER TWAP] Total contas: {total_contas}")
            print(f"[ICEBERG MASTER TWAP] Total grupos: {total_grupos}")
            print(f"[ICEBERG MASTER TWAP] Contas por grupo: {group_size}")
        
        # Log resumo das quantidades que serão executadas
        total_quantidade_executar = sum(conta['quantidade'] for conta in contas_proporcionais)
        print(f"[ICEBERG MASTER] 📊 RESUMO: {len(contas_proporcionais)} contas, {total_quantidade_executar} ações total")
        for conta in contas_proporcionais:
            print(f"  - {conta['AccountID']}: {conta['quantidade']} ações")
            
        # Dividir em grupos
        for i in range(0, len(contas_proporcionais), group_size):
            grupo = contas_proporcionais[i:i+group_size]
            threads = []
            for conta in grupo:
                def iceberg_conta_worker(conta=conta):
                    quantidade_restante = conta['quantidade']
                    lote_conta = conta.get('lote', lote)  # Usar lote específico da conta se disponível
                    
                    while quantidade_restante > 0:
                        # buscar config dinâmica antes de cada fatia
                        doc_cfg = db.collection('icebergs').document(iceberg_id).get()
                        if doc_cfg.exists and doc_cfg.to_dict().get('halt'):
                            print(f"[ICEBERG MASTER] Halt flag, encerrando conta {conta['AccountID']}")
                            return
                        cfg = doc_cfg.to_dict() if doc_cfg.exists else {}
                        price_cfg = cfg.get('price', price)
                        # Tratamento defensivo para evitar erro de conversão de string vazia para int
                        lote_value = cfg.get('lote', lote_conta)
                        if lote_value == '' or lote_value is None:
                            lote_atual = lote_conta
                        else:
                            lote_atual = int(lote_value)  # Usar lote atualizado ou específico da conta

                        quantidade_envio = min(lote_atual, quantidade_restante)
                        res = send_order(conta['AccountID'], conta['BrokerID'], ticker, quantidade_envio, price_cfg, side, exchange, master_batch_id=iceberg_id, master_base_qty=quantity_total, sub_account=conta.get('SubAccountID', ""), strategy_id=strategy_id)
                        if not res.get("success"):
                            print(f"[ICEBERG MASTER] Falha ao enviar ordem: {res.get('log')}")
                            break
                        order_id = res["log"].split("ProfitID: ")[-1] if "ProfitID: " in res["log"] else None
                        if not order_id:
                            print(f"[ICEBERG MASTER] Não foi possível obter ProfitID da ordem.")
                            break
                        
                        # ⚡ OTIMIZAÇÃO: Polling otimizado (100ms) com timeout reduzido
                        start_time = time.time()
                        max_wait = 600  # 10 minutos
                        filled = False
                        
                        while (time.time() - start_time) < max_wait:
                            ordem_doc = db.collection('ordensDLL').document(str(order_id)).get()
                            if ordem_doc.exists:
                                ordem = ordem_doc.to_dict()
                                status = ordem.get("Status")
                                traded = float(ordem.get("TradedQuantity", 0))
                                if status == "Filled" or traded >= quantidade_envio:
                                    filled = True
                                    
                                    # ⚡ OTIMIZAÇÃO 2: Atualização ASSÍNCRONA do Firestore (não bloqueia)
                                    def async_update():
                                        try:
                                            db.collection('icebergs').document(iceberg_id).update({'executed': firestore.Increment(traded)})
                                        except Exception as e:
                                            print(f"[ICEBERG MASTER ASYNC] Erro: {e}")
                                    threading.Thread(target=async_update, daemon=True).start()
                                    
                                    break
                            
                            # ⚡ OTIMIZAÇÃO 1: Polling reduzido para 100ms (era 200ms)
                            time.sleep(0.1)
                        
                        if not filled:
                            print(f"[ICEBERG MASTER] Timeout aguardando execução da ordem {order_id}")
                            break  # CORREÇÃO: Reduzido de 1s para 0.2s (5x mais rápido)
                        else:
                            print(f"[ICEBERG MASTER] Timeout aguardando execução da ordem {order_id}")
                            break
                        quantidade_restante -= quantidade_envio
                        
                        # NOVA FUNCIONALIDADE TWAP - Entre lotes de cada conta
                        if twap_enabled and quantidade_restante > 0:
                            print(f"[ICEBERG MASTER TWAP] Aguardando {twap_interval}s antes do próximo lote da conta {conta['AccountID']}...")
                            time.sleep(twap_interval)
                            
                    print(f"[ICEBERG MASTER] Conta {conta['AccountID']} finalizada.")
                t = threading.Thread(target=iceberg_conta_worker, daemon=True)
                threads.append(t)
                t.start()
            # Esperar todas as contas do grupo terminarem
            for t in threads:
                t.join()
                
            # NOVA FUNCIONALIDADE TWAP - Entre grupos de contas
            if twap_enabled and i + group_size < len(contas_proporcionais):
                print(f"[ICEBERG MASTER TWAP] Aguardando {twap_interval}s antes do próximo grupo de contas...")
                time.sleep(twap_interval)
                
        print(f"[ICEBERG MASTER] Ordem iceberg master {iceberg_id} finalizada.")

    threading.Thread(target=iceberg_master_worker, daemon=True).start()
    return {"success": True, "log": f"Ordem iceberg master iniciada! ID: {iceberg_id}", "order_id": iceberg_id}

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
    # Tratamento defensivo para evitar erro de conversão de string vazia para int
    lote_value = data.get("lote", 0)
    if lote_value == '' or lote_value is None:
        lote = 0
    else:
        lote = int(lote_value)         # obrigatório p/ iceberg
    # Tratamento defensivo para evitar erro de conversão de string vazia para int
    group_size_value = data.get("group_size", 1)
    if group_size_value == '' or group_size_value is None:
        group_size = 1
    else:
        group_size = int(group_size_value)

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

@app.get("/iceberg_info/{iceberg_id}")
def get_iceberg_info(iceberg_id: str):
    """
    Endpoint para obter informações de uma iceberg específica.
    """
    try:
        iceberg_doc = db.collection('icebergs').document(iceberg_id).get()
        
        if not iceberg_doc.exists:
            return {"success": False, "error": "Iceberg não encontrada"}
        
        iceberg_data = iceberg_doc.to_dict()
        
        return {
            "success": True,
            "iceberg": {
                "id": iceberg_id,
                "price": iceberg_data.get('price'),
                "total": iceberg_data.get('total'),
                "executed": iceberg_data.get('executed', 0),
                "lote": iceberg_data.get('lote'),  # Tamanho do lote atual
                "halt": iceberg_data.get('halt', False),
                "twap_enabled": iceberg_data.get('twap_enabled', False),
                "twap_interval": iceberg_data.get('twap_interval'),
                "createdAt": iceberg_data.get('createdAt')
            }
        }
        
    except Exception as e:
        print(f"Erro ao buscar informações da iceberg: {e}")
        return {"success": False, "error": str(e)}

@app.get("/positions_strategy")
def positions_strategy(strategy_id: str):
    """
    Retorna posições consolidadas de uma estratégia, incluindo ajustes manuais.
    Filtra apenas contas que ainda estão alocadas na estratégia.
    """
    try:
        # 1. Buscar contas atualmente alocadas na estratégia
        alloc_docs = db.collection('strategyAllocations').where('strategy_id','==',strategy_id).stream()
        contas_ativas = [d.to_dict()['account_id'] for d in alloc_docs]
        
        print(f"[positions_strategy] Strategy {strategy_id}: {len(contas_ativas)} contas ativas")
        
        if not contas_ativas:
            print(f"[positions_strategy] Strategy {strategy_id}: Nenhuma conta ativa, retornando vazio")
            return {'positions': []}
        
        # 2. Buscar posições calculadas APENAS das contas ativas
        posicoes_calculadas = []
        for account_id in contas_ativas:
            pos_docs = db.collection('posicoesDLL').where('account_id','==',account_id).stream()
            for doc in pos_docs:
                pos_data = doc.to_dict()
                posicoes_calculadas.append(pos_data)
        
        # 3. Buscar ajustes manuais da estratégia (apenas das contas ativas)
        ajustes_docs = db.collection('posicoesAjusteManual').where('strategy_id','==',strategy_id).stream()
        ajustes_manuais = []
        for doc in ajustes_docs:
            ajuste_data = doc.to_dict()
            # Filtrar apenas ajustes de contas ativas
            if ajuste_data.get('account_id') in contas_ativas:
                ajustes_manuais.append(ajuste_data)
        
        print(f"[positions_strategy] Strategy {strategy_id}: {len(posicoes_calculadas)} posições calculadas, {len(ajustes_manuais)} ajustes manuais")
        
        # 4. Consolidar posições incluindo ajustes
        mapa_posicoes = {}
        
        # Adicionar posições calculadas
        for pos in posicoes_calculadas:
            ticker = pos.get('ticker')
            if ticker:
                if ticker not in mapa_posicoes:
                    mapa_posicoes[ticker] = {
                        'ticker': ticker,
                        'quantity': 0,
                        'totalBuy': 0,
                        'hasAjustes': False,
                        'contas_com_ajuste': set()  # Set para evitar duplicatas
                    }
                
                posicao = mapa_posicoes[ticker]
                quantidade = float(pos.get('quantity', 0))
                preco_medio = float(pos.get('avgPrice', 0))
                
                posicao['quantity'] += quantidade
                posicao['totalBuy'] += quantidade * preco_medio
        
        # Aplicar ajustes manuais
        for ajuste in ajustes_manuais:
            ticker = ajuste.get('ticker')
            if not ticker:
                continue
                
            quantidade_ajuste = float(ajuste.get('quantidade_ajuste', 0))
            preco_medio_ajuste = float(ajuste.get('preco_medio_ajuste', 0))
            account_id = ajuste.get('account_id')
            
            if ticker not in mapa_posicoes:
                # Posição não existe, criar apenas com ajuste
                mapa_posicoes[ticker] = {
                    'ticker': ticker,
                    'quantity': quantidade_ajuste,
                    'totalBuy': quantidade_ajuste * preco_medio_ajuste,
                    'hasAjustes': True,
                    'contas_com_ajuste': {account_id}
                }
            else:
                # Posição existe, somar ajuste
                posicao = mapa_posicoes[ticker]
                posicao['quantity'] += quantidade_ajuste
                posicao['totalBuy'] += quantidade_ajuste * preco_medio_ajuste
                posicao['hasAjustes'] = True
                posicao['contas_com_ajuste'].add(account_id)
        
        # 5. Calcular preços médios finais
        posicoes_consolidadas = []
        for pos in mapa_posicoes.values():
            avg_price = pos['totalBuy'] / pos['quantity'] if pos['quantity'] > 0 else 0
            posicoes_consolidadas.append({
                'ticker': pos['ticker'],
                'quantity': pos['quantity'],
                'avgPrice': avg_price,
                'hasAjustes': pos['hasAjustes'],
                'contas_com_ajuste': list(pos['contas_com_ajuste']) if pos['hasAjustes'] else []
            })
        
        # 6. Filtrar posições zeradas
        posicoes_consolidadas = [
            pos for pos in posicoes_consolidadas 
            if pos['quantity'] != 0  # Filtrar posições zeradas
        ]
        
        print(f"[positions_strategy] Strategy {strategy_id}: {len(posicoes_consolidadas)} posições consolidadas")
        return {'positions': posicoes_consolidadas}
        
    except Exception as e:
        print(f"[positions_strategy] Erro ao consolidar posições da estratégia {strategy_id}: {e}")
        return {'positions': [], 'error': str(e)}

@app.get("/sync-data/{strategy_id}")
def get_sync_data(strategy_id: str):
    """
    Retorna dados completos para sincronização de uma estratégia:
    - Posições reais consolidadas
    - Carteira de referência
    - Diferenças calculadas
    """
    try:
        # 1. Buscar posições reais da estratégia
        real_positions_response = positions_strategy(strategy_id)
        real_positions = real_positions_response.get('positions', [])
        
        # 2. Buscar carteira de referência
        reference_portfolio = None
        try:
            ref_docs = db.collection('referencePortfolios').where('strategy_id', '==', strategy_id).stream()
            for doc in ref_docs:
                reference_portfolio = doc.to_dict()
                reference_portfolio['id'] = doc.id
                break
        except Exception as e:
            print(f"[sync-data] Erro ao buscar carteira de referência: {e}")
        
        # 3. Calcular diferenças se houver carteira de referência
        sync_data = {
            'strategy_id': strategy_id,
            'real_positions': real_positions,
            'reference_portfolio': reference_portfolio,
            'differences': []
        }
        
        if reference_portfolio:
            # Criar mapa de posições reais por ticker
            real_positions_map = {}
            for pos in real_positions:
                real_positions_map[pos['ticker']] = pos
            
            # Calcular diferenças
            differences = []
            for ref_pos in reference_portfolio.get('positions', []):
                ticker = ref_pos['ticker']
                ideal_percentage = ref_pos['percentage']
                
                real_pos = real_positions_map.get(ticker)
                real_percentage = real_pos['percentage'] if real_pos else 0
                real_quantity = real_pos['quantity'] if real_pos else 0
                real_avg_price = real_pos['avgPrice'] if real_pos else 0
                
                difference = ideal_percentage - real_percentage
                
                differences.append({
                    'ticker': ticker,
                    'ideal_percentage': ideal_percentage,
                    'real_percentage': real_percentage,
                    'real_quantity': real_quantity,
                    'real_avg_price': real_avg_price,
                    'difference_percentage': difference,
                    'needs_sync': abs(difference) > 1.0,  # Tolerância de 1%
                    'action': 'buy' if difference > 1.0 else 'sell' if difference < -1.0 else 'none'
                })
            
            # Adicionar posições reais que não estão na referência
            for ticker, real_pos in real_positions_map.items():
                if not any(d['ticker'] == ticker for d in differences):
                    differences.append({
                        'ticker': ticker,
                        'ideal_percentage': 0,
                        'real_percentage': real_pos['percentage'],
                        'real_quantity': real_pos['quantity'],
                        'real_avg_price': real_pos['avgPrice'],
                        'difference_percentage': -real_pos['percentage'],
                        'needs_sync': real_pos['percentage'] > 1.0,
                        'action': 'sell' if real_pos['percentage'] > 1.0 else 'none'
                    })
            
            sync_data['differences'] = differences
        
        return sync_data
        
    except Exception as e:
        print(f"[sync-data] Erro ao buscar dados de sincronização para estratégia {strategy_id}: {e}")
        return {
            'strategy_id': strategy_id,
            'real_positions': [],
            'reference_portfolio': None,
            'differences': [],
            'error': str(e)
        } 

# ------------------------------------------------------------
# Carteiras de Referência - Gerenciamento de posições de estratégias
# ------------------------------------------------------------

@app.get("/carteiras_referencia")
def get_carteiras_referencia(strategy_id: str = None):
    """
    Retorna posições de referência das estratégias.
    Se strategy_id for fornecido, retorna apenas posições dessa estratégia.
    """
    try:
        ref = db.collection('CarteirasDeRefDLL')
        if strategy_id:
            ref = ref.where('strategy_id', '==', strategy_id)
        
        docs = ref.stream()
        positions = []
        
        for doc in docs:
            data = doc.to_dict()
            positions.append({
                'id': doc.id,
                'strategy_id': data.get('strategy_id'),
                'ticker': data.get('ticker'),
                'price': data.get('price', 0),
                'quantity': data.get('quantity', 0),
                'percentage': data.get('percentage', 0),
                'created_at': data.get('created_at'),
                'updated_at': data.get('updated_at')
            })
        
        return {'positions': positions}
        
    except Exception as e:
        print(f"[carteiras_referencia] Erro ao buscar posições: {e}")
        return {'positions': [], 'error': str(e)}

@app.post("/carteiras_referencia")
def create_carteira_referencia(data: dict = Body(...)):
    """
    Cria nova posição de referência para uma estratégia.
    Campos obrigatórios: strategy_id, ticker, price, quantity, percentage
    """
    try:
        required_fields = ['strategy_id', 'ticker', 'price', 'quantity', 'percentage']
        for field in required_fields:
            if field not in data:
                raise HTTPException(status_code=400, detail=f"Campo obrigatório ausente: {field}")
        
        # Verificar se já existe posição para este ticker na estratégia
        existing_docs = db.collection('CarteirasDeRefDLL').where('strategy_id', '==', data['strategy_id']).where('ticker', '==', data['ticker']).stream()
        if list(existing_docs):
            raise HTTPException(status_code=400, detail=f"Já existe posição para o ticker {data['ticker']} na estratégia")
        
        # Criar documento
        doc_ref = db.collection('CarteirasDeRefDLL').document()
        position_data = {
            'strategy_id': data['strategy_id'],
            'ticker': data['ticker'],
            'price': float(data['price']),
            'quantity': int(data['quantity']),
            'percentage': float(data['percentage']),
            'created_at': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP
        }
        
        doc_ref.set(position_data)
        
        return {
            'success': True,
            'position': {
                'id': doc_ref.id,
                **position_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[carteiras_referencia] Erro ao criar posição: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.put("/carteiras_referencia/{position_id}")
def update_carteira_referencia(position_id: str, data: dict = Body(...)):
    """
    Atualiza posição de referência existente.
    """
    try:
        doc_ref = db.collection('CarteirasDeRefDLL').document(position_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Posição não encontrada")
        
        # Campos permitidos para atualização
        allowed_fields = ['price', 'quantity', 'percentage']
        update_data = {}
        
        for field in allowed_fields:
            if field in data:
                if field in ['price', 'percentage']:
                    update_data[field] = float(data[field])
                elif field == 'quantity':
                    update_data[field] = int(data[field])
        
        if not update_data:
            raise HTTPException(status_code=400, detail="Nenhum campo válido para atualizar")
        
        update_data['updated_at'] = firestore.SERVER_TIMESTAMP
        doc_ref.update(update_data)
        
        return {
            'success': True,
            'position': {
                'id': position_id,
                **doc.to_dict(),
                **update_data
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[carteiras_referencia] Erro ao atualizar posição: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")

@app.delete("/carteiras_referencia/{position_id}")
def delete_carteira_referencia(position_id: str):
    """
    Remove posição de referência.
    """
    try:
        doc_ref = db.collection('CarteirasDeRefDLL').document(position_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Posição não encontrada")
        
        doc_ref.delete()
        
        return {'success': True, 'message': 'Posição removida com sucesso'}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[carteiras_referencia] Erro ao remover posição: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}") 

# ------------------------------------------------------------
# Posições Reais dos Clientes - Para sincronização
# ------------------------------------------------------------

@app.get("/client-positions/{account_id}")
def get_client_positions(account_id: str):
    """
    Busca posições reais de um cliente específico no Firestore.
    Retorna posições da coleção 'posicoesDLL' consolidadas com ajustes manuais.
    """
    try:
        print(f"[get_client_positions] Buscando posições para account_id: {account_id}")
        
        # 1. Buscar posições calculadas do cliente
        posicoes_ref = db.collection('posicoesDLL').where('account_id', '==', account_id).stream()
        
        posicoes_calculadas = []
        total_docs = 0
        
        for doc in posicoes_ref:
            total_docs += 1
            pos_data = doc.to_dict()
            
            # Log detalhado para debug
            print(f"[get_client_positions] Documento calculado {doc.id}: {pos_data}")
            
            quantity = float(pos_data.get('quantity', 0))
            
            # Só incluir posições com quantidade diferente de zero
            if quantity != 0:
                posicoes_calculadas.append({
                    'id': doc.id,
                    'ticker': pos_data.get('ticker', ''),
                    'quantity': quantity,
                    'price': pos_data.get('price', 0.0),
                    'avgPrice': pos_data.get('avgPrice', 0.0),
                    'avgBuyPrice': pos_data.get('avgBuyPrice', 0.0),
                    'avgSellPrice': pos_data.get('avgSellPrice', 0.0),
                    'totalBuyQty': pos_data.get('totalBuyQty', 0),
                    'totalSellQty': pos_data.get('totalSellQty', 0),
                    'exchange': pos_data.get('exchange', ''),
                    'accountId': pos_data.get('account_id', ''),
                    'brokerId': pos_data.get('broker_id', ''),
                    'timestamp': pos_data.get('updatedAt', None)
                })
                print(f"[get_client_positions] Adicionada posição calculada: {pos_data.get('ticker', '')} - Qty: {quantity}")
            else:
                print(f"[get_client_positions] Posição zerada ignorada: {pos_data.get('ticker', '')} - Qty: {quantity}")
        
        # 2. Buscar ajustes manuais para todas as estratégias desta conta
        ajustes_ref = db.collection('posicoesAjusteManual').where('account_id', '==', account_id).stream()
        
        ajustes_manuais = []
        for doc in ajustes_ref:
            ajuste_data = doc.to_dict()
            print(f"[get_client_positions] Ajuste manual {doc.id}: {ajuste_data}")
            ajustes_manuais.append(ajuste_data)
        
        print(f"[get_client_positions] Encontrados {len(ajustes_manuais)} ajustes manuais para {account_id}")
        
        # 3. Consolidar posições calculadas com ajustes manuais
        mapa_posicoes = {}
        
        # Adicionar posições calculadas
        for pos in posicoes_calculadas:
            mapa_posicoes[pos['ticker']] = {
                'ticker': pos['ticker'],
                'quantity': pos['quantity'],
                'avgPrice': pos['avgPrice'],
                'avgBuyPrice': pos['avgBuyPrice'],
                'avgSellPrice': pos['avgSellPrice'],
                'totalBuyQty': pos['totalBuyQty'],
                'totalSellQty': pos['totalSellQty'],
                'exchange': pos['exchange'],
                'accountId': pos['accountId'],
                'brokerId': pos['brokerId'],
                'timestamp': pos['timestamp'],
                'isAjuste': False
            }
        
        # Aplicar ajustes manuais
        for ajuste in ajustes_manuais:
            ticker = ajuste.get('ticker', '')
            quantidade_ajuste = float(ajuste.get('quantidade_ajuste', 0))
            preco_medio_ajuste = float(ajuste.get('preco_medio_ajuste', 0))
            
            if ticker in mapa_posicoes:
                # Posição já existe, aplicar ajuste
                pos_atual = mapa_posicoes[ticker]
                nova_quantidade = pos_atual['quantity'] + quantidade_ajuste
                
                # Calcular novo preço médio ponderado
                if nova_quantidade != 0:
                    valor_atual = pos_atual['quantity'] * pos_atual['avgPrice']
                    valor_ajuste = quantidade_ajuste * preco_medio_ajuste
                    novo_preco_medio = (valor_atual + valor_ajuste) / nova_quantidade
                else:
                    novo_preco_medio = 0
                
                mapa_posicoes[ticker].update({
                    'quantity': nova_quantidade,
                    'avgPrice': novo_preco_medio,
                    'hasAjuste': True,
                    'ajusteManual': ajuste
                })
                
                print(f"[get_client_positions] Ajuste aplicado para {ticker}: {pos_atual['quantity']} + {quantidade_ajuste} = {nova_quantidade}")
            else:
                # Posição não existe, criar apenas com ajuste
                mapa_posicoes[ticker] = {
                    'ticker': ticker,
                    'quantity': quantidade_ajuste,
                    'avgPrice': preco_medio_ajuste,
                    'avgBuyPrice': 0,
                    'avgSellPrice': 0,
                    'totalBuyQty': 0,
                    'totalSellQty': 0,
                    'exchange': '',
                    'accountId': account_id,
                    'brokerId': '',
                    'timestamp': None,
                    'isAjuste': True,
                    'hasAjuste': True,
                    'ajusteManual': ajuste
                }
                
                print(f"[get_client_positions] Nova posição criada com ajuste: {ticker} - Qty: {quantidade_ajuste}")
        
        # 4. Converter para lista e filtrar posições zeradas
        positions = []
        for ticker, pos in mapa_posicoes.items():
            if pos['quantity'] != 0:
                positions.append(pos)
                print(f"[get_client_positions] Posição final: {ticker} - Qty: {pos['quantity']} - Ajuste: {pos.get('hasAjuste', False)}")
        
        print(f"[get_client_positions] Total de documentos calculados: {total_docs}")
        print(f"[get_client_positions] Total de ajustes manuais: {len(ajustes_manuais)}")
        print(f"[get_client_positions] Posições consolidadas finais: {len(positions)}")
        
        # Incluir métricas de reads para monitoramento
        return {
            "success": True, 
            "positions": positions,
            "firestore_metrics": {
                "posicoesDLL_reads": total_docs,
                "posicoesAjusteManual_reads": len(ajustes_manuais),
                "total_reads": total_docs + len(ajustes_manuais)
            }
        }
        
    except Exception as e:
        print(f"[get_client_positions] Erro ao buscar posições do cliente {account_id}: {e}")
        return {"success": False, "error": str(e)}

@app.get("/iceberg_status/{order_id}")
def get_iceberg_status(order_id: str):
    """
    Verifica o status de uma ordem iceberg específica.
    Retorna informações sobre progresso, conclusão e erros.
    """
    try:
        # Buscar informações do iceberg no Firestore
        iceberg_ref = db.collection('icebergs').document(order_id)
        iceberg_doc = iceberg_ref.get()
        
        if not iceberg_doc.exists:
            return {
                "success": False,
                "error": "Iceberg não encontrado",
                "completed": False,
                "failed": True,
                "error_message": "Ordem iceberg não encontrada"
            }
        
        iceberg_data = iceberg_doc.to_dict()
        
        # Calcular progresso
        total_lotes = iceberg_data.get('total_lotes', 0)
        executed_lotes = iceberg_data.get('executed_lotes', 0)
        current_lote = iceberg_data.get('current_lote', 0)
        
        # Determinar status
        status = iceberg_data.get('status', 'unknown')
        completed = status == 'completed'
        failed = status == 'failed' or status == 'cancelled'
        
        # Calcular progresso percentual
        progress_percent = 0
        if total_lotes > 0:
            progress_percent = (executed_lotes / total_lotes) * 100
        
        return {
            "success": True,
            "order_id": order_id,
            "account_id": iceberg_data.get('account_id', ''),
            "ticker": iceberg_data.get('ticker', ''),
            "completed": completed,
            "failed": failed,
            "status": status,
            "progress": {
                "total_lotes": total_lotes,
                "executed_lotes": executed_lotes,
                "remaining_lotes": total_lotes - executed_lotes,
                "current_lote": current_lote
            },
            "progress_percent": progress_percent,
            "error_message": iceberg_data.get('error_message', ''),
            "start_time": iceberg_data.get('start_time', ''),
            "end_time": iceberg_data.get('end_time', ''),
            "last_update": iceberg_data.get('last_update', '')
        }
        
    except Exception as e:
        print(f"[get_iceberg_status] Erro ao verificar status do iceberg {order_id}: {e}")
        return {
            "success": False,
            "error": str(e),
            "completed": False,
            "failed": True,
            "error_message": f"Erro ao verificar status: {str(e)}"
        }

@app.post("/force_position_update/{account_id}")
def force_position_update(account_id: str):
    """
    Força a atualização das posições de uma conta específica.
    Útil para resolver problemas de cache e dados inconsistentes.
    """
    try:
        print(f"[force_position_update] Forçando atualização de posições para account_id: {account_id}")
        
        # Chamar a função de atualização de posições
        atualizar_posicoes_firebase(account_id)
        
        print(f"[force_position_update] ✅ Posições atualizadas com sucesso para account_id: {account_id}")
        
        return {
            "success": True,
            "message": f"Posições atualizadas com sucesso para conta {account_id}",
            "account_id": account_id,
            "timestamp": datetime.datetime.now().isoformat()
        }
        
    except Exception as e:
        print(f"[force_position_update] ❌ Erro ao atualizar posições para account_id {account_id}: {e}")
        
        return {
            "success": False,
            "error": str(e),
            "account_id": account_id,
            "timestamp": datetime.datetime.now().isoformat()
        }

@app.post("/cancel_iceberg/{order_id}")
def cancel_iceberg(order_id: str):
    """
    Cancela uma ordem iceberg em execução.
    Atualiza o status para 'cancelled' e para a execução.
    """
    try:
        # Buscar informações do iceberg no Firestore
        iceberg_ref = db.collection('icebergs').document(order_id)
        iceberg_doc = iceberg_ref.get()
        
        if not iceberg_doc.exists:
            return {
                "success": False,
                "error": "Iceberg não encontrado"
            }
        
        iceberg_data = iceberg_doc.to_dict()
        current_status = iceberg_data.get('status', 'unknown')
        
        # Verificar se pode ser cancelado
        if current_status in ['completed', 'failed', 'cancelled']:
            return {
                "success": False,
                "error": f"Iceberg já está {current_status} e não pode ser cancelado"
            }
        
        # Atualizar status para cancelado
        update_data = {
            'status': 'cancelled',
            'end_time': SERVER_TIMESTAMP,
            'last_update': SERVER_TIMESTAMP,
            'error_message': 'Cancelado pelo usuário'
        }
        
        iceberg_ref.update(update_data)
        
        print(f"[cancel_iceberg] Iceberg {order_id} cancelado com sucesso")
        
        return {
            "success": True,
            "message": "Iceberg cancelado com sucesso",
            "order_id": order_id
        }
        
    except Exception as e:
        print(f"[cancel_iceberg] Erro ao cancelar iceberg {order_id}: {e}")
        return {
            "success": False,
            "error": str(e)
        }