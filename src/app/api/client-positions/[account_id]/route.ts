import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_BACKEND_PORT = '8000';

const normalizeBackendUrl = (urlValue?: string | null): string | null => {
  if (!urlValue) {
    return null;
  }

  let normalized = urlValue.trim();
  if (!normalized) {
    return null;
  }

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }

  try {
    const parsed = new URL(normalized);
    if (!parsed.port) {
      parsed.port = DEFAULT_BACKEND_PORT;
    }

    // Remover barra final para evitar duplicidade ao montar endpoints
    const cleanUrl = parsed.toString().replace(/\/$/, '');
    return cleanUrl;
  } catch {
    return null;
  }
};

const buildErrorResponse = (accountId: string, message: string, status = 500) => {
  const headers = {
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'X-Cache-Status': 'no-cache'
  };

  return NextResponse.json(
    {
      success: false,
      positions: [],
      account_id: accountId,
      error: message
    },
    { status, headers }
  );
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { account_id: string } }
) {
  const accountId = params.account_id;

  try {
    const backendUrl = normalizeBackendUrl(
      process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL
    );

    if (!backendUrl) {
      const envs = ['BACKEND_URL', 'NEXT_PUBLIC_BACKEND_URL']
        .map((env) => `${env}=${process.env[env as keyof NodeJS.ProcessEnv] ?? 'undefined'}`)
        .join(' | ');
      const message = `URL do backend não configurada. Verifique variáveis de ambiente. (${envs})`;
      console.error(`[API] ${message}`);
      return buildErrorResponse(accountId, message, 500);
    }

    const targetUrl = `${backendUrl}/client-positions/${accountId}`;
    console.log(`[API] Proxying client positions: ${targetUrl}`);

    let response: Response;
    try {
      response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'X-Requested-With': 'XMLHttpRequest'
        },
        cache: 'no-store'
      });
    } catch (networkError: any) {
      const message = `Falha ao alcançar o backend em ${targetUrl}: ${networkError?.message || networkError}`;
      console.error(`[API] ${message}`);
      return buildErrorResponse(accountId, message, 502);
    }

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Backend respondeu ${response.status}: ${bodyText || 'sem corpo'}`);
    }

    const data = await response.json();

    const responseHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Cache-Status': 'no-cache'
    };

    return NextResponse.json(data, { headers: responseHeaders });
  } catch (error: any) {
    const message = error?.message || 'Erro desconhecido';
    console.error(`[API] Erro ao buscar posições do cliente ${accountId}:`, error);
    return buildErrorResponse(accountId, message, 500);
  }
}