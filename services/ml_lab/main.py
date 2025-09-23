# AI Lab Backend (FastAPI)
# ========================
# Serviço separado para experimentos de ML (LightGBM/TCN/etc.)
# Porta padrão: 8010

import os
import urllib.parse
import time
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Optional

import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="AI Lab API",
    description="Serviço de experimentos de IA para trading",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============
# Modelos
# ============

class CreateExperimentRequest(BaseModel):
    model: str
    symbolList: List[str]
    dtSeconds: int
    eventBarType: str
    eventBarSize: int
    costBps: int
    hoursBack: int | None = None
    labelHorizon: int | None = None

class Experiment(BaseModel):
    id: str
    status: str
    model: str
    symbolList: List[str]
    dtSeconds: int
    eventBarType: str
    eventBarSize: int
    costBps: int
    createdAt: str

# Armazenamento em memória (MVP). Futuro: persistir em DB.
_AI_EXPERIMENTS: Dict[str, Dict] = {}
_AI_METRICS: Dict[str, List[Dict]] = {}

DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')

async def _fetch_ticks(symbols: List[str], hours: int = 24) -> int:
    """Busca número de linhas recentes em ticks_raw para diagnóstico/ETL inicial."""
    if not symbols:
        return 0
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                # Conta linhas por símbolo nas últimas X horas
                await cur.execute(
                    """
                    SELECT COUNT(*)
                      FROM ticks_raw
                     WHERE symbol = ANY(%s)
                       AND timestamp >= NOW() - make_interval(hours => %s)
                    """,
                    (symbols, hours),
                )
                row = await cur.fetchone()
                return int(row[0]) if row and row[0] is not None else 0
    except Exception:
        return 0

async def _simulate_training(exp_id: str) -> None:
    """Simula treinamento e atualiza métricas em memória. Usa dados do DB para diagnóstico."""
    exp = await get_experiment_by_id(exp_id)
    if not exp:
        return

    # Passo 0: diagnosticar dataset
    rows = await _fetch_ticks(exp['symbolList'], hours=24)
    await insert_metric_points(exp_id, [{
        'step': 0,
        'name': 'dataset_rows',
        'value': float(rows),
        'ts': datetime.now(timezone.utc),
    }])

    # Tentativa de importar LightGBM
    lgb_ok = False
    try:
        import lightgbm as lgb  # noqa: F401
        lgb_ok = True
    except Exception:
        lgb_ok = False

    # Simula 50 passos de métrica (ou poderia treinar de fato quando integrarmos o ETL completo)
    for i in range(1, 51):
        val = 1.0 / (1.0 + i * 0.02)
        await insert_metric_points(exp_id, [{
            'step': i,
            'name': 'logloss' if lgb_ok else 'sim_logloss',
            'value': val,
            'ts': datetime.now(timezone.utc),
        }])
        await asyncio.sleep(0.2)

    # Marca experimento como concluído
    await update_experiment_status(exp_id, 'completed')

# ============
# Endpoints
# ============

from services.ml_lab.persistence import (
    init_db,
    insert_experiment,
    update_experiment_status,
    get_experiments,
    get_experiment_by_id,
    insert_metric_points,
    get_metrics,
    get_feature_importance,
    close_connection_pool,
)
from services.ml_lab.training import run_training_job, TrainParams


@app.on_event("startup")
async def on_startup():
    await init_db()

@app.on_event("shutdown")
async def on_shutdown():
    await close_connection_pool()


@app.get("/status")
async def status():
    return {"ok": True, "service": "ai_lab", "ts": time.time()}

@app.get("/ml/experiments")
async def list_experiments():
    try:
        return await get_experiments(limit=100)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ml/experiments")
async def create_experiment(req: CreateExperimentRequest):
    exp_id = str(int(time.time() * 1000))
    try:
        bar_type = (req.eventBarType or "").strip().lower()
        # normaliza aliases
        aliases = {
            'trade': 'trades', 'trades': 'trades',
            'vol': 'volume', 'volume': 'volume',
            'dollar': 'dollar', 'usd': 'dollar', 'dinheiro': 'dollar',
        }
        bar_type = aliases.get(bar_type, bar_type)

        exp = {
            'id': exp_id,
            'status': 'running',
            'model': req.model,
            'symbolList': [s.upper() for s in req.symbolList],
            'dtSeconds': int(req.dtSeconds),
            'eventBarType': bar_type,
            'eventBarSize': int(req.eventBarSize),
            'costBps': int(req.costBps),
            'createdAt': datetime.now(timezone.utc).isoformat(),
        }
        # Validação simples
        if not exp['symbolList']:
            raise HTTPException(status_code=400, detail="symbols_required")
        if exp['eventBarType'] not in {"trades","volume","dollar"}:
            raise HTTPException(status_code=400, detail="invalid_event_bar_type")
        if exp['eventBarSize'] <= 0:
            raise HTTPException(status_code=400, detail="invalid_event_bar_size")
        if exp['dtSeconds'] <= 0:
            raise HTTPException(status_code=400, detail="invalid_dt_seconds")

        # Persiste experimento
        await insert_experiment({
            'id': exp_id,
            'status': exp['status'],
            'model': exp['model'],
            'symbol_list': exp['symbolList'],
            'dt_seconds': exp['dtSeconds'],
            'event_bar_type': exp['eventBarType'],
            'event_bar_size': exp['eventBarSize'],
            'cost_bps': exp['costBps'],
            'created_at': datetime.now(timezone.utc),
        })

        # Dispara job real de treino em background
        params = TrainParams(
            symbols=exp['symbolList'],
            dt_seconds=exp['dtSeconds'],
            bar_type=exp['eventBarType'],
            bar_size=exp['eventBarSize'],
            cost_bps=exp['costBps'],
            hours_back=int(req.hoursBack) if req.hoursBack else 72,
            label_horizon=int(req.labelHorizon) if req.labelHorizon else 5,
        )
        asyncio.create_task(run_training_job(exp_id, params))
        return {'ok': True, 'id': exp_id}
    except HTTPException:
        # Não converter erros 4xx em 500
        raise
    except Exception as e:
        # fallback: marcar falha
        try:
            await update_experiment_status(exp_id, 'failed')
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ml/experiments/{exp_id}")
async def get_experiment(exp_id: str):
    try:
        exp = await get_experiment_by_id(exp_id)
        if not exp:
            raise HTTPException(status_code=404, detail="experiment_not_found")
        return exp
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ml/experiments/{exp_id}/metrics")
async def get_experiment_metrics(exp_id: str):
    try:
        return await get_metrics(exp_id, limit=2000)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/ml/experiments/{exp_id}/importance")
async def get_experiment_importance(exp_id: str, limit: int = 100):
    try:
        return await get_feature_importance(exp_id, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BacktestRequest(BaseModel):
    experimentId: str
    longThreshold: float = 0.55
    shortThreshold: float = 0.45
    costBps: int | None = None


class OOSValidationRequest(BaseModel):
    experimentId: str
    testSymbols: List[str]  # Símbolos para teste (diferentes do treino)
    testHoursBack: int = 24  # Janela de teste (horas)
    longThreshold: float = 0.55
    shortThreshold: float = 0.45
    costBps: int | None = None


@app.post("/ml/backtests")
async def run_backtest(req: BacktestRequest):
    """Executa backtest simples: prob->sinal, PnL por barra, custos.

    Estratégia:
      - prob = probabilidade de classe 1 (subir) da validação
      - buy se prob >= longThreshold, sell se prob <= shortThreshold
      - retorno próximo-barra: close[t+1]/close[t]-1 (fallback: retorno da própria barra)
      - custos ida+volta: costBps/10000 por troca de posição
    """
    try:
        from services.ml_lab.training import pd  # reutiliza pandas
        exp = await get_experiment_by_id(req.experimentId)
        if not exp:
            raise HTTPException(status_code=404, detail="experiment_not_found")

        # Recarrega artefatos mínimos: importance (p/ features) não é necessário; apenas replicamos ETL para obter barras
        # e rodamos modelo salvo sobre as barras para probabilidades
        from pathlib import Path
        import json
        import lightgbm as lgb
        from .etl import fetch_ticks, ticks_to_dataframe, build_event_bars
        from .features import add_basic_features, apply_rolling_normalization
        from .labels import add_labels
        from .dataset import build_lgbm_dataset

        run_dir = Path(os.getenv('AI_LAB_ARTIFACTS_DIR', 'artifacts')) / req.experimentId
        model_path = run_dir / 'model.txt'
        if not model_path.exists():
            raise HTTPException(status_code=400, detail="model_not_found")

        # Carrega config do experimento
        cfg = {}
        try:
            cfg = json.loads((run_dir / 'config.json').read_text(encoding='utf-8'))
        except Exception:
            pass

        symbols = cfg.get('symbols', exp['symbolList'])
        dt_seconds = int(cfg.get('dt_seconds', exp['dtSeconds']))
        bar_type = cfg.get('bar_type', exp['eventBarType'])
        bar_size = int(cfg.get('bar_size', exp['eventBarSize']))
        cost_bps = int(req.costBps if req.costBps is not None else exp['costBps'])
        hours_back = int(cfg.get('hours_back', 72))
        label_horizon = int(cfg.get('label_horizon', 5))

        # ETL (igual ao treino)
        from datetime import datetime, timezone, timedelta
        start = datetime.now(timezone.utc) - timedelta(hours=hours_back)
        end = datetime.now(timezone.utc)
        chunks = []
        async for tks in fetch_ticks(symbols, start, end, chunk_hours=6):
            df = ticks_to_dataframe(tks)
            if not df.empty:
                chunks.append(df)
        if not chunks:
            raise HTTPException(status_code=400, detail="no_data_for_backtest")
        ticks_df = pd.concat(chunks, ignore_index=True)
        bars = build_event_bars(ticks_df, bar_type, bar_size)
        bars = add_basic_features(bars)
        bars = apply_rolling_normalization(bars, window=200)

        # Labels só para medir retorno futuro; dataset para alinhar features
        bars = add_labels(bars, label_type='future_return_sign', horizon=label_horizon)
        X, y, feature_cols = build_lgbm_dataset(bars)
        if X.empty:
            raise HTTPException(status_code=400, detail="empty_dataset")

        booster = lgb.Booster(model_file=str(model_path))
        probs = booster.predict(X)

        # Geração de sinais e PnL
        long_th = float(req.longThreshold)
        short_th = float(req.shortThreshold)
        pos = 0  # -1, 0, +1
        pnl = []
        positions = []
        costs = []
        import numpy as np
        rets = bars['close'].pct_change().shift(-1)
        rets = rets.fillna(0.0)
        rets_np = np.nan_to_num(rets.values.astype(float), nan=0.0, posinf=0.0, neginf=0.0)
        signal_counts = {'long': 0, 'short': 0, 'neutral': 0}
        # Diagnóstico: conta quantos pontos caem em zonas neutras estreitas
        neutral_band = max(0.0, min(0.5 - short_th, long_th - 0.5))
        near_half = sum(1 for p in probs if abs(float(p) - 0.5) <= neutral_band)
        print(f"🔎 Backtest debug: probs~0.5 dentro da banda neutra: {near_half} de {len(probs)} (band={neutral_band:.3f})")

        for i, p in enumerate(probs):
            # sanitiza probabilidade para evitar NaN/inf
            pi = float(p)
            if not np.isfinite(pi):
                pi = 0.5
            sig = 1 if pi >= long_th else (-1 if pi <= short_th else 0)
            
            # Conta sinais para debug
            if sig == 1:
                signal_counts['long'] += 1
            elif sig == -1:
                signal_counts['short'] += 1
            else:
                signal_counts['neutral'] += 1
            
            # custo quando muda posição
            turn_cost = 0.0
            if sig != pos:
                turn_cost = abs(sig - pos) * (cost_bps / 10000.0)
                pos = sig
            positions.append(sig)
            costs.append(turn_cost)
            pnl.append(sig * rets_np[i] - turn_cost)

        pnl = np.nan_to_num(np.array(pnl, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
        equity = np.nan_to_num(pnl.cumsum(), nan=0.0, posinf=0.0, neginf=0.0)
        std = float(np.nan_to_num(pnl.std(ddof=0), nan=0.0, posinf=0.0, neginf=0.0))
        mean = float(np.nan_to_num(pnl.mean(), nan=0.0, posinf=0.0, neginf=0.0))
        sharpe = float((mean / (std + 1e-12)) * (252 ** 0.5)) if len(pnl) > 1 else 0.0
        hitrate = float((pnl > 0).mean()) if len(pnl) > 0 else 0.0
        maxdd = 0.0
        if len(equity) > 0:
            peak = equity[0]
            for v in equity:
                peak = max(peak, v)
                maxdd = min(maxdd, v - peak)

        operations = _extract_operations(bars, positions, probs, long_th, short_th)
        
        # Debug: verifica se há índices duplicados nos pontos
        points = [{'i': int(i), 'p': float(np.nan_to_num(equity[i], nan=0.0, posinf=0.0, neginf=0.0))} for i in range(len(equity))]
        point_indices = [p['i'] for p in points]
        if len(point_indices) != len(set(point_indices)):
            print(f"⚠️ WARNING: Pontos duplicados detectados! Total: {len(point_indices)}, Únicos: {len(set(point_indices))}")
            print(f"Primeiros 10 índices: {point_indices[:10]}")
        
        return {
            'points': points,
            'metrics': {
                'cum_pnl': float(equity[-1] if len(equity) else 0.0),
                'sharpe': sharpe,
                'hit_rate': hitrate,
                'max_drawdown': float(maxdd),
                'cost_bps': cost_bps,
                'signal_counts': signal_counts,
                'total_bars': len(bars),
                'operations_count': len(operations),
            },
            'operations': operations,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ml/oos-validation")
async def run_oos_validation(req: OOSValidationRequest):
    """Validação out-of-sample: testa modelo treinado em ativos/período diferentes.
    
    - Usa modelo já treinado (artifacts/<id>/model.txt)
    - Aplica em símbolos/período diferentes do treino
    - Retorna métricas de performance OOS
    """
    try:
        from services.ml_lab.training import pd
        exp = await get_experiment_by_id(req.experimentId)
        if not exp:
            raise HTTPException(status_code=404, detail="experiment_not_found")

        from pathlib import Path
        import json
        import lightgbm as lgb
        from .etl import fetch_ticks, ticks_to_dataframe, build_event_bars
        from .features import add_basic_features, apply_rolling_normalization
        from .labels import add_labels
        from .dataset import build_lgbm_dataset

        run_dir = Path(os.getenv('AI_LAB_ARTIFACTS_DIR', 'artifacts')) / req.experimentId
        model_path = run_dir / 'model.txt'
        if not model_path.exists():
            raise HTTPException(status_code=400, detail="model_not_found")

        # Carrega config do experimento original
        cfg = {}
        try:
            cfg = json.loads((run_dir / 'config.json').read_text(encoding='utf-8'))
        except Exception:
            pass

        # Usa parâmetros do treino original, mas símbolos/período diferentes
        dt_seconds = int(cfg.get('dt_seconds', exp['dtSeconds']))
        bar_type = cfg.get('bar_type', exp['eventBarType'])
        bar_size = int(cfg.get('bar_size', exp['eventBarSize']))
        cost_bps = int(req.costBps if req.costBps is not None else exp['costBps'])
        label_horizon = int(cfg.get('label_horizon', 5))

        # ETL para dados de teste (símbolos/período diferentes)
        from datetime import datetime, timezone, timedelta
        start = datetime.now(timezone.utc) - timedelta(hours=req.testHoursBack)
        end = datetime.now(timezone.utc)
        chunks = []
        async for tks in fetch_ticks(req.testSymbols, start, end, chunk_hours=6):
            df = ticks_to_dataframe(tks)
            if not df.empty:
                chunks.append(df)
        if not chunks:
            raise HTTPException(status_code=400, detail="no_test_data")
        ticks_df = pd.concat(chunks, ignore_index=True)
        bars = build_event_bars(ticks_df, bar_type, bar_size)
        bars = add_basic_features(bars)
        bars = apply_rolling_normalization(bars, window=200)

        # Labels para alinhamento
        bars = add_labels(bars, label_type='future_return_sign', horizon=label_horizon)
        X, y, feature_cols = build_lgbm_dataset(bars)
        if X.empty:
            raise HTTPException(status_code=400, detail="empty_test_dataset")

        # Aplica modelo treinado
        booster = lgb.Booster(model_file=str(model_path))
        probs = booster.predict(X)

        # Backtest OOS
        long_th = float(req.longThreshold)
        short_th = float(req.shortThreshold)
        pos = 0
        pnl = []
        positions = []
        costs = []
        import numpy as np
        rets = bars['close'].pct_change().shift(-1)
        rets = rets.fillna(0.0)
        rets_np = np.nan_to_num(rets.values.astype(float), nan=0.0, posinf=0.0, neginf=0.0)
        
        signal_counts = {'long': 0, 'short': 0, 'neutral': 0}
        # Diagnóstico: idem para OOS
        neutral_band = max(0.0, min(0.5 - short_th, long_th - 0.5))
        near_half = sum(1 for p in probs if abs(float(p) - 0.5) <= neutral_band)
        print(f"🔎 OOS debug: probs~0.5 dentro da banda neutra: {near_half} de {len(probs)} (band={neutral_band:.3f})")

        for i, p in enumerate(probs):
            pi = float(p)
            if not np.isfinite(pi):
                pi = 0.5
            sig = 1 if pi >= long_th else (-1 if pi <= short_th else 0)
            
            # Conta sinais para debug
            if sig == 1:
                signal_counts['long'] += 1
            elif sig == -1:
                signal_counts['short'] += 1
            else:
                signal_counts['neutral'] += 1
            
            turn_cost = 0.0
            if sig != pos:
                turn_cost = abs(sig - pos) * (cost_bps / 10000.0)
                pos = sig
            positions.append(sig)
            costs.append(turn_cost)
            pnl.append(sig * rets_np[i] - turn_cost)

        pnl = np.nan_to_num(np.array(pnl, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
        equity = np.nan_to_num(pnl.cumsum(), nan=0.0, posinf=0.0, neginf=0.0)
        std = float(np.nan_to_num(pnl.std(ddof=0), nan=0.0, posinf=0.0, neginf=0.0))
        mean = float(np.nan_to_num(pnl.mean(), nan=0.0, posinf=0.0, neginf=0.0))
        sharpe = float((mean / (std + 1e-12)) * (252 ** 0.5)) if len(pnl) > 1 else 0.0
        hitrate = float((pnl > 0).mean()) if len(pnl) > 0 else 0.0
        maxdd = 0.0
        if len(equity) > 0:
            peak = equity[0]
            for v in equity:
                peak = max(peak, v)
                maxdd = min(maxdd, v - peak)

        operations = _extract_operations(bars, positions, probs, long_th, short_th)
        
        # Debug: verifica se há índices duplicados nos pontos
        points = [{'i': int(i), 'p': float(np.nan_to_num(equity[i], nan=0.0, posinf=0.0, neginf=0.0))} for i in range(len(equity))]
        point_indices = [p['i'] for p in points]
        if len(point_indices) != len(set(point_indices)):
            print(f"⚠️ WARNING OOS: Pontos duplicados detectados! Total: {len(point_indices)}, Únicos: {len(set(point_indices))}")
            print(f"Primeiros 10 índices: {point_indices[:10]}")
        
        return {
            'test_symbols': req.testSymbols,
            'test_hours_back': req.testHoursBack,
            'points': points,
            'metrics': {
                'cum_pnl': float(equity[-1] if len(equity) else 0.0),
                'sharpe': sharpe,
                'hit_rate': hitrate,
                'max_drawdown': float(maxdd),
                'cost_bps': cost_bps,
                'test_bars': len(bars),
                'signal_counts': signal_counts,
                'operations_count': len(operations),
            },
            'operations': operations,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _extract_operations(bars, positions, probs, long_th, short_th):
    """Extrai operações (entrada/saída) do backtest para exportação."""
    operations = []
    current_position = 0
    entry_bar = None
    entry_price = None
    entry_timestamp = None
    entry_prob = None
    
    for i, (bar, pos, prob) in enumerate(zip(bars.itertuples(), positions, probs)):
        # Detecta mudança de posição
        if pos != current_position:
            # Fecha posição anterior se existir
            if current_position != 0 and entry_bar is not None:
                # Usa preço original (não normalizado) da barra
                exit_price = getattr(bar, 'close_original', bar.close)
                exit_timestamp = bar.timestamp
                result = current_position * (exit_price - entry_price)
                
                # Debug: log dos preços para verificar
                if len(operations) < 5:  # Log apenas as primeiras 5 operações
                    print(f"🔍 DEBUG Operação {len(operations)+1}:")
                    print(f"  Entry: {entry_price} (original: {getattr(entry_bar, 'close_original', 'N/A')})")
                    print(f"  Exit: {exit_price} (original: {getattr(bar, 'close_original', 'N/A')})")
                    print(f"  Result: {result}")
                
                operations.append({
                    'symbol': bar.symbol,
                    'entry_timestamp': entry_timestamp.isoformat(),
                    'entry_price': float(entry_price),
                    'exit_timestamp': exit_timestamp.isoformat(),
                    'exit_price': float(exit_price),
                    'result': float(result),
                    'entry_prob': float(entry_prob),
                    'position': 'LONG' if current_position > 0 else 'SHORT'
                })
            
            # Abre nova posição se não for neutra
            if pos != 0:
                entry_bar = bar
                # Usa preço original (não normalizado) da barra
                entry_price = getattr(bar, 'close_original', bar.close)
                entry_timestamp = bar.timestamp
                entry_prob = prob
            else:
                entry_bar = None
                entry_price = None
                entry_timestamp = None
                entry_prob = None
            
            current_position = pos
    
    # Fecha posição final se existir
    if current_position != 0 and entry_bar is not None:
        last_bar = bars.iloc[-1]
        # Usa preço original (não normalizado) da barra
        exit_price = getattr(last_bar, 'close_original', last_bar['close'])
        exit_timestamp = last_bar['timestamp']
        result = current_position * (exit_price - entry_price)
        
        operations.append({
            'symbol': last_bar['symbol'],
            'entry_timestamp': entry_timestamp.isoformat(),
            'entry_price': float(entry_price),
            'exit_timestamp': exit_timestamp.isoformat(),
            'exit_price': float(exit_price),
            'result': float(result),
            'entry_prob': float(entry_prob),
            'position': 'LONG' if current_position > 0 else 'SHORT'
        })
    
    return operations

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8010"))
    uvicorn.run("main:app", host=host, port=port, reload=False)

@app.get("/debug/env")
async def debug_env():
    """Mostra informações de ambiente: origem do DATABASE_URL e versão do LightGBM."""
    dsn = os.getenv('DATABASE_URL')
    src = 'env' if dsn else 'default'
    if not dsn:
        dsn = 'postgres://postgres:postgres@localhost:5432/market_data'
    try:
        parsed = urllib.parse.urlparse(dsn)
        safe_netloc = parsed.hostname or 'localhost'
        if parsed.port:
            safe_netloc += f":{parsed.port}"
        safe_dsn = f"{parsed.scheme}://***:***@{safe_netloc}{parsed.path}"
    except Exception:
        safe_dsn = 'unparseable'
    # LightGBM
    lgb_installed = False
    lgb_version = None
    try:
        import lightgbm as lgb  # type: ignore
        lgb_installed = True
        lgb_version = getattr(lgb, '__version__', None)
    except Exception:
        lgb_installed = False
    return {
        'database_url_source': src,
        'database_url_sanitized': safe_dsn,
        'lightgbm_installed': lgb_installed,
        'lightgbm_version': lgb_version,
    }

@app.get("/debug/db")
async def debug_db(symbols: str = '', hours: int = 24):
    """Retorna current_database() e contagem de ticks por símbolo nas últimas N horas."""
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                await cur.execute("SELECT current_database(), version()")
                r = await cur.fetchone()
                current_db = r[0]
                version = r[1]
                result = {
                    'current_database': current_db,
                    'server_version': version,
                    'hours': hours,
                    'counts': [],
                }
                syms = [s.strip().upper() for s in symbols.split(',') if s.strip()]
                if syms:
                    await cur.execute(
                        """
                        SELECT symbol, COUNT(*)
                          FROM ticks_raw
                         WHERE symbol = ANY(%s)
                           AND timestamp >= NOW() - make_interval(hours => %s)
                         GROUP BY symbol
                         ORDER BY symbol
                        """,
                        (syms, hours),
                    )
                    rows = await cur.fetchall()
                    result['counts'] = [{'symbol': row[0], 'count': int(row[1])} for row in rows]
                return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
