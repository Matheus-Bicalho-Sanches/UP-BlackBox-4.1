'use client'

import { useState, useEffect } from 'react';
import { collection, getDocs, getFirestore, query, orderBy } from 'firebase/firestore';
import app from '@/config/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Interface para contratos
interface Contract {
  id: string;
  templateId?: string;
  documentId?: string;
  clientName: string;
  clientEmail: string;
  clientCpf?: string;
  status: 'draft' | 'pending' | 'sent' | 'signed' | 'rejected' | 'expired' | 'certificated';
  createdAt?: any;
  signedAt?: string;
  expiresAt?: string;
  hash?: string;
  notes?: string;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'clientName' | 'createdAt' | 'signedAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const router = useRouter();
  const db = getFirestore(app);

  useEffect(() => {
    const fetchContracts = async () => {
      try {
        const contractsCollection = collection(db, 'contracts');
        const contractsQuery = query(contractsCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(contractsQuery);
        
        const fetchedContracts = snapshot.docs.map(doc => {
          const data = doc.data();
          
          let createdAt = null;
          if (data.createdAt) {
            if (data.createdAt.toDate) {
              createdAt = data.createdAt.toDate().toISOString().split('T')[0];
            }
          }
          
          return {
            id: doc.id,
            ...data,
            createdAt
          } as Contract;
        });
        
        setContracts(fetchedContracts);
      } catch (error) {
        console.error('Erro ao buscar contratos:', error);
        setError('Não foi possível carregar os contratos. Por favor, tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
  }, [db]);

  useEffect(() => {
    if (showTemplateModal) {
      fetchTemplates();
    }
  }, [showTemplateModal]);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/contracts/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Erro ao buscar templates:', error);
    }
  };

  const handleUploadTemplate = async () => {
    if (!uploadFile || !templateName) {
      setError('Por favor, selecione um arquivo e informe o nome do template.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      // Primeiro, salvar o arquivo na pasta templates/contracts via API
      // Como não podemos fazer upload direto do frontend para a pasta do servidor,
      // vamos enviar o arquivo para a API que fará o processamento
      
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', templateName);
      formData.append('description', templateDescription);

      const response = await fetch('/api/contracts/templates/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        // Mostrar mensagem de erro mais detalhada
        const errorMsg = data.error || 'Erro ao fazer upload do template';
        console.error('Erro na API:', data);
        throw new Error(errorMsg);
      }

      // Atualizar lista de templates
      await fetchTemplates();
      
      // Limpar formulário
      setUploadFile(null);
      setTemplateName('');
      setTemplateDescription('');
      
      alert('Template enviado com sucesso! Aguarde o processamento.');
    } catch (error: any) {
      setError(error.message || 'Erro ao fazer upload do template');
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: Contract['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-500';
      case 'pending':
        return 'bg-yellow-500';
      case 'sent':
        return 'bg-blue-500';
      case 'signed':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-red-500';
      case 'expired':
        return 'bg-orange-500';
      case 'certificated':
        return 'bg-emerald-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: Contract['status']) => {
    const labels: Record<Contract['status'], string> = {
      draft: 'Rascunho',
      pending: 'Pendente',
      sent: 'Enviado',
      signed: 'Assinado',
      rejected: 'Recusado',
      expired: 'Expirado',
      certificated: 'Certificado'
    };
    return labels[status] || status;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Não informado';
    
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    }
    
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  const formatCpf = (cpf?: string) => {
    if (!cpf) return 'Não informado';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`;
    }
    return cpf;
  };

  // Filtra e ordena os contratos
  const filteredAndSortedContracts = contracts
    .filter(contract => {
      const matchesSearch = 
        contract.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contract.clientEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contract.clientCpf ? contract.clientCpf.replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')) : false);
      
      const statusFilter = filterStatus === 'all' || contract.status === filterStatus;
      
      return matchesSearch && statusFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'clientName') {
        const nameA = (a.clientName || '').toLowerCase();
        const nameB = (b.clientName || '').toLowerCase();
        if (sortOrder === 'asc') {
          return nameA.localeCompare(nameB, 'pt-BR');
        } else {
          return nameB.localeCompare(nameA, 'pt-BR');
        }
      } else if (sortBy === 'signedAt') {
        const dateA = a.signedAt ? new Date(a.signedAt).getTime() : 0;
        const dateB = b.signedAt ? new Date(b.signedAt).getTime() : 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        // default: createdAt
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="w-[95%] mx-auto pt-6 pb-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Contratos</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowTemplateModal(true)}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
          >
            Gerenciar Templates
          </button>
          <Link
            href="/dashboard/contracts/new"
            className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors"
          >
            Novo Contrato
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-md text-red-200">
          {error}
        </div>
      )}

      {/* Cards com estatísticas */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm">Total de Contratos</h3>
          <p className="text-2xl font-bold text-white">{contracts.length}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm">Pendentes</h3>
          <p className="text-2xl font-bold text-white">
            {contracts.filter(c => c.status === 'pending' || c.status === 'sent').length}
          </p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm">Assinados</h3>
          <p className="text-2xl font-bold text-white">
            {contracts.filter(c => c.status === 'signed' || c.status === 'certificated').length}
          </p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm">Taxa de Assinatura</h3>
          <p className="text-2xl font-bold text-white">
            {contracts.length > 0 
              ? Math.round((contracts.filter(c => c.status === 'signed' || c.status === 'certificated').length / contracts.length) * 100) 
              : 0}%
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-4">
        {/* Filtros principais */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por nome, email ou CPF..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 pl-10"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>
        
        {/* Filtros avançados */}
        <div className="flex flex-wrap gap-4 items-center">
          {/* Filtro por status */}
          <div className="flex items-center">
            <label htmlFor="status-filter" className="text-gray-300 mr-2 whitespace-nowrap">Status:</label>
            <select 
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunho</option>
              <option value="pending">Pendente</option>
              <option value="sent">Enviado</option>
              <option value="signed">Assinado</option>
              <option value="certificated">Certificado</option>
              <option value="rejected">Recusado</option>
              <option value="expired">Expirado</option>
            </select>
          </div>
          
          {/* Ordenação */}
          <div className="flex items-center">
            <label htmlFor="sort-by" className="text-gray-300 mr-2 whitespace-nowrap">Ordenar por:</label>
            <select 
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'clientName' | 'createdAt' | 'signedAt')}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="createdAt">Data de criação</option>
              <option value="clientName">Nome do cliente</option>
              <option value="signedAt">Data de assinatura</option>
            </select>
          </div>
          
          {/* Ordem */}
          <div className="flex gap-2">
            <button 
              onClick={() => setSortOrder('asc')}
              className={`px-3 py-1.5 rounded flex items-center ${sortOrder === 'asc' ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-300'}`}
              title="Mais antigos primeiro"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              Crescente
            </button>
            <button 
              onClick={() => setSortOrder('desc')}
              className={`px-3 py-1.5 rounded flex items-center ${sortOrder === 'desc' ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-300'}`}
              title="Mais recentes primeiro"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
              </svg>
              Decrescente
            </button>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg shadow mb-0">
        {filteredAndSortedContracts.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            {contracts.length === 0 ? 'Nenhum contrato cadastrado.' : 'Nenhum contrato encontrado.'}
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="px-3 py-3 text-gray-300 w-[20%] text-left">Cliente</th>
                  <th className="px-3 py-3 text-gray-300 w-[12%] text-center">CPF</th>
                  <th className="px-3 py-3 text-gray-300 w-[14%] text-center">Status</th>
                  <th className="px-3 py-3 text-gray-300 w-[13%] text-center">Criado em</th>
                  <th className="px-3 py-3 text-gray-300 w-[13%] text-center">Assinado em</th>
                  <th className="px-3 py-3 text-gray-300 w-[13%] text-center">Expira em</th>
                  <th className="px-3 py-3 text-gray-300 w-[15%] text-left">Observações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedContracts.map((contract, index) => {
                  const isLastRow = index === filteredAndSortedContracts.length - 1;
                  return (
                  <tr
                    key={contract.id}
                    onClick={() => router.push(`/dashboard/contracts/${contract.id}`)}
                    className={`${!isLastRow ? 'border-b border-gray-700' : ''} hover:bg-gray-700/50 cursor-pointer`}
                  >
                    <td className={`px-3 ${isLastRow ? 'pt-4 pb-3' : 'py-4'} text-white`}>
                      <div className="truncate font-medium">{contract.clientName}</div>
                      <div className="truncate text-xs text-gray-400">{contract.clientEmail || 'Email não informado'}</div>
                    </td>
                    <td className={`px-3 ${isLastRow ? 'pt-4 pb-3' : 'py-4'} text-white text-center`}>
                      {formatCpf(contract.clientCpf)}
                    </td>
                    <td className={`px-3 ${isLastRow ? 'pt-4 pb-3' : 'py-4'} text-center`}>
                      <span className={`px-2 py-1 rounded-full text-xs text-white ${getStatusColor(contract.status)}`}>
                        {getStatusLabel(contract.status)}
                      </span>
                    </td>
                    <td className={`px-3 ${isLastRow ? 'pt-4 pb-3' : 'py-4'} text-white text-center`}>
                      {formatDate(contract.createdAt)}
                    </td>
                    <td className={`px-3 ${isLastRow ? 'pt-4 pb-3' : 'py-4'} text-white text-center`}>
                      {formatDate(contract.signedAt)}
                    </td>
                    <td className={`px-3 ${isLastRow ? 'pt-4 pb-3' : 'py-4'} text-white text-center`}>
                      {formatDate(contract.expiresAt)}
                    </td>
                    <td className={`px-3 ${isLastRow ? 'pt-4 pb-3' : 'py-4'} text-white`}>
                      {contract.notes ? (
                        <div className="relative group max-w-full">
                          <div className="truncate">
                            {contract.notes}
                          </div>
                          {contract.notes.length > 20 && (
                            <div className="absolute z-10 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity bg-gray-900 border border-gray-700 p-2 rounded-md shadow-lg min-w-[200px] max-w-[300px] text-white text-sm -top-2 left-1/2 -translate-x-1/2">
                              {contract.notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Sem observações</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Gerenciamento de Templates */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Gerenciar Templates</h2>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setUploadFile(null);
                  setTemplateName('');
                  setTemplateDescription('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Upload de Template */}
            <div className="mb-6 p-4 bg-gray-700 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-3">Fazer Upload de Template</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Arquivo DOCX *
                  </label>
                  <input
                    type="file"
                    accept=".docx,.pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadFile(file);
                        if (!templateName) {
                          setTemplateName(file.name.replace(/\.(docx|pdf)$/i, ''));
                        }
                      }
                    }}
                    className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Nome do Template *
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Ex: Contrato Padrão"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    placeholder="Descrição do template..."
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <button
                  onClick={handleUploadTemplate}
                  disabled={!uploadFile || !templateName || uploading}
                  className="w-full px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Enviando...' : 'Fazer Upload'}
                </button>
              </div>
            </div>

            {/* Lista de Templates */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Templates Disponíveis</h3>
              {templates.length === 0 ? (
                <p className="text-gray-400 text-center py-4">Nenhum template cadastrado</p>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="p-3 bg-gray-700 rounded flex justify-between items-center"
                    >
                      <div>
                        <p className="text-white font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-gray-400 text-sm">{template.description}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">
                          Status: <span className={template.status === 'ready' ? 'text-green-400' : 'text-yellow-400'}>
                            {template.status === 'ready' ? 'Pronto' : template.status}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

