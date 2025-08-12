#!/usr/bin/env python3
"""
Atualizar Valor da Estratégia no Firebase
=========================================
Atualiza o tamanhoPosition da estratégia para testar o novo cálculo
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

def update_strategy_value():
    """Atualiza o valor da estratégia no Firebase"""
    
    db = init_firebase()
    if not db:
        return
    
    try:
        # Buscar estratégia Voltaamedia_Bollinger_1min_WINQ25
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
        
        # Mostrar valor atual
        current_data = strategy_doc.to_dict()
        current_value = current_data.get('tamanhoPosition', 0)
        print(f"📊 Valor atual da estratégia: {current_value}")
        
        # Calcular novo valor (assumindo que era 10 contratos)
        # Para manter 10 contratos com nova lógica: 10 * 10000 = 100000
        new_value = 100000.0  # R$ 100.000 para 10 contratos
        
        print(f"🔄 Atualizando para: R$ {new_value:,.2f} (10 contratos)")
        
        # Atualizar no Firebase
        strategy_ref = db.collection('quantStrategies').document(strategy_doc.id)
        strategy_ref.update({
            'tamanhoPosition': new_value
        })
        
        print(f"✅ Estratégia atualizada com sucesso!")
        print(f"📝 Novo valor: R$ {new_value:,.2f}")
        print(f"📊 Contratos calculados: {int(new_value / 10000)}")
        
    except Exception as e:
        print(f"❌ Erro ao atualizar estratégia: {e}")

if __name__ == "__main__":
    update_strategy_value() 