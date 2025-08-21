#!/usr/bin/env python3
"""
Agrupador automático de ticks em candles
Converte ticks em tempo real para candles de 1 minuto
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Dict, Optional, List
from dataclasses import dataclass
from services.high_frequency.models import Tick
from services.high_frequency.persistence import get_db_pool

logger = logging.getLogger(__name__)

@dataclass
class CandleData:
    """Estrutura de dados para um candle."""
    symbol: str
    exchange: str
    open_time: datetime
    close_time: datetime
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    total_volume: int
    total_volume_financial: float
    tick_count: int
    last_update: float

class CandleAggregator:
    """Agrupa ticks em candles de 1 minuto automaticamente."""
    
    def __init__(self):
        self.current_candles: Dict[str, CandleData] = {}
        self.is_running = False
        self.aggregation_task: Optional[asyncio.Task] = None
        self.logger = logging.getLogger(f"{__name__}.CandleAggregator")
        
    def start(self):
        """Inicia o agrupador de candles."""
        if self.is_running:
            return
            
        self.is_running = True
        self.aggregation_task = asyncio.create_task(self._aggregation_loop())
        self.logger.info("CandleAggregator iniciado")
        
    def stop(self):
        """Para o agrupador de candles."""
        if not self.is_running:
            return
            
        self.is_running = False
        if self.aggregation_task:
            self.aggregation_task.cancel()
        self.logger.info("CandleAggregator parado")
        
    async def process_tick(self, tick: Tick):
        """Processa um tick e o agrupa no candle atual."""
        try:
            # Calcula o bucket de tempo (1 minuto)
            bucket_time = self._get_minute_bucket(tick.timestamp)
            candle_key = f"{tick.symbol}_{tick.exchange}"
            
            # Verifica se precisa criar novo candle
            if (candle_key not in self.current_candles or 
                self.current_candles[candle_key].open_time != bucket_time):
                
                # Fecha candle anterior se existir
                if candle_key in self.current_candles:
                    await self._close_and_save_candle(candle_key)
                
                # Cria novo candle
                self.current_candles[candle_key] = CandleData(
                    symbol=tick.symbol,
                    exchange=tick.exchange,
                    open_time=bucket_time,
                    close_time=bucket_time.replace(second=59, microsecond=999999),
                    open_price=tick.price,
                    high_price=tick.price,
                    low_price=tick.price,
                    close_price=tick.price,
                    total_volume=tick.volume,
                    total_volume_financial=tick.volume_financial or (tick.price * tick.volume),
                    tick_count=1,
                    last_update=time.time()
                )
            else:
                # Atualiza candle existente
                candle = self.current_candles[candle_key]
                candle.high_price = max(candle.high_price, tick.price)
                candle.low_price = min(candle.low_price, tick.price)
                candle.close_price = tick.price
                candle.total_volume += tick.volume
                candle.total_volume_financial += tick.volume_financial or (tick.price * tick.volume)
                candle.tick_count += 1
                candle.last_update = time.time()
                
        except Exception as e:
            self.logger.error(f"Erro ao processar tick para candle: {e}")
            
    def _get_minute_bucket(self, timestamp: float) -> datetime:
        """Converte timestamp para bucket de 1 minuto."""
        dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
        return dt.replace(second=0, microsecond=0)
        
    async def _close_and_save_candle(self, candle_key: str):
        """Fecha um candle e o salva no banco de dados."""
        try:
            candle = self.current_candles[candle_key]
            
            # Salva no banco
            await self._save_candle_to_db(candle)
            
            # Remove do dicionário de candles ativos
            del self.current_candles[candle_key]
            
            self.logger.debug(f"Candle fechado e salvo: {candle.symbol} {candle.open_time}")
            
        except Exception as e:
            self.logger.error(f"Erro ao fechar candle {candle_key}: {e}")
            
    async def _save_candle_to_db(self, candle: CandleData):
        """Salva um candle na tabela candles_1m."""
        try:
            db_pool = await get_db_pool()
            if not db_pool:
                self.logger.error("Pool de banco não disponível")
                return
                
            async with db_pool.connection() as conn:
                async with conn.cursor() as cur:
                    # Insere ou atualiza candle
                    query = """
                        INSERT INTO candles_1m 
                        (symbol, exchange, ts_minute_utc, o, h, l, c, v, vf)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ON CONFLICT (symbol, ts_minute_utc) 
                        DO UPDATE SET 
                            o = EXCLUDED.o,
                            h = EXCLUDED.h,
                            l = EXCLUDED.l,
                            c = EXCLUDED.c,
                            v = EXCLUDED.v,
                            vf = EXCLUDED.vf
                    """
                    
                    await cur.execute(query, (
                        candle.symbol,
                        candle.exchange,
                        candle.open_time,
                        candle.open_price,
                        candle.high_price,
                        candle.low_price,
                        candle.close_price,
                        candle.total_volume,
                        candle.total_volume_financial
                    ))
                    
                    await conn.commit()
                    
        except Exception as e:
            self.logger.error(f"Erro ao salvar candle no banco: {e}")
            
    async def _aggregation_loop(self):
        """Loop principal de agregação que roda a cada minuto."""
        while self.is_running:
            try:
                # Fecha todos os candles abertos que já passaram do minuto
                current_time = datetime.now(timezone.utc)
                current_minute = current_time.replace(second=0, microsecond=0)
                
                candles_to_close = []
                for key, candle in self.current_candles.items():
                    if candle.open_time < current_minute:
                        candles_to_close.append(key)
                
                # Fecha candles antigos
                for key in candles_to_close:
                    await self._close_and_save_candle(key)
                
                # Aguarda até o próximo minuto
                next_minute = current_minute.replace(minute=current_minute.minute + 1)
                wait_seconds = (next_minute - current_time).total_seconds()
                
                if wait_seconds > 0:
                    await asyncio.sleep(wait_seconds)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Erro no loop de agregação: {e}")
                await asyncio.sleep(1)
                
    def get_current_candle(self, symbol: str, exchange: str) -> Optional[CandleData]:
        """Retorna o candle atual para um símbolo."""
        candle_key = f"{symbol}_{exchange}"
        return self.current_candles.get(candle_key)
        
    def get_status(self) -> Dict:
        """Retorna status do agrupador."""
        return {
            'is_running': self.is_running,
            'active_candles_count': len(self.current_candles),
            'active_symbols': list(self.current_candles.keys())
        }

# Instância global do agrupador
candle_aggregator = CandleAggregator()
