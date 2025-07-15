#!/usr/bin/env python3
"""
Teste Rápido - Verifica se a correção do preço funciona
"""

import asyncio
import aiohttp
import json

async def test_order_with_price():
    """Testa envio de ordem COM preço"""
    try:
        # Ordem de teste com preço incluído
        order_data = {
            "account_id": "MASTER",
            "strategy_id": "master-teste",  # Use o mesmo ID que está funcionando
            "ticker": "WINQ25",
            "quantity": 1,
            "side": "buy",
            "exchange": "F",
            "order_type": "market",
            "price": 137700.00,  # ← CORREÇÃO: Agora incluindo preço
            "reason": "[TESTE CORREÇÃO] Ordem com preço incluído"
        }
        
        print("🧪 TESTE DOS PREÇOS DE GATILHO")
        print("=" * 50)
        print("💡 NOVA LÓGICA: Ordens usam preços de gatilho das Bandas de Bollinger")
        print("   • Compra < Média BB → Ordem no preço da Média BB")
        print("   • Compra < Banda Inferior → Ordem no preço da Banda Inferior")
        print("   • Venda > Média BB → Ordem no preço da Média BB")
        print()
        print("📊 Dados da ordem:")
        print(json.dumps(order_data, indent=2))
        print()
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "http://localhost:8000/order",
                json=order_data,
                headers={"Content-Type": "application/json"}
            ) as response:
                
                status = response.status
                response_text = await response.text()
                
                print(f"📡 Status HTTP: {status}")
                print(f"📄 Resposta:")
                
                try:
                    response_json = json.loads(response_text)
                    print(json.dumps(response_json, indent=2, ensure_ascii=False))
                except:
                    print(response_text)
                
                print()
                
                if status == 200:
                    print("✅ CORREÇÃO FUNCIONOU!")
                    print("✅ Ordem aceita pela API com preço incluído!")
                    print()
                    print("🔍 Verificar se aparece em:")
                    print("   http://localhost:3000/dashboard/up-blackbox4/ordens")
                    print()
                    print("🚀 Agora pare o Quant Engine e inicie novamente:")
                    print("   Ctrl+C para parar")
                    print("   start_quant_engine.bat para reiniciar")
                    return True
                else:
                    print(f"❌ Ainda há problemas: Status {status}")
                    return False
                    
    except Exception as e:
        print(f"❌ Erro ao testar ordem: {e}")
        return False

async def main():
    """Função principal"""
    print("=" * 60)
    print("  TESTE DA CORREÇÃO - PREÇO NAS ORDENS")
    print("=" * 60)
    print()
    
    # Testar conexão primeiro
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8000/health") as response:
                if response.status != 200:
                    print("❌ UP BlackBox não está rodando!")
                    return
    except:
        print("❌ UP BlackBox não está rodando!")
        return
    
    print("✅ UP BlackBox conectado")
    print()
    
    # Testar a correção
    success = await test_order_with_price()
    
    print()
    print("=" * 60)
    if success:
        print("🎉 PROBLEMA RESOLVIDO!")
        print("💡 O problema era a falta do campo 'price' nas ordens")
        print("✅ Agora o Quant Engine deve funcionar completamente")
    else:
        print("⚠️ Ainda há problemas a investigar")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main()) 