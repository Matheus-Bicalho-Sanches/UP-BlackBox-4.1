import { NextRequest } from 'next/server';
import { pgPool } from '@/lib/db';

interface TickQueryParams {
  symbol: string;
  exchange?: string;
  from?: string;
  to?: string;
  limit?: number;
  timeframe?: string; // 'raw', '1m', '5m', '15m', '1h', '1d'
}

function parseParams(request: NextRequest): TickQueryParams {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');
  const exchange = url.searchParams.get('exchange') || 'B';
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const limit = parseInt(url.searchParams.get('limit') || '1000');
  const timeframe = url.searchParams.get('timeframe') || 'raw';

  if (!symbol) {
    throw new Error('symbol parameter is required');
  }

  return { symbol, exchange, from, to, limit, timeframe };
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { symbol, exchange, from, to, limit, timeframe } = parseParams(request);
    
    // Validações
    if (limit > 10000) {
      return new Response(JSON.stringify({ error: 'limit cannot exceed 10000' }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

    let sql: string;
    let values: any[] = [];
    let idx = 1;

    const where: string[] = [`symbol = $${idx}`];
    values.push(symbol);
    idx++;

    if (exchange) {
      where.push(`exchange = $${idx}`);
      values.push(exchange);
      idx++;
    }

    if (from) {
      where.push(`ts_tick_utc >= $${idx}`);
      values.push(new Date(from));
      idx++;
    }

    if (to) {
      where.push(`ts_tick_utc <= $${idx}`);
      values.push(new Date(to));
      idx++;
    }

    if (timeframe === 'raw') {
      // Retorna ticks individuais
      sql = `
        SELECT 
          EXTRACT(EPOCH FROM ts_tick_utc) * 1000 AS t,
          price,
          volume,
          volume_financial,
          trade_id,
          buyer_maker
        FROM ticks_raw
        WHERE ${where.join(' AND ')}
        ORDER BY ts_tick_utc DESC
        LIMIT $${idx}
      `;
      values.push(limit);
    } else {
      // Consolida em candles usando a função do TimescaleDB
      const intervalMap: Record<string, string> = {
        '1m': '1 minute',
        '5m': '5 minutes', 
        '15m': '15 minutes',
        '1h': '1 hour',
        '1d': '1 day'
      };
      
      const interval = intervalMap[timeframe] || '1 minute';
      
      sql = `
        SELECT 
          EXTRACT(EPOCH FROM time_bucket(INTERVAL '${interval}', ts_tick_utc)) * 1000 AS t,
          first(price, ts_tick_utc) AS o,
          max(price) AS h,
          min(price) AS l,
          last(price, ts_tick_utc) AS c,
          sum(volume) AS v,
          sum(volume_financial) AS vf,
          count(*) AS tick_count
        FROM ticks_raw
        WHERE ${where.join(' AND ')}
        GROUP BY time_bucket(INTERVAL '${interval}', ts_tick_utc)
        ORDER BY 1 DESC
        LIMIT $${idx}
      `;
      values.push(limit);
    }

    const client = await pgPool.connect();
    try {
      const result = await client.query(sql, values);
      
      return new Response(JSON.stringify(result.rows), {
        headers: { 'Content-Type': 'application/json' }
      });
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('Error in /api/ticks:', error);
    return new Response(JSON.stringify({ 
      error: 'internal_error', 
      message: error.message 
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
}
