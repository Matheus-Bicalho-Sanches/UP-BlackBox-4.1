import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from psycopg_pool import AsyncConnectionPool
from psycopg import AsyncConnection
from psycopg.types.json import Json
from services.high_frequency.models import Tick, OrderBookEvent, OrderBookSnapshot, OrderBookLevel
import os
import time

logger = logging.getLogger(__name__)

# ✅ NOVO: Controle de throttling para logs de ticks
_last_tick_log_time = 0.0
_tick_log_throttle_seconds = 1.0  # Log apenas a cada 1 segundo

def _should_log_tick_batch() -> bool:
    """Verifica se deve fazer log do lote de ticks (throttling)"""
    global _last_tick_log_time
    current_time = time.time()
    
    if current_time - _last_tick_log_time >= _tick_log_throttle_seconds:
        _last_tick_log_time = current_time
        return True
    return False

pool: AsyncConnectionPool | None = None

async def get_db_pool(retries: int = 1, delay: float = 1.0) -> AsyncConnectionPool | None:
    """
    Retorna o pool de conexões, inicializando se necessário, com lógica de retentativa.
    """
    global pool
    if pool is None:
        db_url = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/market_data")
        for attempt in range(retries):
            try:
                # Cria pool sem abrir automaticamente para evitar warnings
                new_pool = AsyncConnectionPool(db_url, min_size=5, max_size=20, open=False)
                # Abre o pool manualmente
                await new_pool.open()
                # Tenta uma conexão para validar
                async with new_pool.connection():
                    pass
                pool = new_pool
                logger.info("Pool de conexões com o banco de dados inicializado com sucesso.")
                break
            except Exception as e:
                logger.warning(f"Tentativa {attempt + 1} de conectar ao banco de dados falhou: {e}")
                if attempt + 1 < retries:
                    await asyncio.sleep(delay)
                else:
                    logger.error("Todas as tentativas de conectar ao banco de dados falharam.")
                    return None
    return pool

async def initialize_db(conn_pool: AsyncConnectionPool):
    """
    Inicializa o banco de dados, criando a tabela de ticks e a hypertabela se não existirem,
    e garantindo que as colunas críticas sejam do tipo BIGINT para evitar erros de overflow.
    """
    logger.info("Verificando e inicializando o esquema do banco de dados...")
    async with conn_pool.connection() as conn:
        async with conn.cursor() as cur:
            try:
                await cur.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")
                
                # Cria a tabela com os tipos de dados corretos (BIGINT para volume e trade_id)
                await cur.execute("""
                    CREATE TABLE IF NOT EXISTS ticks_raw (
                        symbol VARCHAR(20) NOT NULL,
                        exchange VARCHAR(10) NOT NULL,
                        price DOUBLE PRECISION NOT NULL,
                        volume BIGINT NOT NULL,
                        timestamp TIMESTAMPTZ NOT NULL,
                        trade_id BIGINT,
                        -- Campos para dados detalhados de trade
                        buy_agent INTEGER,
                        sell_agent INTEGER,
                        trade_type SMALLINT,
                        volume_financial DOUBLE PRECISION,
                        is_edit BOOLEAN DEFAULT FALSE
                    );
                """)

                # Bloco PL/pgSQL para alterar as colunas apenas se necessário, de forma segura.
                await cur.execute("""
                    DO $$
                    BEGIN
                        -- Ajusta tipos existentes
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='trade_id' AND data_type <> 'bigint') THEN
                           ALTER TABLE ticks_raw ALTER COLUMN trade_id TYPE BIGINT;
                           RAISE NOTICE 'Coluna trade_id em ticks_raw foi alterada para BIGINT.';
                        END IF;
                        
                        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='volume' AND data_type <> 'bigint') THEN
                           ALTER TABLE ticks_raw ALTER COLUMN volume TYPE BIGINT;
                           RAISE NOTICE 'Coluna volume em ticks_raw foi alterada para BIGINT.';
                        END IF;
                        
                        -- Adiciona novos campos se não existirem
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='buy_agent') THEN
                           ALTER TABLE ticks_raw ADD COLUMN buy_agent INTEGER;
                           RAISE NOTICE 'Coluna buy_agent adicionada em ticks_raw.';
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='sell_agent') THEN
                           ALTER TABLE ticks_raw ADD COLUMN sell_agent INTEGER;
                           RAISE NOTICE 'Coluna sell_agent adicionada em ticks_raw.';
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='trade_type') THEN
                           ALTER TABLE ticks_raw ADD COLUMN trade_type SMALLINT;
                           RAISE NOTICE 'Coluna trade_type adicionada em ticks_raw.';
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='volume_financial') THEN
                           ALTER TABLE ticks_raw ADD COLUMN volume_financial DOUBLE PRECISION;
                           RAISE NOTICE 'Coluna volume_financial adicionada em ticks_raw.';
                        END IF;
                        
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='is_edit') THEN
                           ALTER TABLE ticks_raw ADD COLUMN is_edit BOOLEAN DEFAULT FALSE;
                           RAISE NOTICE 'Coluna is_edit adicionada em ticks_raw.';
                        END IF;
                        
                                        -- Remover colunas desnecessárias se existirem
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='aggressor_side') THEN
                   ALTER TABLE ticks_raw DROP COLUMN aggressor_side;
                   RAISE NOTICE 'Coluna aggressor_side removida de ticks_raw (redundante com trade_type).';
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='sequence') THEN
                   ALTER TABLE ticks_raw DROP COLUMN sequence;
                   RAISE NOTICE 'Coluna sequence removida de ticks_raw (não necessária).';
                END IF;
                
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ticks_raw' AND column_name='buyer_maker') THEN
                   ALTER TABLE ticks_raw DROP COLUMN buyer_maker;
                   RAISE NOTICE 'Coluna buyer_maker removida de ticks_raw (não necessária).';
                END IF;
                    END $$;
                """)
                
                await cur.execute("SELECT create_hypertable('ticks_raw', 'timestamp', if_not_exists => TRUE);")

                await cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS order_book_events (
                        id BIGINT GENERATED ALWAYS AS IDENTITY,
                        symbol VARCHAR(20) NOT NULL,
                        event_time TIMESTAMPTZ NOT NULL,
                        action SMALLINT NOT NULL,
                        side SMALLINT NOT NULL,
                        position INTEGER,
                        price DOUBLE PRECISION,
                        quantity BIGINT,
                        offer_count INTEGER,
                        agent_id INTEGER,
                        sequence BIGINT,
                        raw_payload JSONB
                    );
                    """
                )

                await cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS order_book_snapshots (
                        id BIGINT GENERATED ALWAYS AS IDENTITY,
                        symbol VARCHAR(20) NOT NULL,
                        event_time TIMESTAMPTZ NOT NULL,
                        bids JSONB NOT NULL,
                        asks JSONB NOT NULL,
                        best_bid_price DOUBLE PRECISION,
                        best_bid_quantity BIGINT,
                        best_ask_price DOUBLE PRECISION,
                        best_ask_quantity BIGINT,
                        levels INTEGER,
                        sequence BIGINT,
                        raw_event JSONB
                    );
                    """
                )

                await cur.execute(
                    "SELECT create_hypertable('order_book_events', 'event_time', if_not_exists => TRUE);"
                )

                await cur.execute(
                    "SELECT create_hypertable('order_book_snapshots', 'event_time', if_not_exists => TRUE);"
                )

                await cur.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_order_book_events_event_time_id
                    ON order_book_events(event_time, id);
                    """
                )

                await cur.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_order_book_events_symbol_time
                    ON order_book_events(symbol, event_time DESC);
                    """
                )

                await cur.execute(
                    """
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_order_book_snapshots_event_time_id
                    ON order_book_snapshots(event_time, id);
                    """
                )

                await cur.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_order_book_snapshots_symbol_time
                    ON order_book_snapshots(symbol, event_time DESC);
                    """
                )

                # Cria/ajusta tabela robot_patterns (assinado)
                await cur.execute("""
                    CREATE TABLE IF NOT EXISTS robot_patterns (
                        id SERIAL PRIMARY KEY,
                        symbol VARCHAR(20) NOT NULL,
                        exchange VARCHAR(10) NOT NULL,
                        pattern_type VARCHAR(50) NOT NULL,
                        robot_type VARCHAR(50) NOT NULL,
                        confidence_score DOUBLE PRECISION NOT NULL,
                        agent_id INTEGER NOT NULL,
                        first_seen TIMESTAMPTZ NOT NULL,
                        last_seen TIMESTAMPTZ NOT NULL,
                        total_volume DOUBLE PRECISION NOT NULL,
                        total_trades INTEGER NOT NULL,
                        avg_trade_size DOUBLE PRECISION NOT NULL,
                        frequency_minutes DOUBLE PRECISION NOT NULL,
                        price_aggression DOUBLE PRECISION NOT NULL,
                        status VARCHAR(20) NOT NULL,
                        market_volume_percentage DOUBLE PRECISION,
                        inactivity_notified BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMPTZ NOT NULL,
                        signature_volume INTEGER,
                        signature_direction VARCHAR(10),
                        signature_interval_seconds DOUBLE PRECISION,
                        UNIQUE(symbol, agent_id, pattern_type, signature_volume, signature_direction, signature_interval_seconds, first_seen)
                    );
                """)

                # Adiciona colunas de assinatura se não existirem
                await cur.execute("""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='robot_patterns' AND column_name='signature_volume') THEN
                            ALTER TABLE robot_patterns ADD COLUMN signature_volume INTEGER;
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='robot_patterns' AND column_name='signature_direction') THEN
                            ALTER TABLE robot_patterns ADD COLUMN signature_direction VARCHAR(10);
                        END IF;
                        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='robot_patterns' AND column_name='signature_interval_seconds') THEN
                            ALTER TABLE robot_patterns ADD COLUMN signature_interval_seconds DOUBLE PRECISION;
                        END IF;
                    END $$;
                """)

                # Índices auxiliares
                await cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_robot_patterns_signature
                      ON robot_patterns(symbol, agent_id, pattern_type, signature_volume, signature_direction, signature_interval_seconds);
                """)

                await conn.commit()
                logger.info("Esquema do banco de dados verificado e atualizado com sucesso.")

            except Exception as e:
                logger.error(f"Erro durante a inicialização do banco de dados: {e}", exc_info=True)
                await conn.rollback()
                raise

async def persist_ticks(ticks: List[Tick], conn_pool: AsyncConnectionPool):
    if not ticks:
        return

    sql = """
        INSERT INTO ticks_raw (
            symbol, exchange, price, volume, timestamp, trade_id,
            buy_agent, sell_agent, trade_type, volume_financial, is_edit
        )
        VALUES (%s, %s, %s, %s, to_timestamp(%s), %s, %s, %s, %s, %s, %s)
    """
    params = [(
        t.symbol, t.exchange, t.price, t.volume, t.timestamp, t.trade_id,
        getattr(t, 'buy_agent', None), getattr(t, 'sell_agent', None), getattr(t, 'trade_type', None),
        getattr(t, 'volume_financial', None), getattr(t, 'is_edit', False)
    ) for t in ticks]

    for attempt in range(1, 6):
        try:
            async with conn_pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.executemany(sql, params)
                    await conn.commit()
            # ✅ NOVO: Log com throttling (apenas a cada 1 segundo)
            if _should_log_tick_batch():
                logger.info(f"Lote de {len(ticks)} ticks salvo no banco de dados.")
            return
        except Exception as e:
            logger.warning(f"Tentativa {attempt} falhou para o lote de ticks: {e}")
            if attempt < 5:
                await asyncio.sleep(0.1 * attempt)
            else:
                logger.error(f"Todas as tentativas de salvar o lote de ticks para {ticks[0].symbol} falharam.")

async def get_ticks_from_db(symbol: str, timeframe: str, limit: int, conn_pool: AsyncConnectionPool) -> List[Dict[str, Any]]:
    async with conn_pool.connection() as conn:
        async with conn.cursor() as cur:
            if timeframe == "raw":
                await cur.execute(
                    """SELECT symbol, exchange, price, volume, timestamp, trade_id,
                       buy_agent, sell_agent, trade_type, volume_financial, is_edit 
                       FROM ticks_raw WHERE symbol = %s ORDER BY timestamp DESC LIMIT %s""",
                    (symbol, limit),
                )
            else:
                await cur.execute(
                    """
                    SELECT
                        time_bucket(%s, timestamp) as candle_time,
                        first(price, timestamp) as open,
                        max(price) as high,
                        min(price) as low,
                        last(price, timestamp) as close,
                        sum(volume) as volume
                    FROM ticks_raw
                    WHERE symbol = %s
                    GROUP BY candle_time
                    ORDER BY candle_time DESC
                    LIMIT %s
                    """,
                    (timeframe, symbol, limit),
                )
            
            rows = await cur.fetchall()
            columns = [desc[0] for desc in cur.description]
            return [dict(zip(columns, row)) for row in rows]

async def persist_order_book_event(event: OrderBookEvent, db_pool: AsyncConnectionPool):
    """Persiste um evento incremental do livro de ofertas."""
    sql = """
        INSERT INTO order_book_events (
            symbol,
            event_time,
            action,
            side,
            position,
            price,
            quantity,
            offer_count,
            agent_id,
            sequence,
            raw_payload
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    params = (
        event.symbol,
        event.timestamp,
        event.action,
        event.side,
        event.position,
        event.price,
        event.quantity,
        event.offer_count,
        event.agent_id,
        event.sequence,
        Json(event.raw_payload or {}),
    )

    for attempt in range(1, 6):
        try:
            async with db_pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(sql, params)
                    await conn.commit()
            logger.debug(
                "Persisted order book event %s action=%s side=%s position=%s",
                event.symbol,
                event.action,
                event.side,
                event.position,
            )
            return
        except Exception as exc:
            logger.warning(
                "Tentativa %s falhou ao persistir evento de book (%s - action %s): %s",
                attempt,
                event.symbol,
                event.action,
                exc,
            )
            if attempt < 5:
                await asyncio.sleep(0.1 * attempt)
            else:
                logger.error("Falha definitiva ao persistir evento de book para %s", event.symbol)


def _levels_to_json(levels: List[OrderBookLevel]) -> List[Dict[str, Any]]:
    return [
        {
            "price": level.price,
            "quantity": level.quantity,
            "offer_count": level.offer_count,
            "agent_id": level.agent_id,
        }
        for level in levels
    ]


async def persist_order_book_snapshot(snapshot: OrderBookSnapshot, db_pool: AsyncConnectionPool):
    """Persiste um snapshot completo do livro de ofertas."""
    bids_json = _levels_to_json(snapshot.bids)
    asks_json = _levels_to_json(snapshot.asks)

    best_bid = bids_json[0] if bids_json else None
    best_ask = asks_json[0] if asks_json else None

    sql = """
        INSERT INTO order_book_snapshots (
            symbol,
            event_time,
            bids,
            asks,
            best_bid_price,
            best_bid_quantity,
            best_ask_price,
            best_ask_quantity,
            levels,
            sequence,
            raw_event
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """

    params = (
        snapshot.symbol,
        snapshot.timestamp,
        Json(bids_json),
        Json(asks_json),
        best_bid["price"] if best_bid else None,
        best_bid["quantity"] if best_bid else None,
        best_ask["price"] if best_ask else None,
        best_ask["quantity"] if best_ask else None,
        max(len(bids_json), len(asks_json)),
        snapshot.sequence,
        Json(snapshot.source_event or {}),
    )

    for attempt in range(1, 6):
        try:
            async with db_pool.connection() as conn:
                async with conn.cursor() as cur:
                    await cur.execute(sql, params)
                    await conn.commit()
            logger.debug(
                "Persisted order book snapshot %s bids=%s asks=%s",
                snapshot.symbol,
                len(bids_json),
                len(asks_json),
            )
            return
        except Exception as exc:
            logger.warning(
                "Tentativa %s falhou ao persistir snapshot de %s: %s",
                attempt,
                snapshot.symbol,
                exc,
            )
            if attempt < 5:
                await asyncio.sleep(0.1 * attempt)
            else:
                logger.error("Falha definitiva ao persistir snapshot de %s", snapshot.symbol)
