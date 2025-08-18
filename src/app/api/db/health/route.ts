import { NextRequest } from 'next/server';
import { dbHealthCheck } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const now = await dbHealthCheck();
    return new Response(JSON.stringify({ ok: true, now }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: any) {
    console.error('DB health error', err);
    return new Response(JSON.stringify({ ok: false, error: 'db_unreachable' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
}


