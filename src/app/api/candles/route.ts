import { NextRequest } from 'next/server';
import { pgPool } from '@/lib/db';

type Timeframe = '1m' | '5m' | '15m' | '60m' | '1d' | '1w';

function parseParams(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get('symbol') || '').toUpperCase();
  const exchange = (searchParams.get('exchange') || '').toUpperCase();
  const timeframe = (searchParams.get('timeframe') || '1m') as Timeframe;
  const from = searchParams.get('from'); // ISO opcional
  const to = searchParams.get('to'); // ISO opcional
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1), 10000);
  return { symbol, exchange, timeframe, from, to, limit };
}

export async function GET(request: NextRequest) {
  const { symbol, exchange, timeframe, from, to, limit } = parseParams(request);
  if (!symbol) {
    return new Response(JSON.stringify({ error: 'symbol param required' }), { status: 400 });
  }

  // Base filters
  const where: string[] = ['symbol = $1'];
  let values: any[] = [symbol];
  let idx = values.length + 1;
  if (exchange) {
    where.push(`exchange = $${idx++}`);
    values.push(exchange);
  }
  if (from) {
    where.push(`ts_minute_utc >= $${idx++}`);
    values.push(from);
  }
  if (to) {
    where.push(`ts_minute_utc <= $${idx++}`);
    values.push(to);
  }

  let sql = '';
  if (timeframe === '1m') {
    // Primeiro tenta buscar da tabela candles_1m
    sql = `
      SELECT
        EXTRACT(EPOCH FROM ts_minute_utc) * 1000 AS t,
        o, h, l, c, v, vf
      FROM candles_1m
      WHERE ${where.join(' AND ')}
      ORDER BY ts_minute_utc ASC
      LIMIT $${idx}
    `;
    values.push(limit.toString());
  } else {
    // Agregação on-the-fly a partir de 1m
    const tfToInterval: Record<string, string> = {
      '5m': "5 minutes",
      '15m': "15 minutes",
      '60m': "60 minutes",
      '1d': "1 day",
      '1w': "1 week",
    };
    const bucket = tfToInterval[timeframe] || '5 minutes';

    sql = `
      SELECT
        EXTRACT(EPOCH FROM time_bucket(INTERVAL '${bucket}', ts_minute_utc)) * 1000 AS t,
        first(o, ts_minute_utc) AS o,
        max(h) AS h,
        min(l) AS l,
        last(c, ts_minute_utc) AS c,
        sum(v) AS v,
        sum(vf) AS vf
      FROM candles_1m
      WHERE ${where.join(' AND ')}
      GROUP BY time_bucket(INTERVAL '${bucket}', ts_minute_utc)
      ORDER BY 1 ASC
      LIMIT $${idx}
    `;
    values.push(limit.toString());
  }

  try {
    const client = await pgPool.connect();
    try {
      let result;
      
      if (timeframe === '1m') {
        // Primeiro tenta buscar da tabela candles_1m
        result = await client.query(sql, values);
        
        // Se não retornar dados, usa agregação de ticks
        if (result.rows.length === 0) {
          // Agrega a partir de ticks_raw
          const ticksSql = `
            SELECT
              EXTRACT(EPOCH FROM time_bucket(INTERVAL '1 minute', ts_tick_utc)) * 1000 AS t,
              first(price, ts_tick_utc) AS o,
              max(price) AS h,
              min(price) AS l,
              last(price, ts_tick_utc) AS c,
              sum(volume) AS v,
              sum(volume_financial) AS vf
            FROM ticks_raw
            WHERE ${where.join(' AND ')}
            GROUP BY time_bucket(INTERVAL '1 minute', ts_tick_utc)
            ORDER BY 1 ASC
            LIMIT $${idx}
          `;
          
          // Recalcula valores para a nova query
          const ticksValues = [symbol];
          if (exchange) ticksValues.push(exchange);
          if (from) ticksValues.push(from);
          if (to) ticksValues.push(to);
          ticksValues.push(limit.toString());
          
          result = await client.query(ticksSql, ticksValues);
        }
      } else {
        result = await client.query(sql, values);
      }
      
      return new Response(JSON.stringify(result.rows), {
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('candles_api_error', err);
    return new Response(JSON.stringify({ error: 'db_query_failed' }), { status: 500 });
  }
}


