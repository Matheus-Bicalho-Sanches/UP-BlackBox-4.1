# AI Lab Backend (FastAPI)
# ========================
# Serviço separado para experimentos de ML (LightGBM/TCN/etc.)
# Porta padrão: 8010

import os
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
)


@app.on_event("startup")
async def on_startup():
    await init_db()


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
    try:
        exp_id = str(int(time.time() * 1000))
        exp = {
            'id': exp_id,
            'status': 'running',
            'model': req.model,
            'symbolList': [s.upper() for s in req.symbolList],
            'dtSeconds': int(req.dtSeconds),
            'eventBarType': req.eventBarType,
            'eventBarSize': int(req.eventBarSize),
            'costBps': int(req.costBps),
            'createdAt': datetime.now(timezone.utc).isoformat(),
        }
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

        # Dispara tarefa de "treino" em background (MVP)
        asyncio.create_task(_simulate_training(exp_id))
        return {'ok': True, 'id': exp_id}
    except Exception as e:
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

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8010"))
    uvicorn.run("main:app", host=host, port=port, reload=False)
