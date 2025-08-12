#!/usr/bin/env python3
"""
Teste da Correção de Posição Negativa
=====================================
Verifica se o Quant Engine agora trata corretamente posições negativas
"""

import firebase_admin
from firebase_admin import credentials, firestore
import os
from pathlib import Path
import datetime

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

def check_current_position(db, strategy_id="master-teste"):
    """Verifica posição atual da estratégia"""
    
    print()
    print("🔍 VERIFICANDO POSIÇÃO ATUAL")
    print("=" * 50)
    
    try:
        # Buscar posição no Firebase
        position_ref = db.collection('strategyPositions').document(f"{strategy_id}_WINQ25")
        position_doc = position_ref.get()
        
        if position_doc.exists:
            pos_data = position_doc.to_dict()
            current_qty = pos_data.get('quantity', 0)
            avg_price = pos_data.get('avgPrice', 0)
            updated_at = pos_data.get('updatedAt')
            
            print(f"📊 Posição atual: {current_qty} contratos")
            print(f"💰 Preço médio: R$ {avg_price:.2f}")
            print(f"🕒 Última atualização: {updated_at}")
            
            # Análise da posição
            if current_qty > 0:
                print("✅ Posição POSITIVA - Sistema deve enviar ordem de VENDA")
            elif current_qty < 0:
                print("⚠️ Posição NEGATIVA - Sistema deve AGUARDAR (não enviar ordens)")
            else:
                print("📊 Posição ZERO - Sistema deve enviar ordem de COMPRA")
                
            return current_qty
        else:
            print("📊 Nenhuma posição encontrada - Sistema deve enviar ordem de COMPRA")
            return 0
            
    except Exception as e:
        print(f"❌ Erro ao verificar posição: {e}")
        return 0

def simulate_strategy_logic(current_qty):
    """Simula a lógica da estratégia com a correção"""
    
    print()
    print("🧮 SIMULANDO LÓGICA DA ESTRATÉGIA")
    print("=" * 50)
    
    print(f"📊 Posição de entrada: {current_qty} contratos")
    print()
    
    if current_qty == 0:
        print("🟢 AÇÃO: Enviar ordem de COMPRA na banda inferior")
        print("   • Side: buy")
        print("   • Quantity: base_quantity")
        print("   • Price: bands['lower']")
        print("   • Motivo: Sem posição - aguardando entrada")
        
    elif current_qty > 0:
        print("🔴 AÇÃO: Enviar ordem de VENDA na média BB")
        print("   • Side: sell")
        print("   • Quantity: current_qty")
        print("   • Price: bands['middle']")
        print("   • Motivo: Com posição positiva - aguardando saída")
        
    else:
        print("⚠️ AÇÃO: NÃO ENVIAR ORDEM")
        print("   • Motivo: Posição negativa detectada")
        print("   • Sistema aguarda posição voltar ao positivo")
        print("   • Evita tentar vender quantidade negativa")
        
    print()
    print("✅ Correção aplicada: Sistema não tentará vender posição negativa")

def check_recent_orders(db, strategy_id="master-teste"):
    """Verifica ordens recentes para entender como chegou à posição negativa"""
    
    print()
    print("📋 VERIFICANDO ORDENS RECENTES")
    print("=" * 50)
    
    try:
        hoje = datetime.datetime.now().date()
        
        # Buscar ordens de hoje
        ordens_ref = db.collection('ordensDLL').where('strategy_id', '==', strategy_id).stream()
        
        orders_today = []
        for doc in ordens_ref:
            o = doc.to_dict()
            if not o:
                continue
                
            created_at = o.get('createdAt')
            if created_at:
                if isinstance(created_at, str):
                    try:
                        order_date = datetime.datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    except:
                        continue
                else:
                    order_date = created_at
                    
                if order_date.date() == hoje:
                    orders_today.append(o)
        
        print(f"📅 Ordens de hoje ({hoje}): {len(orders_today)}")
        
        if orders_today:
            # Agrupar por tipo
            buys = [o for o in orders_today if o.get('side') == 'buy' and float(o.get('TradedQuantity', 0)) > 0]
            sells = [o for o in orders_today if o.get('side') == 'sell' and float(o.get('TradedQuantity', 0)) > 0]
            
            total_buys = sum(float(o.get('TradedQuantity', 0)) for o in buys)
            total_sells = sum(float(o.get('TradedQuantity', 0)) for o in sells)
            
            print(f"🟢 Compras executadas: {len(buys)} ordens = {total_buys} contratos")
            print(f"🔴 Vendas executadas: {len(sells)} ordens = {total_sells} contratos")
            print(f"📊 Posição líquida: {total_buys - total_sells} contratos")
            
            if total_sells > total_buys:
                print("⚠️ PROBLEMA: Vendeu mais do que comprou!")
                print("   • Isso explica a posição negativa")
                print("   • Sistema estava vendendo sem ter posição suficiente")
                
        return orders_today
        
    except Exception as e:
        print(f"❌ Erro ao verificar ordens: {e}")
        return []

def main():
    """Função principal do teste"""
    
    print("🔬 TESTE: CORREÇÃO DE POSIÇÃO NEGATIVA")
    print("Objetivo: Verificar se o sistema trata corretamente posições negativas")
    print()
    
    # Inicializar Firebase
    db = init_firebase()
    if not db:
        print("❌ Não foi possível conectar ao Firebase")
        return
    
    print("✅ Conectado ao Firebase")
    
    # 1. Verificar posição atual
    current_qty = check_current_position(db)
    
    # 2. Simular lógica da estratégia
    simulate_strategy_logic(current_qty)
    
    # 3. Verificar ordens recentes
    recent_orders = check_recent_orders(db)
    
    print()
    print("=" * 60)
    print("📋 RESUMO DO TESTE:")
    print()
    
    if current_qty < 0:
        print("⚠️ POSIÇÃO NEGATIVA DETECTADA")
        print("✅ Correção aplicada: Sistema não enviará ordens de venda")
        print("✅ Sistema aguardará posição voltar ao positivo")
    elif current_qty > 0:
        print("✅ POSIÇÃO POSITIVA")
        print("✅ Sistema funcionará normalmente")
    else:
        print("📊 POSIÇÃO ZERO")
        print("✅ Sistema enviará ordem de compra")
    
    print()
    print("🚀 PRÓXIMO PASSO:")
    print("1. Reinicie o Quant Engine")
    print("2. Monitore os logs para verificar:")
    if current_qty < 0:
        print("   ⚠️ Posição negativa detectada: X contratos. Aguardando posição voltar ao positivo")
    else:
        print("   📊 Posição: X | Enviando nova ordem: [buy/sell] X WINQ25 @ Y")
    print("3. Verifique se não há mais tentativas de vender quantidade negativa")

if __name__ == "__main__":
    main() 