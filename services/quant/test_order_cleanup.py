"""
Script para Teste e Limpeza de Ordens
=====================================
Teste das correções do sistema de ordens limitadas e limpeza de ordens duplicadas.
"""

import asyncio
import aiohttp
import json
from datetime import datetime

async def test_blackbox_orders():
    """Testa conexão com BlackBox e lista ordens ativas"""
    blackbox_url = "http://localhost:8000"
    
    try:
        async with aiohttp.ClientSession() as session:
            # Listar todas as ordens ativas
            async with session.get(f"{blackbox_url}/orders") as response:
                if response.status == 200:
                    orders = await response.json()
                    print(f"📋 Ordens ativas na BlackBox: {len(orders)}")
                    
                    for order in orders:
                        print(f"  • ID: {order.get('id', 'N/A')} | "
                              f"Tipo: {order.get('side', 'N/A')} | "
                              f"Ticker: {order.get('ticker', 'N/A')} | "
                              f"Preço: {order.get('price', 'N/A')} | "
                              f"Status: {order.get('status', 'N/A')}")
                    
                    return orders
                else:
                    print(f"❌ Erro ao listar ordens: {response.status}")
                    return []
    except Exception as e:
        print(f"❌ Erro de conexão: {e}")
        return []

async def cancel_all_orders():
    """Cancela todas as ordens ativas (CUIDADO!)"""
    print("⚠️ ATENÇÃO: Este comando cancelará TODAS as ordens ativas!")
    confirm = input("Digite 'CONFIRMAR' para continuar: ")
    
    if confirm != "CONFIRMAR":
        print("❌ Operação cancelada")
        return
    
    blackbox_url = "http://localhost:8000"
    
    try:
        # Primeiro, listar todas as ordens
        orders = await test_blackbox_orders()
        
        if not orders:
            print("✅ Nenhuma ordem ativa para cancelar")
            return
        
        async with aiohttp.ClientSession() as session:
            cancelled_count = 0
            
            for order in orders:
                order_id = order.get('id')
                if order_id:
                    async with session.delete(f"{blackbox_url}/order/{order_id}") as response:
                        if response.status == 200:
                            print(f"✅ Ordem cancelada: {order_id}")
                            cancelled_count += 1
                        else:
                            print(f"❌ Erro ao cancelar ordem {order_id}: {response.status}")
            
            print(f"📊 Total de ordens canceladas: {cancelled_count}")
            
    except Exception as e:
        print(f"❌ Erro ao cancelar ordens: {e}")

def test_order_id_generation():
    """Testa geração de IDs únicos"""
    print("🧪 Testando geração de IDs únicos:")
    
    # Simular diferentes cenários de ID
    strategy_id = "test_strategy_123"
    
    for i in range(5):
        # Gerar ID como no código
        order_id = f"QUANT_{strategy_id}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        print(f"  • ID {i+1}: {order_id}")
        
        # Pequeno delay para diferenciação
        import time
        time.sleep(0.001)

def show_improvements():
    """Mostra as melhorias implementadas"""
    print("=" * 60)
    print("🔧 MELHORIAS IMPLEMENTADAS:")
    print("=" * 60)
    print()
    print("1. 🆔 GERAÇÃO DE IDs ÚNICOS:")
    print("   • Se API retornar ID inválido/vazio, gera ID único")
    print("   • Formato: QUANT_{strategy_id}_{timestamp_microsegundos}")
    print("   • Garante rastreamento mesmo com falhas de API")
    print()
    print("2. 🔍 VERIFICAÇÃO ROBUSTA DE ORDENS:")
    print("   • Verifica preço, lado E quantidade da ordem")
    print("   • Só atualiza se diferença > R$ 0,50")
    print("   • Logs detalhados para debug")
    print()
    print("3. ✅ PREVENÇÃO DE ORDENS DUPLICADAS:")
    print("   • Registra ordem no sistema SEMPRE que envia")
    print("   • Verifica ordens ativas antes de enviar nova")
    print("   • Return early se ordem já está correta")
    print()
    print("4. 📊 LOGS MELHORADOS:")
    print("   • Status detalhado das ordens ativas")
    print("   • Debug com contadores de ordens")
    print("   • Logs específicos para cada tipo de mudança")
    print()
    print("=" * 60)

async def main():
    """Menu principal"""
    print("🛠️ SCRIPT DE TESTE E LIMPEZA DE ORDENS")
    print("=" * 60)
    print()
    print("Escolha uma opção:")
    print("1 - Listar ordens ativas na BlackBox")
    print("2 - Cancelar TODAS as ordens (CUIDADO!)")
    print("3 - Testar geração de IDs únicos")
    print("4 - Mostrar melhorias implementadas")
    print("0 - Sair")
    print()
    
    choice = input("Digite sua escolha: ")
    
    if choice == "1":
        await test_blackbox_orders()
    elif choice == "2":
        await cancel_all_orders()
    elif choice == "3":
        test_order_id_generation()
    elif choice == "4":
        show_improvements()
    elif choice == "0":
        print("👋 Saindo...")
    else:
        print("❌ Opção inválida")

if __name__ == "__main__":
    asyncio.run(main()) 