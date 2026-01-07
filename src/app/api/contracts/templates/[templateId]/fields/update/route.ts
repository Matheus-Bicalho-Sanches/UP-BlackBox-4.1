import { NextRequest, NextResponse } from 'next/server';
import { updateTemplateFields, listFieldDefinitions, getFieldTypes } from '@/lib/assinafy';
import { adminDb } from '@/lib/firebase-admin';

const ASSINAFY_ACCOUNT_ID = process.env.ASSINAFY_ACCOUNT_ID;

/**
 * PUT - Atualiza/importa campos em um template existente
 * 
 * Body:
 * {
 *   fields: [
 *     {
 *       field_id: "id-da-definicao-de-campo",
 *       role_id: "id-do-role-signer",
 *       page_id: 1,
 *       x: 100,
 *       y: 200,
 *       width: 200,
 *       height: 30,
 *       is_required: true
 *     }
 *   ]
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> | { templateId: string } }
) {
  try {
    if (!ASSINAFY_ACCOUNT_ID) {
      return NextResponse.json(
        { error: 'ASSINAFY_ACCOUNT_ID não configurada' },
        { status: 500 }
      );
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const { templateId } = resolvedParams;
    const body = await request.json();

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId é obrigatório' },
        { status: 400 }
      );
    }

    if (!body.fields || !Array.isArray(body.fields)) {
      return NextResponse.json(
        { error: 'Campo "fields" é obrigatório e deve ser um array' },
        { status: 400 }
      );
    }

    // Buscar o templateId do Assinafy no Firestore
    let assinafyTemplateId = templateId;
    
    try {
      const templateDoc = await adminDb.collection('contractTemplates').doc(templateId).get();
      
      if (templateDoc.exists()) {
        const templateData = templateDoc.data();
        if (templateData?.templateId) {
          assinafyTemplateId = templateData.templateId;
          console.log(`Template encontrado no Firestore. ID Assinafy: ${assinafyTemplateId}`);
        }
      }
    } catch (error) {
      console.log('Template não encontrado no Firestore, usando ID direto do Assinafy');
    }

    // Atualizar os campos no template
    const result = await updateTemplateFields(
      ASSINAFY_ACCOUNT_ID,
      assinafyTemplateId,
      body.fields
    );

    return NextResponse.json({
      success: true,
      message: 'Campos atualizados com sucesso',
      data: result.data
    });

  } catch (error: any) {
    console.error('Erro ao atualizar campos do template:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao atualizar campos do template',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Lista definições de campos disponíveis e tipos de campos
 * Útil para saber quais campos podem ser adicionados ao template
 */
export async function GET(request: NextRequest) {
  try {
    if (!ASSINAFY_ACCOUNT_ID) {
      return NextResponse.json(
        { error: 'ASSINAFY_ACCOUNT_ID não configurada' },
        { status: 500 }
      );
    }

    // Buscar definições de campos e tipos disponíveis
    const [fieldDefinitions, fieldTypes] = await Promise.all([
      listFieldDefinitions(ASSINAFY_ACCOUNT_ID, true, true),
      getFieldTypes()
    ]);

    return NextResponse.json({
      success: true,
      fieldDefinitions: fieldDefinitions.data || [],
      fieldTypes: fieldTypes.data || [],
      // Exemplo de estrutura de campo para template
      exampleField: {
        field_id: "id-da-definicao-de-campo",
        role_id: "id-do-role-signer",
        page_id: 1,
        x: 100,
        y: 200,
        width: 200,
        height: 30,
        is_required: true
      }
    });

  } catch (error: any) {
    console.error('Erro ao listar campos disponíveis:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao listar campos disponíveis',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

