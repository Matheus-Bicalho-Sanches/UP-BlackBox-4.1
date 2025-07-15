"""plot_winq25_candles.py

Consulta a tabela candles_5m no TimescaleDB e exibe um gráfico de velas
para o ativo WINQ25 usando mplfinance.

Uso:
  python plot_winq25_candles.py 2024-06-01 2024-06-02
Argumentos de data são opcionais (formato YYYY-MM-DD). Se omitidos, pega as
últimas 200 velas.
"""
from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

import asyncpg
import pandas as pd
import mplfinance as mpf
import asyncio

ASSET = "WINQ25"
DB_DSN = os.getenv("TSCALE_DSN", "postgres://postgres:senha_muito_segura@localhost:5432/postgres")


async def fetch_candles(start: datetime | None = None, end: datetime | None = None):
    if end is None:
        end = datetime.now(tz=timezone.utc)
    if start is None:
        start = end - timedelta(days=1)

    sql = """
    SELECT open_time, open, high, low, close, volume
    FROM candles_5m
    WHERE asset=$1 AND open_time >= $2 AND open_time < $3
    ORDER BY open_time;
    """
    pool = await asyncpg.create_pool(DB_DSN)
    async with pool.acquire() as con:
        rows = await con.fetch(sql, ASSET, start, end)
    await pool.close()
    if not rows:
        return pd.DataFrame()
    columns = list(rows[0].keys())
    df = pd.DataFrame(rows, columns=columns)
    return df


def parse_date(date_str: str) -> datetime:
    return datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)


async def main():
    if len(sys.argv) == 3:
        start = parse_date(sys.argv[1])
        end = parse_date(sys.argv[2])
    else:
        start = None
        end = None

    df = await fetch_candles(start, end)
    if df.empty:
        print("Nenhuma vela encontrada para o período.")
        return

    df.set_index("open_time", inplace=True)
    df.index.name = "Date"
    df.columns = ["Open", "High", "Low", "Close", "Volume"]

    mpf.plot(df, type="candle", volume=True, title=f"{ASSET} – 5m candles")


if __name__ == "__main__":
    asyncio.run(main()) 