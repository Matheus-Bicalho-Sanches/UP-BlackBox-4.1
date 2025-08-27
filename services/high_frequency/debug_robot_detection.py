#!/usr/bin/env python3
"""
Script de debug para investigar problema de reconhecimento de robôs
"""

import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

# Adiciona o diretório atual ao path para imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    import psycopg
except ImportError:
    print("❌ psycopg não encontrado. Instale com: pip install psycopg")
    sys.exit(1)

# Configuração do banco
DATABASE_URL = os.getenv('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/market_data')

async def check_database_connection():
    """Verifica conexão com o banco"""
    print("🔌 Testando conexão com o banco...")
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            print("✅ Conexão com banco estabelecida")
            return True
    except Exception as e:
        print(f"❌ Erro de conexão: {e}")
        return False

async def check_ticks_data():
    """Verifica se há dados de ticks na base"""
    print("\n📊 Verificando dados de ticks...")
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Conta total de ticks
                await cur.execute("SELECT COUNT(*) FROM ticks_raw")
                total_ticks = await cur.fetchone()
                print(f"📈 Total de ticks na base: {total_ticks[0]:,}")
                
                # Verifica ticks das últimas 24h
                await cur.execute("""
                    SELECT COUNT(*) FROM ticks_raw 
                    WHERE timestamp >= NOW() - INTERVAL '24 hours'
                """)
                recent_ticks = await cur.fetchone()
                print(f"⏰ Ticks das últimas 24h: {recent_ticks[0]:,}")
                
                # Verifica ticks das últimas 1h
                await cur.execute("""
                    SELECT COUNT(*) FROM ticks_raw 
                    WHERE timestamp >= NOW() - INTERVAL '1 hour'
                """)
                last_hour_ticks = await cur.fetchone()
                print(f"⏰ Ticks da última hora: {last_hour_ticks[0]:,}")
                
                # Verifica símbolos únicos
                await cur.execute("""
                    SELECT COUNT(DISTINCT symbol) FROM ticks_raw 
                    WHERE timestamp >= NOW() - INTERVAL '24 hours'
                """)
                unique_symbols = await cur.fetchone()
                print(f"📊 Símbolos únicos (24h): {unique_symbols[0]}")
                
                # Lista símbolos
                await cur.execute("""
                    SELECT DISTINCT symbol FROM ticks_raw 
                    WHERE timestamp >= NOW() - INTERVAL '24 hours'
                    ORDER BY symbol
                """)
                symbols = await cur.fetchall()
                print(f"📋 Símbolos: {[s[0] for s in symbols]}")
                
                # Verifica agentes únicos
                await cur.execute("""
                    SELECT COUNT(DISTINCT buy_agent) + COUNT(DISTINCT sell_agent) as total_agents
                    FROM ticks_raw 
                    WHERE timestamp >= NOW() - INTERVAL '24 hours'
                """)
                total_agents = await cur.fetchone()
                print(f"👥 Total de agentes únicos (24h): {total_agents[0]}")
                
                # Verifica se há agentes com muitos trades
                await cur.execute("""
                    SELECT 
                        COALESCE(buy_agent, sell_agent) as agent_id,
                        COUNT(*) as trade_count,
                        COUNT(DISTINCT symbol) as symbols_count
                    FROM ticks_raw 
                    WHERE timestamp >= NOW() - INTERVAL '24 hours'
                    GROUP BY COALESCE(buy_agent, sell_agent)
                    HAVING COUNT(*) >= 5
                    ORDER BY trade_count DESC
                    LIMIT 10
                """)
                top_agents = await cur.fetchall()
                print(f"\n🏆 Top 10 agentes por volume de trades:")
                for agent in top_agents:
                    print(f"   Agente {agent[0]}: {agent[1]} trades em {agent[2]} símbolos")
                
                return recent_ticks[0] > 0
                
    except Exception as e:
        print(f"❌ Erro ao verificar ticks: {e}")
        return False

async def check_robot_patterns_table():
    """Verifica se a tabela robot_patterns existe e tem dados"""
    print("\n🤖 Verificando tabela robot_patterns...")
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Verifica se a tabela existe
                await cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'robot_patterns'
                    )
                """)
                table_exists = await cur.fetchone()
                
                if not table_exists[0]:
                    print("❌ Tabela robot_patterns não existe!")
                    return False
                
                print("✅ Tabela robot_patterns existe")
                
                # Conta padrões existentes
                await cur.execute("SELECT COUNT(*) FROM robot_patterns")
                total_patterns = await cur.fetchone()
                print(f"📊 Total de padrões salvos: {total_patterns[0]}")
                
                # Verifica padrões das últimas 24h
                await cur.execute("""
                    SELECT COUNT(*) FROM robot_patterns 
                    WHERE created_at >= NOW() - INTERVAL '24 hours'
                """)
                recent_patterns = await cur.fetchone()
                print(f"⏰ Padrões das últimas 24h: {recent_patterns[0]}")
                
                # Verifica status dos padrões
                await cur.execute("""
                    SELECT status, COUNT(*) 
                    FROM robot_patterns 
                    GROUP BY status
                """)
                status_counts = await cur.fetchall()
                print(f"📋 Status dos padrões:")
                for status, count in status_counts:
                    print(f"   {status}: {count}")
                
                return True
                
    except Exception as e:
        print(f"❌ Erro ao verificar robot_patterns: {e}")
        return False

async def test_agent_analysis():
    """Testa a análise de um agente específico"""
    print("\n🧪 Testando análise de agente...")
    try:
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                
                # Busca um agente com muitos trades para teste
                await cur.execute("""
                    SELECT 
                        COALESCE(buy_agent, sell_agent) as agent_id,
                        symbol,
                        COUNT(*) as trade_count,
                        MIN(timestamp) as first_trade,
                        MAX(timestamp) as last_trade
                    FROM ticks_raw 
                    WHERE timestamp >= NOW() - INTERVAL '24 hours'
                    GROUP BY COALESCE(buy_agent, sell_agent), symbol
                    HAVING COUNT(*) >= 10
                    ORDER BY trade_count DESC
                    LIMIT 1
                """)
                
                agent_data = await cur.fetchone()
                if not agent_data:
                    print("❌ Nenhum agente com 10+ trades encontrado")
                    return
                
                agent_id, symbol, trade_count, first_trade, last_trade = agent_data
                print(f"🔍 Analisando agente {agent_id} em {symbol}:")
                print(f"   Trades: {trade_count}")
                print(f"   Período: {first_trade} até {last_trade}")
                
                # Busca trades detalhados deste agente
                await cur.execute("""
                    SELECT 
                        timestamp,
                        price,
                        volume,
                        CASE 
                            WHEN buy_agent = %s THEN 'BUY'
                            WHEN sell_agent = %s THEN 'SELL'
                        END as side
                    FROM ticks_raw 
                    WHERE (buy_agent = %s OR sell_agent = %s)
                    AND symbol = %s
                    AND timestamp >= NOW() - INTERVAL '24 hours'
                    ORDER BY timestamp
                """, (agent_id, agent_id, agent_id, agent_id, symbol))
                
                trades = await cur.fetchall()
                print(f"   Trades encontrados: {len(trades)}")
                
                # Calcula métricas básicas
                if len(trades) > 1:
                    prices = [float(t[1]) for t in trades]
                    volumes = [int(t[2]) for t in trades]
                    timestamps = [t[0] for t in trades]
                    
                    # Frequência média
                    time_deltas = []
                    for i in range(1, len(timestamps)):
                        delta = (timestamps[i] - timestamps[i-1]).total_seconds() / 60.0
                        time_deltas.append(delta)
                    
                    avg_frequency = sum(time_deltas) / len(time_deltas) if time_deltas else 0
                    total_volume = sum(volumes)
                    price_variation = ((max(prices) - min(prices)) / min(prices)) * 100 if prices else 0
                    
                    print(f"   📊 Métricas calculadas:")
                    print(f"      Frequência média: {avg_frequency:.3f} min")
                    print(f"      Volume total: {total_volume:,}")
                    print(f"      Variação preço: {price_variation:.2f}%")
                    
                    # Simula score de confiança
                    score = 0.0
                    if trade_count >= 10: score += 0.15
                    if 0.001 <= avg_frequency <= 60.0: score += 0.3
                    if price_variation <= 15.0: score += 0.2
                    if avg_frequency <= 5.0: score += 0.25
                    
                    print(f"      Score simulado: {score:.2f}")
                    
                    if score >= 0.3:
                        print(f"   ✅ Este agente DEVERIA ser detectado como robô!")
                    else:
                        print(f"   ❌ Score insuficiente para detecção")
                else:
                    print(f"   ❌ Poucos trades para análise")
                
    except Exception as e:
        print(f"❌ Erro ao testar análise: {e}")

async def check_configuration():
    """Verifica configuração do sistema"""
    print("\n⚙️ Verificando configuração...")
    try:
        # Verifica variáveis de ambiente
        print(f"🌐 DATABASE_URL: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'Configurado'}")
        
        # Verifica se o backend está rodando
        print("🔌 Backend rodando: Sim (assumindo)")
        
        # Mostra configuração padrão
        print("📋 Configuração padrão:")
        print("   min_trades: 5")
        print("   min_confidence: 0.3")
        print("   min_total_volume: 1000")
        print("   min_frequency_minutes: 0.001")
        print("   max_frequency_minutes: 60.0")
        print("   active_recency_threshold_minutes: 5")
        
    except Exception as e:
        print(f"❌ Erro ao verificar configuração: {e}")

async def main():
    """Função principal de debug"""
    print("=" * 60)
    print("🔍 DEBUG: Sistema de Reconhecimento de Robôs")
    print("=" * 60)
    
    # Testa conexão
    if not await check_database_connection():
        print("❌ Falha na conexão com banco. Abortando.")
        return
    
    # Verifica dados
    has_ticks = await check_ticks_data()
    if not has_ticks:
        print("❌ Nenhum tick encontrado. Sistema não está recebendo dados.")
        return
    
    # Verifica tabela de padrões
    await check_robot_patterns_table()
    
    # Testa análise
    await test_agent_analysis()
    
    # Verifica configuração
    await check_configuration()
    
    print("\n" + "=" * 60)
    print("✅ Diagnóstico concluído!")
    print("💡 Verifique os resultados acima para identificar o problema")
    print("=" * 60)

if __name__ == "__main__":
    # Configura event loop para Windows
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    # Executa debug
    asyncio.run(main())
