import { NextResponse } from 'next/server';
import { createPayment } from '@/lib/asaas';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      customerId, 
      value, 
      creditCardToken,
      description,
      paymentMethod, // Novo campo para identificar o método de pagamento
      paymentId      // ID do pagamento no Firestore
    } = body;

    // Se for pagamento PIX, apenas atualizar o status
    if (paymentMethod === 'PIX') {
      if (!paymentId) {
        return NextResponse.json(
          { error: 'ID do pagamento é obrigatório para PIX' },
          { status: 400 }
        );
      }

      // Atualizar status no Firestore
      await adminDb.collection('payments').doc(paymentId).update({
        status: 'paid',
        paidAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paymentMethod: 'PIX'
      });

      return NextResponse.json({ success: true });
    }

    // Se for cartão de crédito, validar campos obrigatórios
    if (!customerId || !value || !creditCardToken) {
      return NextResponse.json(
        { error: 'Campos obrigatórios faltando para pagamento com cartão' },
        { status: 400 }
      );
    }

    // Obter o IP do cliente
    const forwardedFor = request.headers.get('x-forwarded-for');
    const remoteIp = forwardedFor ? forwardedFor.split(',')[0] : '127.0.0.1';

    // Preparar o payload para o Asaas
    const paymentPayload = {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: value,
      dueDate: new Date().toISOString().split('T')[0],
      description: description || 'Pagamento com cartão',
      creditCardToken: creditCardToken,
      remoteIp: remoteIp
    };

    console.log('Enviando payload:', paymentPayload);

    // Criar pagamento no Asaas
    const payment = await createPayment(paymentPayload);
    
    return NextResponse.json(payment);
  } catch (error: any) {
    console.error('Erro ao processar pagamento:', error);
    
    const errorMessage = error.message || 'Erro ao processar pagamento';
    const statusCode = error.message?.includes('autenticação') ? 401 : 500;
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
} 