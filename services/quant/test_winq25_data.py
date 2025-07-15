#!/usr/bin/env python3
"""
Teste de Dados WINQ25 - Verifica se conseguimos buscar dados do ticker correto
"""

import firebase_admin
from firebase_admin import credentials, firestore
from pathlib import Path

def test_winq25_data():
    """Testa conexão e busca dados do WINQ25"""
    try:
        # Inicializar Firebase se não estiver inicializado
        if not firebase_admin._apps:
            BASE_DIR = Path(__file__).resolve().parents[2]
            cred_path = BASE_DIR / "UP BlackBox 4.0" / "secrets" / "up-gestao-firebase-adminsdk-fbsvc-7657b3faa7.json"
            
            if not cred_path.exists():
                print(f"❌ Firebase credentials not found at {cred_path}")
                return False
            
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred)
        
        db = firestore.client()
        
        print("🔍 Buscando dados WINQ25 no Firebase...")
        
        # Buscar candles de 1 minuto do WINQ25
        candles_ref = db.collection('marketDataDLL').document('WINQ25').collection('candles_1m')
        query = candles_ref.order_by('t', direction=firestore.Query.DESCENDING).limit(10)
        docs = list(query.stream())
        
        if docs:
            print(f"✅ Encontrados {len(docs)} candles recentes do WINQ25:")
            print()
            
            for i, doc in enumerate(docs):
                data = doc.to_dict()
                timestamp = data.get('t', 0)
                open_price = data.get('o', 0)
                high_price = data.get('h', 0)
                low_price = data.get('l', 0)
                close_price = data.get('c', 0)
                volume = data.get('v', 0)
                
                # Converter timestamp para datetime se necessário
                from datetime import datetime
                dt = datetime.fromtimestamp(timestamp / 1000) if timestamp > 1000000000000 else datetime.fromtimestamp(timestamp)
                
                print(f"📊 Candle {i+1}: {dt.strftime('%H:%M:%S')}")
                print(f"   O: {open_price:.2f} | H: {high_price:.2f} | L: {low_price:.2f} | C: {close_price:.2f}")
                if volume > 0:
                    print(f"   Volume: {volume}")
                print()
            
            # Testar Bollinger Bands com dados reais
            print("🧮 Testando cálculo de Bollinger Bands...")
            closes = [doc.to_dict().get('c', 0) for doc in reversed(docs)]
            
            if len(closes) >= 5:  # Mínimo para um teste básico
                import numpy as np
                
                # Calcular média simples
                sma = np.mean(closes)
                std = np.std(closes)
                
                upper_band = sma + (2.0 * std)
                lower_band = sma - (2.0 * std)
                
                print(f"   📈 Média (SMA): {sma:.2f}")
                print(f"   📊 Banda Superior: {upper_band:.2f}")
                print(f"   📉 Banda Inferior: {lower_band:.2f}")
                print(f"   📍 Último preço: {closes[-1]:.2f}")
                
                # Simular sinais
                last_price = closes[-1]
                
                if last_price < lower_band:
                    print("🟢 SINAL: COMPRA (Preço < Banda Inferior)")
                elif last_price < sma:
                    print("🟡 SINAL: COMPRA (Preço < Média)")
                elif last_price > sma:
                    print("🔴 SINAL: VENDA (Preço > Média)")
                else:
                    print("⚪ SINAL: NEUTRO")
            
            return True
            
        else:
            print("❌ Nenhum candle encontrado para WINQ25")
            print("💡 Verifique se o Profit Feed está enviando dados para o ticker correto")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao buscar dados: {e}")
        return False

def main():
    """Função principal"""
    print("=" * 60)
    print("  TESTE DE DADOS WINQ25 - UP GESTORA QUANT ENGINE")
    print("=" * 60)
    print()
    
    success = test_winq25_data()
    
    print()
    print("=" * 60)
    if success:
        print("🎉 DADOS WINQ25 DISPONÍVEIS!")
        print("✅ O Quant Engine pode processar esta estratégia")
    else:
        print("⚠️ DADOS WINQ25 NÃO DISPONÍVEIS")
        print("🔧 Verifique se o Profit Feed está rodando")
        print("📡 Certifique-se que WINQ25 está sendo coletado")
    print("=" * 60)

if __name__ == "__main__":
    main() 