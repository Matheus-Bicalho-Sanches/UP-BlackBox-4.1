import psycopg
import os
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict

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
                            avg_trade_size, frequency_minutes, price_aggression, status, 
                            market_volume_percentage, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        pattern.symbol, pattern.exchange, 'TWAP', pattern.confidence_score,
                        pattern.agent_id, pattern.first_seen, pattern.last_seen,
                        pattern.total_volume, pattern.total_trades, pattern.avg_trade_size,
                        pattern.frequency_minutes, pattern.price_aggression, pattern.status.value,
                        pattern.market_volume_percentage, datetime.now(timezone.utc)
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
                            market_volume_percentage = %s,
                            inactivity_notified = CASE 
                                WHEN %s = 'active' THEN FALSE 
                                ELSE inactivity_notified 
                            END
                        WHERE id = %s
                    """, (
                        pattern.last_seen, pattern.total_volume, pattern.total_trades,
                        pattern.avg_trade_size, pattern.frequency_minutes,
                        pattern.price_aggression, pattern.confidence_score,
                        pattern.status.value, pattern.market_volume_percentage,
                        pattern.status.value, pattern_id
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
                    # Converte o tipo de trade para string 'buy'/'sell' conforme a constraint da tabela
                    side_str = None
                    try:
                        # Enum name is 'BUY' or 'SELL'
                        side_str = trade.trade_type.name.lower()
                    except Exception:
                        # Fallback seguro
                        side_str = 'buy' if int(trade.trade_type) == 2 else 'sell'
                    await cur.execute("""
                        INSERT INTO robot_trades (
                            robot_pattern_id, symbol, agent_id, timestamp, price, volume, side, created_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        robot_pattern_id, trade.symbol, trade.agent_id, trade.timestamp,
                        trade.price, trade.volume, side_str, datetime.now(timezone.utc)
                    ))
                    
                    await conn.commit()
                    return True
                    
        except Exception as e:
            logger.error(f"Erro ao salvar trade de robô: {e}")
            return False

    async def save_pattern_and_trades(self, pattern: TWAPPattern, trades: List[RobotTrade]) -> Optional[int]:
        """Salva o padrão e todos os trades em uma única transação (atômico).
        Retorna o pattern_id se sucesso, ou None em caso de erro."""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    # 1) Busca padrão existente (símbolo+agente) para decidir entre UPDATE/INSERT
                    await cur.execute("""
                        SELECT id FROM robot_patterns
                         WHERE symbol = %s AND agent_id = %s AND pattern_type = 'TWAP'
                         ORDER BY last_seen DESC
                         LIMIT 1
                    """, (pattern.symbol, pattern.agent_id))
                    row = await cur.fetchone()
                    if row:
                        pattern_id = row[0]
                        # Atualiza padrão existente
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
                                market_volume_percentage = %s,
                                inactivity_notified = CASE WHEN %s = 'active' THEN FALSE ELSE inactivity_notified END
                             WHERE id = %s
                        """, (
                            pattern.last_seen, pattern.total_volume, pattern.total_trades,
                            pattern.avg_trade_size, pattern.frequency_minutes,
                            pattern.price_aggression, pattern.confidence_score,
                            pattern.status.value, pattern.market_volume_percentage,
                            pattern.status.value, pattern_id
                        ))
                    else:
                        # Insere novo padrão e obtém ID
                        await cur.execute("""
                            INSERT INTO robot_patterns (
                                symbol, exchange, pattern_type, confidence_score, agent_id,
                                first_seen, last_seen, total_volume, total_trades,
                                avg_trade_size, frequency_minutes, price_aggression, status,
                                market_volume_percentage, created_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            RETURNING id
                        """, (
                            pattern.symbol, pattern.exchange, 'TWAP', pattern.confidence_score,
                            pattern.agent_id, pattern.first_seen, pattern.last_seen,
                            pattern.total_volume, pattern.total_trades, pattern.avg_trade_size,
                            pattern.frequency_minutes, pattern.price_aggression, pattern.status.value,
                            pattern.market_volume_percentage, datetime.now(timezone.utc)
                        ))
                        row2 = await cur.fetchone()
                        if not row2:
                            await conn.rollback()
                            logger.error("Falha ao inserir padrão TWAP (sem retorno de ID)")
                            return None
                        pattern_id = row2[0]

                    # 2) Calcula e atualiza market_volume_percentage (se aplicável)
                    try:
                        await cur.execute("""
                            SELECT COALESCE(SUM(price * volume), 0) as total_market_volume
                            FROM ticks_raw 
                            WHERE symbol = %s 
                              AND timestamp BETWEEN %s AND %s
                        """, (pattern.symbol, pattern.first_seen, pattern.last_seen))
                        r2 = await cur.fetchone()
                        market_volume = float(r2[0]) if r2 and r2[0] else 0.0
                        if market_volume > 0:
                            volume_pct = round((pattern.total_volume / market_volume) * 100.0, 2)
                            await cur.execute("""
                                UPDATE robot_patterns
                                   SET market_volume_percentage = %s
                                 WHERE id = %s
                            """, (volume_pct, pattern_id))
                            pattern.market_volume_percentage = volume_pct
                    except Exception as e:
                        logger.warning(f"Não foi possível calcular/atualizar market_volume_percentage: {e}")

                    # 3) Insere os trades referenciando o pattern_id
                    inserted = 0
                    for t in trades:
                        side_str = None
                        try:
                            side_str = t.trade_type.name.lower()
                        except Exception:
                            side_str = 'buy' if int(t.trade_type) == 2 else 'sell'
                        await cur.execute("""
                            INSERT INTO robot_trades (
                                robot_pattern_id, symbol, agent_id, timestamp, price, volume, side, created_at
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (
                            pattern_id, t.symbol, t.agent_id, t.timestamp,
                            t.price, t.volume, side_str, datetime.now(timezone.utc)
                        ))
                        inserted += 1

                    # 4) Commit de tudo
                    await conn.commit()
                    logger.info(f"✅ Padrão {pattern_id} e {inserted}/{len(trades)} trades salvos (transação atômica)")
                    return pattern_id

        except Exception as e:
            logger.error(f"💥 Erro em save_pattern_and_trades: {e}")
            return None
    
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
                        WHERE symbol = %s AND timestamp >= NOW() - make_interval(hours => %s)
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
                          AND timestamp >= NOW() - make_interval(mins => %s)
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
                        WHERE created_at < NOW() - make_interval(days => %s)
                    """, (days,))
                    
                    # Remove padrões antigos
                    await cur.execute("""
                        DELETE FROM robot_patterns 
                        WHERE last_seen < NOW() - make_interval(days => %s)
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

    async def get_robot_trades(self, symbol: str, agent_id: int, hours: int = 24, limit: int = 200) -> List[Dict]:
        """Busca todas as operações de um robô específico"""
        try:
            logger.info(f"🔍 Buscando trades do robô {agent_id} em {symbol} (últimas {hours}h)")
            
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        SELECT 
                            id,
                            symbol,
                            agent_id,
                            timestamp,
                            price,
                            volume,
                            side,
                            robot_pattern_id,
                            created_at
                        FROM robot_trades 
                        WHERE symbol = %s AND agent_id = %s 
                          AND timestamp >= NOW() - (%s || ' hours')::interval
                        ORDER BY timestamp DESC
                        LIMIT %s
                    """, (symbol.upper(), agent_id, str(hours), limit))
                    
                    rows = await cur.fetchall()
                    trades = [
                        {
                            'id': row[0],
                            'symbol': row[1],
                            'agent_id': row[2],
                            'timestamp': row[3].isoformat() if row[3] else None,
                            'price': float(row[4]) if row[4] else 0.0,
                            'volume': int(row[5]) if row[5] else 0,
                            'side': row[6],
                            'pattern_id': row[7],
                            'created_at': row[8].isoformat() if row[8] else None
                        }
                        for row in rows
                    ]
                    
                    logger.info(f"📊 Encontrados {len(trades)} trades para robô {agent_id} em {symbol}")
                    return trades
                    
        except Exception as e:
            logger.error(f"💥 Erro ao buscar trades do robô {agent_id} em {symbol}: {e}")
            logger.error(f"📋 Traceback completo:", exc_info=True)
            return []

    async def get_market_volume_for_period(self, symbol: str, start_time: datetime, end_time: datetime) -> float:
        """Retorna volume total do mercado para um período específico"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        SELECT COALESCE(SUM(price * volume), 0) as total_market_volume
                        FROM ticks_raw 
                        WHERE symbol = %s 
                        AND timestamp BETWEEN %s AND %s
                    """, (symbol, start_time, end_time))
                    
                    result = await cur.fetchone()
                    market_volume = float(result[0]) if result and result[0] else 0.0
                    
                    logger.debug(f"📊 Volume do mercado {symbol}: {market_volume:,.2f} ({start_time} até {end_time})")
                    return market_volume
                    
        except Exception as e:
            logger.error(f"💥 Erro ao calcular volume do mercado {symbol}: {e}")
            return 0.0

    async def update_market_volume_percentage(self, pattern_id: int, new_percentage: float) -> bool:
        """Atualiza apenas o campo market_volume_percentage de um padrão"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        UPDATE robot_patterns 
                        SET market_volume_percentage = %s 
                        WHERE id = %s
                    """, (new_percentage, pattern_id))
                    
                    await conn.commit()
                    logger.debug(f"📊 Volume % atualizado para padrão {pattern_id}: {new_percentage:.2f}%")
                    return True
                    
        except Exception as e:
            logger.error(f"💥 Erro ao atualizar volume % do padrão {pattern_id}: {e}")
            return False

    async def delete_robot_trades_by_pattern(self, pattern_id: int) -> bool:
        """Remove todos os trades relacionados a um padrão específico"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        DELETE FROM robot_trades 
                        WHERE robot_pattern_id = %s
                    """, (pattern_id,))
                    
                    deleted_count = cur.rowcount
                    await conn.commit()
                    logger.info(f"🗑️ {deleted_count} trades removidos para padrão {pattern_id}")
                    return True
                    
        except Exception as e:
            logger.error(f"💥 Erro ao remover trades do padrão {pattern_id}: {e}")
            return False

    async def delete_robot_pattern(self, pattern_id: int) -> bool:
        """Remove um padrão específico do banco"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    await cur.execute("""
                        DELETE FROM robot_patterns 
                        WHERE id = %s
                    """, (pattern_id,))
                    
                    deleted_count = cur.rowcount
                    await conn.commit()
                    logger.info(f"🗑️ Padrão {pattern_id} removido do banco")
                    return deleted_count > 0
                    
        except Exception as e:
            logger.error(f"💥 Erro ao remover padrão {pattern_id}: {e}")
            return False

    async def cleanup_inactive_patterns_from_database(self, max_inactive_hours: int = 3) -> int:
        """Remove diretamente do banco padrões inativos há mais de X horas"""
        try:
            async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
                async with conn.cursor() as cur:
                    # Busca padrões inativos antigos
                    await cur.execute("""
                        SELECT id, symbol, agent_id, last_seen 
                        FROM robot_patterns 
                        WHERE last_seen < NOW() - make_interval(hours => %s)
                        ORDER BY last_seen ASC
                    """, (max_inactive_hours,))
                    
                    patterns_to_remove = await cur.fetchall()
                    removed_count = 0
                    
                    for pattern in patterns_to_remove:
                        pattern_id, symbol, agent_id, last_seen = pattern
                        try:
                            # Remove trades relacionados primeiro (foreign key)
                            await cur.execute("""
                                DELETE FROM robot_trades 
                                WHERE robot_pattern_id = %s
                            """, (pattern_id,))
                            
                            trades_deleted = cur.rowcount
                            
                            # Remove o padrão
                            await cur.execute("""
                                DELETE FROM robot_patterns 
                                WHERE id = %s
                            """, (pattern_id,))
                            
                            if cur.rowcount > 0:
                                removed_count += 1
                                logger.info(f"🗑️ Padrão removido do banco: {symbol} - {get_agent_name(agent_id)} ({agent_id}) - último trade: {last_seen} (há {max_inactive_hours}h)")
                            
                        except Exception as e:
                            logger.error(f"❌ Erro ao remover padrão {pattern_id}: {e}")
                            continue
                    
                    await conn.commit()
                    logger.info(f"✅ Limpeza direta no banco: {removed_count} padrões removidos")
                    return removed_count
                    
        except Exception as e:
            logger.error(f"💥 Erro na limpeza direta do banco: {e}")
            return 0
