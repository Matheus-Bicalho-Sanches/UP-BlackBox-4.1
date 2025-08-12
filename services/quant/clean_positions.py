#!/usr/bin/env python3
"""
Limpar Posições - Zerar Tudo
============================
Zera todas as posições da estratégia para começar do zero
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

def clean_positions():
    """Limpa todas as posições da estratégia"""
    
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
        
        print(f"🧹 LIMPANDO POSIÇÕES DA ESTRATÉGIA: {strategy_id}")
        print("=" * 60)
        
        # Buscar todas as posições da estratégia
        positions_ref = db.collection('strategyPositions')
        docs = positions_ref.stream()
        
        positions_to_clean = []
        for doc in docs:
            data = doc.to_dict()
            if data.get('strategy_id') == strategy_id:
                positions_to_clean.append({
                    'doc_id': doc.id,
                    'ticker': data.get('ticker', 'N/A'),
                    'quantity': data.get('quantity', 0)
                })
        
        if not positions_to_clean:
            print("✅ Nenhuma posição encontrada para limpar")
            return
        
        print(f"📊 Posições encontradas: {len(positions_to_clean)}")
        for pos in positions_to_clean:
            print(f"  - {pos['ticker']}: {pos['quantity']} contratos")
        
        # Confirmar limpeza
        print()
        confirm = input("❓ Confirmar limpeza de TODAS as posições? (digite 'SIM' para confirmar): ")
        
        if confirm != "SIM":
            print("❌ Limpeza cancelada pelo usuário")
            return
        
        # Limpar posições
        print()
        print("🧹 Limpando posições...")
        
        for pos in positions_to_clean:
            doc_ref = db.collection('strategyPositions').document(pos['doc_id'])
            doc_ref.update({
                'quantity': 0,
                'avgPrice': 0,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            print(f"✅ {pos['ticker']}: zerado")
        
        print()
        print("🎉 LIMPEZA CONCLUÍDA!")
        print("📝 Agora você pode reiniciar o Quant Engine para testar com posições zeradas")
        
    except Exception as e:
        print(f"❌ Erro ao limpar posições: {e}")

if __name__ == "__main__":
    clean_positions() 