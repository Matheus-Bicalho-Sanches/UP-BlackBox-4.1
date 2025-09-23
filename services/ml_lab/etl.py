from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import AsyncIterator, Dict, Iterable, List, Literal, Optional, Tuple

import psycopg
import pandas as pd


DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')


BarType = Literal['trades', 'volume', 'dollar']


@dataclass
class Tick:
    symbol: str
    price: float
    volume: int
    timestamp: datetime
    trade_type: Optional[int]  # 2 comprador agressor, 3 vendedor agressor
    buy_agent: Optional[int]
    sell_agent: Optional[int]


async def fetch_ticks(
    symbols: List[str],
    start: datetime,
    end: datetime,
    chunk_hours: int = 6,
) -> AsyncIterator[List[Tick]]:
    """Faz streaming de ticks_raw por janelas de tempo em ordem ASC.

    - Usa ORDER BY timestamp ASC para não quebrar cálculos de delta-t.
    - Emite listas de Tick por chunk para controlar memória.
    """
    if not symbols:
        return
    symbols = [s.upper() for s in symbols]
    async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
        curr = start
        while curr < end:
            nxt = min(curr + timedelta(hours=chunk_hours), end)
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT symbol, price, volume, timestamp, trade_type, buy_agent, sell_agent
                      FROM ticks_raw
                     WHERE symbol = ANY(%s)
                       AND timestamp >= %s AND timestamp < %s
                     ORDER BY timestamp ASC
                    """,
                    (symbols, curr, nxt),
                )
                rows = await cur.fetchall()
                if rows:
                    yield [
                        Tick(
                            symbol=r[0],
                            price=float(r[1]),
                            volume=int(r[2]),
                            timestamp=r[3],
                            trade_type=r[4],
                            buy_agent=r[5],
                            sell_agent=r[6],
                        )
                        for r in rows
                    ]
            curr = nxt


def ticks_to_dataframe(ticks: List[Tick]) -> pd.DataFrame:
    if not ticks:
        return pd.DataFrame(columns=['timestamp','symbol','price','volume','trade_type','buy_agent','sell_agent'])
    df = pd.DataFrame([
        {
            'timestamp': t.timestamp,
            'symbol': t.symbol,
            'price': t.price,
            'volume': t.volume,
            'trade_type': t.trade_type,
            'buy_agent': t.buy_agent,
            'sell_agent': t.sell_agent,
        }
        for t in ticks
    ])
    df.sort_values('timestamp', inplace=True)
    df.reset_index(drop=True, inplace=True)
    return df


def build_event_bars(
    df: pd.DataFrame,
    bar_type: BarType,
    bar_size: int,
) -> pd.DataFrame:
    """Gera event bars simples por símbolo, preservando ordem temporal.

    - trades: a cada N trades
    - volume: acumula volume até >= bar_size
    - dollar: acumula (price*volume) até >= bar_size
    """
    if df.empty:
        return pd.DataFrame(columns=[
            'timestamp','symbol','open','high','low','close','volume','trades','dollar',
            'buy_volume','sell_volume','signed_volume','ofi','interarrival_mean_s'
        ])

    bars = []
    for symbol, g in df.groupby('symbol', sort=False):
        g = g.sort_values('timestamp')
        if bar_type == 'trades':
            # Quebra por blocos fixos de tamanho bar_size
            for i in range(0, len(g), bar_size):
                chunk = g.iloc[i:i+bar_size]
                if chunk.empty:
                    continue
                bars.append(_ohlcv_from_chunk(chunk))
        else:
            acc_vol = 0
            acc_dollar = 0.0
            start_idx = 0
            for idx, row in g.iterrows():
                acc_vol += int(row['volume'])
                acc_dollar += float(row['price']) * int(row['volume'])
                threshold = acc_vol if bar_type == 'volume' else acc_dollar
                if threshold >= bar_size:
                    chunk = g.iloc[start_idx:g.index.get_loc(idx)+1]
                    bars.append(_ohlcv_from_chunk(chunk))
                    start_idx = g.index.get_loc(idx) + 1
                    acc_vol = 0
                    acc_dollar = 0.0
            # descarta resto incompleto (evita vazamento entre janelas)

    if not bars:
        return pd.DataFrame(columns=[
            'timestamp','symbol','open','high','low','close','volume','trades','dollar',
            'buy_volume','sell_volume','signed_volume','ofi','interarrival_mean_s'
        ])
    out = pd.DataFrame(bars).sort_values(['symbol','timestamp']).reset_index(drop=True)
    return out


def _ohlcv_from_chunk(chunk: pd.DataFrame) -> Dict:
    symbol = chunk.iloc[0]['symbol']
    ts = chunk.iloc[-1]['timestamp']
    prices = chunk['price']
    buy_vol = int(chunk.loc[chunk.get('trade_type') == 2, 'volume'].sum()) if 'trade_type' in chunk.columns else 0
    sell_vol = int(chunk.loc[chunk.get('trade_type') == 3, 'volume'].sum()) if 'trade_type' in chunk.columns else 0
    signed_vol = buy_vol - sell_vol
    denom = buy_vol + sell_vol
    ofi = (signed_vol / denom) if denom > 0 else 0.0

    # inter-arrival mean in seconds
    if len(chunk) > 1:
        tdiff = chunk['timestamp'].diff().dropna().dt.total_seconds()
        interarrival_mean_s = float(tdiff.mean()) if not tdiff.empty else 0.0
    else:
        interarrival_mean_s = 0.0

    return {
        'timestamp': ts,
        'symbol': symbol,
        'open': float(prices.iloc[0]),
        'high': float(prices.max()),
        'low': float(prices.min()),
        'close': float(prices.iloc[-1]),
        'volume': int(chunk['volume'].sum()),
        'trades': int(len(chunk)),
        'dollar': float((chunk['price'] * chunk['volume']).sum()),
        'buy_volume': buy_vol,
        'sell_volume': sell_vol,
        'signed_volume': signed_vol,
        'ofi': float(ofi),
        'interarrival_mean_s': interarrival_mean_s,
    }


