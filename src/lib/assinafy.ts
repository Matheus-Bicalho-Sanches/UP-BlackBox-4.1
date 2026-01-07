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

