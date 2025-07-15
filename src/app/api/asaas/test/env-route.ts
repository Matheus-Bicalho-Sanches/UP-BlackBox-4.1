import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ASAAS_API_KEY: process.env.ASAAS_API_KEY ? 'Presente' : 'Ausente',
    ASAAS_ENVIRONMENT: process.env.ASAAS_ENVIRONMENT || 'não definido'
  });
} 