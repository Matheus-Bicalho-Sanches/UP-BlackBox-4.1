"""
Sistema de buffer para alta frequência
"""
import asyncio
import logging
import time
from collections import deque, defaultdict
from typing import Dict, List, Optional
from services.high_frequency.models import Tick
from services.high_frequency.persistence import persist_ticks

logger = logging.getLogger(__name__)

# Estado global do buffer
buffer_queue: Dict[str, deque] = defaultdict(deque)
subscriptions: Dict[str, dict] = {}
tick_counters: Dict[str, int] = defaultdict(int)

# Configurações
BATCH_SIZE = 1000
BATCH_TIMEOUT_MS = 100

async def start_buffer_processor(db_pool):
    """Inicia o processador de buffer principal."""
    logger.info("Iniciando processador de buffer...")
    
    while True:
        try:
            # Processa cada símbolo
            for symbol, tick_queue in buffer_queue.items():
                if tick_queue:
                    # Coleta ticks para processar
                    ticks_to_process = []
                    for _ in range(min(BATCH_SIZE, len(tick_queue))):
                        if tick_queue:
                            ticks_to_process.append(tick_queue.popleft())
                    
                    if ticks_to_process:
                        # Persiste no banco
                        await persist_ticks(ticks_to_process, db_pool)
                        tick_counters[symbol] += len(ticks_to_process)
                        
                        logger.debug(f"Processados {len(ticks_to_process)} ticks para {symbol}")
            
            # Espera um pouco antes da próxima iteração
            await asyncio.sleep(BATCH_TIMEOUT_MS / 1000.0)
            
        except Exception as e:
            logger.error(f"Erro no processador de buffer: {e}")
            await asyncio.sleep(1)

def add_tick_to_buffer(tick: Tick):
    """Adiciona um tick ao buffer."""
    buffer_queue[tick.symbol].append(tick)
    
def get_buffer_status():
    """Retorna status do buffer."""
    return {
        'symbols': len(buffer_queue),
        'total_queued': sum(len(queue) for queue in buffer_queue.values()),
        'tick_counters': dict(tick_counters)
    }
