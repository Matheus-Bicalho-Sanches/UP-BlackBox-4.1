"""
Test Script for High Frequency Market Data System
================================================
Script para testar e validar o sistema de alta frequência.
"""

import asyncio
import aiohttp
import time
import json
from datetime import datetime

# Configuração
BASE_URL = "http://localhost:8002"
TEST_SYMBOLS = ["PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3"]

async def test_endpoint(session: aiohttp.ClientSession, endpoint: str, method: str = "GET", data: dict = None):
    """Testa um endpoint específico."""
    try:
        url = f"{BASE_URL}{endpoint}"
        
        if method == "GET":
            async with session.get(url) as response:
                result = await response.json()
                print(f"✅ {method} {endpoint}: {response.status}")
                return result
        elif method == "POST":
            async with session.post(url, json=data) as response:
                result = await response.json()
                print(f"✅ {method} {endpoint}: {response.status}")
                return result
                
    except Exception as e:
        print(f"❌ {method} {endpoint}: {e}")
        return None

async def test_subscribe_symbols(session: aiohttp.ClientSession):
    """Testa inscrição em símbolos."""
    print("\n🔔 Testando inscrição em símbolos...")
    
    for symbol in TEST_SYMBOLS:
        data = {"symbol": symbol, "exchange": "B"}
        result = await test_endpoint(session, "/subscribe", "POST", data)
        
        if result and result.get("success"):
            print(f"   📈 {symbol}: Inscrito com sucesso")
        else:
            print(f"   ❌ {symbol}: Falha na inscrição")
        
        await asyncio.sleep(0.1)  # Pequena pausa

async def test_get_subscriptions(session: aiohttp.ClientSession):
    """Testa obtenção de assinaturas ativas."""
    print("\n📋 Testando obtenção de assinaturas...")
    
    result = await test_endpoint(session, "/subscriptions")
    
    if result and result.get("success"):
        subscriptions = result.get("subscriptions", [])
        print(f"   📊 Total de assinaturas: {len(subscriptions)}")
        
        for sub in subscriptions:
            symbol = sub.get("symbol")
            total_ticks = sub.get("total_ticks", 0)
            last_price = sub.get("last_price", 0)
            print(f"      {symbol}: {total_ticks} ticks, último preço: R$ {last_price:.2f}")
    else:
        print("   ❌ Falha ao obter assinaturas")

async def test_get_ticks(session: aiohttp.ClientSession):
    """Testa obtenção de ticks."""
    print("\n📈 Testando obtenção de ticks...")
    
    for symbol in TEST_SYMBOLS[:2]:  # Testa apenas 2 símbolos
        result = await test_endpoint(session, f"/ticks/{symbol}?timeframe=raw&limit=100")
        
        if result and result.get("success"):
            ticks = result.get("ticks", [])
            print(f"   📊 {symbol}: {len(ticks)} ticks obtidos")
            
            if ticks:
                latest_tick = ticks[0]
                price = latest_tick.get("price", 0)
                volume = latest_tick.get("volume", 0)
                timestamp = latest_tick.get("timestamp", 0)
                time_str = datetime.fromtimestamp(timestamp).strftime("%H:%M:%S")
                print(f"      Último: R$ {price:.2f}, Volume: {volume}, Hora: {time_str}")
        else:
            print(f"   ❌ {symbol}: Falha ao obter ticks")
        
        await asyncio.sleep(0.1)

async def test_get_candles(session: aiohttp.ClientSession):
    """Testa obtenção de candles consolidados."""
    print("\n🕯️ Testando obtenção de candles...")
    
    timeframes = ["1s", "5s", "15s", "1m"]
    
    for symbol in TEST_SYMBOLS[:2]:  # Testa apenas 2 símbolos
        for timeframe in timeframes:
            result = await test_endpoint(session, f"/ticks/{symbol}?timeframe={timeframe}")
            
            if result and result.get("success"):
                candle = result.get("candle", {})
                if candle:
                    open_price = candle.get("open_price", 0)
                    close_price = candle.get("close_price", 0)
                    volume = candle.get("total_volume", 0)
                    tick_count = candle.get("tick_count", 0)
                    print(f"   📊 {symbol} {timeframe}: O={open_price:.2f}, C={close_price:.2f}, V={volume}, Ticks={tick_count}")
                else:
                    print(f"   ⚠️ {symbol} {timeframe}: Sem dados disponíveis")
            else:
                print(f"   ❌ {symbol} {timeframe}: Falha ao obter candle")
            
            await asyncio.sleep(0.05)  # Pausa menor

async def test_system_status(session: aiohttp.ClientSession):
    """Testa status do sistema."""
    print("\n🔍 Testando status do sistema...")
    
    result = await test_endpoint(session, "/status")
    
    if result and result.get("success"):
        active_count = result.get("active_subscriptions_count", 0)
        buffer_status = result.get("buffer_status", {})
        persistence_status = result.get("persistence_status", {})
        
        print(f"   📊 Assinaturas ativas: {active_count}")
        print(f"   🧠 Buffer: {buffer_status.get('is_running', False)}")
        print(f"   💾 Persistência: {persistence_status.get('is_running', False)}")
        
        if buffer_status:
            symbols_count = buffer_status.get("symbols_count", 0)
            total_ticks = buffer_status.get("total_ticks_buffered", 0)
            memory_mb = buffer_status.get("memory_usage_mb", 0)
            print(f"      Símbolos: {symbols_count}, Ticks: {total_ticks}, Memória: {memory_mb:.1f} MB")
        
        if persistence_status:
            pending_ticks = persistence_status.get("tick_batches_pending", 0)
            pending_candles = persistence_status.get("candle_batches_pending", 0)
            print(f"      Ticks pendentes: {pending_ticks}, Candles pendentes: {pending_candles}")
    else:
        print("   ❌ Falha ao obter status")

async def test_performance_metrics(session: aiohttp.ClientSession):
    """Testa métricas de performance."""
    print("\n⚡ Testando métricas de performance...")
    
    result = await test_endpoint(session, "/metrics")
    
    if result and result.get("success"):
        buffer_metrics = result.get("buffer_metrics", {})
        persistence_metrics = result.get("persistence_metrics", {})
        
        print("   📊 Buffer Metrics:")
        total_processed = buffer_metrics.get("total_ticks_processed", 0)
        latency_ms = buffer_metrics.get("processing_latency_ms", 0)
        errors = buffer_metrics.get("errors_count", 0)
        print(f"      Ticks processados: {total_processed}")
        print(f"      Latência: {latency_ms:.2f} ms")
        print(f"      Erros: {errors}")
        
        print("   💾 Persistence Metrics:")
        total_persisted = persistence_metrics.get("total_ticks_persisted", 0)
        batch_count = persistence_metrics.get("batch_count", 0)
        avg_batch_time = persistence_metrics.get("average_batch_time_ms", 0)
        print(f"      Ticks persistidos: {total_persisted}")
        print(f"      Lotes processados: {batch_count}")
        print(f"      Tempo médio por lote: {avg_batch_time:.2f} ms")
    else:
        print("   ❌ Falha ao obter métricas")

async def test_unsubscribe_symbols(session: aiohttp.ClientSession):
    """Testa cancelamento de inscrições."""
    print("\n🚫 Testando cancelamento de inscrições...")
    
    for symbol in TEST_SYMBOLS:
        data = {"symbol": symbol}
        result = await test_endpoint(session, "/unsubscribe", "POST", data)
        
        if result and result.get("success"):
            print(f"   ✅ {symbol}: Inscrição cancelada")
        else:
            print(f"   ❌ {symbol}: Falha ao cancelar inscrição")
        
        await asyncio.sleep(0.1)

async def run_performance_test(session: aiohttp.ClientSession):
    """Executa teste de performance."""
    print("\n🚀 Executando teste de performance...")
    
    # Inscreve em todos os símbolos
    await test_subscribe_symbols(session)
    
    # Aguarda alguns segundos para acumular dados
    print("   ⏳ Aguardando 5 segundos para acumular dados...")
    await asyncio.sleep(5)
    
    # Testa endpoints de dados
    await test_get_subscriptions(session)
    await test_get_ticks(session)
    await test_get_candles(session)
    await test_system_status(session)
    await test_performance_metrics(session)
    
    # Cancela inscrições
    await test_unsubscribe_symbols(session)

async def main():
    """Função principal de teste."""
    print("🚀 High Frequency Market Data System - Test Suite")
    print("=" * 60)
    print(f"📡 Testando backend em: {BASE_URL}")
    print(f"⏰ Início: {datetime.now().strftime('%H:%M:%S')}")
    
    # Testa conectividade básica
    print("\n🔌 Testando conectividade básica...")
    
    async with aiohttp.ClientSession() as session:
        # Teste de conectividade
        test_result = await test_endpoint(session, "/test")
        if not test_result or not test_result.get("success"):
            print("❌ Backend não está respondendo. Verifique se está rodando na porta 8002.")
            return
        
        print("✅ Backend está respondendo!")
        
        # Executa testes
        await run_performance_test(session)
    
    print(f"\n⏰ Fim: {datetime.now().strftime('%H:%M:%S')}")
    print("🎉 Teste concluído!")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⏹️ Teste interrompido pelo usuário")
    except Exception as e:
        print(f"\n❌ Erro durante o teste: {e}")
    
    input("\nPressione Enter para sair...")
