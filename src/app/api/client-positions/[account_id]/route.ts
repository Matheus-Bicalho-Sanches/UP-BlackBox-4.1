import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { account_id: string } }
) {
  try {
    const accountId = params.account_id;
    
    // URL do backend (ajuste conforme necessário)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    // Fazer requisição para o backend com headers anti-cache
    const response = await fetch(`${backendUrl}/client-positions/${accountId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'X-Requested-With': 'XMLHttpRequest'
      },
      cache: 'no-store' // Força o fetch a não usar cache
    });
    
    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Adicionar headers anti-cache para forçar sempre buscar dados frescos
    const responseHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Cache-Status': 'no-cache'
    };
    
    return NextResponse.json(data, { headers: responseHeaders });
  } catch (error: any) {
    console.error(`[API] Erro ao buscar posições do cliente ${params.account_id}:`, error);
    
    // Headers anti-cache para resposta de erro também
    const errorHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Cache-Status': 'no-cache'
    };
    
    return NextResponse.json(
      { 
        success: false,
        positions: [],
        account_id: params.account_id,
        error: error.message 
      },
      { status: 500, headers: errorHeaders }
    );
  }
} 