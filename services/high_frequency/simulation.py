"""
Simulação de ticks para teste
"""
import asyncio
import logging
import time
import random
from services.high_frequency.models import Tick
from services.high_frequency.buffer import add_tick_to_buffer

logger = logging.getLogger(__name__)

async def simulate_ticks():
    """Simula ticks para teste do sistema."""
    logger.info("Iniciando simulação de ticks...")
    
    # Símbolos de teste
    test_symbols = ["PETR4", "VALE3", "ITUB4", "BBDC4", "ABEV3"]
    
    while True:
        try:
            for symbol in test_symbols:
                # Simula tick com dados realistas
                tick = Tick(
                    symbol=symbol,
                    exchange="B",
                    price=random.uniform(10.0, 100.0),
                    volume=random.randint(100, 10000),
                    timestamp=time.time(),
                    trade_id=random.randint(1, 1000000),
                    buy_agent=random.randint(1, 999),
                    sell_agent=random.randint(1, 999),
                    trade_type=random.choice([2, 3]),  # 2=Comprador, 3=Vendedor
                    volume_financial=random.uniform(1000.0, 100000.0),
                    is_edit=random.choice([True, False])
                )
                
                # Adiciona ao buffer
                add_tick_to_buffer(tick)
                
                # Pequena pausa entre ticks
                await asyncio.sleep(0.001)  # 1ms
            
            # Pausa entre ciclos
            await asyncio.sleep(0.05)  # 50ms
            
        except Exception as e:
            logger.error(f"Erro na simulação de ticks: {e}")
            await asyncio.sleep(1)
