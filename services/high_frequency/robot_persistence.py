import psycopg
import os
import logging
from datetime import datetime, timezone
from typing import List, Optional

# Corrige imports para funcionar como módulo standalone
try:
    from .robot_models import TWAPPattern, RobotTrade, TradeType, RobotStatus
    from .agent_mapping import get_agent_name
except ImportError:
    from robot_models import TWAPPattern, RobotTrade, TradeType, RobotStatus
    from agent_mapping import get_agent_name

logger = logging.getLogger(__name__)

class RobotPersistence:
    """Classe para persistir dados de robôs no banco"""
    
    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')
    
    async def save_twap_pattern(self, pattern: TWAPPattern) -> Optional[int]:
        """Salva um padrão TWAP e retorna o ID"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    # Insere o padrão
                    await cur.execute("""
                        INSERT INTO robot_patterns (
                            symbol, exchange, pattern_type, confidence_score, agent_id,
                            first_seen, last_seen, total_volume, total_trades,
                            avg_trade_size, frequency_minutes, price_aggression, status, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        pattern.symbol, pattern.exchange, 'TWAP', pattern.confidence_score,
                        pattern.agent_id, pattern.first_seen, pattern.last_seen,
                        pattern.total_volume, pattern.total_trades, pattern.avg_trade_size,
                        pattern.frequency_minutes, pattern.price_aggression, pattern.status.value,
                        datetime.now(timezone.utc)
                    ))
                    
                    result = await cur.fetchone()
                    await conn.commit()
                    
                    if result:
                        logger.info(f"Padrão TWAP salvo para {pattern.symbol} - {get_agent_name(pattern.agent_id)} ({pattern.agent_id})")
                        return result[0]
                    return None
                    
        except Exception as e:
            logger.error(f"Erro ao salvar padrão TWAP: {e}")
            return None
    
    async def update_twap_pattern(self, pattern_id: int, pattern: TWAPPattern) -> bool:
        """Atualiza um padrão TWAP existente"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        UPDATE robot_patterns SET
                            last_seen = %s,
                            total_volume = %s,
                            total_trades = %s,
                            avg_trade_size = %s,
                            frequency_minutes = %s,
                            price_aggression = %s,
                            confidence_score = %s,
                            status = %s,
                            inactivity_notified = CASE 
                                WHEN %s = 'active' THEN FALSE 
                                ELSE inactivity_notified 
                            END
                        WHERE id = %s
                    """, (
                        pattern.last_seen, pattern.total_volume, pattern.total_trades,
                        pattern.avg_trade_size, pattern.frequency_minutes,
                        pattern.price_aggression, pattern.confidence_score,
                        pattern.status.value, pattern.status.value, pattern_id
                    ))
                    
                    await conn.commit()
                    logger.info(f"Padrão TWAP {pattern_id} atualizado - {get_agent_name(pattern.agent_id)} ({pattern.agent_id}) em {pattern.symbol}")
                    return True
                    
        except Exception as e:
            logger.error(f"Erro ao atualizar padrão TWAP {pattern_id}: {e}")
            return False
    
    async def save_robot_trade(self, trade: RobotTrade, robot_pattern_id: int) -> bool:
        """Salva um trade de robô"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        INSERT INTO robot_trades (
                            robot_pattern_id, symbol, price, volume, timestamp,
                            trade_type, agent_id, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        robot_pattern_id, trade.symbol, trade.price, trade.volume,
                        trade.timestamp, trade.trade_type.value, trade.agent_id,
                        datetime.now(timezone.utc)
                    ))
                    
                    await conn.commit()
                    return True
                    
        except Exception as e:
            logger.error(f"Erro ao salvar trade de robô: {e}")
            return False
    
    async def get_existing_pattern(self, symbol: str, agent_id: int) -> Optional[tuple]:
        """Busca um padrão existente para o símbolo e agente"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        SELECT id, status, first_seen, total_volume, total_trades, avg_trade_size, inactivity_notified
                        FROM robot_patterns
                        WHERE symbol = %s AND agent_id = %s AND pattern_type = 'TWAP'
                        ORDER BY last_seen DESC
                        LIMIT 1
                    """, (symbol, agent_id))
                    
                    result = await cur.fetchone()
                    return result
                    
        except Exception as e:
            logger.error(f"Erro ao buscar padrão existente: {e}")
            return None
    
    async def get_recent_ticks(self, symbol: str, hours: int) -> List[dict]:
        """Busca ticks recentes de um símbolo"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        SELECT symbol, price, volume, timestamp, buy_agent, sell_agent, exchange
                        FROM ticks_raw
                        WHERE symbol = %s AND timestamp >= NOW() - INTERVAL '%s hours'
                        ORDER BY timestamp DESC
                    """, (symbol, hours))
                    
                    rows = await cur.fetchall()
                    return [
                        {
                            'symbol': row[0],
                            'price': row[1],
                            'volume': row[2],
                            'timestamp': row[3],
                            'buy_agent': row[4],
                            'sell_agent': row[5],
                            'exchange': row[6]
                        }
                        for row in rows
                    ]
                    
        except Exception as e:
            logger.error(f"Erro ao buscar ticks recentes para {symbol}: {e}")
            return []
    
    async def get_recent_ticks_for_agent(self, symbol: str, agent_id: int, minutes: int) -> List[dict]:
        """Busca trades recentes de um agente específico nas últimas X minutos"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        SELECT symbol, price, volume, timestamp, buy_agent, sell_agent, exchange
                        FROM ticks_raw
                        WHERE symbol = %s 
                          AND timestamp >= NOW() - INTERVAL '%s minutes'
                          AND (buy_agent = %s OR sell_agent = %s)
                        ORDER BY timestamp DESC
                    """, (symbol, minutes, agent_id, agent_id))
                    
                    rows = await cur.fetchall()
                    return [
                        {
                            'symbol': row[0],
                            'price': row[1],
                            'volume': row[2],
                            'timestamp': row[3],
                            'buy_agent': row[4],
                            'sell_agent': row[5],
                            'exchange': row[6]
                        }
                        for row in rows
                    ]
                    
        except Exception as e:
            logger.error(f"Erro ao buscar trades recentes para agente {agent_id} em {symbol}: {e}")
            return []
    
    async def get_active_symbols(self) -> List[str]:
        """Busca símbolos que tiveram atividade nas últimas 24h"""
        try:
            logger.info("🔍 Buscando símbolos ativos nas últimas 24h...")
            
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        SELECT DISTINCT symbol 
                        FROM ticks_raw 
                        WHERE timestamp >= NOW() - INTERVAL '24 hours'
                        ORDER BY symbol
                    """)
                    
                    rows = await cur.fetchall()
                    symbols = [row[0] for row in rows]
                    
                    logger.info(f"📊 Símbolos ativos encontrados: {len(symbols)} - {symbols[:10]}...")
                    return symbols
                    
        except Exception as e:
            logger.error(f"💥 Erro ao buscar símbolos ativos: {e}")
            logger.error(f"📋 Traceback completo:", exc_info=True)
            return []
    
    async def cleanup_old_patterns(self, days: int = 7) -> int:
        """Remove padrões antigos para manter o banco limpo"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    # Remove trades antigos primeiro (foreign key)
                    await cur.execute("""
                        DELETE FROM robot_trades 
                        WHERE created_at < NOW() - INTERVAL '%s days'
                    """, (days,))
                    
                    # Remove padrões antigos
                    await cur.execute("""
                        DELETE FROM robot_patterns 
                        WHERE last_seen < NOW() - INTERVAL '%s days'
                    """, (days,))
                    
                    await conn.commit()
                    logger.info(f"Limpeza de padrões antigos concluída")
                    return 0
                    
        except Exception as e:
            logger.error(f"Erro na limpeza de padrões antigos: {e}")
            return 0

    async def mark_inactivity_notified(self, pattern_id: int) -> bool:
        """Marca um padrão como notificado de inatividade para evitar notificações repetitivas"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        UPDATE robot_patterns 
                        SET inactivity_notified = TRUE 
                        WHERE id = %s
                    """, (pattern_id,))
                    
                    await conn.commit()
                    logger.info(f"✅ Padrão {pattern_id} marcado como notificado de inatividade")
                    return True
                    
        except Exception as e:
            logger.error(f"❌ Erro ao marcar padrão {pattern_id} como notificado: {e}")
            return False

    async def reset_inactivity_notification(self, pattern_id: int) -> bool:
        """Reseta o flag de notificação quando um robô volta a operar"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        UPDATE robot_patterns 
                        SET inactivity_notified = FALSE 
                        WHERE id = %s
                    """, (pattern_id,))
                    
                    await conn.commit()
                    logger.info(f"🔄 Flag de notificação resetado para padrão {pattern_id}")
                    return True
                    
        except Exception as e:
            logger.error(f"❌ Erro ao resetar flag de notificação para padrão {pattern_id}: {e}")
            return False
