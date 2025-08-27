#!/usr/bin/env python3
"""Script para testar busca de trades de robôs"""

import asyncio
import sys
import os

# Corrige o event loop para Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Adiciona o diretório atual ao path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from robot_persistence import RobotPersistence
from config import DATABASE_URL

async def test_robot_trades():
    """Testa a busca de trades de um robô específico"""
    try:
        # Inicializa a persistência
        db_url = DATABASE_URL
        print(f"🔗 Conectando ao banco: {db_url.split('@')[1] if '@' in db_url else 'localhost'}")
        
        persistence = RobotPersistence(db_url)
        
        # Testa com o robô que está dando problema
        symbol = 'BRBI11'
        agent_id = 120
        hours = 24
        
        print(f"\n🔍 Testando busca de trades para:")
        print(f"   Símbolo: {symbol}")
        print(f"   Agente: {agent_id}")
        print(f"   Período: {hours} horas")
        
        # Busca os trades
        trades = await persistence.get_robot_trades(symbol, agent_id, hours)
        
        print(f"\n📊 Resultado:")
        print(f"   Trades encontrados: {len(trades)}")
        
        if trades:
            print(f"\n📋 Primeiros 3 trades:")
            for i, trade in enumerate(trades[:3]):
                print(f"   {i+1}. ID: {trade['id']}, Preço: R$ {trade['price']}, Volume: {trade['volume']}, Lado: {trade['side']}, Timestamp: {trade['timestamp']}")
        else:
            print("   ❌ Nenhum trade encontrado")
            
            # Vamos verificar se existem trades na tabela
            print(f"\n🔍 Verificando se existem trades na tabela robot_trades...")
            
            # Verifica se a tabela tem dados usando conexão direta
            import psycopg
            async with await psycopg.AsyncConnection.connect(db_url) as conn:
                async with conn.cursor() as cur:
                    # Conta total de trades
                    await cur.execute("SELECT COUNT(*) FROM robot_trades")
                    total_trades = await cur.fetchone()
                    print(f"   Total de trades na tabela: {total_trades[0] if total_trades else 0}")
                    
                    # Verifica trades para este símbolo
                    await cur.execute("SELECT COUNT(*) FROM robot_trades WHERE symbol = %s", (symbol,))
                    symbol_trades = await cur.fetchone()
                    print(f"   Trades para {symbol}: {symbol_trades[0] if symbol_trades else 0}")
                    
                    # Verifica trades para este agente
                    await cur.execute("SELECT COUNT(*) FROM robot_trades WHERE agent_id = %s", (agent_id,))
                    agent_trades = await cur.fetchone()
                    print(f"   Trades para agente {agent_id}: {agent_trades[0] if agent_trades else 0}")
                    
                    # Verifica trades para esta combinação
                    await cur.execute("SELECT COUNT(*) FROM robot_trades WHERE symbol = %s AND agent_id = %s", (symbol, agent_id))
                    combo_trades = await cur.fetchone()
                    print(f"   Trades para {symbol} + agente {agent_id}: {combo_trades[0] if combo_trades else 0}")
                    
                    # Mostra alguns exemplos de trades existentes
                    await cur.execute("SELECT symbol, agent_id, timestamp, price, volume, side FROM robot_trades LIMIT 5")
                    sample_trades = await cur.fetchall()
                    if sample_trades:
                        print(f"\n📋 Exemplos de trades existentes:")
                        for trade in sample_trades:
                            print(f"   {trade[0]} | Agente {trade[1]} | {trade[2]} | R$ {trade[3]} | {trade[4]} | {trade[5]}")
        
    except Exception as e:
        print(f"❌ Erro durante o teste: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_robot_trades())
