import os
import psycopg
from datetime import datetime, timezone
import logging
from contextlib import contextmanager
from typing import Optional

# Configuração da conexão PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")

@contextmanager
def get_db_connection():
    """Context manager para conexões de banco de dados."""
    conn = None
    try:
        conn = psycopg.connect(DATABASE_URL)
        yield conn
    finally:
        if conn:
            conn.close()

async def upsert_candle_1m(symbol: str, exchange: str, ts_minute_utc: datetime, o: float, h: float, l: float, c: float, v: int, vf: float):
    """Insere ou atualiza candle de 1 minuto."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Upsert usando ON CONFLICT
                query = """
                    INSERT INTO candles_1m (symbol, exchange, ts_minute_utc, o, h, l, c, v, vf)
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
                cur.execute(query, (symbol, exchange, ts_minute_utc, o, h, l, c, v, vf))
                conn.commit()
                
    except Exception as e:
        logging.error("Failed to upsert candle_1m: %s", e)
        raise

def insert_tick_raw(symbol: str, exchange: str, price: float, volume: int, trade_id: int = None, buyer_maker: bool = None):
    """Insere um tick individual na tabela ticks_raw."""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                volume_financial = price * volume
                
                query = """
                    INSERT INTO ticks_raw (symbol, exchange, ts_tick_utc, price, volume, volume_financial, trade_id, buyer_maker)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                
                cur.execute(
                    query,
                    (symbol, exchange, datetime.now(timezone.utc), price, volume, volume_financial, trade_id, buyer_maker)
                )
                conn.commit()
                
                if logging.getLogger().isEnabledFor(logging.DEBUG):
                    logging.debug("Tick saved: %s %s %.2f %d", symbol, exchange, price, volume)
                    
    except Exception as e:
        logging.error("Failed to insert tick_raw: %s", e)
        # Não vamos fazer raise aqui para não interromper o fluxo principal
        # Apenas logamos o erro


