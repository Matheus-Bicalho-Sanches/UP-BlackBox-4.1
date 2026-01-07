'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc, serverTimestamp, getFirestore } from 'firebase/firestore';
import app from '@/config/firebase';

// Interface para templates de contrato
interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  status: 'ready' | 'processing' | 'failed';
  createdAt?: any;
  templateId?: string; // ID do template no Assinafy
}

// Interface para dados do formulário
interface NewContractFormData {
  templateId: string;
  clientName: string;
  clientEmail: string;
  clientCpf: string;
  notes?: string;
  expiresAt?: string;
}

export default function NewContractPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);
  const [showClientForm, setShowClientForm] = useState(false);
  const db = getFirestore(app);
  
  const [formData, setFormData] = useState<NewContractFormData>({
    templateId: '',
    clientName: '',
    clientEmail: '',
    clientCpf: '',
    notes: '',
    expiresAt: ''
  });

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        console.log('Buscando templates...');
        const response = await fetch('/api/contracts/templates');
        
        if (!response.ok) {
          throw new Error(`Erro HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Resposta da API:', data);
        
        if (data.success && data.templates) {
          console.log(`Total de templates encontrados: ${data.templates.length}`);
          console.log('Templates:', data.templates);
          
          // Filtrar apenas templates prontos
          const readyTemplates = data.templates.filter((t: ContractTemplate) => t.status === 'ready');
          console.log(`Templates prontos: ${readyTemplates.length}`);
          
          if (readyTemplates.length === 0 && data.templates.length > 0) {
            // Se não há templates prontos, mas há templates, mostrar todos
            console.log('Nenhum template pronto encontrado, mostrando todos os templates');
            setTemplates(data.templates);
          } else {
            setTemplates(readyTemplates);
          }
        } else {
          console.error('Resposta da API sem sucesso ou sem templates:', data);
          if (data.error) {
            setError(`Erro: ${data.error}`);
          } else {
            setError('Não foi possível carregar os templates. Por favor, tente novamente.');
          }
        }
      } catch (error: any) {
        console.error('Erro ao buscar templates:', error);
        setError(`Erro ao buscar templates: ${error.message || 'Erro desconhecido'}`);
      } finally {
        setLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, []);

  const handleTemplateSelect = (template: ContractTemplate) => {
    setSelectedTemplate(template);
    setFormData(prev => ({ ...prev, templateId: template.id }));
    setShowClientForm(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const formatCpf = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      if (cleaned.length <= 3) return cleaned;
      if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
      if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
    }
    return value;
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCpf(e.target.value);
    setFormData(prev => ({ ...prev, clientCpf: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validações
      if (!formData.templateId) {
        throw new Error('Por favor, selecione um template.');
      }
      if (!formData.clientName || !formData.clientEmail || !formData.clientCpf) {
        throw new Error('Por favor, preencha todos os campos obrigatórios do cliente.');
      }

      // Criar contrato no Firestore
      const contractData = {
        templateId: formData.templateId,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientCpf: formData.clientCpf.replace(/\D/g, ''), // Salvar apenas números
        status: 'draft',
        notes: formData.notes || '',
        expiresAt: formData.expiresAt || null,
        createdAt: serverTimestamp(),
        // Estes campos serão preenchidos quando o contrato for enviado para o Assinafy
        documentId: null,
        signedAt: null,
        hash: null
      };
      
      const contractsCollection = collection(db, 'contracts');
      const docRef = await addDoc(contractsCollection, contractData);
      
      console.log('Contrato criado com ID:', docRef.id);
      
      // Redirecionar para a página de detalhes do contrato (ou para a lista)
      router.push(`/dashboard/contracts/${docRef.id}`);
    } catch (error: any) {
      console.error('Erro ao criar contrato:', error);
      setError(error.message || 'Ocorreu um erro ao criar o contrato. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToTemplates = () => {
    setSelectedTemplate(null);
    setShowClientForm(false);
    setFormData({
      templateId: '',
      clientName: '',
      clientEmail: '',
      clientCpf: '',
      notes: '',
      expiresAt: ''
    });
  };

  if (loadingTemplates) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="w-[95%] max-w-4xl mx-auto pt-6 pb-6">
      <div className="flex items-center mb-6">
        <Link 
          href="/dashboard/contracts" 
          className="mr-4 text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">
          {showClientForm ? 'Novo Contrato - Dados do Cliente' : 'Novo Contrato - Selecionar Template'}
        </h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-md text-red-200">
          {error}
        </div>
      )}

      {!showClientForm ? (
        /* Seleção de Template */
        <div className="bg-gray-800 rounded-lg shadow p-6">
          {loadingTemplates ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Carregando templates...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <svg 
                className="mx-auto h-12 w-12 text-gray-400 mb-4" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-400 mb-4">Nenhum template de contrato disponível.</p>
              <p className="text-gray-500 text-sm mb-4">
                Os templates serão criados através da integração com o Assinafy.
              </p>
              <Link
                href="/dashboard/contracts"
                className="inline-block px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors"
              >
                Voltar para Contratos
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-300 mb-4">
                Selecione um template para criar um novo contrato:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="p-4 bg-gray-700 hover:bg-gray-600 rounded-lg border border-gray-600 hover:border-cyan-500 transition-all text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                      <span className={`px-2 py-1 text-white text-xs rounded ${
                        template.status === 'ready' 
                          ? 'bg-green-500' 
                          : template.status === 'processing' 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                      }`}>
                        {template.status === 'ready' 
                          ? 'Pronto' 
                          : template.status === 'processing' 
                          ? 'Processando' 
                          : 'Erro'}
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-gray-400 text-sm mt-2">{template.description}</p>
                    )}
                    <div className="mt-3 flex items-center text-cyan-400 text-sm">
                      <span>Selecionar</span>
                      <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Formulário de Dados do Cliente */
        <div className="bg-gray-800 rounded-lg shadow p-6">
          {selectedTemplate && (
            <div className="mb-6 p-4 bg-gray-700 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Template selecionado:</p>
                  <p className="text-white font-semibold">{selectedTemplate.name}</p>
                </div>
                <button
                  onClick={handleBackToTemplates}
                  className="text-cyan-400 hover:text-cyan-300 text-sm"
                >
                  Alterar template
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Nome do Cliente */}
              <div>
                <label htmlFor="clientName" className="block text-sm font-medium text-gray-300 mb-1">
                  Nome do Cliente *
                </label>
                <input
                  type="text"
                  id="clientName"
                  name="clientName"
                  required
                  value={formData.clientName}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Nome completo do cliente"
                />
              </div>

              {/* Email do Cliente */}
              <div>
                <label htmlFor="clientEmail" className="block text-sm font-medium text-gray-300 mb-1">
                  Email do Cliente *
                </label>
                <input
                  type="email"
                  id="clientEmail"
                  name="clientEmail"
                  required
                  value={formData.clientEmail}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="email@exemplo.com"
                />
              </div>

              {/* CPF do Cliente */}
              <div>
                <label htmlFor="clientCpf" className="block text-sm font-medium text-gray-300 mb-1">
                  CPF do Cliente *
                </label>
                <input
                  type="text"
                  id="clientCpf"
                  name="clientCpf"
                  required
                  value={formData.clientCpf}
                  onChange={handleCpfChange}
                  maxLength={14}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="000.000.000-00"
                />
              </div>

              {/* Data de Expiração */}
              <div>
                <label htmlFor="expiresAt" className="block text-sm font-medium text-gray-300 mb-1">
                  Data de Expiração (Opcional)
                </label>
                <input
                  type="date"
                  id="expiresAt"
                  name="expiresAt"
                  value={formData.expiresAt}
                  onChange={handleChange}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Deixe em branco para não definir expiração
                </p>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-300 mb-1">
                Observações
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Observações adicionais sobre este contrato..."
              ></textarea>
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={handleBackToTemplates}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Voltar
              </button>
              <Link
                href="/dashboard/contracts"
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Criando...' : 'Criar Contrato'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

