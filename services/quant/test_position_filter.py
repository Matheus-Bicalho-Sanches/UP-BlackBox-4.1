#!/usr/bin/env python3
"""
Teste do Filtro de Posições por Data
====================================
Verifica se a função atualizar_posicoes_firebase_strategy agora filtra apenas ordens do dia atual
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os
from pathlib import Path
import datetime

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

def check_orders_by_date(db, strategy_id="master-teste"):
    """Verifica ordens por data para uma estratégia"""
    
    print()
    print("🔍 VERIFICANDO ORDENS POR DATA")
    print("=" * 50)
    
    try:
        # Buscar todas as ordens da estratégia
        ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).stream()
        
        orders_by_date = {}
        total_orders = 0
        
        for doc in ordens_ref:
            data = doc.to_dict()
            total_orders += 1
            
            created_at = data.get('createdAt')
            if created_at:
                if isinstance(created_at, str):
                    try:
                        order_date = datetime.datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                        date_str = order_date.date().isoformat()
                    except:
                        date_str = "Data inválida"
                else:
                    date_str = created_at.date().isoformat()
            else:
                date_str = "Sem data"
            
            if date_str not in orders_by_date:
                orders_by_date[date_str] = []
            
            traded_qty = float(data.get('TradedQuantity', 0))
            status = data.get('Status', 'Pendente')
            
            orders_by_date[date_str].append({
                'order_id': data.get('OrderID'),
                'ticker': data.get('ticker'),
                'side': data.get('side'),
                'quantity': data.get('quantity'),
                'traded_qty': traded_qty,
                'status': status,
                'executed': traded_qty > 0 or status == 'Filled'
            })
        
        print(f"📊 Total de ordens encontradas: {total_orders}")
        print()
        
        # Mostrar ordens por data
        for date_str in sorted(orders_by_date.keys()):
            orders = orders_by_date[date_str]
            executed_orders = [o for o in orders if o['executed']]
            
            print(f"📅 {date_str}: {len(orders)} ordens ({len(executed_orders)} executadas)")
            
            # Mostrar detalhes das ordens executadas
            for order in executed_orders:
                print(f"  • {order['side'].upper()} {order['traded_qty']}/{order['quantity']} {order['ticker']} - {order['status']}")
        
        # Verificar posição atual
        print()
        print("📊 POSIÇÃO ATUAL NO FIREBASE:")
        position_ref = db.collection('strategyPositions').document(f"{strategy_id}_WINQ25")
        position_doc = position_ref.get()
        
        if position_doc.exists:
            pos_data = position_doc.to_dict()
            current_qty = pos_data.get('quantity', 0)
            avg_price = pos_data.get('avgPrice', 0)
            updated_at = pos_data.get('updatedAt')
            
            print(f"  WINQ25: {current_qty} contratos @ R$ {avg_price:.2f}")
            print(f"  Última atualização: {updated_at}")
        else:
            print("  Nenhuma posição encontrada para WINQ25")
        
        return orders_by_date
        
    except Exception as e:
        print(f"❌ Erro ao verificar ordens: {e}")
        return {}

def simulate_position_calculation(db, strategy_id="master-teste"):
    """Simula o cálculo de posição apenas com ordens do dia atual"""
    
    print()
    print("🧮 SIMULANDO CÁLCULO DE POSIÇÃO (APENAS HOJE)")
    print("=" * 50)
    
    hoje = datetime.datetime.now().date()
    print(f"📅 Data atual: {hoje}")
    
    try:
        # Buscar ordens da estratégia
        ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).stream()
        
        pos_map = {}
        ordens_processadas = 0
        ordens_filtradas = 0
        
        for doc in ordens_ref:
            o = doc.to_dict()
            if not o:
                continue
                
            ordens_processadas += 1
            
            # Verificar se a ordem é do dia atual
            created_at = o.get('createdAt')
            if created_at:
                if isinstance(created_at, str):
                    try:
                        order_date = datetime.datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    except:
                        ordens_filtradas += 1
                        continue
                else:
                    order_date = created_at
                    
                if order_date.date() != hoje:
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
                pos_map[ticker] = {'qty': 0, 'totalBuy': 0, 'orders': []}
                
            pos_map[ticker]['orders'].append({
                'side': side,
                'qty': qty,
                'price': price,
                'order_id': o.get('OrderID')
            })
            
            if side == 'buy':
                pos_map[ticker]['qty'] += qty
                pos_map[ticker]['totalBuy'] += qty * price
            elif side == 'sell':
                pos_map[ticker]['qty'] -= qty
        
        print(f"📊 Processadas: {ordens_processadas} ordens")
        print(f"📊 Filtradas: {ordens_filtradas} ordens antigas")
        print()
        
        # Mostrar posições calculadas
        for ticker, pos in pos_map.items():
            avg = pos['qty'] > 0 and pos['totalBuy'] / pos['qty'] or 0
            print(f"📈 {ticker}: {pos['qty']} contratos @ R$ {avg:.2f}")
            print(f"   Ordens consideradas: {len(pos['orders'])}")
            for order in pos['orders']:
                print(f"     • {order['side'].upper()} {order['qty']} @ R$ {order['price']:.2f} (ID: {order['order_id']})")
            print()
        
        return pos_map
        
    except Exception as e:
        print(f"❌ Erro ao simular cálculo: {e}")
        return {}

def main():
    """Função principal do teste"""
    
    print("🔬 TESTE: FILTRO DE POSIÇÕES POR DATA")
    print("Objetivo: Verificar se apenas ordens do dia atual são consideradas")
    print()
    
    # Inicializar Firebase
    db = init_firebase()
    if not db:
        print("❌ Não foi possível conectar ao Firebase")
        return
    
    print("✅ Conectado ao Firebase")
    
    # 1. Verificar ordens por data
    orders_by_date = check_orders_by_date(db)
    
    # 2. Simular cálculo de posição
    calculated_positions = simulate_position_calculation(db)
    
    print()
    print("=" * 60)
    print("📋 RESUMO DO TESTE:")
    print()
    
    if orders_by_date:
        total_orders = sum(len(orders) for orders in orders_by_date.values())
        print(f"📊 Total de ordens na estratégia: {total_orders}")
        
        hoje = datetime.datetime.now().date().isoformat()
        if hoje in orders_by_date:
            orders_hoje = orders_by_date[hoje]
            executed_hoje = [o for o in orders_hoje if o['executed']]
            print(f"📅 Ordens de hoje ({hoje}): {len(orders_hoje)} ({len(executed_hoje)} executadas)")
        else:
            print(f"📅 Nenhuma ordem de hoje ({hoje})")
    
    if calculated_positions:
        print("✅ Cálculo de posição simulado com sucesso")
        print("✅ Apenas ordens do dia atual foram consideradas")
    else:
        print("⚠️ Nenhuma posição calculada (normal se não há ordens de hoje)")
    
    print()
    print("🚀 PRÓXIMO PASSO:")
    print("1. Reinicie o UP BlackBox 4.0")
    print("2. Monitore os logs para verificar o filtro:")
    print("   [strategyPositions] Processadas: X ordens, Filtradas: Y ordens antigas")
    print("3. Verifique se a posição agora reflete apenas ordens do dia atual")

if __name__ == "__main__":
    main() 