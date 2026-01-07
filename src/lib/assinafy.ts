/**
 * Utilitários para integração com a API do Assinafy
 */

import axios from 'axios';
import FormData from 'form-data';

const ASSINAFY_API_BASE = process.env.ASSINAFY_API_BASE || 'https://api.assinafy.com.br/v1';
const ASSINAFY_API_KEY = process.env.ASSINAFY_API_KEY;
const ASSINAFY_ACCOUNT_ID = process.env.ASSINAFY_ACCOUNT_ID;

export interface AssinafyTemplate {
  id: string;
  name: string;
  status: 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed';
  created_at?: string;
  updated_at?: string;
}

export interface AssinafyResponse<T = any> {
  status: number;
  message: string;
  data: T;
}

/**
 * Faz upload de um template para o Assinafy
 */
export async function uploadTemplateToAssinafy(
  file: File | Buffer,
  fileName: string,
  accountId: string
): Promise<AssinafyResponse<AssinafyTemplate>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  // Converter para Buffer se necessário
  let fileBuffer: Buffer;
  if (Buffer.isBuffer(file)) {
    fileBuffer = file;
  } else {
    // Se for File (cliente), converter para Buffer
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
  }

  // Criar FormData usando o pacote form-data
  const formData = new FormData();
  formData.append('file', fileBuffer, {
    filename: fileName,
    contentType: fileName.endsWith('.pdf') ? 'application/pdf' : 
                 fileName.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                 'application/octet-stream'
  });

  try {
    // Limpar API Key de possíveis espaços ou caracteres invisíveis
    const cleanApiKey = ASSINAFY_API_KEY.trim();
    
    // Log para debug (remover em produção)
    console.log('Enviando template para Assinafy:', {
      url: `${ASSINAFY_API_BASE}/accounts/${accountId}/templates`,
      accountId: accountId,
      fileName: fileName,
      fileSize: fileBuffer.length,
      apiKeyLength: cleanApiKey.length,
      apiKeyPrefix: cleanApiKey.substring(0, 15) + '...',
    });

    // Usar axios que funciona melhor com form-data no Node.js
    const headers = {
      'X-Api-Key': cleanApiKey,
      ...formData.getHeaders(), // Adiciona Content-Type com boundary
    };

    const response = await axios.post(
      `${ASSINAFY_API_BASE}/accounts/${accountId}/templates`,
      formData,
      {
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log('Upload bem-sucedido:', response.status);
    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error || 
                        error.message || 
                        `Erro ao fazer upload do template: ${error.response?.status || 'desconhecido'}`;
    
    console.error('Erro da API Assinafy:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: errorMessage,
      url: `${ASSINAFY_API_BASE}/accounts/${accountId}/templates`,
      accountId: accountId,
      apiKeyLength: ASSINAFY_API_KEY?.trim().length || 0,
      apiKeyPrefix: ASSINAFY_API_KEY ? `${ASSINAFY_API_KEY.trim().substring(0, 15)}...` : 'não configurada'
    });
    
    throw new Error(errorMessage);
  }
}

/**
 * Lista templates do Assinafy
 */
export async function listAssinafyTemplates(
  accountId: string,
  status?: string
): Promise<AssinafyResponse<AssinafyTemplate[]>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  const url = `${ASSINAFY_API_BASE}/accounts/${accountId}/templates`;
  const params: any = {};
  if (status) {
    params.status = status;
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': ASSINAFY_API_KEY,
      },
      params,
    });

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        `Erro ao listar templates: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Obtém detalhes de um template do Assinafy
 */
export async function getAssinafyTemplate(
  accountId: string,
  templateId: string
): Promise<AssinafyResponse<AssinafyTemplate>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const response = await axios.get(
      `${ASSINAFY_API_BASE}/accounts/${accountId}/templates/${templateId}`,
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        `Erro ao obter template: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Obtém os campos de um template do Assinafy
 * Retorna os campos que o cliente precisa preencher
 */
export async function getAssinafyTemplateFields(
  accountId: string,
  templateId: string
): Promise<AssinafyResponse<any>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  if (!accountId) {
    throw new Error('accountId é obrigatório');
  }

  if (!templateId) {
    throw new Error('templateId é obrigatório');
  }

  try {
    const url = `${ASSINAFY_API_BASE}/accounts/${accountId}/templates/${templateId}`;
    
    console.log('Buscando template do Assinafy:', {
      url,
      accountId,
      templateId,
      apiKeyLength: ASSINAFY_API_KEY?.length || 0
    });

    // Buscar o template completo que deve incluir os campos
    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': ASSINAFY_API_KEY.trim(),
      },
    });

    console.log('Resposta do Assinafy:', {
      status: response.status,
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : []
    });

    // A resposta do template deve incluir informações sobre campos, roles, etc.
    // Pode retornar diretamente os dados ou dentro de uma estrutura AssinafyResponse
    if (response.data && typeof response.data === 'object') {
      return response.data;
    }

    throw new Error('Resposta inválida do Assinafy');
  } catch (error: any) {
    console.error('Erro ao buscar template do Assinafy:', {
      accountId,
      templateId,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });

    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        `Erro ao obter campos do template: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Cria uma definição de campo no Assinafy
 * Essas definições podem ser reutilizadas em múltiplos templates
 */
export async function createFieldDefinition(
  accountId: string,
  fieldData: {
    type: string;
    name: string;
    regex?: string;
    is_required?: boolean;
    is_active?: boolean;
  }
): Promise<AssinafyResponse<any>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const response = await axios.post(
      `${ASSINAFY_API_BASE}/accounts/${accountId}/fields`,
      fieldData,
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        `Erro ao criar definição de campo: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Lista todas as definições de campos disponíveis
 */
export async function listFieldDefinitions(
  accountId: string,
  includeInactive?: boolean,
  includeStandard?: boolean
): Promise<AssinafyResponse<any[]>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const params: any = {};
    if (includeInactive !== undefined) params.include_inactive = includeInactive;
    if (includeStandard !== undefined) params.include_standard = includeStandard;

    const response = await axios.get(
      `${ASSINAFY_API_BASE}/accounts/${accountId}/fields`,
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY,
        },
        params,
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        `Erro ao listar definições de campos: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Lista os tipos de campos disponíveis
 */
export async function getFieldTypes(): Promise<AssinafyResponse<any[]>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const response = await axios.get(
      `${ASSINAFY_API_BASE}/field-types`,
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY,
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        `Erro ao listar tipos de campos: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Atualiza os campos de um template
 * Permite adicionar/atualizar campos que o cliente deve preencher
 */
export async function updateTemplateFields(
  accountId: string,
  templateId: string,
  fields: any[]
): Promise<AssinafyResponse<any>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const response = await axios.put(
      `${ASSINAFY_API_BASE}/accounts/${accountId}/templates/${templateId}/fields`,
      { fields: fields },
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        `Erro ao atualizar campos do template: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Cria um role (papel) no template
 * Roles são necessários para associar campos aos signatários
 */
export async function createTemplateRole(
  accountId: string,
  templateId: string,
  roleData: {
    name: string;
    assignment_type: 'Signer' | 'Editor' | 'CopyReceiver';
  }
): Promise<AssinafyResponse<any>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const response = await axios.post(
      `${ASSINAFY_API_BASE}/accounts/${accountId}/templates/${templateId}/roles`,
      roleData,
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        `Erro ao criar role no template: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Lista os roles de um template
 */
export async function getTemplateRoles(
  accountId: string,
  templateId: string
): Promise<AssinafyResponse<any[]>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    // A API do Assinafy retorna os roles quando buscamos o template
    const templateResponse = await getAssinafyTemplateFields(accountId, templateId);
    const templateData = templateResponse.data || templateResponse;
    
    return {
      status: 200,
      message: 'Success',
      data: templateData.roles || []
    };
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.message || 
                        `Erro ao listar roles do template: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Cria um signer (signatário) no Assinafy
 */
export async function createSigner(
  accountId: string,
  signerData: {
    full_name: string;
    email: string;
    cpf?: string;
  }
): Promise<AssinafyResponse<any>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const response = await axios.post(
      `${ASSINAFY_API_BASE}/accounts/${accountId}/signers`,
      signerData,
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY.trim(),
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        `Erro ao criar signer: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Cria um documento a partir de um template
 */
export async function createDocumentFromTemplate(
  accountId: string,
  templateId: string,
  documentData: {
    signers: Array<{
      role_id: string;
      signer_id: string;
    }>;
    editor_fields?: any[];
    document_name?: string;
  }
): Promise<AssinafyResponse<any>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const response = await axios.post(
      `${ASSINAFY_API_BASE}/accounts/${accountId}/templates/${templateId}/documents`,
      documentData,
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY.trim(),
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        `Erro ao criar documento: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Cria um assignment (solicitação de assinatura) para um documento
 * method: 'virtual' (sem campos) ou 'collect' (com campos)
 */
export async function createAssignment(
  documentId: string,
  assignmentData: {
    method: 'virtual' | 'collect';
    signer_ids?: string[];
    message?: string;
    expires_at?: string | null;
    entries?: Array<{
      page: number;
      fields: Array<{
        signer_id: string;
        field_id: string;
        display_settings?: any;
      }>;
    }>;
  }
): Promise<AssinafyResponse<any>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const response = await axios.post(
      `${ASSINAFY_API_BASE}/documents/${documentId}/assignments`,
      assignmentData,
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY.trim(),
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        `Erro ao criar assignment: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

/**
 * Obtém informações de um documento
 */
export async function getDocument(
  documentId: string
): Promise<AssinafyResponse<any>> {
  if (!ASSINAFY_API_KEY) {
    throw new Error('ASSINAFY_API_KEY não configurada');
  }

  try {
    const response = await axios.get(
      `${ASSINAFY_API_BASE}/documents/${documentId}`,
      {
        headers: {
          'X-Api-Key': ASSINAFY_API_KEY.trim(),
        },
      }
    );

    return response.data;
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || 
                        error.response?.data?.error ||
                        error.message || 
                        `Erro ao obter documento: ${error.response?.status || 'desconhecido'}`;
    throw new Error(errorMessage);
  }
}

