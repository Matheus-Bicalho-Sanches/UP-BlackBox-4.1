#!/usr/bin/env python3
"""
Script de Debug para Posições LFTS11
====================================
Verifica se os ajustes manuais estão sendo aplicados corretamente
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

def debug_posicoes_lfts11(db, account_id):
    """Debug das posições LFTS11 para uma conta específica"""
    
    print(f"🔍 DEBUG POSIÇÕES LFTS11 - Conta: {account_id}")
    print("=" * 60)
    
    # 1. Verificar ajustes manuais
    print("1. VERIFICANDO AJUSTES MANUAIS:")
    ajuste_quantity = 0
    ajuste_avg_price = 0
    
    try:
        contas_ref = db.collection('contasDll').where('AccountID', '==', account_id).stream()
        for doc in contas_ref:
            conta = doc.to_dict()
            ajuste_quantity = float(conta.get('AjusteQuantityLFTS11', 0))
            ajuste_avg_price = float(conta.get('AjusteAvgPriceLFTS11', 0))
            print(f"   Ajuste Quantity: {ajuste_quantity}")
            print(f"   Ajuste AvgPrice: {ajuste_avg_price}")
            break
    except Exception as e:
        print(f"   ❌ Erro ao buscar ajustes: {e}")
    
    # 2. Verificar ordens executadas
    print("\n2. VERIFICANDO ORDENS EXECUTADAS:")
    ordens_ref = db.collection('ordensDLL').where('account_id', '==', account_id).stream()
    pos_map = {}
    
    for doc in ordens_ref:
        ordem = doc.to_dict()
        ticker = ordem.get('ticker')
        side = ordem.get('side')
        traded_qty = float(ordem.get('TradedQuantity', 0))
        price = float(ordem.get('preco_medio_executado', ordem.get('price', 0)))
        
        if ticker == 'LFTS11' and traded_qty > 0:
            print(f"   Ordem: {side} {traded_qty} @ {price:.2f}")
            
            if ticker not in pos_map:
                pos_map[ticker] = {'ticker': ticker, 'quantity': 0, 'totalBuy': 0, 'totalSell': 0, 'avgPrice': 0}
            
            if side == 'buy':
                pos_map[ticker]['quantity'] += traded_qty
                pos_map[ticker]['totalBuy'] += traded_qty * price
            elif side == 'sell':
                pos_map[ticker]['quantity'] -= traded_qty
                pos_map[ticker]['totalSell'] += traded_qty * price
    
    # 3. Calcular posição sem ajustes
    print("\n3. CÁLCULO SEM AJUSTES:")
    if 'LFTS11' in pos_map:
        pos_lfts = pos_map['LFTS11']
        pos_lfts['avgPrice'] = pos_lfts['quantity'] > 0 and pos_lfts['totalBuy'] / (pos_lfts['quantity'] if pos_lfts['quantity'] != 0 else 1) or 0
        
        print(f"   Quantidade calculada: {pos_lfts['quantity']}")
        print(f"   Total Buy: {pos_lfts['totalBuy']:.2f}")
        print(f"   Preço médio calculado: {pos_lfts['avgPrice']:.2f}")
    else:
        print("   Nenhuma ordem LFTS11 encontrada")
        pos_lfts = {'quantity': 0, 'totalBuy': 0, 'avgPrice': 0}
    
    # 4. Aplicar ajustes manuais
    print("\n4. APLICAÇÃO DOS AJUSTES MANUAIS:")
    quantidade_final = pos_lfts['quantity'] + ajuste_quantity
    print(f"   Quantidade final: {pos_lfts['quantity']} + {ajuste_quantity} = {quantidade_final}")
    
    if ajuste_avg_price > 0:
        if quantidade_final > 0:
            valor_calculado = pos_lfts['totalBuy']
            valor_ajuste = ajuste_quantity * ajuste_avg_price
            preco_medio_final = (valor_calculado + valor_ajuste) / quantidade_final
            print(f"   Valor calculado: {valor_calculado:.2f}")
            print(f"   Valor ajuste: {valor_ajuste:.2f}")
            print(f"   Preço médio final: ({valor_calculado:.2f} + {valor_ajuste:.2f}) / {quantidade_final} = {preco_medio_final:.2f}")
        else:
            preco_medio_final = ajuste_avg_price
            print(f"   Preço médio final (apenas ajuste): {preco_medio_final:.2f}")
    else:
        preco_medio_final = pos_lfts['avgPrice']
        print(f"   Preço médio final (sem ajuste): {preco_medio_final:.2f}")
    
    # 5. Verificar posição atual no Firebase
    print("\n5. POSIÇÃO ATUAL NO FIREBASE:")
    try:
        doc_id = f"{account_id}_LFTS11"
        pos_doc = db.collection('posicoesDLL').document(doc_id).get()
        
        if pos_doc.exists:
            pos_data = pos_doc.to_dict()
            print(f"   Quantidade no Firebase: {pos_data.get('quantity', 0)}")
            print(f"   Preço médio no Firebase: {pos_data.get('avgPrice', 0):.2f}")
            
            # Comparar com cálculo
            if abs(pos_data.get('quantity', 0) - quantidade_final) > 0.01:
                print(f"   ⚠️ DIFERENÇA NA QUANTIDADE: Firebase={pos_data.get('quantity', 0)}, Calculado={quantidade_final}")
            else:
                print(f"   ✅ Quantidade OK")
                
            if abs(pos_data.get('avgPrice', 0) - preco_medio_final) > 0.01:
                print(f"   ⚠️ DIFERENÇA NO PREÇO MÉDIO: Firebase={pos_data.get('avgPrice', 0):.2f}, Calculado={preco_medio_final:.2f}")
            else:
                print(f"   ✅ Preço médio OK")
        else:
            print("   ❌ Documento não encontrado no Firebase")
            
    except Exception as e:
        print(f"   ❌ Erro ao verificar Firebase: {e}")
    
    print("\n" + "=" * 60)

def main():
    """Função principal"""
    
    print("🔬 DEBUG POSIÇÕES LFTS11")
    print("Objetivo: Verificar se ajustes manuais estão sendo aplicados corretamente")
    print()
    
    # Inicializar Firebase
    db = init_firebase()
    if not db:
        print("❌ Não foi possível conectar ao Firebase")
        return
    
    print("✅ Conectado ao Firebase")
    print()
    
    # Listar contas disponíveis
    print("📋 CONTAS DISPONÍVEIS:")
    contas_ref = db.collection('contasDll').stream()
    contas = []
    
    for doc in contas_ref:
        conta = doc.to_dict()
        account_id = conta.get('AccountID')
        nome = conta.get('Nome Cliente', account_id)
        contas.append((account_id, nome))
        print(f"   • {account_id} - {nome}")
    
    print()
    
    # Debug para cada conta
    for account_id, nome in contas:
        debug_posicoes_lfts11(db, account_id)
    
    print("🏁 DEBUG CONCLUÍDO")

if __name__ == "__main__":
    main() 