import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { uploadTemplateToAssinafy } from '@/lib/assinafy';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const TEMPLATES_DIR = join(process.cwd(), 'templates', 'contracts');
const ASSINAFY_ACCOUNT_ID = process.env.ASSINAFY_ACCOUNT_ID;

/**
 * POST - Recebe arquivo do frontend, salva na pasta e faz upload para Assinafy
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar variáveis de ambiente
    if (!ASSINAFY_ACCOUNT_ID) {
      console.error('ASSINAFY_ACCOUNT_ID não configurada');
      return NextResponse.json(
        { error: 'ASSINAFY_ACCOUNT_ID não configurada. Verifique o arquivo .env.local' },
        { status: 500 }
      );
    }

    if (!process.env.ASSINAFY_API_KEY) {
      console.error('ASSINAFY_API_KEY não configurada');
      return NextResponse.json(
        { error: 'ASSINAFY_API_KEY não configurada. Verifique o arquivo .env.local' },
        { status: 500 }
      );
    }

    // Log para debug (remover em produção)
    console.log('Variáveis de ambiente:', {
      hasApiKey: !!process.env.ASSINAFY_API_KEY,
      apiKeyLength: process.env.ASSINAFY_API_KEY?.length || 0,
      apiKeyPrefix: process.env.ASSINAFY_API_KEY?.substring(0, 10) || 'não configurada',
      hasAccountId: !!ASSINAFY_ACCOUNT_ID,
      accountId: ASSINAFY_ACCOUNT_ID,
      apiBase: process.env.ASSINAFY_API_BASE || 'https://api.assinafy.com.br/v1',
    });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string || '';

    if (!file) {
      return NextResponse.json(
        { error: 'Arquivo não fornecido' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Nome do template é obrigatório' },
        { status: 400 }
      );
    }

    // Garantir que a pasta existe
    if (!existsSync(TEMPLATES_DIR)) {
      await mkdir(TEMPLATES_DIR, { recursive: true });
    }

    // Salvar arquivo na pasta templates/contracts
    const fileName = file.name;
    const filePath = join(TEMPLATES_DIR, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Fazer upload para o Assinafy
    const uploadResult = await uploadTemplateToAssinafy(
      buffer,
      fileName,
      ASSINAFY_ACCOUNT_ID
    );

    if (uploadResult.status !== 200 && uploadResult.status !== 201) {
      throw new Error(uploadResult.message || 'Erro ao fazer upload');
    }

    const templateData = uploadResult.data;

    // Salvar no Firestore usando Admin SDK
    const docRef = await adminDb.collection('contractTemplates').add({
      name: name,
      description: description,
      status: templateData.status || 'processing',
      templateId: templateData.id, // ID retornado pelo Assinafy
      fileName: fileName,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      template: {
        id: docRef.id,
        name: name,
        description: description,
        status: templateData.status || 'processing',
        templateId: templateData.id,
        fileName: fileName,
      },
    });
  } catch (error: any) {
    console.error('Erro ao fazer upload do template:', error);
    console.error('Stack:', error.stack);
    
    // Retornar mensagem de erro mais detalhada
    let errorMessage = 'Erro ao fazer upload do template';
    
    if (error.message) {
      errorMessage = error.message;
    } else if (error.response) {
      errorMessage = `Erro da API: ${error.response.status} - ${error.response.statusText}`;
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

