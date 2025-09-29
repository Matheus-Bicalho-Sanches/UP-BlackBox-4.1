"""
Sistema de buffer para alta frequência
"""
import asyncio
import logging
import time
from collections import deque, defaultdict
from typing import Dict, Deque
from services.high_frequency.models import Tick, OrderBookEvent, OrderBookSnapshot, OrderBookOffer
from services.high_frequency.persistence import persist_ticks

logger = logging.getLogger(__name__)

# Estado global do buffer
buffer_queue: Dict[str, deque] = defaultdict(deque)
order_book_event_queue: Deque[OrderBookEvent] = deque()
order_book_snapshot_queue: Deque[OrderBookSnapshot] = deque()
order_book_offer_queue: Deque[OrderBookOffer] = deque()
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
            # ✅ CORRIGIDO: Cria uma cópia segura da lista de símbolos para evitar erro de iteração
            symbols_to_process = list(buffer_queue.keys())
            
            # Processa cada símbolo
            for symbol in symbols_to_process:
                tick_queue = buffer_queue.get(symbol)
                if tick_queue and len(tick_queue) > 0:
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


def enqueue_order_book_event(event: OrderBookEvent):
    order_book_event_queue.append(event)


def enqueue_order_book_snapshot(snapshot: OrderBookSnapshot):
    order_book_snapshot_queue.append(snapshot)


def enqueue_order_book_offer(offer: OrderBookOffer):
    order_book_offer_queue.append(offer)
    logger.debug(f"📥 Enqueued offer: {offer.symbol} action={offer.action} side={offer.side} agent={offer.agent_id} (queue size: {len(order_book_offer_queue)})")


async def start_order_book_event_processor(process_event):
    """Processa eventos incrementais do livro de ofertas."""
    logger.info("Iniciando processador de eventos de order book...")
    while True:
        if order_book_event_queue:
            event = order_book_event_queue.popleft()
            try:
                await process_event(event)
            except Exception as exc:
                logger.error(f"Erro ao processar evento de order book: {exc}")
        else:
            await asyncio.sleep(0.01)


async def start_order_book_snapshot_processor(process_snapshot):
    """Processa snapshots agregados do livro de ofertas."""
    logger.info("Iniciando processador de snapshots de order book...")
    while True:
        if order_book_snapshot_queue:
            snapshot = order_book_snapshot_queue.popleft()
            try:
                await process_snapshot(snapshot)
            except Exception as exc:
                logger.error(f"Erro ao processar snapshot de order book: {exc}")
        else:
            await asyncio.sleep(0.05)


async def start_order_book_offer_processor(process_offer):
    """Processa eventos individuais de ofertas (por agente)."""
    logger.info("🚀 Iniciando processador de ofertas de order book...")
    processed_count = 0
    while True:
        if order_book_offer_queue:
            offer = order_book_offer_queue.popleft()
            try:
                await process_offer(offer)
                processed_count += 1
                if processed_count % 100 == 0:
                    logger.info(f"📊 Processadas {processed_count} ofertas de order book")
            except Exception as exc:
                logger.error(f"❌ Erro ao processar oferta de order book: {exc}")
        else:
            await asyncio.sleep(0.01)
