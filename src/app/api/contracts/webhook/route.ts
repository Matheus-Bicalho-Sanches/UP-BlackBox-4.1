import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Webhook para receber eventos do Assinafy
 * Eventos suportados:
 * - signer_signed_document: quando o signatário assina o documento
 * - signer_filled_fields: quando o signatário preenche os campos (dados coletados)
 * - document_ready: quando o documento está pronto
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Webhook Assinafy recebido:', {
      event: body.event,
      document_id: body.document?.id,
      timestamp: new Date().toISOString()
    });

    const { event, document, signer, assignment, collected_data } = body;

    // Validar que temos pelo menos um document_id
    const documentId = document?.id || assignment?.document_id;
    if (!documentId) {
      console.warn('Webhook sem document_id:', body);
      return NextResponse.json(
        { error: 'document_id não encontrado no webhook' },
        { status: 400 }
      );
    }

    // Buscar contrato pelo documentId do Assinafy
    const contractsSnapshot = await adminDb
      .collection('contracts')
      .where('documentId', '==', documentId)
      .limit(1)
      .get();

    if (contractsSnapshot.empty) {
      console.warn(`Contrato não encontrado para documentId: ${documentId}`);
      // Não retornar erro, apenas logar - pode ser um documento que não foi criado pelo sistema
      return NextResponse.json({ 
        success: true, 
        message: 'Documento não encontrado no sistema' 
      });
    }

    const contractDoc = contractsSnapshot.docs[0];
    const contractRef = contractDoc.ref;
    const updateData: any = {
      updatedAt: FieldValue.serverTimestamp()
    };

    // Processar diferentes tipos de eventos
    switch (event) {
      case 'signer_signed_document':
        // Quando o signatário assina o documento
        updateData.status = 'signed';
        if (assignment?.signed_at) {
          updateData.signedAt = assignment.signed_at;
        } else {
          updateData.signedAt = new Date().toISOString();
        }
        
        // Se houver dados coletados, salvar também
        if (collected_data && Object.keys(collected_data).length > 0) {
          updateData.collectedData = collected_data;
        }
        
        console.log(`Contrato ${contractDoc.id} assinado`);
        break;

      case 'signer_filled_fields':
      case 'document_fields_filled':
        // Quando o signatário preenche os campos (dados coletados)
        if (collected_data && Object.keys(collected_data).length > 0) {
          updateData.collectedData = collected_data;
          updateData.fieldsFilledAt = new Date().toISOString();
        }
        
        console.log(`Dados coletados para contrato ${contractDoc.id}:`, collected_data);
        break;

      case 'document_ready':
        // Quando o documento está pronto
        if (updateData.status !== 'signed') {
          updateData.status = 'sent';
        }
        break;

      case 'document_certificated':
        // Quando o documento é certificado
        updateData.status = 'certificated';
        if (document?.certificated_at) {
          updateData.certificatedAt = document.certificated_at;
        }
        break;

      case 'signer_rejected_document':
        // Quando o signatário rejeita o documento
        updateData.status = 'rejected';
        if (assignment?.rejected_at) {
          updateData.rejectedAt = assignment.rejected_at;
        }
        if (assignment?.decline_reason) {
          updateData.declineReason = assignment.decline_reason;
        }
        break;

      case 'document_expired':
        // Quando o documento expira
        updateData.status = 'expired';
        break;

      default:
        // Para outros eventos, apenas atualizar o timestamp
        console.log(`Evento não processado: ${event}`);
    }

    // Atualizar o contrato no Firestore
    await contractRef.update(updateData);

    console.log(`Contrato ${contractDoc.id} atualizado com sucesso`);

    return NextResponse.json({ 
      success: true,
      contractId: contractDoc.id,
      event: event
    });

  } catch (error: any) {
    console.error('Erro ao processar webhook do Assinafy:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao processar webhook',
        message: error.message 
      },
      { status: 500 }
    );
  }
}

// Permitir apenas POST
export async function GET() {
  return NextResponse.json(
    { error: 'Método não permitido. Use POST.' },
    { status: 405 }
  );
}

