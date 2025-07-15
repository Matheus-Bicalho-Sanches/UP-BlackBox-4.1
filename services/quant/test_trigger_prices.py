#!/usr/bin/env python3
"""
Teste dos Preços de Gatilho - Demonstra a nova lógica de preços
"""

import asyncio
import aiohttp
import json

def simulate_bollinger_scenario():
    """Simula um cenário com Bandas de Bollinger para demonstrar os preços"""
    
    # Dados simulados das Bandas de Bollinger
    bands = {
        'upper': 137850.00,   # Banda Superior
        'middle': 137700.00,  # Média (SMA)
        'lower': 137550.00    # Banda Inferior
    }
    
    # Cenários de preços de mercado
    scenarios = [
        {
            'market_price': 137680.00,  # Abaixo da média
            'description': 'Preço < Média BB',
            'expected_signal': 'COMPRA',
            'trigger_price': bands['middle'],  # Ordem na média
            'order_type': 'buy'
        },
        {
            'market_price': 137520.00,  # Abaixo da banda inferior
            'description': 'Preço < Banda Inferior',
            'expected_signal': 'COMPRA ADICIONAL',
            'trigger_price': bands['lower'],  # Ordem na banda inferior
            'order_type': 'buy'
        },
        {
            'market_price': 137720.00,  # Acima da média
            'description': 'Preço > Média BB',
            'expected_signal': 'VENDA (Fechamento)',
            'trigger_price': bands['middle'],  # Ordem na média
            'order_type': 'sell'
        }
    ]
    
    print("🎯 DEMONSTRAÇÃO DOS PREÇOS DE GATILHO")
    print("=" * 60)
    print(f"📊 Bandas de Bollinger Simuladas:")
    print(f"   Banda Superior: {bands['upper']:.2f}")
    print(f"   Média (SMA):    {bands['middle']:.2f}")
    print(f"   Banda Inferior: {bands['lower']:.2f}")
    print()
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"📈 Cenário {i}: {scenario['description']}")
        print(f"   Preço de Mercado: {scenario['market_price']:.2f}")
        print(f"   Sinal: {scenario['expected_signal']}")
        print(f"   Preço da Ordem: {scenario['trigger_price']:.2f} (gatilho)")
        print(f"   Diferença: {abs(scenario['market_price'] - scenario['trigger_price']):.2f} pontos")
        print()
    
    return scenarios[0]  # Retorna o primeiro cenário para teste

async def test_trigger_price_order():
    """Testa uma ordem com preço de gatilho"""
    try:
        # Simular cenário
        scenario = simulate_bollinger_scenario()
        
        # Ordem de teste com preço de gatilho
        order_data = {
            "account_id": "MASTER",
            "strategy_id": "master-teste",
            "ticker": "WINQ25",
            "quantity": 1,
            "side": scenario['order_type'],
            "exchange": "F",
            "order_type": "market",
            "price": scenario['trigger_price'],  # Preço de gatilho
            "reason": f"[TESTE GATILHO] {scenario['description']} - Mercado: {scenario['market_price']:.2f}"
        }
        
        print("🧪 TESTE DE ORDEM COM PREÇO DE GATILHO")
        print("=" * 60)
        print("📊 Dados da ordem:")
        print(json.dumps(order_data, indent=2))
        print()
        print(f"💡 Lógica: {scenario['expected_signal']}")
        print(f"   • Preço de Mercado: {scenario['market_price']:.2f}")
        print(f"   • Preço da Ordem: {scenario['trigger_price']:.2f}")
        print(f"   • Estratégia: Usar preço de gatilho, não mercado")
        print()
        
        # Comentado por segurança - demonstração apenas
        print("⚠️ TESTE DEMONSTRATIVO - Ordem não será enviada")
        print("💡 Para testar de verdade, descomente as linhas abaixo:")
        print()
        
        """
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "http://localhost:8000/order",
                json=order_data,
                headers={"Content-Type": "application/json"}
            ) as response:
                status = response.status
                response_text = await response.text()
                
                print(f"📡 Status HTTP: {status}")
                print(f"📄 Resposta: {response_text}")
                
                if status == 200:
                    print("✅ Ordem aceita com preço de gatilho!")
                else:
                    print(f"❌ Problema: {status}")
        """
        
        return True
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return False

async def main():
    """Função principal"""
    print("=" * 70)
    print("  DEMONSTRAÇÃO: PREÇOS DE GATILHO NAS ORDENS")
    print("=" * 70)
    print()
    print("🎯 NOVA FUNCIONALIDADE:")
    print("   As ordens agora usam preços das Bandas de Bollinger como gatilho,")
    print("   não o preço atual de mercado.")
    print()
    print("✅ VANTAGENS:")
    print("   • Ordens mais precisas baseadas na estratégia")
    print("   • Execução nos níveis técnicos corretos")
    print("   • Melhor controle de risco")
    print()
    
    await test_trigger_price_order()
    
    print("=" * 70)
    print("🚀 PRÓXIMOS PASSOS:")
    print("1. Pare o Quant Engine atual (Ctrl+C)")
    print("2. Reinicie: start_quant_engine.bat")
    print("3. Observe os novos logs com preços de gatilho")
    print()
    print("📋 LOGS ESPERADOS:")
    print("✅ Ordem REAL enviada: buy 1 WINQ25 @ 137700.00 (gatilho) | Mercado: 137680.00")
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(main()) 