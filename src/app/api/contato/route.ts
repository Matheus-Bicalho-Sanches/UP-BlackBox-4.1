import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase-admin';

const resend = new Resend(process.env.RESEND_API_KEY);

// Email de destino (pode ser configurável via env)
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'matheus.bs@up-gestora.com.br';

type ContactFormData = {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  consent: boolean;
};

function validateFormData(data: any): data is ContactFormData {
  return (
    typeof data.name === 'string' &&
    data.name.trim().length > 0 &&
    typeof data.email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) &&
    typeof data.phone === 'string' &&
    data.phone.trim().length > 0 &&
    typeof data.subject === 'string' &&
    data.subject.trim().length > 0 &&
    typeof data.message === 'string' &&
    data.message.trim().length > 0 &&
    data.consent === true
  );
}

function formatEmailHTML(data: ContactFormData): string {
  const date = new Date().toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'long',
    timeStyle: 'short',
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .content {
            background: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
            border-top: none;
            border-radius: 0 0 8px 8px;
          }
          .field {
            margin-bottom: 20px;
          }
          .field-label {
            font-weight: 600;
            color: #06b6d4;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          .field-value {
            color: #1f2937;
            font-size: 16px;
            padding: 10px;
            background: white;
            border-radius: 4px;
            border: 1px solid #e5e7eb;
          }
          .message-box {
            min-height: 100px;
            white-space: pre-wrap;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">Nova Mensagem do Formulário de Contato</h1>
        </div>
        <div class="content">
          <div class="field">
            <div class="field-label">Nome</div>
            <div class="field-value">${data.name}</div>
          </div>
          <div class="field">
            <div class="field-label">E-mail</div>
            <div class="field-value">${data.email}</div>
          </div>
          <div class="field">
            <div class="field-label">Telefone / WhatsApp</div>
            <div class="field-value">${data.phone}</div>
          </div>
          <div class="field">
            <div class="field-label">Assunto</div>
            <div class="field-value">${data.subject}</div>
          </div>
          <div class="field">
            <div class="field-label">Mensagem</div>
            <div class="field-value message-box">${data.message}</div>
          </div>
          <div class="footer">
            <p>Enviado em: ${date}</p>
            <p>Este email foi enviado automaticamente pelo formulário de contato do site.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    // Verificar se a API key do Resend está configurada
    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY não configurada');
      return NextResponse.json(
        { error: 'Serviço de email não configurado. Por favor, entre em contato diretamente.' },
        { status: 500 }
      );
    }

    const body = await request.json();

    // Validar dados
    if (!validateFormData(body)) {
      return NextResponse.json(
        { error: 'Dados inválidos. Por favor, preencha todos os campos corretamente.' },
        { status: 400 }
      );
    }

    // Enviar email
    // Nota: O domínio "from" precisa ser verificado no Resend
    // Para desenvolvimento, pode usar "onboarding@resend.dev" (domínio de teste do Resend)
    // Para produção, configure um domínio verificado no Resend
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    
    const emailResult = await resend.emails.send({
      from: `Site UP <${fromEmail}>`,
      to: CONTACT_EMAIL,
      replyTo: body.email,
      subject: `[Formulário de Contato] ${body.subject}`,
      html: formatEmailHTML(body),
    });

    // Salvar no Firestore para histórico (opcional, mas recomendado)
    try {
      await adminDb.collection('contact-submissions').add({
        name: body.name,
        email: body.email,
        phone: body.phone,
        subject: body.subject,
        message: body.message,
        consent: body.consent,
        createdAt: new Date(),
        emailSent: true,
        emailId: emailResult.id,
      });
    } catch (firestoreError) {
      // Log do erro mas não falha o request se o email foi enviado
      console.error('Erro ao salvar no Firestore:', firestoreError);
    }

    return NextResponse.json(
      { 
        success: true, 
        message: 'Mensagem enviada com sucesso! Entraremos em contato em até 1 dia útil.' 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Erro ao processar formulário de contato:', error);

    // Erro específico do Resend
    if (error.message?.includes('API key')) {
      return NextResponse.json(
        { error: 'Erro de configuração do serviço de email. Por favor, tente novamente mais tarde.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao enviar mensagem. Por favor, tente novamente ou entre em contato diretamente pelo WhatsApp.' },
      { status: 500 }
    );
  }
}

