from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Tuple
import json
from pathlib import Path

import asyncio
import pandas as pd

from .etl import fetch_ticks, ticks_to_dataframe, build_event_bars
from .features import add_basic_features, apply_rolling_normalization
from .labels import add_labels
from .dataset import build_lgbm_dataset
from .persistence import insert_metric_points, insert_feature_importance, update_experiment_status


@dataclass
class TrainParams:
    symbols: List[str]
    dt_seconds: int
    bar_type: str
    bar_size: int
    cost_bps: int
    label_type: str = 'future_return_sign'
    label_horizon: int = 5
    hours_back: int = 72

    # thresholds para backtest default (também expostos via API)
    long_threshold: float = 0.55
    short_threshold: float = 0.45


async def run_training_job(exp_id: str, p: TrainParams) -> None:
    try:
        # 1) ETL streaming de ticks
        start = datetime.now(timezone.utc) - timedelta(hours=p.hours_back)
        end = datetime.now(timezone.utc)
        chunks: List[pd.DataFrame] = []
        async for tks in fetch_ticks(p.symbols, start, end, chunk_hours=6):
            df = ticks_to_dataframe(tks)
            if not df.empty:
                chunks.append(df)

        if not chunks:
            await update_experiment_status(exp_id, 'empty_dataset')
            return

        ticks_df = pd.concat(chunks, ignore_index=True)

        # 2) Event bars
        bars = build_event_bars(ticks_df, p.bar_type, p.bar_size)

        # 3) Features
        bars = add_basic_features(bars)
        bars = apply_rolling_normalization(bars, window=200)

        # 4) Labels
        bars = add_labels(bars, label_type=p.label_type, horizon=p.label_horizon)

        # 5) Dataset LGBM
        X, y, feature_cols = build_lgbm_dataset(bars)
        await insert_metric_points(exp_id, [{
            'step': 0,
            'name': 'train_rows',
            'value': float(len(X)),
            'ts': datetime.now(timezone.utc),
        }])

        # 6) Treino
        try:
            import lightgbm as lgb
            lgb_ok = True
        except Exception:
            lgb_ok = False

        if not lgb_ok or X.empty:
            await update_experiment_status(exp_id, 'failed_no_lgbm_or_data')
            return

        # Split simples tempo-ordenado 80/20
        split_idx = int(len(X) * 0.8)
        X_train, y_train = X.iloc[:split_idx], y.iloc[:split_idx]
        X_valid, y_valid = X.iloc[split_idx:], y.iloc[split_idx:]

        # Debug: log do tamanho dos datasets
        print(f"🔍 DEBUG Dataset sizes:")
        print(f"  Total samples: {len(X)}")
        print(f"  Train samples: {len(X_train)}")
        print(f"  Valid samples: {len(X_valid)}")
        print(f"  Features: {len(feature_cols)}")
        print(f"  Label distribution train: {y_train.value_counts().to_dict()}")
        print(f"  Label distribution valid: {y_valid.value_counts().to_dict()}")
        
        dtrain = lgb.Dataset(X_train, label=y_train)
        dvalid = lgb.Dataset(X_valid, label=y_valid)

        # Parâmetros mais conservadores para evitar overfitting
        params = {
            'objective': 'binary',
            'metric': ['binary_logloss','auc'],
            'learning_rate': 0.01,  # Reduzido de 0.05 para 0.01
            'num_leaves': 31,       # Reduzido de 63 para 31
            'min_data_in_leaf': 20, # Adicionado para evitar overfitting
            'min_sum_hessian_in_leaf': 1e-3,  # Adicionado
            'feature_pre_filter': False,
            'verbosity': -1,
            'force_col_wise': True,  # Adicionado para estabilidade
        }

        loop = asyncio.get_running_loop()

        def _callback(env):
            i = env.iteration
            res = env.evaluation_result_list
            metrics_payload = []
            for (name, metric, value, is_higher_better) in res:
                metrics_payload.append({
                    'step': int(i),
                    'name': f'{name}_{metric}',
                    'value': float(value),
                    'ts': datetime.now(timezone.utc),
                })
            # agenda gravação de métricas de dentro da thread de treino
            loop.call_soon_threadsafe(asyncio.create_task, insert_metric_points(exp_id, metrics_payload))

        def _train_sync():
            # Critério de early stopping deve usar EXCLUSIVAMENTE o conjunto de validação.
            # Usar o treino aqui pode levar a paradas na 1ª iteração.
            booster_local = lgb.train(
                params,
                dtrain,
                valid_sets=[dvalid],
                valid_names=['valid'],
                num_boost_round=1000,  # Aumentado de 500 para 1000
                callbacks=[lgb.early_stopping(100), _callback],  # Aumentado de 50 para 100
            )
            return booster_local

        booster = await asyncio.to_thread(_train_sync)

        # Importâncias
        imps = booster.feature_importance(importance_type='gain')
        fi_items = [
            {'feature': feature_cols[i], 'importance': float(imps[i])}
            for i in range(len(feature_cols))
        ]
        await insert_feature_importance(exp_id, fi_items)

        # Artefatos
        artifacts_root = Path(os.getenv('AI_LAB_ARTIFACTS_DIR', 'artifacts'))
        run_dir = artifacts_root / exp_id
        run_dir.mkdir(parents=True, exist_ok=True)
        # Modelo
        booster.save_model(str(run_dir / 'model.txt'))
        # Datasets binários
        dtrain.save_binary(str(run_dir / 'train.bin'))
        dvalid.save_binary(str(run_dir / 'valid.bin'))
        # Config
        with open(run_dir / 'config.json', 'w', encoding='utf-8') as f:
            json.dump({
                'symbols': p.symbols,
                'dt_seconds': p.dt_seconds,
                'bar_type': p.bar_type,
                'bar_size': p.bar_size,
                'cost_bps': p.cost_bps,
                'label_type': p.label_type,
                'label_horizon': p.label_horizon,
                'hours_back': p.hours_back,
                'features': feature_cols,
            }, f, ensure_ascii=False, indent=2)
        # Importância
        with open(run_dir / 'feature_importance.json', 'w', encoding='utf-8') as f:
            json.dump(fi_items, f, ensure_ascii=False, indent=2)

        await update_experiment_status(exp_id, 'completed')
    except Exception:
        await update_experiment_status(exp_id, 'failed')


