#!/usr/bin/env python3
"""
Força Atualização de Posição com Filtro de Data
===============================================
Executa manualmente a função atualizar_posicoes_firebase_strategy com filtro de data
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os
from pathlib import Path
import datetime

def init_firebase():
    """Inicializa Firebase Admin SDK"""
    try:
        if firebase_admin._apps:
            return firestore.client()
            
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

def atualizar_posicoes_firebase_strategy_manual(db, strategy_id):
    """
    Versão manual da função atualizar_posicoes_firebase_strategy com filtro de data
    """
    print(f"[strategyPositions] Recalculando posições para strategy_id={strategy_id} (apenas ordens de hoje)")
    
    hoje = datetime.datetime.now().date()
    print(f"📅 Data atual: {hoje}")
    
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
    
    # Salvar posições
    for t, vals in pos_map.items():
        avg = vals['qty'] > 0 and vals['totalBuy'] / vals['qty'] or 0
        
        # Salvar no Firebase
        db.collection('strategyPositions').document(f"{strategy_id}_{t}").set({
            'strategy_id': strategy_id,
            'ticker': t,
            'quantity': vals['qty'],
            'avgPrice': avg,
            'updatedAt': firestore.SERVER_TIMESTAMP
        })
        
        print(f"📈 {t}: {vals['qty']} contratos @ R$ {avg:.2f}")
        print(f"   Ordens consideradas: {len(vals['orders'])}")
        
        # Mostrar detalhes das ordens
        for order in vals['orders']:
            print(f"     • {order['side'].upper()} {order['qty']} @ R$ {order['price']:.2f} (ID: {order['order_id']})")
    
    print(f"[strategyPositions] Atualizado strategy_id={strategy_id} tickers={list(pos_map.keys())}")
    print(f"[strategyPositions] Processadas: {ordens_processadas} ordens, Filtradas: {ordens_filtradas} ordens antigas")
    
    return pos_map

def main():
    """Função principal"""
    
    print("🔄 FORÇANDO ATUALIZAÇÃO DE POSIÇÃO COM FILTRO DE DATA")
    print("=" * 60)
    
    # Inicializar Firebase
    db = init_firebase()
    if not db:
        print("❌ Não foi possível conectar ao Firebase")
        return
    
    print("✅ Conectado ao Firebase")
    
    # Estratégia a ser atualizada
    strategy_id = "master-teste"
    
    print(f"🎯 Atualizando posições para estratégia: {strategy_id}")
    print()
    
    # Executar atualização manual
    pos_map = atualizar_posicoes_firebase_strategy_manual(db, strategy_id)
    
    print()
    print("=" * 60)
    print("✅ ATUALIZAÇÃO CONCLUÍDA!")
    print()
    
    if pos_map:
        print("📊 Posições atualizadas:")
        for ticker, pos in pos_map.items():
            print(f"  • {ticker}: {pos['qty']} contratos")
    else:
        print("📊 Nenhuma posição encontrada para hoje")
    
    print()
    print("🚀 PRÓXIMO PASSO:")
    print("1. Verifique se o Quant Engine agora detecta a posição correta")
    print("2. Monitore os logs para confirmar que não há mais problemas de posição")

if __name__ == "__main__":
    main() 