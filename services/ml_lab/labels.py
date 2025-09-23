from __future__ import annotations

from typing import Literal
import pandas as pd


LabelType = Literal['future_return_sign', 'triple_barrier']


def add_labels(
    bars: pd.DataFrame,
    label_type: LabelType = 'future_return_sign',
    horizon: int = 5,
    upper_mult: float = 2.0,
    lower_mult: float = 2.0,
) -> pd.DataFrame:
    if bars.empty:
        bars['label'] = []
        return bars

    out = bars.copy()

    if label_type == 'future_return_sign':
        fut = out['close'].shift(-horizon)
        out['label'] = (fut / out['close'] - 1.0).fillna(0.0).apply(lambda x: 1 if x > 0 else 0)
        return out

    # triple-barrier simplificada: usa std rolling para definir barreiras
    ret = out['close'].pct_change().fillna(0.0)
    vol = ret.rolling(50, min_periods=10).std().fillna(ret.std() or 0.0)
    up = out['close'] * (1.0 + upper_mult * vol)
    down = out['close'] * (1.0 - lower_mult * vol)

    labels = []
    closes = out['close'].values
    for i in range(len(out)):
        end = min(i + horizon, len(out) - 1)
        hit = 0
        for j in range(i + 1, end + 1):
            if closes[j] >= up.iloc[i]:
                hit = 1
                break
            if closes[j] <= down.iloc[i]:
                hit = -1
                break
        labels.append(1 if hit == 1 else (0 if hit == -1 else (1 if closes[end] >= closes[i] else 0)))

    out['label'] = labels
    return out


