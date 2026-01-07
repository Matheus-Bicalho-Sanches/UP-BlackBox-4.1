import { NextRequest, NextResponse } from 'next/server';
import { 
  createFieldDefinition, 
  listFieldDefinitions, 
  getFieldTypes,
  createTemplateRole,
  getTemplateRoles,
  updateTemplateFields,
  getAssinafyTemplateFields
} from '@/lib/assinafy';
import { adminDb } from '@/lib/firebase-admin';

const ASSINAFY_ACCOUNT_ID = process.env.ASSINAFY_ACCOUNT_ID;

/**
 * GET - Retorna informações sobre como configurar o template
 * Mostra: roles disponíveis, campos disponíveis, exemplo de configuração
 */
export async function GET(
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

    // Buscar o templateId do Assinafy no Firestore
    let assinafyTemplateId = templateId;
    let templateName = 'Template';
    
    try {
      const templateDoc = await adminDb.collection('contractTemplates').doc(templateId).get();
      if (templateDoc.exists()) {
        const templateData = templateDoc.data();
        if (templateData?.templateId) {
          assinafyTemplateId = templateData.templateId;
        }
        if (templateData?.name) {
          templateName = templateData.name;
        }
      }
    } catch (error) {
      console.log('Template não encontrado no Firestore');
    }

    // Buscar informações do template, roles, campos disponíveis
    const [templateInfo, roles, fieldDefinitions, fieldTypes] = await Promise.all([
      getAssinafyTemplateFields(ASSINAFY_ACCOUNT_ID, assinafyTemplateId).catch(() => null),
      getTemplateRoles(ASSINAFY_ACCOUNT_ID, assinafyTemplateId).catch(() => ({ data: [] })),
      listFieldDefinitions(ASSINAFY_ACCOUNT_ID, true, true).catch(() => ({ data: [] })),
      getFieldTypes().catch(() => ({ data: [] }))
    ]);

    const templateData = templateInfo?.data || templateInfo || {};
    const rolesList = roles.data || [];
    const fieldsList = fieldDefinitions.data || [];
    const typesList = fieldTypes.data || [];

    return NextResponse.json({
      success: true,
      template: {
        id: assinafyTemplateId,
        name: templateName,
        status: templateData.status
      },
      // Roles existentes no template
      existingRoles: rolesList,
      // Definições de campos disponíveis
      availableFieldDefinitions: fieldsList,
      // Tipos de campos disponíveis
      availableFieldTypes: typesList,
      // Campos já configurados no template
      existingFields: templateData.fields || [],
      // Guia de configuração
      setupGuide: {
        step1: 'Criar definições de campos (se necessário)',
        step2: 'Criar role Signer no template (se não existir)',
        step3: 'Adicionar campos ao template usando PUT /api/contracts/templates/{id}/fields/update',
        example: {
          createField: {
            method: 'POST',
            url: `/api/contracts/templates/${templateId}/setup/field`,
            body: {
              type: 'text',
              name: 'Nome Completo',
              is_required: true
            }
          },
          createRole: {
            method: 'POST',
            url: `/api/contracts/templates/${templateId}/setup/role`,
            body: {
              name: 'Signer',
              assignment_type: 'Signer'
            }
          },
          addFieldsToTemplate: {
            method: 'PUT',
            url: `/api/contracts/templates/${templateId}/fields/update`,
            body: {
              fields: [
                {
                  field_id: 'id-da-definicao-de-campo',
                  role_id: 'id-do-role-signer',
                  page_id: 1,
                  x: 100,
                  y: 200,
                  width: 200,
                  height: 30,
                  is_required: true
                }
              ]
            }
          }
        }
      }
    });

  } catch (error: any) {
    console.error('Erro ao buscar informações de setup:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao buscar informações de setup',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Cria uma definição de campo e opcionalmente adiciona ao template
 */
export async function POST(
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

    // Buscar o templateId do Assinafy
    let assinafyTemplateId = templateId;
    try {
      const templateDoc = await adminDb.collection('contractTemplates').doc(templateId).get();
      if (templateDoc.exists()) {
        const templateData = templateDoc.data();
        if (templateData?.templateId) {
          assinafyTemplateId = templateData.templateId;
        }
      }
    } catch (error) {
      console.log('Template não encontrado no Firestore');
    }

    const { action, ...data } = body;

    if (action === 'create_field') {
      // Criar definição de campo
      const fieldDef = await createFieldDefinition(ASSINAFY_ACCOUNT_ID, {
        type: data.type,
        name: data.name,
        regex: data.regex,
        is_required: data.is_required || false,
        is_active: data.is_active !== false
      });

      return NextResponse.json({
        success: true,
        message: 'Definição de campo criada com sucesso',
        fieldDefinition: fieldDef.data
      });
    }

    if (action === 'create_role') {
      // Criar role no template
      const role = await createTemplateRole(ASSINAFY_ACCOUNT_ID, assinafyTemplateId, {
        name: data.name,
        assignment_type: data.assignment_type
      });

      return NextResponse.json({
        success: true,
        message: 'Role criado com sucesso',
        role: role.data
      });
    }

    return NextResponse.json(
      { error: 'Ação não reconhecida. Use: create_field ou create_role' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Erro ao configurar template:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao configurar template',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

