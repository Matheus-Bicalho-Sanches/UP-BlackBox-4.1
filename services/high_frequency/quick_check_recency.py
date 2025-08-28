#!/usr/bin/env python3
import asyncio
import sys
from datetime import datetime, timezone

# Uso: python quick_check_recency.py URPR11 6003 60
symbol = sys.argv[1] if len(sys.argv) > 1 else 'URPR11'
agent = int(sys.argv[2]) if len(sys.argv) > 2 else 6003
threshold_min = int(sys.argv[3]) if len(sys.argv) > 3 else 60

async def main():
    try:
        import psycopg
        from config import DATABASE_URL
        async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
            async with conn.cursor() as cur:
                await cur.execute(
                    """
                    SELECT max(timestamp) 
                    FROM ticks_raw 
                    WHERE symbol = %s AND (buy_agent = %s OR sell_agent = %s)
                    """,
                    (symbol, agent, agent),
                )
                row = await cur.fetchone()
                last_ts = row[0]
                now_utc = datetime.now(timezone.utc)
                if last_ts is None:
                    print(f"❌ Sem ticks para {symbol}/{agent}")
                    return
                diff_min = (now_utc - last_ts).total_seconds() / 60.0
                print(f"Símbolo: {symbol}  Agente: {agent}")
                print(f"Último tick: {last_ts}  (UTC)")
                print(f"Agora (UTC): {now_utc}")
                print(f"Recência: {diff_min:.2f} minutos  |  Limite: {threshold_min} minutos")
                print("➡️  Status esperado pelo gate de recência:", "INACTIVE" if diff_min > threshold_min else "ACTIVE")
                
                # Amostra dos últimos 5 ticks
                await cur.execute(
                    """
                    SELECT timestamp, price, volume, buy_agent, sell_agent
                    FROM ticks_raw 
                    WHERE symbol = %s AND (buy_agent = %s OR sell_agent = %s)
                    ORDER BY timestamp DESC LIMIT 5
                    """,
                    (symbol, agent, agent),
                )
                rows = await cur.fetchall()
                print("\nÚltimos 5 ticks:")
                for r in rows:
                    print(r)
    except Exception as e:
        print("❌ Erro no diagnóstico:", e)

if __name__ == "__main__":
    asyncio.run(main())
