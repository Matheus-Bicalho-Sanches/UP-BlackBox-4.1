import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_BASE_URL = 'https://api.asaas.com/v3';

export async function POST(request: Request) {
  try {
    // Verificar se a API key está definida
    if (!ASAAS_API_KEY) {
      console.error('API Key do Asaas não encontrada');
      return NextResponse.json(
        { error: 'Configuração do Asaas não encontrada' },
        { status: 500 }
      );
    }

    const { clientId, dueDate, value } = await request.json();

    // Buscar dados do cliente no Firestore
    const clientDoc = await adminDb.collection('clients').doc(clientId).get();
    if (!clientDoc.exists) {
      return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    const clientData = clientDoc.data();
    if (!clientData?.asaasId) {
      return NextResponse.json({ error: 'Cliente não possui ID do Asaas' }, { status: 400 });
    }

    // Payload conforme documentação do Asaas
    const paymentPayload = {
      customer: clientData.asaasId,
      billingType: 'UNDEFINED',
      dueDate: dueDate,
      value: value,
      description: 'Pagamento de serviços',
      externalReference: clientId
    };

    console.log('Enviando para Asaas:', {
      url: ASAAS_BASE_URL + '/payments',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY.substring(0, 10) + '...'
      },
      payload: paymentPayload
    });

    try {
      // Criar pagamento no Asaas
      const response = await fetch(`${ASAAS_BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY
        },
        body: JSON.stringify(paymentPayload)
      });

      // Log da resposta completa
      console.log('Status da resposta:', response.status);
      console.log('Headers da resposta:', Object.fromEntries(response.headers.entries()));
      
      const responseText = await response.text();
      console.log('Corpo da resposta:', responseText);

      if (!response.ok) {
        if (response.status === 401) {
          console.error('Erro de autenticação com o Asaas');
          return NextResponse.json({ 
            error: 'Erro de autenticação com o Asaas',
            details: 'Verifique a chave de API'
          }, { status: 401 });
        }

        return NextResponse.json({ 
          error: 'Erro na API do Asaas',
          details: responseText
        }, { status: response.status });
      }

      // Tentar parsear a resposta
      const asaasPayment = JSON.parse(responseText);

      // Salvar o pagamento no Firestore
      await adminDb.collection('asaasPayments').add({
        clientId,
        asaasId: asaasPayment.id,
        value: value,
        dueDate: dueDate,
        status: asaasPayment.status,
        billingType: asaasPayment.billingType,
        invoiceUrl: asaasPayment.invoiceUrl,
        createdAt: new Date().toISOString()
      });

      return NextResponse.json({ 
        success: true,
        id: asaasPayment.id 
      });

    } catch (error: any) {
      console.error('Erro na chamada à API do Asaas:', error);
      return NextResponse.json({ 
        error: 'Erro ao processar pagamento',
        details: error.message
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Erro ao criar pagamento:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao criar pagamento' },
      { status: 500 }
    );
  }
} 