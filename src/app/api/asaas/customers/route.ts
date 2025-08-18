import { NextResponse } from 'next/server'
import { CreateCustomerData } from '@/lib/asaas'

// Configuração do Asaas (exige variável de ambiente)
const config = {
  apiKey: process.env.ASAAS_API_KEY || '',
  environment: process.env.ASAAS_ENVIRONMENT || 'production',
  baseUrl: 'https://api.asaas.com/v3'
}

// Log seguro da configuração (sem expor a chave)
console.log('DEBUG - Configuração:', {
  baseUrl: config.baseUrl,
  environment: config.environment,
  apiKeyLength: config.apiKey ? config.apiKey.length : 0,
  usingEnvVar: Boolean(process.env.ASAAS_API_KEY)
});

export async function POST(request: Request) {
  try {
    if (!config.apiKey) {
      return NextResponse.json(
        { error: 'ASAAS_API_KEY ausente no ambiente' },
        { status: 500 }
      );
    }

    const data: CreateCustomerData = await request.json();

    const payload = {
      name: data.name,
      email: data.email,
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ''),
      phone: data.mobilePhone?.replace(/\D/g, ''),
      notificationDisabled: false,
      externalReference: `up_${Date.now()}`
    };

    // Teste de autenticação
    const testResponse = await fetch(`${config.baseUrl}/customers?limit=1`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access_token': config.apiKey
      }
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('Erro na autenticação:', {
        status: testResponse.status,
        response: errorText
      });
      throw new Error(`Falha na autenticação: ${testResponse.status}`);
    }

    // Criar cliente
    const response = await fetch(`${config.baseUrl}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': config.apiKey
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.error('Erro ao processar resposta:', responseText);
      throw new Error('Erro ao processar resposta do Asaas');
    }

    if (!response.ok) {
      throw new Error(
        responseData?.errors?.[0]?.description || 
        responseData?.message || 
        'Erro ao criar cliente'
      );
    }

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Erro detalhado:', {
      message: error.message,
      cause: error.cause,
      stack: error.stack
    });

    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: error.status || 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ASAAS_API_KEY_ENV: process.env.ASAAS_API_KEY ? 'Presente' : 'Ausente',
    ASAAS_API_KEY_LENGTH_ENV: process.env.ASAAS_API_KEY?.length || 0,
    ASAAS_API_KEY_FALLBACK: 'Configurado como backup',
    ASAAS_ENVIRONMENT: process.env.ASAAS_ENVIRONMENT || 'production',
    USANDO_ENV: process.env.ASAAS_API_KEY === config.apiKey ? 'Sim' : 'Não (usando fallback)'
  });
} 