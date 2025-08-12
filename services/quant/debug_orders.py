#!/usr/bin/env python3
"""
Debug: Ordens e Posições
========================
Verifica as ordens executadas para entender por que a posição está incorreta
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os
from pathlib import Path
from datetime import datetime, timedelta

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

def debug_orders():
    """Debuga as ordens executadas"""
    
    db = init_firebase()
    if not db:
        return
    
    try:
        print("🔍 DEBUG: Ordens e Posições")
        print("=" * 60)
        
        # Buscar estratégia
        strategies_ref = db.collection('quantStrategies')
        query = strategies_ref.where('nome', '==', 'Voltaamedia_Bollinger_1min_WINQ25')
        docs = query.stream()
        
        strategy_doc = None
        for doc in docs:
            strategy_doc = doc
            break
        
        if not strategy_doc:
            print("❌ Estratégia não encontrada")
            return
        
        strategy_data = strategy_doc.to_dict()
        strategy_id = strategy_data.get('carteiraBlackBox')
        
        print(f"📊 Estratégia: {strategy_data.get('nome')}")
        print(f"📊 ID da Carteira: {strategy_id}")
        print()
        
        # Buscar posição atual
        print("📊 POSIÇÃO ATUAL:")
        positions_ref = db.collection('strategyPositions')
        docs = positions_ref.stream()
        
        current_position = 0
        for doc in docs:
            data = doc.to_dict()
            if data.get('strategy_id') == strategy_id and data.get('ticker') == 'WINQ25':
                current_position = data.get('quantity', 0)
                avg_price = data.get('avgPrice', 0)
                print(f"  - WINQ25: {current_position} contratos @ R$ {avg_price:.2f}")
        
        print()
        
        # Buscar ordens executadas (todas, sem filtro de tempo)
        print("📋 ORDENS EXECUTADAS (todas):")
        print("-" * 120)
        
        ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).stream()
        
        ordens_executadas = []
        for doc in ordens_ref:
            data = doc.to_dict()
            if not data:
                continue
            traded_qty = float(data.get('TradedQuantity', 0))
            status = data.get('Status', '').lower()
            if traded_qty > 0 and status in ('filled', 'partially filled', 'executada'):
                ordens_executadas.append(data)
        
        # Ordenar por timestamp (tratar casos onde createdAt pode ser string)
        def get_timestamp(ordem):
            timestamp = ordem.get('createdAt', 0)
            if isinstance(timestamp, str):
                try:
                    return float(timestamp)
                except:
                    return 0
            return timestamp
        ordens_executadas.sort(key=get_timestamp)
        
        if not ordens_executadas:
            print("  Nenhuma ordem executada encontrada")
        else:
            print(f"{'Timestamp':<20} | {'Side':<6} | {'Qty':<8} | {'Price':<10} | {'Status':<15} | {'OrderID':<20} | {'MasterBatchID':<20}")
            print("-" * 120)
            total_buy = 0
            total_sell = 0
            order_ids = {}
            for ordem in ordens_executadas:
                timestamp = ordem.get('createdAt', 0)
                if isinstance(timestamp, str):
                    try:
                        timestamp = float(timestamp)
                    except:
                        timestamp = 0
                if timestamp > 1000000000000:
                    dt = datetime.fromtimestamp(timestamp / 1000)
                elif timestamp > 0:
                    dt = datetime.fromtimestamp(timestamp)
                else:
                    dt = None
                time_str = dt.strftime('%Y-%m-%d %H:%M:%S') if dt else 'N/A'
                side = ordem.get('side', 'N/A')
                qty = float(ordem.get('TradedQuantity', 0))
                price = float(ordem.get('preco_medio_executado', ordem.get('price', 0)))
                status = ordem.get('Status', 'N/A')
                order_id = ordem.get('OrderID', 'N/A')
                master_batch_id = ordem.get('master_batch_id', '-')
                print(f"{time_str:<20} | {side:<6} | {qty:<8.0f} | {price:<10.2f} | {status:<15} | {order_id:<20} | {master_batch_id:<20}")
                if side.lower() == 'buy':
                    total_buy += qty
                elif side.lower() == 'sell':
                    total_sell += qty
                # Checar duplicidade
                if order_id in order_ids:
                    print(f"❌ ORDEM DUPLICADA: {order_id}")
                order_ids[order_id] = ordem
            print("-" * 120)
            print(f"TOTAL COMPRAS: {total_buy:.0f} contratos")
            print(f"TOTAL VENDAS: {total_sell:.0f} contratos")
            print(f"POSIÇÃO LÍQUIDA CALCULADA: {total_buy - total_sell:.0f} contratos")
            print(f"POSIÇÃO NO FIREBASE: {current_position:.0f} contratos")
            if abs((total_buy - total_sell) - current_position) > 1:
                print("❌ PROBLEMA: Posição no Firebase não bate com ordens executadas!")
                print("🔍 Possíveis causas:")
                print("  1. Ordens duplicadas sendo contadas")
                print("  2. Problema na função de atualização de posições")
                print("  3. Ordens antigas não zeradas")
            else:
                print("✅ Posição está correta!")
        
    except Exception as e:
        print(f"❌ Erro no debug: {e}")

if __name__ == "__main__":
    debug_orders() 