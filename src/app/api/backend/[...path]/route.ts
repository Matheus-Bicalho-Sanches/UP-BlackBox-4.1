import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_BACKEND_PORT = '8000';
const HOP_BY_HOP_HEADERS = [
  'connection',
  'content-length',
  'content-encoding',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host'
];

const normalizeBackendBase = (): string => {
  const raw =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.BACKEND_URL ||
    'http://127.0.0.1:8000';

  let normalized = raw.trim();
  if (!normalized) {
    throw new Error('BACKEND_INTERNAL_URL/BACKEND_URL não configurado');
  }

  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `http://${normalized}`;
  }

  const parsed = new URL(normalized);
  if (!parsed.port) {
    parsed.port = DEFAULT_BACKEND_PORT;
  }

  return parsed.toString().replace(/\/$/, '');
};

const buildTargetUrl = (base: string, pathSegments: string[], search: string) => {
  const cleanedPath = pathSegments.length ? `/${pathSegments.join('/')}` : '';
  return `${base}${cleanedPath}${search}`;
};

const proxyRequest = async (
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) => {
  const backendBase = normalizeBackendBase();
  const url = new URL(request.url);
  const targetUrl = buildTargetUrl(backendBase, params.path ?? [], url.search);

  const proxyHeaders = new Headers(request.headers);
  for (const header of HOP_BY_HOP_HEADERS) {
    proxyHeaders.delete(header);
  }
  proxyHeaders.set('x-forwarded-host', request.headers.get('host') ?? '');
  proxyHeaders.set(
    'x-forwarded-proto',
    request.headers.get('x-forwarded-proto') ?? 'https'
  );

  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;

  console.log(`[API Proxy] ${method} ${targetUrl}`);

  try {
    const backendResponse = await fetch(targetUrl, {
      method,
      headers: proxyHeaders,
      body,
      cache: 'no-store'
    });

    const responseHeaders = new Headers(backendResponse.headers);
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('transfer-encoding');

    return new NextResponse(backendResponse.body, {
      status: backendResponse.status,
      headers: responseHeaders
    });
  } catch (error: any) {
    console.error('[API Proxy] Falha ao contatar backend:', error);
    return NextResponse.json(
      {
        success: false,
        error: `Falha ao contatar backend: ${error?.message || 'erro desconhecido'}`
      },
      { status: 502 }
    );
  }
};

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const OPTIONS = proxyRequest;

