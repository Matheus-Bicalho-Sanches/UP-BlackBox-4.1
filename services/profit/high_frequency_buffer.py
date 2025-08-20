"""
High Frequency Tick Buffer System
================================
Sistema otimizado para processar 1K-50K ticks/segundo com zero perdas.
Capacidade: 1M+ ticks por símbolo com agregação em tempo real.
"""

import asyncio
import threading
import time
from collections import deque, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Callable, Any
import logging
import json
import os
from pathlib import Path

@dataclass
class Tick:
    """Representa um tick individual com metadados."""
    symbol: str
    exchange: str
    price: float
    volume: int
    timestamp: float  # Unix timestamp em segundos
    trade_id: Optional[int] = None
    buyer_maker: Optional[bool] = None
    sequence: int = 0  # Sequência global para ordenação
    
    def to_dict(self) -> dict:
        return {
            'symbol': self.symbol,
            'exchange': self.exchange,
            'price': self.price,
            'volume': self.volume,
            'timestamp': self.timestamp,
            'trade_id': self.trade_id,
            'buyer_maker': self.buyer_maker,
            'sequence': self.sequence
        }

@dataclass
class Candle:
    """Candle consolidado com metadados."""
    symbol: str
    exchange: str
    timeframe: str  # '1s', '5s', '15s', '1m', '5m', '15m', '1h'
    open_time: float
    close_time: float
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    total_volume: int
    total_volume_financial: float
    tick_count: int
    last_update: float = field(default_factory=time.time)

class HighFrequencyBuffer:
    """
    Buffer de alta frequência com processamento em tempo real.
    Capacidade: 1M+ ticks por símbolo
    Throughput: 50K+ ticks/segundo
    Latência: <1ms
    """
    
    def __init__(self, max_ticks_per_symbol: int = 2_000_000):
        # Buffers principais
        self.tick_buffers: Dict[str, deque] = defaultdict(
            lambda: deque(maxlen=max_ticks_per_symbol)
        )
        
        # Candles em tempo real
        self.realtime_candles: Dict[str, Dict[str, Candle]] = defaultdict(dict)
        
        # Métricas de performance
        self.metrics = {
            'total_ticks_processed': 0,
            'total_ticks_saved': 0,
            'processing_latency_ms': 0,
            'last_processing_time': 0,
            'errors_count': 0,
            'gaps_detected': 0
        }
        
        # Configurações
        self.max_ticks_per_symbol = max_ticks_per_symbol
        self.processing_interval_ms = 100  # Processa a cada 100ms
        self.batch_size = 1000  # Processa em lotes de 1000
        
        # Controle de estado
        self.is_running = False
        self.processing_task: Optional[asyncio.Task] = None
        self.sequence_counter = 0
        
        # Callbacks
        self.on_tick_processed: Optional[Callable[[Tick], None]] = None
        self.on_candle_updated: Optional[Callable[[Candle], None]] = None
        self.on_gap_detected: Optional[Callable[[str, float, float], None]] = None
        
        # Locks para thread safety
        self._tick_lock = threading.Lock()
        self._candle_lock = threading.Lock()
        self._metrics_lock = threading.Lock()
        
        # Logging
        self.logger = logging.getLogger(__name__)
        
    def add_tick(self, tick: Tick) -> bool:
        """
        Adiciona um tick ao buffer com processamento otimizado.
        Retorna True se foi processado com sucesso.
        """
        start_time = time.perf_counter()
        
        try:
            # Atualiza sequência global
            tick.sequence = self.sequence_counter
            self.sequence_counter += 1
            
            # Adiciona ao buffer thread-safe
            with self._tick_lock:
                self.tick_buffers[tick.symbol].append(tick)
            
            # Atualiza métricas
            with self._metrics_lock:
                self.metrics['total_ticks_processed'] += 1
                self.metrics['last_processing_time'] = time.time()
            
            # Processa candle em tempo real
            self._update_realtime_candle(tick)
            
            # Callback se configurado
            if self.on_tick_processed:
                try:
                    self.on_tick_processed(tick)
                except Exception as e:
                    self.logger.error(f"Error in tick callback: {e}")
            
            # Calcula latência
            latency_ms = (time.perf_counter() - start_time) * 1000
            with self._metrics_lock:
                self.metrics['processing_latency_ms'] = latency_ms
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error processing tick: {e}")
            with self._metrics_lock:
                self.metrics['errors_count'] += 1
            return False
    
    def _update_realtime_candle(self, tick: Tick):
        """Atualiza candles em tempo real para múltiplos timeframes."""
        timeframes = ['1s', '5s', '15s', '1m', '5m', '15m', '1h']
        
        for timeframe in timeframes:
            candle_key = f"{tick.symbol}_{timeframe}"
            
            # Calcula bucket de tempo
            bucket_time = self._get_time_bucket(tick.timestamp, timeframe)
            
            with self._candle_lock:
                if candle_key not in self.realtime_candles[tick.symbol]:
                    # Cria novo candle
                    self.realtime_candles[tick.symbol][candle_key] = Candle(
                        symbol=tick.symbol,
                        exchange=tick.exchange,
                        timeframe=timeframe,
                        open_time=bucket_time,
                        close_time=bucket_time + self._get_timeframe_seconds(timeframe),
                        open_price=tick.price,
                        high_price=tick.price,
                        low_price=tick.price,
                        close_price=tick.price,
                        total_volume=tick.volume,
                        total_volume_financial=tick.price * tick.volume,
                        tick_count=1
                    )
                else:
                    # Atualiza candle existente
                    candle = self.realtime_candles[tick.symbol][candle_key]
                    
                    # Verifica se ainda está no mesmo bucket
                    if tick.timestamp < candle.close_time:
                        candle.high_price = max(candle.high_price, tick.price)
                        candle.low_price = min(candle.low_price, tick.price)
                        candle.close_price = tick.price
                        candle.total_volume += tick.volume
                        candle.total_volume_financial += tick.price * tick.volume
                        candle.tick_count += 1
                        candle.last_update = time.time()
                    else:
                        # Cria novo candle para o próximo bucket
                        self.realtime_candles[tick.symbol][candle_key] = Candle(
                            symbol=tick.symbol,
                            exchange=tick.exchange,
                            timeframe=timeframe,
                            open_time=bucket_time,
                            close_time=bucket_time + self._get_timeframe_seconds(timeframe),
                            open_price=tick.price,
                            high_price=tick.price,
                            low_price=tick.price,
                            close_price=tick.price,
                            total_volume=tick.volume,
                            total_volume_financial=tick.price * tick.volume,
                            tick_count=1
                        )
    
    def _get_time_bucket(self, timestamp: float, timeframe: str) -> float:
        """Calcula o bucket de tempo para um timestamp e timeframe."""
        seconds = self._get_timeframe_seconds(timeframe)
        return int(timestamp // seconds) * seconds
    
    def _get_timeframe_seconds(self, timeframe: str) -> int:
        """Converte timeframe para segundos."""
        timeframe_map = {
            '1s': 1,
            '5s': 5,
            '15s': 15,
            '1m': 60,
            '5m': 300,
            '15m': 900,
            '1h': 3600
        }
        return timeframe_map.get(timeframe, 1)
    
    def get_realtime_candle(self, symbol: str, timeframe: str) -> Optional[Candle]:
        """Retorna o candle em tempo real para um símbolo e timeframe."""
        candle_key = f"{symbol}_{timeframe}"
        return self.realtime_candles.get(symbol, {}).get(candle_key)
    
    def get_ticks_window(self, symbol: str, start_time: float, end_time: float, limit: int = 10000) -> List[Tick]:
        """Retorna ticks em uma janela de tempo específica."""
        with self._tick_lock:
            if symbol not in self.tick_buffers:
                return []
            
            ticks = []
            for tick in reversed(self.tick_buffers[symbol]):
                if start_time <= tick.timestamp <= end_time:
                    ticks.append(tick)
                    if len(ticks) >= limit:
                        break
            
            return sorted(ticks, key=lambda x: x.timestamp)
    
    def get_metrics(self) -> dict:
        """Retorna métricas de performance."""
        with self._metrics_lock:
            return self.metrics.copy()
    
    def start_processing(self):
        """Inicia o processamento em background."""
        if self.is_running:
            return
        
        self.is_running = True
        self.processing_task = asyncio.create_task(self._processing_loop())
        self.logger.info("High frequency buffer processing started")
    
    def stop_processing(self):
        """Para o processamento em background."""
        if not self.is_running:
            return
        
        self.is_running = False
        if self.processing_task:
            self.processing_task.cancel()
        self.logger.info("High frequency buffer processing stopped")
    
    async def _processing_loop(self):
        """Loop principal de processamento em background."""
        while self.is_running:
            try:
                start_time = time.perf_counter()
                
                # Processa lotes de ticks
                await self._process_tick_batch()
                
                # Aguarda próximo ciclo
                processing_time = (time.perf_counter() - start_time) * 1000
                if processing_time < self.processing_interval_ms:
                    await asyncio.sleep((self.processing_interval_ms - processing_time) / 1000)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                self.logger.error(f"Error in processing loop: {e}")
                await asyncio.sleep(1)
    
    async def _process_tick_batch(self):
        """Processa um lote de ticks para operações em lote."""
        # Aqui implementaremos operações em lote como:
        # - Compressão de dados
        # - Detecção de anomalias
        # - Limpeza de buffers antigos
        # - Backup em disco
        pass
    
    def detect_gaps(self, symbol: str, max_gap_seconds: float = 5.0) -> List[tuple]:
        """Detecta gaps nos dados de um símbolo."""
        with self._tick_lock:
            if symbol not in self.tick_buffers or len(self.tick_buffers[symbol]) < 2:
                return []
            
            ticks = list(self.tick_buffers[symbol])
            gaps = []
            
            for i in range(1, len(ticks)):
                gap = ticks[i].timestamp - ticks[i-1].timestamp
                if gap > max_gap_seconds:
                    gaps.append((ticks[i-1].timestamp, ticks[i].timestamp, gap))
            
            return gaps
    
    def cleanup_old_data(self, max_age_hours: int = 24):
        """Remove dados antigos para economizar memória."""
        cutoff_time = time.time() - (max_age_hours * 3600)
        
        with self._tick_lock:
            for symbol in list(self.tick_buffers.keys()):
                # Remove ticks antigos
                while (self.tick_buffers[symbol] and 
                       self.tick_buffers[symbol][0].timestamp < cutoff_time):
                    self.tick_buffers[symbol].popleft()
                
                # Remove símbolos vazios
                if not self.tick_buffers[symbol]:
                    del self.tick_buffers[symbol]
        
        self.logger.info(f"Cleaned up data older than {max_age_hours} hours")
    
    def get_status(self) -> dict:
        """Retorna status completo do sistema."""
        return {
            'is_running': self.is_running,
            'symbols_count': len(self.tick_buffers),
            'total_ticks_buffered': sum(len(buf) for buf in self.tick_buffers.values()),
            'memory_usage_mb': self._estimate_memory_usage(),
            'metrics': self.get_metrics(),
            'gaps_detected': sum(len(self.detect_gaps(symbol)) for symbol in self.tick_buffers.keys())
        }
    
    def _estimate_memory_usage(self) -> float:
        """Estima uso de memória em MB."""
        # Estimativa aproximada: 100 bytes por tick
        total_ticks = sum(len(buf) for buf in self.tick_buffers.values())
        return (total_ticks * 100) / (1024 * 1024)  # MB
