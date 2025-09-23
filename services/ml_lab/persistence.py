import os
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any

import psycopg
from psycopg.types.json import Json
from psycopg_pool import AsyncConnectionPool

DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')

# Pool global de conexões
_connection_pool: Optional[AsyncConnectionPool] = None

async def get_connection_pool() -> AsyncConnectionPool:
    """Retorna o pool de conexões, criando se necessário."""
    global _connection_pool
    if _connection_pool is None:
        _connection_pool = AsyncConnectionPool(
            DATABASE_URL,
            min_size=2,  # Mínimo de 2 conexões
            max_size=10,  # Máximo de 10 conexões
            max_idle=300,  # 5 minutos de idle
            max_lifetime=3600,  # 1 hora de vida máxima
            check=AsyncConnectionPool.check_connection,
        )
    return _connection_pool

async def close_connection_pool():
    """Fecha o pool de conexões."""
    global _connection_pool
    if _connection_pool is not None:
        await _connection_pool.close()
        _connection_pool = None


async def init_db() -> None:
    """Cria as tabelas necessárias para o AI Lab se não existirem."""
    pool = await get_connection_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ml_experiments (
                    id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    model TEXT NOT NULL,
                    symbol_list JSONB NOT NULL,
                    dt_seconds INTEGER NOT NULL,
                    event_bar_type TEXT NOT NULL,
                    event_bar_size INTEGER NOT NULL,
                    cost_bps INTEGER NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS ml_metrics (
                    id BIGSERIAL PRIMARY KEY,
                    experiment_id TEXT NOT NULL REFERENCES ml_experiments(id) ON DELETE CASCADE,
                    step INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    value DOUBLE PRECISION NOT NULL,
                    ts TIMESTAMPTZ NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_ml_metrics_exp_step ON ml_metrics(experiment_id, step ASC);

                CREATE TABLE IF NOT EXISTS ml_feature_importance (
                    id BIGSERIAL PRIMARY KEY,
                    experiment_id TEXT NOT NULL REFERENCES ml_experiments(id) ON DELETE CASCADE,
                    feature TEXT NOT NULL,
                    importance DOUBLE PRECISION NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_ml_fi_exp_imp ON ml_feature_importance(experiment_id, importance DESC);
                """
            )
            await conn.commit()


# Experiments
async def insert_experiment(exp: Dict[str, Any]) -> None:
    pool = await get_connection_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                INSERT INTO ml_experiments (
                    id, status, model, symbol_list, dt_seconds, event_bar_type, event_bar_size,
                    cost_bps, created_at, updated_at
                ) VALUES (
                    %(id)s, %(status)s, %(model)s, %(symbol_list)s, %(dt_seconds)s, %(event_bar_type)s, %(event_bar_size)s,
                    %(cost_bps)s, %(created_at)s, NOW()
                )
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    updated_at = NOW()
                """,
                {
                    **exp,
                    'symbol_list': Json(exp['symbol_list']),
                },
            )
            await conn.commit()


async def update_experiment_status(exp_id: str, status: str) -> None:
    pool = await get_connection_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                UPDATE ml_experiments
                   SET status = %s,
                       updated_at = NOW()
                 WHERE id = %s
                """,
                (status, exp_id),
            )
            await conn.commit()


async def get_experiments(limit: int = 100) -> List[Dict[str, Any]]:
    pool = await get_connection_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, status, model, symbol_list, dt_seconds, event_bar_type, event_bar_size,
                       cost_bps, created_at
                  FROM ml_experiments
                 ORDER BY created_at DESC
                 LIMIT %s
                """,
                (limit,),
            )
            rows = await cur.fetchall()
            result = []
            for r in rows:
                result.append(
                    {
                        'id': r[0],
                        'status': r[1],
                        'model': r[2],
                        'symbolList': r[3],
                        'dtSeconds': r[4],
                        'eventBarType': r[5],
                        'eventBarSize': r[6],
                        'costBps': r[7],
                        'createdAt': r[8].isoformat() if r[8] else None,
                    }
                )
            return result


async def get_experiment_by_id(exp_id: str) -> Optional[Dict[str, Any]]:
    pool = await get_connection_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT id, status, model, symbol_list, dt_seconds, event_bar_type, event_bar_size,
                       cost_bps, created_at
                  FROM ml_experiments
                 WHERE id = %s
                """,
                (exp_id,),
            )
            r = await cur.fetchone()
            if not r:
                return None
            return {
                'id': r[0],
                'status': r[1],
                'model': r[2],
                'symbolList': r[3],
                'dtSeconds': r[4],
                'eventBarType': r[5],
                'eventBarSize': r[6],
                'costBps': r[7],
                'createdAt': r[8].isoformat() if r[8] else None,
            }


# Metrics
async def insert_metric_points(exp_id: str, points: List[Dict[str, Any]]) -> None:
    if not points:
        return
    pool = await get_connection_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(
                """
                INSERT INTO ml_metrics (experiment_id, step, name, value, ts)
                VALUES (%s, %s, %s, %s, %s)
                """,
                [
                    (
                        exp_id,
                        int(p.get('step', 0)),
                        str(p.get('name', 'metric')),
                        float(p.get('value', 0.0)),
                        p.get('ts') or datetime.now(timezone.utc),
                    )
                    for p in points
                ],
            )
            await conn.commit()


async def get_metrics(exp_id: str, limit: int = 1000, after_step: Optional[int] = None) -> List[Dict[str, Any]]:
    pool = await get_connection_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            if after_step is None:
                await cur.execute(
                    """
                    SELECT step, name, value, ts
                      FROM ml_metrics
                     WHERE experiment_id = %s
                     ORDER BY step ASC
                     LIMIT %s
                    """,
                    (exp_id, limit),
                )
            else:
                await cur.execute(
                    """
                    SELECT step, name, value, ts
                      FROM ml_metrics
                     WHERE experiment_id = %s AND step > %s
                     ORDER BY step ASC
                     LIMIT %s
                    """,
                    (exp_id, after_step, limit),
                )
            rows = await cur.fetchall()
            return [
                {
                    'step': r[0],
                    'name': r[1],
                    'value': float(r[2]),
                    'ts': r[3].isoformat() if r[3] else None,
                }
                for r in rows
            ]


# Feature Importance
async def insert_feature_importance(exp_id: str, items: List[Dict[str, Any]]) -> None:
    if not items:
        return
    pool = await get_connection_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.executemany(
                """
                INSERT INTO ml_feature_importance (experiment_id, feature, importance)
                VALUES (%s, %s, %s)
                """,
                [(exp_id, it['feature'], float(it['importance'])) for it in items],
            )
            await conn.commit()


async def get_feature_importance(exp_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    pool = await get_connection_pool()
    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                """
                SELECT feature, importance
                  FROM ml_feature_importance
                 WHERE experiment_id = %s
                 ORDER BY importance DESC
                 LIMIT %s
                """,
                (exp_id, limit),
            )
            rows = await cur.fetchall()
            return [
                {'feature': r[0], 'importance': float(r[1])}
                for r in rows
            ]


async def get_feature_importance_endpoint(exp_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    return await get_feature_importance(exp_id, limit=limit)


