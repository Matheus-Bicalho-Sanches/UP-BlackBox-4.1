#!/usr/bin/env python3
import asyncio
import os
from robot_persistence import RobotPersistence

DB = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/high_frequency')

async def main():
    symbol = os.getenv('Q_SYMBOL', 'ABEV3')
    agent = int(os.getenv('Q_AGENT', '120'))
    hours = int(os.getenv('Q_HOURS', '24'))
    p = RobotPersistence(database_url=DB)
    trades = await p.get_robot_trades(symbol, agent, hours)
    print(f"Trades {symbol}-{agent} (últimas {hours}h): {len(trades)}")
    for t in trades[:5]:
        print(t)

if __name__ == '__main__':
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
