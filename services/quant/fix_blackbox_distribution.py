#!/usr/bin/env python3
"""
Correção: Distribuição de Quantidades no BlackBox
=================================================
Corrige a lógica de distribuição para vendas (deve ser proporcional, não multiplicativa)
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

def analyze_problem():
    """Analisa o problema de distribuição"""
    
    db = init_firebase()
    if not db:
        return
    
    try:
        print("🔍 ANÁLISE DO PROBLEMA DE DISTRIBUIÇÃO")
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
        
        # Buscar alocações
        alloc_ref = db.collection("strategyAllocations").where("strategy_id", "==", strategy_id).stream()
        allocations = []
        
        for doc in alloc_ref:
            data = doc.to_dict()
            allocations.append(data)
        
        print(f"📊 Estratégia: {strategy_data.get('nome')}")
        print(f"📊 ID da Carteira: {strategy_id}")
        print()
        
        print("📋 ALOCAÇÕES:")
        total_valor = 0
        for alloc in allocations:
            valor_inv = float(alloc.get('valor_investido', 0))
            total_valor += valor_inv
            print(f"  - Conta {alloc['account_id']}: R$ {valor_inv:,.2f}")
        
        print(f"📊 Total Alocado: R$ {total_valor:,.2f}")
        print()
        
        # Verificar posições atuais
        print("📊 POSIÇÕES ATUAIS:")
        positions_ref = db.collection('strategyPositions')
        docs = positions_ref.stream()
        
        total_position = 0
        for doc in docs:
            data = doc.to_dict()
            if data.get('strategy_id') == strategy_id and data.get('ticker') == 'WINQ25':
                quantity = data.get('quantity', 0)
                total_position = quantity
                print(f"  - WINQ25: {quantity} contratos")
        
        print()
        print("🧮 SIMULAÇÃO DO PROBLEMA:")
        print("-" * 40)
        
        # Simular compra (quantidade base = 10)
        print("📈 COMPRA (quantidade base = 10):")
        for alloc in allocations:
            valor_inv = float(alloc.get('valor_investido', 0))
            fator = valor_inv / 10000
            qty_calc = max(1, int(10 * fator))
            print(f"  - Conta {alloc['account_id']}: 10 × {fator:.2f} = {qty_calc} contratos")
        
        # Simular venda (quantidade total = 515)
        print()
        print("📉 VENDA (quantidade total = 515):")
        print("❌ PROBLEMA: BlackBox multiplica 515 pelos fatores:")
        for alloc in allocations:
            valor_inv = float(alloc.get('valor_investido', 0))
            fator = valor_inv / 10000
            qty_calc = max(1, int(515 * fator))
            print(f"  - Conta {alloc['account_id']}: 515 × {fator:.2f} = {qty_calc} contratos")
        
        print()
        print("✅ SOLUÇÃO CORRETA (distribuição proporcional):")
        for alloc in allocations:
            valor_inv = float(alloc.get('valor_investido', 0))
            proporcao = valor_inv / total_valor
            qty_calc = max(1, int(515 * proporcao))
            print(f"  - Conta {alloc['account_id']}: 515 × {proporcao:.2f} = {qty_calc} contratos")
        
        print()
        print("📝 CONCLUSÃO:")
        print("O BlackBox precisa ser modificado para:")
        print("1. COMPRA: Multiplicar quantidade base pelos fatores (atual)")
        print("2. VENDA: Distribuir quantidade total proporcionalmente (correção necessária)")
        
    except Exception as e:
        print(f"❌ Erro na análise: {e}")

if __name__ == "__main__":
    analyze_problem() 