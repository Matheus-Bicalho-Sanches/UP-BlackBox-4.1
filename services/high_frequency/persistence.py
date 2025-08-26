import asyncio
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from psycopg_pool import AsyncConnectionPool
from psycopg import AsyncConnection
from services.high_frequency.models import Tick
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
