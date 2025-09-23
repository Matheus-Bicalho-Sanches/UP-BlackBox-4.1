from __future__ import annotations

import pandas as pd


def add_basic_features(bars: pd.DataFrame) -> pd.DataFrame:
    if bars.empty:
        return bars
    bars = bars.copy()

    # Retornos log e simples
    bars['ret'] = bars['close'].pct_change().fillna(0.0)
    # Evitar uso de pd.np em versões recentes
    import numpy as np
    bars['logret'] = (bars['close'] / bars['close'].shift(1)).apply(lambda x: 0.0 if x <= 0 else float(np.log(x))).fillna(0.0)

    # Volatilidade rolling (ex.: janela 20)
    bars['vol20'] = bars['ret'].rolling(20, min_periods=5).std().fillna(0.0)

    # Agressor / fluxo: normalizações simples
    total_vol = bars['buy_volume'] + bars['sell_volume']
    bars['buy_ratio'] = (bars['buy_volume'] / total_vol).fillna(0.0)
    bars['sell_ratio'] = (bars['sell_volume'] / total_vol).fillna(0.0)

    # OFI já vem pré-calculado; normalizar levemente
    bars['ofi_norm'] = bars['ofi']

    # Inter-arrival time
    bars['interarrival_mean_s'] = bars['interarrival_mean_s'].fillna(0.0)

    # Hora do dia (seno/cosseno) para sazonalidade intradiária
    if 'timestamp' in bars.columns:
        minutes = bars['timestamp'].dt.hour * 60 + bars['timestamp'].dt.minute
        day_frac = (minutes % (24 * 60)) / (24.0 * 60.0)
        bars['hod_sin'] = np.sin(2 * np.pi * day_frac)
        bars['hod_cos'] = np.cos(2 * np.pi * day_frac)

    # Médias móveis (9, 20, 50 períodos)
    bars['ma_9'] = bars['close'].rolling(9, min_periods=1).mean()
    bars['ma_20'] = bars['close'].rolling(20, min_periods=1).mean()
    bars['ma_50'] = bars['close'].rolling(50, min_periods=1).mean()
    
    # Ratios de preço vs médias móveis
    bars['price_ma9_ratio'] = bars['close'] / bars['ma_9']
    bars['price_ma20_ratio'] = bars['close'] / bars['ma_20']
    bars['price_ma50_ratio'] = bars['close'] / bars['ma_50']
    
    # Crossovers de médias móveis
    bars['ma9_ma20_cross'] = (bars['ma_9'] > bars['ma_20']).astype(int)
    bars['ma20_ma50_cross'] = (bars['ma_20'] > bars['ma_50']).astype(int)
    bars['ma9_ma50_cross'] = (bars['ma_9'] > bars['ma_50']).astype(int)

    # Bandas de Bollinger (20 períodos)
    bb20_mean = bars['close'].rolling(20, min_periods=1).mean()
    bb20_std = bars['close'].rolling(20, min_periods=1).std()
    bars['bb20_upper_1std'] = bb20_mean + (1 * bb20_std)
    bars['bb20_upper_2std'] = bb20_mean + (2 * bb20_std)
    bars['bb20_upper_3std'] = bb20_mean + (3 * bb20_std)
    bars['bb20_lower_1std'] = bb20_mean - (1 * bb20_std)
    bars['bb20_lower_2std'] = bb20_mean - (2 * bb20_std)
    bars['bb20_lower_3std'] = bb20_mean - (3 * bb20_std)
    bars['bb20_middle'] = bb20_mean
    
    # Bandas de Bollinger (50 períodos)
    bb50_mean = bars['close'].rolling(50, min_periods=1).mean()
    bb50_std = bars['close'].rolling(50, min_periods=1).std()
    bars['bb50_upper_1std'] = bb50_mean + (1 * bb50_std)
    bars['bb50_upper_2std'] = bb50_mean + (2 * bb50_std)
    bars['bb50_upper_3std'] = bb50_mean + (3 * bb50_std)
    bars['bb50_lower_1std'] = bb50_mean - (1 * bb50_std)
    bars['bb50_lower_2std'] = bb50_mean - (2 * bb50_std)
    bars['bb50_lower_3std'] = bb50_mean - (3 * bb50_std)
    bars['bb50_middle'] = bb50_mean
    
    # Posição do preço dentro das bandas de Bollinger
    bars['bb20_position'] = (bars['close'] - bars['bb20_lower_1std']) / (bars['bb20_upper_1std'] - bars['bb20_lower_1std'])
    bars['bb50_position'] = (bars['close'] - bars['bb50_lower_1std']) / (bars['bb50_upper_1std'] - bars['bb50_lower_1std'])
    
    # Bandas de Bollinger - indicadores de toque
    bars['bb20_touch_upper_1std'] = (bars['close'] >= bars['bb20_upper_1std']).astype(int)
    bars['bb20_touch_upper_2std'] = (bars['close'] >= bars['bb20_upper_2std']).astype(int)
    bars['bb20_touch_upper_3std'] = (bars['close'] >= bars['bb20_upper_3std']).astype(int)
    bars['bb20_touch_lower_1std'] = (bars['close'] <= bars['bb20_lower_1std']).astype(int)
    bars['bb20_touch_lower_2std'] = (bars['close'] <= bars['bb20_lower_2std']).astype(int)
    bars['bb20_touch_lower_3std'] = (bars['close'] <= bars['bb20_lower_3std']).astype(int)
    
    bars['bb50_touch_upper_1std'] = (bars['close'] >= bars['bb50_upper_1std']).astype(int)
    bars['bb50_touch_upper_2std'] = (bars['close'] >= bars['bb50_upper_2std']).astype(int)
    bars['bb50_touch_upper_3std'] = (bars['close'] >= bars['bb50_upper_3std']).astype(int)
    bars['bb50_touch_lower_1std'] = (bars['close'] <= bars['bb50_lower_1std']).astype(int)
    bars['bb50_touch_lower_2std'] = (bars['close'] <= bars['bb50_lower_2std']).astype(int)
    bars['bb50_touch_lower_3std'] = (bars['close'] <= bars['bb50_lower_3std']).astype(int)

    return bars


def apply_rolling_normalization(bars: pd.DataFrame, window: int = 200) -> pd.DataFrame:
    """Aplica normalização rolling (z-score) sem vazamento em colunas numéricas.

    - Usa média e std rolling com shift(1) para evitar olhar o futuro.
    - Mantém colunas de identificação, label e preços originais intactas.
    """
    if bars.empty:
        return bars
    out = bars.copy()
    
    # Preserva preços originais antes da normalização
    price_cols = ['open', 'high', 'low', 'close', 'volume', 'buy_volume', 'sell_volume']
    for col in price_cols:
        if col in out.columns:
            out[f'{col}_original'] = out[col].copy()
    
    # Normaliza apenas features derivadas, não preços originais
    exclude_cols = {
        'timestamp', 'symbol', 'label', 
        'open', 'high', 'low', 'close', 'volume', 'buy_volume', 'sell_volume',
        'open_original', 'high_original', 'low_original', 'close_original', 
        'volume_original', 'buy_volume_original', 'sell_volume_original',
        'dollar', 'trades', 'signed_volume', 'ofi', 'interarrival_mean_s',
        # Exclui médias móveis e bandas de Bollinger da normalização
        'ma_9', 'ma_20', 'ma_50', 'bb20_middle', 'bb50_middle',
        'bb20_upper_1std', 'bb20_upper_2std', 'bb20_upper_3std',
        'bb20_lower_1std', 'bb20_lower_2std', 'bb20_lower_3std',
        'bb50_upper_1std', 'bb50_upper_2std', 'bb50_upper_3std',
        'bb50_lower_1std', 'bb50_lower_2std', 'bb50_lower_3std'
    }
    
    numeric_cols = [
        c for c in out.columns
        if c not in exclude_cols and pd.api.types.is_numeric_dtype(out[c])
    ]
    
    for c in numeric_cols:
        mean = out[c].rolling(window, min_periods=max(10, window // 10)).mean().shift(1)
        std = out[c].rolling(window, min_periods=max(10, window // 10)).std(ddof=0).shift(1)
        normalized = (out[c] - mean) / (std.replace(0, pd.NA))
        # Converte explicitamente para float antes de fillna para evitar FutureWarning
        out[c] = pd.to_numeric(normalized, errors='coerce').fillna(0.0)
    return out


