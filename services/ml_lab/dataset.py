from __future__ import annotations

from typing import List, Tuple
import pandas as pd


def build_lgbm_dataset(bars: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series, List[str]]:
    if bars.empty or 'label' not in bars.columns:
        return pd.DataFrame(), pd.Series(dtype='float32'), []

    # Seleciona colunas de features (inclui técnicas recentes)
    candidate_cols = [
        'ret','logret','vol20','buy_ratio','sell_ratio','ofi_norm','interarrival_mean_s','hod_sin','hod_cos',
        'open','high','low','close','volume','trades','dollar','buy_volume','sell_volume','signed_volume',
        # Médias móveis e relações
        'ma_9','ma_20','ma_50','price_ma9_ratio','price_ma20_ratio','price_ma50_ratio',
        # Crossovers
        'ma9_ma20_cross','ma20_ma50_cross','ma9_ma50_cross',
        # Bollinger 20
        'bb20_middle','bb20_upper_1std','bb20_upper_2std','bb20_upper_3std',
        'bb20_lower_1std','bb20_lower_2std','bb20_lower_3std','bb20_position',
        'bb20_touch_upper_1std','bb20_touch_upper_2std','bb20_touch_upper_3std',
        'bb20_touch_lower_1std','bb20_touch_lower_2std','bb20_touch_lower_3std',
        # Bollinger 50
        'bb50_middle','bb50_upper_1std','bb50_upper_2std','bb50_upper_3std',
        'bb50_lower_1std','bb50_lower_2std','bb50_lower_3std','bb50_position',
        'bb50_touch_upper_1std','bb50_touch_upper_2std','bb50_touch_upper_3std',
        'bb50_touch_lower_1std','bb50_touch_lower_2std','bb50_touch_lower_3std',
    ]
    feature_cols = [c for c in candidate_cols if c in bars.columns]
    X = bars[feature_cols].copy()
    y = bars['label'].astype('int8').copy()

    # Preenchimentos simples
    X = X.fillna(0.0)
    # Downcast
    for c in X.columns:
        X[c] = pd.to_numeric(X[c], downcast='float')

    return X, y, feature_cols


