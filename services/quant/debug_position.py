#!/usr/bin/env python3
"""
Debug: Teste da Função get_strategy_position
===========================================
Verifica se a função está funcionando corretamente com o ID da carteira BlackBox
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

async def get_strategy_position(strategy_id: str, ticker: str) -> int:
    """Função idêntica à do Quant Engine"""
    try:
        position_doc_id = f"{strategy_id}_{ticker}"
        position_ref = db.collection('strategyPositions').document(position_doc_id)
        position_doc = position_ref.get()
        
        print(f"🔍 Buscando posição: {position_doc_id}")
        
        if position_doc.exists:
            data = position_doc.to_dict()
            quantity = int(data.get('quantity', 0))
            print(f"✅ Posição encontrada: {quantity}")
            return quantity
        else:
            print(f"📊 Nenhuma posição encontrada para: {position_doc_id}")
            return 0
            
    except Exception as e:
        print(f"❌ Erro ao buscar posição para {strategy_id}_{ticker}: {e}")
        return 0

def main():
    """Função principal"""
    global db
    db = init_firebase()
    
    if not db:
        print("❌ Falha ao conectar ao Firebase")
        return
    
    print("🔬 DEBUG: Teste da Função get_strategy_position")
    print("=" * 60)
    
    # Teste 1: ID da estratégia quant (antigo - incorreto)
    print("\n🧪 TESTE 1: ID da Estratégia Quant (Incorreto)")
    print("-" * 40)
    import asyncio
    result1 = asyncio.run(get_strategy_position("ADBvsn4N3BneHPkXbQVg", "WINQ25"))
    print(f"Resultado: {result1}")
    
    # Teste 2: ID da carteira BlackBox (novo - correto)
    print("\n🧪 TESTE 2: ID da Carteira BlackBox (Correto)")
    print("-" * 40)
    result2 = asyncio.run(get_strategy_position("master-teste", "WINQ25"))
    print(f"Resultado: {result2}")
    
    # Teste 3: Verificar todas as posições relacionadas
    print("\n🧪 TESTE 3: Todas as Posições WINQ25")
    print("-" * 40)
    try:
        positions_ref = db.collection('strategyPositions').where('ticker', '==', 'WINQ25').stream()
        for doc in positions_ref:
            data = doc.to_dict()
            print(f"  • {doc.id} | Qtd: {data.get('quantity', 0)} | Strategy: {data.get('strategy_id', 'N/A')}")
    except Exception as e:
        print(f"❌ Erro ao buscar posições: {e}")
    
    print("\n" + "=" * 60)
    print("📋 CONCLUSÃO:")
    if result1 == 0 and result2 > 0:
        print("✅ CORREÇÃO FUNCIONANDO: ID da carteira BlackBox retorna posição correta")
        print(f"   - ID estratégia: {result1} (incorreto)")
        print(f"   - ID carteira: {result2} (correto)")
    else:
        print("❌ PROBLEMA PERSISTE: Verificar se correção foi aplicada corretamente")

if __name__ == "__main__":
    main() 