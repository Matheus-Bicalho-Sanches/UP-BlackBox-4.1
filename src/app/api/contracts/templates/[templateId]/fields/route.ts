import { NextRequest, NextResponse } from 'next/server';
import { getAssinafyTemplateFields } from '@/lib/assinafy';
import { adminDb } from '@/lib/firebase-admin';

const ASSINAFY_ACCOUNT_ID = process.env.ASSINAFY_ACCOUNT_ID;

/**
 * GET - Retorna os campos que o cliente deve preencher em um template
 * 
 * Exemplo de uso:
 * GET /api/contracts/templates/{templateId}/fields
 * 
 * O templateId pode ser:
 * - O ID do Firestore (busca o templateId do Assinafy)
 * - O ID direto do Assinafy
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

    // Next.js 13+ pode retornar params como Promise
    const resolvedParams = params instanceof Promise ? await params : params;
    const { templateId } = resolvedParams;

    if (!templateId) {
      return NextResponse.json(
        { error: 'templateId é obrigatório' },
        { status: 400 }
      );
    }

    // Tentar buscar no Firestore primeiro para obter o templateId do Assinafy
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

    // Buscar os campos do template no Assinafy
    let templateResponse;
    let templateData;
    
    try {
      console.log('Buscando template do Assinafy:', {
        accountId: ASSINAFY_ACCOUNT_ID,
        templateId: assinafyTemplateId
      });

      templateResponse = await getAssinafyTemplateFields(
        ASSINAFY_ACCOUNT_ID,
        assinafyTemplateId
      );

      console.log('Resposta recebida do Assinafy:', {
        hasStatus: !!templateResponse.status,
        status: templateResponse.status,
        hasData: !!templateResponse.data,
        keys: templateResponse ? Object.keys(templateResponse) : []
      });

      // A resposta do Assinafy pode ter estrutura diferente
      // Pode ser: { status: 200, data: {...} } ou diretamente { ... }
      if (templateResponse && typeof templateResponse === 'object') {
        if (templateResponse.status && templateResponse.status !== 200) {
          throw new Error(templateResponse.message || 'Erro ao buscar template');
        }

        // Extrair os dados do template
        templateData = templateResponse.data || templateResponse;
      } else {
        templateData = templateResponse;
      }
      
      if (!templateData || typeof templateData !== 'object') {
        console.error('Resposta inválida do Assinafy:', templateResponse);
        throw new Error('Resposta do Assinafy não contém dados válidos do template');
      }

      console.log('Dados do template extraídos:', {
        hasId: !!templateData.id,
        hasName: !!templateData.name,
        hasFields: !!templateData.fields,
        hasRoles: !!templateData.roles,
        keys: Object.keys(templateData)
      });
    } catch (error: any) {
      console.error('Erro ao buscar template do Assinafy:', {
        templateId: assinafyTemplateId,
        accountId: ASSINAFY_ACCOUNT_ID,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Erro ao buscar template do Assinafy: ${error.message}`);
    }

    // Extrair informações relevantes sobre os campos
    // A estrutura pode variar, então vamos retornar tudo e organizar
    const fieldsInfo = {
      templateId: templateData.id || assinafyTemplateId,
      templateName: templateData.name,
      status: templateData.status,
      // Campos do template (pode estar em diferentes lugares na resposta)
      fields: templateData.fields || templateData.field_definitions || [],
      // Roles do template (Editor, Signer, etc.)
      roles: templateData.roles || [],
      // Páginas do template
      pages: templateData.pages || [],
      // Dados completos para referência
      fullData: templateData
    };

    // Organizar campos por role/signer para facilitar visualização
    const fieldsByRole: Record<string, any[]> = {};
    
    if (fieldsInfo.roles && Array.isArray(fieldsInfo.roles)) {
      fieldsInfo.roles.forEach((role: any) => {
        fieldsByRole[role.name || role.assignment_type || 'unknown'] = [];
      });
    }

    // Se houver campos, organizá-los
    if (Array.isArray(fieldsInfo.fields)) {
      fieldsInfo.fields.forEach((field: any) => {
        const roleName = field.role_name || field.role || 'unknown';
        if (!fieldsByRole[roleName]) {
          fieldsByRole[roleName] = [];
        }
        fieldsByRole[roleName].push({
          id: field.id,
          name: field.name || field.field_name,
          type: field.type || field.field_type,
          required: field.is_required || field.required || false,
          label: field.label || field.display_name,
          placeholder: field.placeholder,
          validation: field.validation || field.regex,
          page: field.page_id || field.page,
          position: field.position || field.coordinates
        });
      });
    }

    const response = {
      success: true,
      template: {
        id: fieldsInfo.templateId,
        name: fieldsInfo.templateName || 'Template sem nome',
        status: fieldsInfo.status || 'unknown'
      },
      // Campos organizados por role
      fieldsByRole: fieldsByRole || {},
      // Lista simples de todos os campos
      allFields: Array.isArray(fieldsInfo.fields) ? fieldsInfo.fields : [],
      // Roles disponíveis
      roles: Array.isArray(fieldsInfo.roles) ? fieldsInfo.roles : [],
      // Informações completas (para debug)
      raw: templateData
    };

    console.log('Resposta final:', {
      success: response.success,
      templateId: response.template.id,
      fieldsCount: response.allFields.length,
      rolesCount: response.roles.length,
      fieldsByRoleKeys: Object.keys(response.fieldsByRole)
    });

    return NextResponse.json(response);

  } catch (error: any) {
    const resolvedParams = params instanceof Promise ? await params : params;
    
    console.error('Erro ao buscar campos do template:', {
      error: error.message,
      stack: error.stack,
      templateId: resolvedParams?.templateId,
      accountId: ASSINAFY_ACCOUNT_ID
    });
    
    // Retornar erro mais detalhado para debug
    return NextResponse.json(
      { 
        success: false,
        error: 'Erro ao buscar campos do template',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? {
          stack: error.stack,
          templateId: resolvedParams?.templateId
        } : undefined
      },
      { status: 500 }
    );
  }
}

