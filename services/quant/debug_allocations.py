#!/usr/bin/env python3
"""
Debug: Alocações da Estratégia
==============================
Verifica as alocações da estratégia no Firebase para entender os valores investidos
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os
from pathlib import Path

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

def debug_allocations():
    """Debuga as alocações da estratégia"""
    
    db = init_firebase()
    if not db:
        return
    
    try:
        # Buscar estratégia
        strategies_ref = db.collection('quantStrategies')
        query = strategies_ref.where('nome', '==', 'Voltaamedia_Bollinger_1min_WINQ25')
        docs = query.stream()
        
        strategy_doc = None
        for doc in docs:
            strategy_doc = doc
            break
        
        if not strategy_doc:
            print("❌ Estratégia 'Voltaamedia_Bollinger_1min_WINQ25' não encontrada")
            return
        
        strategy_data = strategy_doc.to_dict()
        strategy_id = strategy_data.get('carteiraBlackBox')
        tamanho_position = strategy_data.get('tamanhoPosition', 0)
        
        print(f"📊 Estratégia: {strategy_data.get('nome')}")
        print(f"📊 ID da Carteira: {strategy_id}")
        print(f"📊 Tamanho Position: R$ {tamanho_position:,.2f}")
        print(f"📊 Contratos Calculados: {int(tamanho_position / 10000)}")
        print()
        
        # Buscar alocações da estratégia
        alloc_ref = db.collection("strategyAllocations").where("strategy_id", "==", strategy_id).stream()
        allocations = []
        
        for doc in alloc_ref:
            data = doc.to_dict()
            data['_id'] = doc.id
            allocations.append(data)
        
        if not allocations:
            print("❌ Nenhuma alocação encontrada para a estratégia")
            return
        
        print(f"📋 Alocações encontradas: {len(allocations)}")
        print("-" * 80)
        print(f"{'Conta':<15} | {'Broker':<8} | {'Valor Investido':<15} | {'Fator':<8} | {'Qty Calc (10)':<12}")
        print("-" * 80)
        
        total_valor = 0
        for alloc in allocations:
            account_id = alloc.get('account_id', 'N/A')
            broker_id = alloc.get('broker_id', 'N/A')
            valor_inv = float(alloc.get('valor_investido', 0))
            fator = valor_inv / 10000
            qty_calc = max(1, int(valor_inv / 10000))
            
            print(f"{account_id:<15} | {broker_id:<8} | R$ {valor_inv:>12,.2f} | {fator:>7.2f} | {qty_calc:>10}")
            total_valor += valor_inv
        
        print("-" * 80)
        print(f"{'TOTAL':<15} | {'':<8} | R$ {total_valor:>12,.2f} | {'':<8} | {'':<12}")
        
        # Simular cálculo do BlackBox
        print()
        print("🧮 SIMULAÇÃO: Cálculo do BlackBox (quantidade base = 10)")
        print("-" * 60)
        
        for alloc in allocations:
            account_id = alloc.get('account_id', 'N/A')
            valor_inv = float(alloc.get('valor_investido', 0))
            fator = valor_inv / 10000
            qty_calc = max(1, int(10 * fator))  # quantidade base = 10
            
            print(f"Conta {account_id}: valor_inv={valor_inv:.2f} fator={fator:.4f} qty_calc={qty_calc}")
        
        # Verificar posições atuais
        print()
        print("📊 POSIÇÕES ATUAIS:")
        print("-" * 40)
        
        positions_ref = db.collection('strategyPositions')
        docs = positions_ref.stream()
        
        for doc in docs:
            data = doc.to_dict()
            if data.get('strategy_id') == strategy_id:
                ticker = data.get('ticker', 'N/A')
                quantity = data.get('quantity', 0)
                avg_price = data.get('avgPrice', 0)
                print(f"{ticker}: {quantity} contratos @ R$ {avg_price:.2f}")
        
    except Exception as e:
        print(f"❌ Erro ao debugar alocações: {e}")

if __name__ == "__main__":
    debug_allocations() 