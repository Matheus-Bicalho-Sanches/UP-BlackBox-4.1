#!/usr/bin/env python3
"""
Teste da API UP BlackBox - Diagnóstico de ordens
"""

import asyncio
import aiohttp
import json
from datetime import datetime

async def test_blackbox_connection():
    """Testa conexão básica com UP BlackBox"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("http://localhost:8000/health") as response:
                if response.status == 200:
                    print("✅ UP BlackBox API: Conectado")
                    return True
                else:
                    print(f"❌ UP BlackBox API: Erro {response.status}")
                    return False
    except Exception as e:
        print(f"❌ UP BlackBox API: Não conectou - {e}")
        return False

async def test_send_order():
    """Testa envio de ordem e mostra resposta detalhada"""
    try:
        # Dados da ordem de teste
        order_data = {
            "account_id": "MASTER",
            "strategy_id": "sua_estrategia_id_aqui",  # ← ALTERE ESTE VALOR
            "ticker": "WINQ25",
            "quantity": 1,
            "side": "buy",
            "exchange": "F",
            "order_type": "market",
            "price": 137700.00,  # Preço de referência para a ordem
            "reason": "[TESTE] Ordem de teste do Quant Engine"
        }
        
        print("🧪 TESTE DE ENVIO DE ORDEM")
        print("=" * 50)
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
                    print("✅ Ordem aceita pela API!")
                    print("🔍 Verifique se aparece na interface:")
                    print("   http://localhost:3000/dashboard/up-blackbox4/ordens")
                    return True
                else:
                    print(f"❌ Ordem rejeitada: Status {status}")
                    if "alocação" in response_text.lower():
                        print("💡 Problema: Configure alocações para esta estratégia")
                    elif "login" in response_text.lower():
                        print("💡 Problema: Faça login na corretora primeiro")
                    return False
                    
    except Exception as e:
        print(f"❌ Erro ao testar ordem: {e}")
        return False

async def test_get_strategies():
    """Lista estratégias disponíveis"""
    try:
        print("📋 ESTRATÉGIAS DISPONÍVEIS")
        print("=" * 50)
        
        async with aiohttp.ClientSession() as session:
            # Tentar diferentes endpoints
            endpoints_to_try = [
                "/strategies",
                "/estrategias", 
                "/allocations",
                "/alocacoes",
                "/status"
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    async with session.get(f"http://localhost:8000{endpoint}") as response:
                        if response.status == 200:
                            data = await response.text()
                            print(f"✅ {endpoint}: Disponível")
                            try:
                                json_data = json.loads(data)
                                if json_data:
                                    print(f"   Dados: {len(json_data)} item(s)")
                            except:
                                pass
                        else:
                            print(f"❌ {endpoint}: Status {response.status}")
                except:
                    print(f"❌ {endpoint}: Não disponível")
        
        print()
        
    except Exception as e:
        print(f"❌ Erro ao listar estratégias: {e}")

async def main():
    """Função principal"""
    print("=" * 60)
    print("  DIAGNÓSTICO DA API UP BLACKBOX")
    print("=" * 60)
    print()
    
    # Teste 1: Conexão básica
    print("🔍 Teste 1: Conexão básica")
    connection_ok = await test_blackbox_connection()
    print()
    
    if not connection_ok:
        print("❌ UP BlackBox não está rodando!")
        print("💡 Inicie com: cd 'UP BlackBox 4.0' && python main.py")
        return
    
    # Teste 2: Listar estratégias/endpoints
    print("🔍 Teste 2: Explorando API")
    await test_get_strategies()
    
    # Teste 3: Envio de ordem
    print("🔍 Teste 3: Envio de ordem de teste")
    print("⚠️ IMPORTANTE: Altere 'strategy_id' no código antes de executar!")
    print()
    
    # Comentado por segurança - usuário deve configurar strategy_id primeiro
    # await test_send_order()
    
    print("=" * 60)
    print("🔧 PRÓXIMOS PASSOS:")
    print("1. Verifique se UP BlackBox está logado na corretora")
    print("2. Configure alocações para sua estratégia")
    print("3. Altere strategy_id neste script e descomente test_send_order()")
    print("4. Execute novamente para testar ordem")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main()) 