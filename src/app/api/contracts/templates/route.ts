import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { uploadTemplateToAssinafy } from '@/lib/assinafy';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const TEMPLATES_DIR = join(process.cwd(), 'templates', 'contracts');
const ASSINAFY_ACCOUNT_ID = process.env.ASSINAFY_ACCOUNT_ID;

/**
 * GET - Lista templates disponíveis na pasta e no Firestore
 */
export async function GET(request: NextRequest) {
  try {
    // Listar arquivos na pasta templates/contracts
    let localFiles: string[] = [];
    try {
      const files = await readdir(TEMPLATES_DIR);
      localFiles = files.filter(file => file.endsWith('.docx') || file.endsWith('.pdf'));
    } catch (error) {
      console.warn('Pasta de templates não encontrada ou vazia:', error);
    }

    // Buscar templates no Firestore usando Admin SDK
    const templatesSnapshot = await adminDb.collection('contractTemplates')
      .orderBy('createdAt', 'desc')
      .get();
    
    const firestoreTemplates = templatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      success: true,
      localFiles,
      templates: firestoreTemplates,
    });
  } catch (error: any) {
    console.error('Erro ao listar templates:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao listar templates' },
      { status: 500 }
    );
  }
}

/**
 * POST - Faz upload de um template para o Assinafy
 * Body: { fileName: string, name: string, description?: string }
 */
export async function POST(request: NextRequest) {
  try {
    if (!ASSINAFY_ACCOUNT_ID) {
      return NextResponse.json(
        { error: 'ASSINAFY_ACCOUNT_ID não configurada' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { fileName, name, description } = body;

    if (!fileName || !name) {
      return NextResponse.json(
        { error: 'fileName e name são obrigatórios' },
        { status: 400 }
      );
    }

    // Ler o arquivo da pasta templates/contracts
    const filePath = join(TEMPLATES_DIR, fileName);
    let fileBuffer: Buffer;
    
    try {
      fileBuffer = await readFile(filePath);
    } catch (error) {
      return NextResponse.json(
        { error: `Arquivo não encontrado: ${fileName}` },
        { status: 404 }
      );
    }

    // TODO: Converter DOCX para PDF se necessário
    // Por enquanto, assumimos que o arquivo já está em PDF ou que o Assinafy aceita DOCX
    // Se precisar converter, pode usar bibliotecas como:
    // - libreoffice-convert (requer LibreOffice instalado)
    // - docx-pdf (npm package)
    // - ou uma API externa de conversão

    // Fazer upload para o Assinafy
    const uploadResult = await uploadTemplateToAssinafy(
      fileBuffer,
      fileName,
      ASSINAFY_ACCOUNT_ID
    );

    if (uploadResult.status !== 200 && uploadResult.status !== 201) {
      throw new Error(uploadResult.message || 'Erro ao fazer upload');
    }

    const templateData = uploadResult.data;

    // Salvar no Firestore usando Admin SDK
    const docRef = await adminDb.collection('contractTemplates').add({
      name: name || templateData.name || fileName,
      description: description || '',
      status: templateData.status || 'processing',
      templateId: templateData.id, // ID retornado pelo Assinafy
      fileName: fileName,
      createdAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      template: {
        id: docRef.id,
        name: name || templateData.name || fileName,
        description: description || '',
        status: templateData.status || 'processing',
        templateId: templateData.id,
        fileName: fileName,
      },
      assinafyResponse: templateData,
    });
  } catch (error: any) {
    console.error('Erro ao fazer upload do template:', error);
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload do template' },
      { status: 500 }
    );
  }
}

