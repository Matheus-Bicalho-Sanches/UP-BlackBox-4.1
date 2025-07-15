import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin'; // Assumindo que você tem adminAuth configurado

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    // Criar usuário usando Firebase Admin SDK
    const userRecord = await adminAuth.createUser({
      email: email,
      password: password,
      emailVerified: false, // Ou true, dependendo da sua lógica
      // Você pode adicionar displayName aqui se quiser, ex: displayName: name
    });

    // Retornar o UID do usuário criado
    return NextResponse.json({ uid: userRecord.uid }, { status: 201 });

  } catch (error: any) {
    console.error('Erro ao criar usuário (Admin SDK):', error);

    // Tratar erros específicos do Firebase Admin, se necessário
    let errorMessage = 'Erro interno ao criar usuário.';
    let statusCode = 500;

    if (error.code === 'auth/email-already-exists') {
      errorMessage = 'Este email já está em uso.';
      statusCode = 409; // Conflict
    } else if (error.code === 'auth/invalid-password') {
      errorMessage = 'A senha fornecida é inválida. Deve ter pelo menos 6 caracteres.';
       statusCode = 400;
    }
    // Adicione mais tratamentos de erro conforme necessário

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
} 