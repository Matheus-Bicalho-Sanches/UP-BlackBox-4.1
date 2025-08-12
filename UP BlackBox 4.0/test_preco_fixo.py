#!/usr/bin/env python3
"""
Teste do Preço Fixo LFTS11
==========================
Verifica se o sistema está usando o preço fixo corretamente
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
            
        cred_path = Path(__file__).parent / "secrets" / "up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json"
        
        if not cred_path.exists():
            print(f"❌ Arquivo de credenciais não encontrado: {cred_path}")
            return None
            
        cred = credentials.Certificate(str(cred_path))
        firebase_admin.initialize_app(cred)
        return firestore.client()
        
    except Exception as e:
        print(f"❌ Erro ao inicializar Firebase: {e}")
        return None

def test_preco_fixo(db):
    """Testa se o preço fixo está sendo usado corretamente"""
    
    print("🔬 TESTE DO PREÇO FIXO LFTS11")
    print("=" * 60)
    
    # 1. Verificar preço fixo no config
    print("1. VERIFICANDO PREÇO FIXO NO CONFIG:")
    try:
        config_ref = db.collection('config').document('lftsPrice')
        config_doc = config_ref.get()
        
        if config_doc.exists:
            preco_fixo = float(config_doc.to_dict().get('value', 0))
            print(f"   ✅ Preço fixo encontrado: R$ {preco_fixo:.2f}")
        else:
            print("   ❌ Preço fixo não encontrado no config")
            return False
            
    except Exception as e:
        print(f"   ❌ Erro ao buscar preço fixo: {e}")
        return False
    
    # 2. Verificar posições LFTS11
    print("\n2. VERIFICANDO POSIÇÕES LFTS11:")
    try:
        posicoes_ref = db.collection('posicoesDLL').where('ticker', '==', 'LFTS11').stream()
        posicoes = []
        
        for doc in posicoes_ref:
            data = doc.to_dict()
            account_id = data.get('account_id')
            quantity = float(data.get('quantity', 0))
            avg_price = float(data.get('avgPrice', 0))
            
            if account_id:
                posicoes.append({
                    'account_id': account_id,
                    'quantity': quantity,
                    'avg_price': avg_price,
                    'valor': quantity * avg_price
                })
        
        print(f"   📊 {len(posicoes)} posições LFTS11 encontradas:")
        
        for pos in posicoes:
            print(f"   • Conta {pos['account_id']}: {pos['quantity']} unidades a R$ {pos['avg_price']:.2f} = R$ {pos['valor']:.2f}")
            
            # Verificar se o preço está correto
            if abs(pos['avg_price'] - preco_fixo) > 0.01:
                print(f"     ⚠️ PREÇO INCORRETO! Esperado: R$ {preco_fixo:.2f}, Atual: R$ {pos['avg_price']:.2f}")
            else:
                print(f"     ✅ Preço correto")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Erro ao verificar posições: {e}")
        return False

def simular_atualizacao_posicao(db, account_id):
    """Simula a atualização de uma posição para testar o preço fixo"""
    
    print(f"\n3. SIMULANDO ATUALIZAÇÃO DE POSIÇÃO:")
    print(f"   Conta: {account_id}")
    
    try:
        # Buscar preço fixo
        config_ref = db.collection('config').document('lftsPrice')
        config_doc = config_ref.get()
        preco_fixo = float(config_doc.to_dict().get('value', 0))
        
        # Buscar posição atual
        doc_id = f"{account_id}_LFTS11"
        pos_doc = db.collection('posicoesDLL').document(doc_id).get()
        
        if pos_doc.exists:
            pos_data = pos_doc.to_dict()
            quantity_atual = float(pos_data.get('quantity', 0))
            avg_price_atual = float(pos_data.get('avgPrice', 0))
            
            print(f"   Posição atual: {quantity_atual} unidades a R$ {avg_price_atual:.2f}")
            
            # Simular venda de 10 unidades
            nova_quantity = quantity_atual - 10
            if nova_quantity < 0:
                nova_quantity = 0
            
            # Atualizar posição (o backend deve usar o preço fixo)
            db.collection('posicoesDLL').document(doc_id).update({
                'quantity': nova_quantity,
                'avgPrice': preco_fixo,  # Forçar preço fixo
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            
            print(f"   ✅ Posição atualizada: {nova_quantity} unidades a R$ {preco_fixo:.2f}")
            print(f"   💰 Valor total: R$ {(nova_quantity * preco_fixo):.2f}")
            
            return True
        else:
            print(f"   ❌ Posição não encontrada para conta {account_id}")
            return False
            
    except Exception as e:
        print(f"   ❌ Erro ao simular atualização: {e}")
        return False

def main():
    """Função principal"""
    
    print("🔬 TESTE DO PREÇO FIXO LFTS11")
    print("Objetivo: Verificar se o sistema está usando o preço fixo corretamente")
    print()
    
    # Inicializar Firebase
    db = init_firebase()
    if not db:
        print("❌ Não foi possível conectar ao Firebase")
        return
    
    print("✅ Conectado ao Firebase")
    print()
    
    # Testar preço fixo
    sucesso = test_preco_fixo(db)
    
    if sucesso:
        print("\n" + "=" * 60)
        print("📋 PRÓXIMOS PASSOS:")
        print()
        print("1. Teste o ajuste de caixa no frontend")
        print("2. Verifique se o preço médio permanece fixo após operações")
        print("3. Confirme se os valores LFTS11 estão corretos")
        print()
        
        # Perguntar se quer simular uma atualização
        print("🔧 Quer simular uma atualização de posição?")
        print("   Digite o account_id da conta para testar:")
        account_id = input("   Account ID: ").strip()
        
        if account_id:
            simular_atualizacao_posicao(db, account_id)
    
    print("\n🏁 TESTE CONCLUÍDO")

if __name__ == "__main__":
    main() 