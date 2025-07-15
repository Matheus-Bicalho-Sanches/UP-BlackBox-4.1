"""collect_winq25.py

Coleta ticks do ativo WINQ25 usando a ProfitDLL, converte em amostras de 1 segundo
(equivalente a "ticks" consolidados) e gera candles de 5 minutos.
Grava tudo em uma instância TimescaleDB/PostgreSQL.

Pré-requisitos:
  pip install asyncpg pandas
  (e wrapper profit_dll.py que forneça Subscribe/on_tick)

Antes de rodar, certifique-se de ter o TimescaleDB ativo (docker) e ter executado
scripts/db_setup.sql para criar as tabelas.
"""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional

import asyncpg

# -------------------------------------------------------------
# Configurações
# -------------------------------------------------------------
ASSET = "WINQ25"
DB_DSN = os.getenv("TSCALE_DSN", "postgres://postgres:senha_muito_segura@localhost:5432/postgres")
TIMEFRAME_MIN = 5  # minutos para candle

# -------------------------------------------------------------
# Conexão ProfitDLL (placeholder simples)
# -------------------------------------------------------------
try:
    import profit_dll  # <- seu wrapper Python para ProfitDLL
except ImportError:
    profit_dll = None  # Se o wrapper não estiver disponível ainda


@dataclass
class Tick:
    ts: datetime
    price: float
    quantity: int


@dataclass
class Candle:
    open_time: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

    @property
    def as_tuple(self):
        return (
            self.open_time,
            ASSET,
            self.open,
            self.high,
            self.low,
            self.close,
            self.volume,
        )


class CandleBuilder:
    """Constrói candles de TIMEFRAME_MIN a partir de ticks de 1 segundo."""

    def __init__(self, timeframe_min: int = TIMEFRAME_MIN):
        self.tf = timedelta(minutes=timeframe_min)
        self.current: Optional[Candle] = None

    def _bucket_start(self, ts: datetime) -> datetime:
        # Arredonda para baixo para múltiplo de tf
        epoch = int(ts.timestamp())
        bucket_epoch = (epoch // int(self.tf.total_seconds())) * int(self.tf.total_seconds())
        return datetime.fromtimestamp(bucket_epoch, tz=timezone.utc)

    def add_tick(self, tick: Tick) -> Optional[Candle]:
        bucket = self._bucket_start(tick.ts)
        candle = self.current

        if candle is None or bucket > candle.open_time:
            # Fecha vela anterior
            closed = candle
            # Inicia nova vela
            self.current = Candle(
                open_time=bucket,
                open=tick.price,
                high=tick.price,
                low=tick.price,
                close=tick.price,
                volume=tick.quantity,
            )
            return closed  # Pode ser None se não existia
        else:
            # Atualiza vela atual
            candle.high = max(candle.high, tick.price)
            candle.low = min(candle.low, tick.price)
            candle.close = tick.price
            candle.volume += tick.quantity
            return None


class TickSampler:
    """Mantém o último tick de cada segundo e gera amostra."""

    def __init__(self):
        self.last_tick: Optional[Tick] = None
        self.current_second: Optional[int] = None
        self.queue: "asyncio.Queue[Tick]" = asyncio.Queue()

    async def feed(self, price: float, quantity: int, ts: datetime):
        second = int(ts.timestamp())
        if self.current_second is None:
            self.current_second = second
        if second == self.current_second:
            # Apenas guarda o último preço do segundo
            self.last_tick = Tick(ts, price, quantity)
        else:
            # Empilha tick consolidado do segundo anterior
            if self.last_tick:
                await self.queue.put(self.last_tick)
            # Reinicia para novo segundo
            self.current_second = second
            self.last_tick = Tick(ts, price, quantity)

    async def poll(self):
        """Async iterator que devolve ticks de 1 segundo."""
        while True:
            tick = await self.queue.get()
            yield tick


# -------------------------------------------------------------
# Persistência
# -------------------------------------------------------------
class TimescaleWriter:
    def __init__(self, dsn: str):
        self.dsn = dsn
        self.pool: Optional[asyncpg.Pool] = None

    async def start(self):
        self.pool = await asyncpg.create_pool(self.dsn, min_size=1, max_size=5)

    async def insert_tick(self, tick: Tick):
        sql = """
        INSERT INTO ticks (ts, asset, price, quantity)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING;
        """
        async with self.pool.acquire() as con:
            await con.execute(sql, tick.ts, ASSET, tick.price, tick.quantity)

    async def insert_candle(self, candle: Candle):
        sql = """
        INSERT INTO candles_5m (open_time, asset, open, high, low, close, volume)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING;
        """
        async with self.pool.acquire() as con:
            await con.execute(sql, *candle.as_tuple)


# -------------------------------------------------------------
# Função principal
# -------------------------------------------------------------
async def main():
    writer = TimescaleWriter(DB_DSN)
    await writer.start()

    sampler = TickSampler()
    candle_builder = CandleBuilder(TIMEFRAME_MIN)

    async def process_ticks():
        async for tick in sampler.poll():
            await writer.insert_tick(tick)
            closed_candle = candle_builder.add_tick(tick)
            if closed_candle:
                await writer.insert_candle(closed_candle)
                print("Candle fechado:", closed_candle)

    task_processing = asyncio.create_task(process_ticks())

    # -----------------------------------------------------
    # Integração com ProfitDLL
    # -----------------------------------------------------
    if profit_dll is None:
        print("WARNING: profit_dll wrapper não encontrado. Simulando preços...")

        async def fake_price_generator():
            import random
            price = 100000.0
            while True:
                ts = datetime.now(tz=timezone.utc)
                price += random.uniform(-5, 5)
                qty = random.randint(1, 10)
                await sampler.feed(price, qty, ts)
                await asyncio.sleep(0.2)  # cinco ticks por segundo

        await fake_price_generator()
    else:
        # Exemplo de callback real
        def on_market_data(price: float, quantity: int, timestamp_ms: int):
            ts = datetime.fromtimestamp(timestamp_ms / 1000, tz=timezone.utc)
            asyncio.run_coroutine_threadsafe(sampler.feed(price, quantity, ts), asyncio.get_event_loop())

        profit_dll.login()
        profit_dll.subscribe_market_data(ASSET, on_market_data)
        print("Escutando dados do ProfitDLL… Pressione Ctrl+C para sair")
        try:
            while True:
                await asyncio.sleep(3600)
        except KeyboardInterrupt:
            print("Encerrando…")

    await task_processing


if __name__ == "__main__":
    asyncio.run(main()) 