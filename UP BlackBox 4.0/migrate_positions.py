"""
Script para migrar posições existentes e calcular preços médios de vendas
"""
from firebase_admin import firestore
import datetime

db = firestore.client()

def migrate_positions():
    """Recalcula todas as posições existentes com os novos campos"""
    print("Iniciando migração das posições...")
    
    # Buscar todas as posições
    posicoes_ref = db.collection('posicoesDLL').stream()
    
    for doc in posicoes_ref:
        pos_data = doc.to_dict()
        account_id = pos_data.get('account_id')
        ticker = pos_data.get('ticker')
        
        if account_id and ticker:
            print(f"Recalculando posição {ticker} para conta {account_id}")
            
            # Recalcular posição usando a nova lógica
            from main import atualizar_posicoes_firebase
            atualizar_posicoes_firebase(account_id)
    
    print("Migração concluída!")

if __name__ == "__main__":
    migrate_positions() 