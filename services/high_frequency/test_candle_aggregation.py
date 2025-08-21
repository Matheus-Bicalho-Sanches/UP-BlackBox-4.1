#!/usr/bin/env python3
"""
Script para testar a agregação automática de candles
"""

import asyncio
import time
import random
from datetime import datetime, timezone
from services.high_frequency.models import Tick
from services.high_frequency.candle_aggregator import candle_aggregator
from services.high_frequency.persistence import get_db_pool

async def test_candle_aggregation():
    """Testa a agregação de candles com dados simulados."""
    print("🧪 TESTANDO AGREGAÇÃO AUTOMÁTICA DE CANDLES")
    print("=" * 60)
    
    # Inicia o agrupador
    candle_aggregator.start()
    print("✅ Agrupador de candles iniciado")
    
    # Simula ticks para PETR4
    symbol = "PETR4"
    exchange = "B"
    base_price = 35.50
    
    print(f"📈 Simulando ticks para {symbol}...")
    
    # Simula 100 ticks ao longo de 2 minutos
    for i in range(100):
        # Timestamp atual + variação
        timestamp = time.time() + (i * 0.1)  # 0.1 segundos entre ticks
        
        # Preço com variação aleatória
        price_change = random.uniform(-0.05, 0.05)
        price = base_price + price_change
        
        # Volume aleatório
        volume = random.randint(100, 1000)
        
        # Cria tick
        tick = Tick(
            symbol=symbol,
            exchange=exchange,
            price=price,
            volume=volume,
            timestamp=timestamp,
            trade_id=i,
            volume_financial=price * volume
        )
        
        # Processa tick
        await candle_aggregator.process_tick(tick)
        
        # Aguarda um pouco
        await asyncio.sleep(0.01)
        
        if (i + 1) % 20 == 0:
            print(f"   Processados {i + 1} ticks...")
    
    print("✅ Ticks simulados processados")
    
    # Aguarda um pouco para processamento
    print("⏳ Aguardando processamento...")
    await asyncio.sleep(5)
    
    # Verifica status
    status = candle_aggregator.get_status()
    print(f"📊 Status do agrupador: {status}")
    
    # Verifica candle atual
    current_candle = candle_aggregator.get_current_candle(symbol, exchange)
    if current_candle:
        print(f"🕯️  Candle atual para {symbol}:")
        print(f"   Abertura: {current_candle.open_price:.2f}")
        print(f"   Máximo: {current_candle.high_price:.2f}")
        print(f"   Mínimo: {current_candle.low_price:.2f}")
        print(f"   Fechamento: {current_candle.close_price:.2f}")
        print(f"   Volume: {current_candle.total_volume}")
        print(f"   Ticks: {current_candle.tick_count}")
    
    # Verifica dados no banco
    print("\n🗄️  Verificando dados no banco...")
    try:
        db_pool = await get_db_pool()
        if db_pool:
            async with db_pool.connection() as conn:
                async with conn.cursor() as cur:
                    # Verifica candles salvos
                    await cur.execute("""
                        SELECT COUNT(*) FROM candles_1m 
                        WHERE symbol = %s
                    """, (symbol,))
                    candles_count = (await cur.fetchone())[0]
                    print(f"   Candles salvos na tabela candles_1m: {candles_count}")
                    
                    # Verifica ticks salvos
                    await cur.execute("""
                        SELECT COUNT(*) FROM ticks_raw 
                        WHERE symbol = %s
                    """, (symbol,))
                    ticks_count = (await cur.fetchone())[0]
                    print(f"   Ticks salvos na tabela ticks_raw: {ticks_count}")
                    
                    # Mostra últimos candles
                    if candles_count > 0:
                        await cur.execute("""
                            SELECT ts_minute_utc, o, h, l, c, v, vf
                            FROM candles_1m 
                            WHERE symbol = %s
                            ORDER BY ts_minute_utc DESC
                            LIMIT 3
                        """, (symbol,))
                        recent_candles = await cur.fetchall()
                        print(f"   Últimos 3 candles:")
                        for candle in recent_candles:
                            ts, o, h, l, c, v, vf = candle
                            print(f"     {ts}: O:{o:.2f} H:{h:.2f} L:{l:.2f} C:{c:.2f} V:{v} VF:{vf:.2f}")
        
    except Exception as e:
        print(f"❌ Erro ao verificar banco: {e}")
    
    # Para o agrupador
    candle_aggregator.stop()
    print("\n✅ Teste concluído!")

async def main():
    """Função principal."""
    try:
        await test_candle_aggregation()
    except Exception as e:
        print(f"❌ Erro no teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
