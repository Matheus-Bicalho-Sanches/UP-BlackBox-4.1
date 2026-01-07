import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { 
  createSigner, 
  createDocumentFromTemplate, 
  createAssignment,
  getAssinafyTemplateFields
} from '@/lib/assinafy';

const ASSINAFY_ACCOUNT_ID = process.env.ASSINAFY_ACCOUNT_ID;

/**
 * POST - Envia um contrato para assinatura no Assinafy
 * Cria o documento a partir do template, cria o signer e envia para assinatura
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ contractId: string }> | { contractId: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { contractId } = resolvedParams;

    if (!ASSINAFY_ACCOUNT_ID) {
      return NextResponse.json(
        { error: 'ASSINAFY_ACCOUNT_ID não configurada' },
        { status: 500 }
      );
    }

    // Buscar contrato no Firestore
    const contractDoc = await adminDb.collection('contracts').doc(contractId).get();
    
    if (!contractDoc.exists) {
      return NextResponse.json(
        { error: 'Contrato não encontrado' },
        { status: 404 }
      );
    }

    const contractData = contractDoc.data();
    
    if (!contractData?.templateId) {
      return NextResponse.json(
        { error: 'Template ID não encontrado no contrato' },
        { status: 400 }
      );
    }

    // Buscar template no Firestore para obter o templateId do Assinafy
    const templateDoc = await adminDb.collection('contractTemplates').doc(contractData.templateId).get();
    
    if (!templateDoc.exists) {
      return NextResponse.json(
        { error: 'Template não encontrado' },
        { status: 404 }
      );
    }

    const templateData = templateDoc.data();
    const assinafyTemplateId = templateData?.templateId;

    if (!assinafyTemplateId) {
      return NextResponse.json(
        { error: 'Template ID do Assinafy não encontrado' },
        { status: 400 }
      );
    }

    // Buscar roles do template
    const templateFieldsResponse = await getAssinafyTemplateFields(
      ASSINAFY_ACCOUNT_ID,
      assinafyTemplateId
    );
    const templateFields = templateFieldsResponse.data || templateFieldsResponse;
    const roles = templateFields.roles || [];
    
    // Encontrar role do tipo "Signer"
    const signerRole = roles.find((r: any) => 
      r.assignment_type === 'Signer' || r.name === 'Signer'
    );

    if (!signerRole) {
      return NextResponse.json(
        { error: 'Nenhum role "Signer" encontrado no template. Configure um role Signer primeiro.' },
        { status: 400 }
      );
    }

    // Criar signer no Assinafy
    const signerResponse = await createSigner(ASSINAFY_ACCOUNT_ID, {
      full_name: contractData.clientName,
      email: contractData.clientEmail,
      cpf: contractData.clientCpf?.replace(/\D/g, '') || undefined,
    });

    if (signerResponse.status !== 200 && signerResponse.status !== 201) {
      throw new Error(signerResponse.message || 'Erro ao criar signer');
    }

    const signerId = signerResponse.data?.id;
    if (!signerId) {
      throw new Error('Signer ID não retornado pelo Assinafy');
    }

    // Criar documento a partir do template
    const documentResponse = await createDocumentFromTemplate(
      ASSINAFY_ACCOUNT_ID,
      assinafyTemplateId,
      {
        signers: [
          {
            role_id: signerRole.id,
            signer_id: signerId,
          },
        ],
        document_name: `Contrato - ${contractData.clientName}`,
      }
    );

    if (documentResponse.status !== 200 && documentResponse.status !== 201) {
      throw new Error(documentResponse.message || 'Erro ao criar documento');
    }

    const documentId = documentResponse.data?.id;
    if (!documentId) {
      throw new Error('Document ID não retornado pelo Assinafy');
    }

    // Verificar se há campos no template (method: collect) ou não (method: virtual)
    const hasFields = templateFields.fields && Array.isArray(templateFields.fields) && templateFields.fields.length > 0;
    const method = hasFields ? 'collect' : 'virtual';

    // Preparar entries para method=collect se houver campos
    let entries: any[] = [];
    if (method === 'collect' && templateFields.fields) {
      // Agrupar campos por página
      const fieldsByPage: Record<number, any[]> = {};
      
      templateFields.fields.forEach((field: any) => {
        const page = field.page || 1;
        if (!fieldsByPage[page]) {
          fieldsByPage[page] = [];
        }
        fieldsByPage[page].push({
          signer_id: signerId,
          field_id: field.id,
        });
      });

      // Criar entries por página
      entries = Object.entries(fieldsByPage).map(([page, fields]) => ({
        page: parseInt(page),
        fields: fields,
      }));
    }

    // Criar assignment (solicitação de assinatura)
    const assignmentData: any = {
      method: method,
      signer_ids: [signerId],
      message: contractData.notes || 'Por favor, revise e assine o documento.',
    };

    if (contractData.expiresAt) {
      assignmentData.expires_at = new Date(contractData.expiresAt).toISOString();
    }

    if (method === 'collect' && entries.length > 0) {
      assignmentData.entries = entries;
    }

    const assignmentResponse = await createAssignment(documentId, assignmentData);

    if (assignmentResponse.status !== 200 && assignmentResponse.status !== 201) {
      throw new Error(assignmentResponse.message || 'Erro ao criar assignment');
    }

    // Atualizar contrato no Firestore
    await adminDb.collection('contracts').doc(contractId).update({
      documentId: documentId,
      status: 'sent',
      sentAt: new Date().toISOString(),
      signerId: signerId,
      assignmentId: assignmentResponse.data?.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Contrato enviado para assinatura com sucesso!',
      data: {
        documentId: documentId,
        signerId: signerId,
        assignmentId: assignmentResponse.data?.id,
        method: method,
        hasFields: hasFields,
      },
    });
  } catch (error: any) {
    console.error('Erro ao enviar contrato:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Erro ao enviar contrato para assinatura',
        details: error.response?.data || error.stack
      },
      { status: 500 }
    );
  }
}

