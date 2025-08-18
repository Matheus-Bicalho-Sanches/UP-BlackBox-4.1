import os
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

import psycopg
from psycopg.rows import dict_row


DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/market_data")


@asynccontextmanager
async def get_conn() -> AsyncIterator[psycopg.AsyncConnection]:
    conn = await psycopg.AsyncConnection.connect(DATABASE_URL, row_factory=dict_row)
    try:
        yield conn
    finally:
        await conn.close()


async def upsert_candle_1m(
    symbol: str,
    exchange: str,
    ts_minute_utc_iso: str,
    o: float,
    h: float,
    l: float,
    c: float,
    v: int,
    vf: Optional[float] = None,
    trades: Optional[int] = None,
    vwap: Optional[float] = None,
) -> None:
    sql = (
        """
        INSERT INTO candles_1m(symbol, exchange, ts_minute_utc, o,h,l,c,v,vf,trades,vwap)
        VALUES (%(symbol)s, %(exchange)s, %(ts)s, %(o)s, %(h)s, %(l)s, %(c)s, %(v)s, %(vf)s, %(trades)s, %(vwap)s)
        ON CONFLICT (symbol, ts_minute_utc)
        DO UPDATE SET o=EXCLUDED.o, h=EXCLUDED.h, l=EXCLUDED.l, c=EXCLUDED.c, v=EXCLUDED.v,
                      vf=EXCLUDED.vf, trades=EXCLUDED.trades, vwap=EXCLUDED.vwap
        """
    )

    async with get_conn() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                sql,
                {
                    "symbol": symbol,
                    "exchange": exchange,
                    "ts": ts_minute_utc_iso,
                    "o": o,
                    "h": h,
                    "l": l,
                    "c": c,
                    "v": v,
                    "vf": vf,
                    "trades": trades,
                    "vwap": vwap,
                },
            )
            await conn.commit()


