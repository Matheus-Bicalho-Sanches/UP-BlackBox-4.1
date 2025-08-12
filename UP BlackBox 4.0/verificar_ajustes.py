#!/usr/bin/env python3
"""
Script para verificar ajustes manuais LFTS11
===========================================
Verifica se os ajustes manuais estão sendo salvos corretamente na coleção contasDll
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

def verificar_ajustes_manuais(db):
    """Verifica todos os ajustes manuais LFTS11"""
    
    print("🔍 VERIFICANDO AJUSTES MANUAIS LFTS11")
    print("=" * 60)
    
    try:
        contas_ref = db.collection('contasDll').stream()
        contas_com_ajustes = []
        
        for doc in contas_ref:
            conta = doc.to_dict()
            account_id = conta.get('AccountID')
            nome = conta.get('Nome Cliente', account_id)
            
            ajuste_quantity = float(conta.get('AjusteQuantityLFTS11', 0))
            ajuste_avg_price = float(conta.get('AjusteAvgPriceLFTS11', 0))
            
            if ajuste_quantity != 0 or ajuste_avg_price != 0:
                contas_com_ajustes.append({
                    'account_id': account_id,
                    'nome': nome,
                    'ajuste_quantity': ajuste_quantity,
                    'ajuste_avg_price': ajuste_avg_price,
                    'doc_id': doc.id
                })
                print(f"✅ {account_id} - {nome}")
                print(f"   Ajuste Quantity: {ajuste_quantity}")
                print(f"   Ajuste AvgPrice: {ajuste_avg_price}")
                print()
        
        if not contas_com_ajustes:
            print("❌ Nenhum ajuste manual encontrado!")
            print("   Isso explica por que as edições não estão sendo mantidas.")
            print("   Os ajustes manuais não estão sendo salvos na coleção contasDll.")
        
        return contas_com_ajustes
        
    except Exception as e:
        print(f"❌ Erro ao verificar ajustes: {e}")
        return []

def simular_edicao_ajuste(db, account_id, nova_quantidade, novo_preco_medio):
    """Simula a edição de um ajuste manual"""
    
    print(f"🔧 SIMULANDO EDIÇÃO DE AJUSTE")
    print(f"Conta: {account_id}")
    print(f"Nova quantidade: {nova_quantidade}")
    print(f"Novo preço médio: {novo_preco_medio}")
    print()
    
    try:
        # Buscar a conta
        contas_ref = db.collection('contasDll').where('AccountID', '==', account_id).stream()
        
        for doc in contas_ref:
            doc_id = doc.id
            conta = doc.to_dict()
            
            print(f"📝 Atualizando documento: {doc_id}")
            
            # Atualizar os ajustes
            db.collection('contasDll').document(doc_id).update({
                'AjusteQuantityLFTS11': nova_quantidade,
                'AjusteAvgPriceLFTS11': novo_preco_medio
            })
            
            print(f"✅ Ajustes atualizados com sucesso!")
            return True
        
        print(f"❌ Conta {account_id} não encontrada")
        return False
        
    except Exception as e:
        print(f"❌ Erro ao atualizar ajustes: {e}")
        return False

def main():
    """Função principal"""
    
    print("🔬 VERIFICAÇÃO DE AJUSTES MANUAIS LFTS11")
    print("Objetivo: Verificar se os ajustes estão sendo salvos corretamente")
    print()
    
    # Inicializar Firebase
    db = init_firebase()
    if not db:
        print("❌ Não foi possível conectar ao Firebase")
        return
    
    print("✅ Conectado ao Firebase")
    print()
    
    # Verificar ajustes existentes
    ajustes = verificar_ajustes_manuais(db)
    
    print("=" * 60)
    print("📋 PRÓXIMOS PASSOS:")
    print()
    
    if not ajustes:
        print("1. Você precisa editar a quantidade LFTS11 no frontend")
        print("2. Verificar se o frontend está salvando os ajustes em contasDll")
        print("3. Se não estiver salvando, precisamos corrigir o frontend")
        print()
        
        # Perguntar se quer simular uma edição
        print("🔧 Quer simular uma edição de ajuste?")
        print("   Digite o account_id da conta que você editou:")
        account_id = input("   Account ID: ").strip()
        
        if account_id:
            print("   Digite a nova quantidade que você definiu:")
            nova_qty = input("   Nova quantidade: ").strip()
            
            if nova_qty and account_id:
                try:
                    nova_qty = float(nova_qty)
                    sucesso = simular_edicao_ajuste(db, account_id, nova_qty, 0)
                    
                    if sucesso:
                        print()
                        print("✅ Ajuste simulado com sucesso!")
                        print("   Agora teste novamente no frontend.")
                        print("   A quantidade deve ser mantida após atualizar a página.")
                except ValueError:
                    print("❌ Quantidade inválida")
    
    print("🏁 VERIFICAÇÃO CONCLUÍDA")

if __name__ == "__main__":
    main() 