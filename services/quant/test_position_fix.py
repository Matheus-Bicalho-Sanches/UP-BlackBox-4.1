#!/usr/bin/env python3
"""
Teste da Correção: Detecção de Posições e Execuções
===================================================
Verifica se o Quant Engine agora detecta corretamente execuções de ordens
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os
from pathlib import Path

def init_firebase():
    """Inicializa Firebase Admin SDK"""
    try:
        # Verificar se já foi inicializado
        if firebase_admin._apps:
            return firestore.client()
            
        # Caminho para as credenciais
        cred_path = Path(__file__).parent.parent.parent / "UP BlackBox 4.0" / "secrets" / "up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json"
        
        if not cred_path.exists():
            print(f"❌ Arquivo de credenciais não encontrado: {cred_path}")
            return None
            
        cred = credentials.Certificate(str(cred_path))
        firebase_admin.initialize_app(cred)
        return firestore.client()
        
    except Exception as e:
        print(f"❌ Erro ao inicializar Firebase: {e}")
        return None

def check_strategy_positions(db):
    """Verifica posições de estratégias no Firebase"""
    
    print("🔍 VERIFICANDO POSIÇÕES DE ESTRATÉGIAS")
    print("=" * 50)
    
    try:
        positions_ref = db.collection('strategyPositions')
        docs = positions_ref.stream()
        
        positions = []
        for doc in docs:
            data = doc.to_dict()
            positions.append({
                'id': doc.id,
                'strategy_id': data.get('strategy_id'),
                'ticker': data.get('ticker'),
                'quantity': data.get('quantity', 0),
                'avgPrice': data.get('avgPrice', 0),
                'updatedAt': data.get('updatedAt')
            })
        
        if not positions:
            print("📊 Nenhuma posição encontrada em strategyPositions")
            return []
        
        print(f"📊 {len(positions)} posições encontradas:")
        for pos in positions:
            print(f"  • {pos['strategy_id']} | {pos['ticker']} | Qtd: {pos['quantity']} | Preço Médio: {pos['avgPrice']:.2f}")
        
        return positions
        
    except Exception as e:
        print(f"❌ Erro ao verificar posições: {e}")
        return []

def check_recent_orders(db, strategy_id="master-teste"):
    """Verifica ordens recentes para uma estratégia"""
    
    print()
    print("🔍 VERIFICANDO ORDENS RECENTES")
    print("=" * 50)
    
    try:
        # Buscar ordens da estratégia nos últimos documentos
        ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).limit(10)
        docs = ordens_ref.stream()
        
        orders = []
        for doc in docs:
            data = doc.to_dict()
            orders.append({
                'id': doc.id,
                'order_id': data.get('OrderID'),
                'ticker': data.get('ticker'),
                'side': data.get('side'),
                'quantity': data.get('quantity'),
                'price': data.get('price'),
                'status': data.get('Status'),
                'traded_qty': data.get('TradedQuantity', 0),
                'master_batch_id': data.get('master_batch_id'),
                'created': data.get('createdAt')
            })
        
        if not orders:
            print(f"📋 Nenhuma ordem encontrada para strategy_id: {strategy_id}")
            return []
        
        print(f"📋 {len(orders)} ordens encontradas:")
        for order in orders:
            traded = order['traded_qty']
            status = order['status'] or 'Pendente'
            
            if traded > 0:
                execution_status = f"✅ Executada ({traded})"
            elif status == 'Filled':
                execution_status = "✅ Filled"
            else:
                execution_status = f"⏳ {status}"
            
            print(f"  • {order['side'].upper()} {order['quantity']} {order['ticker']} @ {order['price']:.2f}")
            print(f"    ID: {order['order_id']} | Status: {execution_status}")
            if order['master_batch_id']:
                print(f"    Batch: {order['master_batch_id'][:8]}...")
        
        return orders
        
    except Exception as e:
        print(f"❌ Erro ao verificar ordens: {e}")
        return []

def simulate_position_lookup(db, strategy_id, ticker):
    """Simula a função get_strategy_position do Quant Engine"""
    
    print()
    print("🔍 SIMULANDO BUSCA DE POSIÇÃO (como Quant Engine faz)")
    print("=" * 60)
    
    try:
        position_doc_id = f"{strategy_id}_{ticker}"
        position_ref = db.collection('strategyPositions').document(position_doc_id)
        position_doc = position_ref.get()
        
        print(f"📊 Buscando posição: {position_doc_id}")
        
        if position_doc.exists:
            data = position_doc.to_dict()
            quantity = int(data.get('quantity', 0))
            avg_price = float(data.get('avgPrice', 0))
            
            print(f"✅ Posição encontrada:")
            print(f"  • Quantidade: {quantity}")
            print(f"  • Preço Médio: {avg_price:.2f}")
            print(f"  • Última Atualização: {data.get('updatedAt')}")
            
            return quantity
        else:
            print("📊 Nenhuma posição encontrada - retornando 0")
            return 0
            
    except Exception as e:
        print(f"❌ Erro ao buscar posição: {e}")
        return 0

def check_quant_strategy_active(db):
    """Verifica se há estratégias quant ativas"""
    
    print()
    print("🔍 VERIFICANDO ESTRATÉGIAS QUANT ATIVAS")
    print("=" * 50)
    
    try:
        strategies_ref = db.collection('quantStrategies').where('status', '==', True)
        docs = strategies_ref.stream()
        
        strategies = []
        for doc in docs:
            data = doc.to_dict()
            strategies.append({
                'id': doc.id,
                'nome': data.get('nome'),
                'carteira_blackbox': data.get('carteiraBlackBox'),
                'status': data.get('status')
            })
        
        if not strategies:
            print("⚠️ Nenhuma estratégia quant ativa encontrada")
            return []
        
        print(f"📈 {len(strategies)} estratégias ativas:")
        for strategy in strategies:
            print(f"  • {strategy['nome']} (ID: {strategy['id']})")
            print(f"    Carteira BlackBox: {strategy['carteira_blackbox']}")
        
        return strategies
        
    except Exception as e:
        print(f"❌ Erro ao verificar estratégias: {e}")
        return []

def main():
    """Função principal do teste"""
    
    print("🔬 DIAGNÓSTICO: CORREÇÃO DE DETECÇÃO DE POSIÇÕES")
    print("Objetivo: Verificar se o sistema detecta execuções e atualiza posições")
    print()
    
    # Inicializar Firebase
    db = init_firebase()
    if not db:
        print("❌ Não foi possível conectar ao Firebase")
        return
    
    print("✅ Conectado ao Firebase")
    print()
    
    # 1. Verificar estratégias ativas
    strategies = check_quant_strategy_active(db)
    
    # 2. Verificar posições atuais
    positions = check_strategy_positions(db)
    
    # 3. Verificar ordens recentes
    if strategies:
        # Usar primeira estratégia ativa ou buscar por master-teste
        strategy_id = strategies[0]['carteira_blackbox'] if strategies else "master-teste"
        orders = check_recent_orders(db, strategy_id)
        
        # 4. Simular busca de posição
        if positions:
            # Usar primeiro ticker encontrado
            ticker = positions[0]['ticker']
            quantity = simulate_position_lookup(db, strategy_id, ticker)
        else:
            # Usar WINQ25 padrão
            quantity = simulate_position_lookup(db, strategy_id, "WINQ25")
    
    print()
    print("=" * 60)
    print("📋 RESUMO DO DIAGNÓSTICO:")
    print()
    
    if strategies:
        print("✅ Estratégias quant ativas encontradas")
    else:
        print("⚠️ Nenhuma estratégia quant ativa")
    
    if positions:
        print("✅ Posições de estratégias encontradas no Firebase")
        print("✅ Quant Engine conseguirá ler posições atualizadas")
    else:
        print("📊 Nenhuma posição atual (normal se não houve execuções)")
    
    if 'orders' in locals() and orders:
        executed_orders = [o for o in orders if o['traded_qty'] > 0 or o['status'] == 'Filled']
        if executed_orders:
            print(f"✅ {len(executed_orders)} ordens executadas encontradas")
            print("✅ Sistema BlackBox está atualizando execuções no Firebase")
        else:
            print("⏳ Ordens enviadas mas ainda não executadas")
    
    print()
    print("🚀 PRÓXIMO PASSO:")
    print("1. Reinicie o Quant Engine")
    print("2. Monitore logs para verificar detecção de posições:")
    print("   📊 Posição: X (em vez de sempre 0)")
    print("   ✅ Master Batch executado completamente")

if __name__ == "__main__":
    main() 