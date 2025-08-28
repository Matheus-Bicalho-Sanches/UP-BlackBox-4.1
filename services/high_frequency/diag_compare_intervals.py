#!/usr/bin/env python3
import asyncio
import sys
from datetime import datetime, timezone

# Fix Windows event loop policy for psycopg async
if sys.platform == 'win32':
	asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

symbol = sys.argv[1] if len(sys.argv) > 1 else 'WEGE3'
agent = int(sys.argv[2]) if len(sys.argv) > 2 else 39
minutes = int(sys.argv[3]) if len(sys.argv) > 3 else 60

async def main():
	try:
		import psycopg
		from config import DATABASE_URL
		async with await psycopg.AsyncConnection.connect(DATABASE_URL) as conn:
			async with conn.cursor() as cur:
				print(f"Symbol={symbol} agent={agent} minutes={minutes}")
				# DB time and TZ
				await cur.execute("SELECT now(), current_setting('TimeZone')")
				now_ts, tz = await cur.fetchone()
				print(f"DB now(): {now_ts} | TimeZone={tz}")

				# Last tick for this agent
				await cur.execute(
					"""
					SELECT max(timestamp) FROM ticks_raw 
					WHERE symbol=%s AND (buy_agent=%s OR sell_agent=%s)
					""",
					(symbol, agent, agent),
				)
				last = (await cur.fetchone())[0]
				print(f"max(timestamp) for agent: {last}")

				# A) current code style (as in persistence): INTERVAL '%s minutes'
				await cur.execute(
					"""
					SELECT count(*) FROM ticks_raw 
					WHERE symbol=%s 
					  AND timestamp >= NOW() - INTERVAL '%s minutes'
					  AND (buy_agent=%s OR sell_agent=%s)
					""",
					(symbol, minutes, agent, agent),
				)
				count_a = (await cur.fetchone())[0]

				# B) parameterized interval using concatenation cast
				await cur.execute(
					"""
					SELECT count(*) FROM ticks_raw 
					WHERE symbol=%s 
					  AND timestamp >= NOW() - (%s || ' minutes')::interval
					  AND (buy_agent=%s OR sell_agent=%s)
					""",
					(symbol, str(minutes), agent, agent),
				)
				count_b = (await cur.fetchone())[0]

				# C) make_interval
				await cur.execute(
					"""
					SELECT count(*) FROM ticks_raw 
					WHERE symbol=%s 
					  AND timestamp >= NOW() - make_interval(mins => %s)
					  AND (buy_agent=%s OR sell_agent=%s)
					""",
					(symbol, minutes, agent, agent),
				)
				count_c = (await cur.fetchone())[0]

				print(f"Counts in last {minutes}m: A(cur_style)={count_a}, B(concat)={count_b}, C(make_interval)={count_c}")

				# Show a few rows from method C window for reference
				await cur.execute(
					"""
					SELECT timestamp, price, volume, buy_agent, sell_agent 
					FROM ticks_raw 
					WHERE symbol=%s 
					  AND timestamp >= NOW() - make_interval(mins => %s)
					  AND (buy_agent=%s OR sell_agent=%s)
					ORDER BY timestamp DESC LIMIT 5
					""",
					(symbol, minutes, agent, agent),
				)
				rows = await cur.fetchall()
				print("Sample rows (window C):")
				for r in rows:
					print(r)
	except Exception as e:
		print("Error:", e)

if __name__ == "__main__":
	asyncio.run(main())
