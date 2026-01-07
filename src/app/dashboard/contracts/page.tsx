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
  collectedData?: Record<string, any>; // Dados coletados do cliente quando preenche o contrato
  fieldsFilledAt?: string;
  certificatedAt?: string;
  rejectedAt?: string;
  declineReason?: string;
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
  const [selectedTemplateFields, setSelectedTemplateFields] = useState<any>(null);
  const [loadingFields, setLoadingFields] = useState<string | null>(null);
  const [showSetupModal, setShowSetupModal] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<any>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [sendingContract, setSendingContract] = useState<string | null>(null);
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

  const fetchSetupInfo = async (templateId: string) => {
    setLoadingSetup(true);
    try {
      const response = await fetch(`/api/contracts/templates/${templateId}/setup`);
      if (response.ok) {
        const data = await response.json();
        setSetupData(data);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
        alert('Erro ao buscar informações: ' + (errorData.error || errorData.message));
      }
    } catch (error: any) {
      console.error('Erro ao buscar setup:', error);
      alert('Erro ao buscar informações de configuração: ' + error.message);
    } finally {
      setLoadingSetup(false);
    }
  };

  const handleSendContract = async (contractId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevenir navegação ao clicar no botão
    if (!confirm('Deseja enviar este contrato para assinatura? O cliente receberá um email com o link para preencher e assinar.')) {
      return;
    }

    setSendingContract(contractId);
    try {
      const response = await fetch(`/api/contracts/${contractId}/send`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar contrato');
      }

      alert(`✅ ${data.message || 'Contrato enviado com sucesso!'}\n\nO cliente receberá um email com o link para preencher e assinar o documento.`);
      
      // Recarregar contratos
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
    } catch (error: any) {
      console.error('Erro ao enviar contrato:', error);
      alert(`❌ Erro ao enviar contrato: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSendingContract(null);
    }
  };

  const fetchTemplateFields = async (templateId: string) => {
    setLoadingFields(templateId);
    try {
      // Buscar campos do template primeiro
      const fieldsResponse = await fetch(`/api/contracts/templates/${templateId}/fields`);
      
      if (!fieldsResponse.ok) {
        const errorData = await fieldsResponse.json().catch(() => ({ error: 'Erro desconhecido' }));
        throw new Error(errorData.error || errorData.message || `Erro HTTP: ${fieldsResponse.status}`);
      }
      
      const fieldsData = await fieldsResponse.json();
      
      // Buscar tipos disponíveis (opcional - se falhar, continua sem eles)
      let typesData = { fieldTypes: [], fieldDefinitions: [] };
      try {
        const typesResponse = await fetch(`/api/contracts/templates/${templateId}/fields/update`);
        if (typesResponse.ok) {
          typesData = await typesResponse.json();
        }
      } catch (typesError) {
        console.warn('Erro ao buscar tipos de campos (continuando sem eles):', typesError);
      }
      
      if (fieldsData.success) {
        setSelectedTemplateFields({
          templateId,
          ...fieldsData,
          availableFieldTypes: typesData.fieldTypes || [],
          availableFieldDefinitions: typesData.fieldDefinitions || []
        });
      } else {
        throw new Error(fieldsData.error || fieldsData.message || 'Erro ao buscar campos');
      }
    } catch (error: any) {
      console.error('Erro ao buscar campos:', error);
      alert(`Erro ao buscar campos do template: ${error.message || 'Erro desconhecido'}\n\nVerifique o console para mais detalhes.`);
    } finally {
      setLoadingFields(null);
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
                  <th className="px-3 py-3 text-gray-300 w-[15%] text-left">Dados Coletados</th>
                  <th className="px-3 py-3 text-gray-300 w-[10%] text-center">Ações</th>
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
                      {contract.collectedData && Object.keys(contract.collectedData).length > 0 ? (
                        <div className="relative group max-w-full">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="text-green-400 text-sm font-medium">
                              {Object.keys(contract.collectedData).length} campo(s) preenchido(s)
                            </span>
                          </div>
                          <div className="absolute z-10 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity bg-gray-900 border border-gray-700 p-3 rounded-md shadow-lg min-w-[300px] max-w-[500px] text-white text-sm -top-2 left-1/2 -translate-x-1/2">
                            <div className="font-semibold mb-2 text-cyan-400">Dados Coletados:</div>
                            <div className="space-y-1 max-h-60 overflow-y-auto">
                              {Object.entries(contract.collectedData).map(([key, value]) => (
                                <div key={key} className="border-b border-gray-700 pb-1">
                                  <div className="text-gray-400 text-xs">{key}:</div>
                                  <div className="text-white">{String(value || 'N/A')}</div>
                                </div>
                              ))}
                            </div>
                            {contract.fieldsFilledAt && (
                              <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
                                Preenchido em: {formatDate(contract.fieldsFilledAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Aguardando preenchimento</span>
                      )}
                    </td>
                    <td className={`px-3 ${isLastRow ? 'pt-4 pb-3' : 'py-4'} text-center`} onClick={(e) => e.stopPropagation()}>
                      {contract.status === 'draft' && (
                        <button
                          onClick={(e) => handleSendContract(contract.id, e)}
                          disabled={sendingContract === contract.id}
                          className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white text-xs rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 mx-auto"
                          title="Enviar contrato para assinatura via email"
                        >
                          {sendingContract === contract.id ? (
                            <>
                              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Enviando...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              Enviar
                            </>
                          )}
                        </button>
                      )}
                      {contract.status === 'sent' && contract.documentId && (
                        <span className="text-xs text-gray-400">Enviado</span>
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
                      <div className="flex-1">
                        <p className="text-white font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-gray-400 text-sm">{template.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-gray-500 text-xs">
                            Status: <span className={template.status === 'ready' ? 'text-green-400' : 'text-yellow-400'}>
                              {template.status === 'ready' ? 'Pronto' : template.status}
                            </span>
                          </p>
                          <p className="text-gray-500 text-xs">
                            ID: <span 
                              className="text-cyan-400 font-mono cursor-pointer hover:text-cyan-300"
                              onClick={() => {
                                navigator.clipboard.writeText(template.id);
                                alert('ID copiado: ' + template.id);
                              }}
                              title="Clique para copiar"
                            >
                              {template.id}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="ml-4 flex gap-2">
                        <button
                          onClick={() => fetchTemplateFields(template.id)}
                          disabled={loadingFields === template.id}
                          className="px-3 py-1.5 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Ver campos do Assinafy"
                        >
                          {loadingFields === template.id ? 'Carregando...' : 'Ver Campos'}
                        </button>
                        <button
                          onClick={() => {
                            setShowSetupModal(template.id);
                            fetchSetupInfo(template.id);
                          }}
                          className="px-3 py-1.5 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition-colors"
                          title="Configurar template"
                        >
                          Configurar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Campos do Template */}
      {selectedTemplateFields && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Campos do Template: {selectedTemplateFields.template?.name || 'N/A'}
              </h2>
              <button
                onClick={() => setSelectedTemplateFields(null)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-700 rounded">
              <p className="text-gray-300 text-sm">
                <span className="font-semibold">ID do Template (Assinafy):</span>{' '}
                <span className="text-cyan-400 font-mono">{selectedTemplateFields.template?.id}</span>
              </p>
              <p className="text-gray-300 text-sm mt-1">
                <span className="font-semibold">Status:</span>{' '}
                <span className={selectedTemplateFields.template?.status === 'ready' ? 'text-green-400' : 'text-yellow-400'}>
                  {selectedTemplateFields.template?.status || 'N/A'}
                </span>
              </p>
            </div>

            {/* Roles */}
            {selectedTemplateFields.roles && selectedTemplateFields.roles.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Roles Disponíveis</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {selectedTemplateFields.roles.map((role: any, index: number) => (
                    <div key={index} className="p-2 bg-gray-700 rounded">
                      <p className="text-white text-sm font-medium">
                        {typeof (role.name || role.assignment_type) === 'string'
                          ? (role.name || role.assignment_type)
                          : String(role.name || role.assignment_type || 'Role sem nome')}
                      </p>
                      <p className="text-gray-400 text-xs">
                        ID: {typeof role.id === 'string' ? role.id : String(role.id || 'N/A')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Campos por Role */}
            {selectedTemplateFields.fieldsByRole && Object.keys(selectedTemplateFields.fieldsByRole).length > 0 ? (
              <div>
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-900/50 to-cyan-900/50 rounded-lg border border-cyan-500/30">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    📋 Campos que o Cliente Deve Preencher Antes de Assinar
                  </h3>
                  {(() => {
                    const allFields = Object.values(selectedTemplateFields.fieldsByRole).flat() as any[];
                    const requiredFields = allFields.filter((f: any) => f.required || f.is_required);
                    const optionalFields = allFields.filter((f: any) => !f.required && !f.is_required);
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="bg-gray-800/50 p-2 rounded">
                          <span className="text-gray-400">Total de Campos:</span>
                          <span className="text-white font-semibold ml-2">{allFields.length}</span>
                        </div>
                        <div className="bg-red-900/30 p-2 rounded border border-red-500/30">
                          <span className="text-gray-400">Obrigatórios:</span>
                          <span className="text-red-400 font-semibold ml-2">{requiredFields.length}</span>
                        </div>
                        <div className="bg-green-900/30 p-2 rounded border border-green-500/30">
                          <span className="text-gray-400">Opcionais:</span>
                          <span className="text-green-400 font-semibold ml-2">{optionalFields.length}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {Object.entries(selectedTemplateFields.fieldsByRole).map(([roleName, fields]: [string, any]) => {
                  const roleFields = Array.isArray(fields) ? fields : [];
                  const requiredFields = roleFields.filter((f: any) => f.required || f.is_required);
                  const optionalFields = roleFields.filter((f: any) => !f.required && !f.is_required);
                  
                  return (
                    <div key={roleName} className="mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-md font-semibold text-cyan-400">
                          👤 Role: {roleName}
                        </h4>
                        <span className="text-xs text-gray-400">
                          {roleFields.length} campo(s) • {requiredFields.length} obrigatório(s)
                        </span>
                      </div>
                      
                      {roleFields.length > 0 ? (
                        <div className="space-y-3">
                          {/* Campos Obrigatórios */}
                          {requiredFields.length > 0 && (
                            <div>
                              <h5 className="text-sm font-semibold text-red-400 mb-2 flex items-center">
                                <span className="mr-2">⚠️ Campos Obrigatórios ({requiredFields.length})</span>
                              </h5>
                              <div className="space-y-2">
                                {requiredFields.map((field: any, index: number) => (
                                  <div key={`required-${index}`} className="p-3 bg-gray-700 rounded border-l-4 border-red-500">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <p className="text-white font-medium">
                                            {typeof (field.name || field.label) === 'string' 
                                              ? (field.name || field.label || 'Campo sem nome')
                                              : String(field.name || field.label || 'Campo sem nome')}
                                          </p>
                                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30">
                                            OBRIGATÓRIO
                                          </span>
                                        </div>
                                        <div className="mt-1 space-y-1">
                                          <p className="text-gray-400 text-xs">
                                            <span className="font-semibold">Tipo:</span>{' '}
                                            <span className="text-cyan-300">
                                              {typeof field.type === 'string' 
                                                ? (field.type || 'N/A')
                                                : String(field.type || 'N/A')}
                                            </span>
                                          </p>
                                          {field.label && field.label !== field.name && (
                                            <p className="text-gray-400 text-xs">
                                              <span className="font-semibold">Label:</span>{' '}
                                              {typeof field.label === 'string'
                                                ? field.label
                                                : String(field.label || 'N/A')}
                                            </p>
                                          )}
                                          {field.placeholder && (
                                            <p className="text-gray-400 text-xs italic">
                                              <span className="font-semibold">Exemplo:</span>{' '}
                                              <span className="text-gray-300">
                                                {typeof field.placeholder === 'string'
                                                  ? field.placeholder
                                                  : String(field.placeholder || 'N/A')}
                                              </span>
                                            </p>
                                          )}
                                          {field.page && (
                                            <p className="text-gray-500 text-xs">
                                              📄 Página {typeof field.page === 'string' || typeof field.page === 'number'
                                                ? String(field.page)
                                                : String(field.page || 'N/A')}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Campos Opcionais */}
                          {optionalFields.length > 0 && (
                            <div>
                              <h5 className="text-sm font-semibold text-green-400 mb-2 flex items-center">
                                <span className="mr-2">✓ Campos Opcionais ({optionalFields.length})</span>
                              </h5>
                              <div className="space-y-2">
                                {optionalFields.map((field: any, index: number) => (
                                  <div key={`optional-${index}`} className="p-3 bg-gray-700 rounded border-l-4 border-green-500">
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <p className="text-white font-medium">
                                            {typeof (field.name || field.label) === 'string' 
                                              ? (field.name || field.label || 'Campo sem nome')
                                              : String(field.name || field.label || 'Campo sem nome')}
                                          </p>
                                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded border border-green-500/30">
                                            OPCIONAL
                                          </span>
                                        </div>
                                        <div className="mt-1 space-y-1">
                                          <p className="text-gray-400 text-xs">
                                            <span className="font-semibold">Tipo:</span>{' '}
                                            <span className="text-cyan-300">
                                              {typeof field.type === 'string' 
                                                ? (field.type || 'N/A')
                                                : String(field.type || 'N/A')}
                                            </span>
                                          </p>
                                          {field.label && field.label !== field.name && (
                                            <p className="text-gray-400 text-xs">
                                              <span className="font-semibold">Label:</span>{' '}
                                              {typeof field.label === 'string'
                                                ? field.label
                                                : String(field.label || 'N/A')}
                                            </p>
                                          )}
                                          {field.placeholder && (
                                            <p className="text-gray-400 text-xs italic">
                                              <span className="font-semibold">Exemplo:</span>{' '}
                                              <span className="text-gray-300">
                                                {typeof field.placeholder === 'string'
                                                  ? field.placeholder
                                                  : String(field.placeholder || 'N/A')}
                                              </span>
                                            </p>
                                          )}
                                          {field.page && (
                                            <p className="text-gray-500 text-xs">
                                              📄 Página {typeof field.page === 'string' || typeof field.page === 'number'
                                                ? String(field.page)
                                                : String(field.page || 'N/A')}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm">Nenhum campo definido para este role</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-400 mb-2">Nenhum campo configurado neste template</p>
                <p className="text-gray-500 text-sm">
                  Os campos precisam ser adicionados através da API do Assinafy ou interface web
                </p>
              </div>
            )}

            {/* Tipos de Campos Disponíveis */}
            {selectedTemplateFields.availableFieldTypes && selectedTemplateFields.availableFieldTypes.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3">Tipos de Campos Disponíveis no Assinafy</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {selectedTemplateFields.availableFieldTypes.map((fieldType: string, index: number) => (
                    <div key={index} className="p-2 bg-gray-700 rounded text-center">
                      <span className="text-cyan-400 text-sm font-medium">{fieldType}</span>
                    </div>
                  ))}
                </div>
                <p className="text-gray-400 text-xs mt-3">
                  Estes são os tipos de campos que podem ser adicionados ao template
                </p>
              </div>
            )}

            {/* Definições de Campos Disponíveis */}
            {selectedTemplateFields.availableFieldDefinitions && selectedTemplateFields.availableFieldDefinitions.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3">Definições de Campos Já Criadas</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedTemplateFields.availableFieldDefinitions.map((fieldDef: any, index: number) => (
                    <div key={index} className="p-3 bg-gray-700 rounded">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-medium">
                            {typeof fieldDef.name === 'string'
                              ? fieldDef.name
                              : String(fieldDef.name || 'Campo sem nome')}
                          </p>
                          <p className="text-gray-400 text-xs mt-1">
                            Tipo:{' '}
                            <span className="text-cyan-400">
                              {typeof fieldDef.type === 'string'
                                ? fieldDef.type
                                : String(fieldDef.type || 'N/A')}
                            </span>
                            {fieldDef.is_required && (
                              <span className="ml-2 text-red-400">• Obrigatório</span>
                            )}
                          </p>
                          {fieldDef.regex && (
                            <p className="text-gray-500 text-xs mt-1">
                              Validação:{' '}
                              {typeof fieldDef.regex === 'string'
                                ? fieldDef.regex
                                : String(fieldDef.regex || 'N/A')}
                            </p>
                          )}
                        </div>
                        <span className="text-gray-500 text-xs font-mono">
                          ID: {fieldDef.id?.substring(0, 8)}...
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumo dos Dados que Podem Ser Coletados */}
            <div className="mt-6 p-4 bg-cyan-900/20 border border-cyan-500/30 rounded">
              <h3 className="text-lg font-semibold text-cyan-400 mb-3">📋 Resumo: Dados que o Cliente Pode Preencher</h3>
              <div className="space-y-2 text-sm">
                <p className="text-gray-300">
                  <span className="font-semibold text-white">Campos Configurados:</span>{' '}
                  {selectedTemplateFields.allFields?.length || 0} campo(s) definido(s) no template
                </p>
                <p className="text-gray-300">
                  <span className="font-semibold text-white">Tipos Suportados:</span>{' '}
                  {selectedTemplateFields.availableFieldTypes?.join(', ') || 'Carregando...'}
                </p>
                <p className="text-gray-300">
                  <span className="font-semibold text-white">Exemplos Comuns:</span>{' '}
                  Texto, CPF, Email, Data, Número, Telefone, CEP, CNPJ, etc.
                </p>
                <p className="text-gray-400 text-xs mt-3">
                  💡 Quando o cliente preencher esses campos, os dados serão enviados via webhook e salvos no campo <code className="bg-gray-800 px-1 rounded">collectedData</code> do contrato
                </p>
              </div>
            </div>

            {/* Todos os Campos (raw) */}
            {selectedTemplateFields.allFields && selectedTemplateFields.allFields.length > 0 && (
              <div className="mt-6">
                <details className="bg-gray-700 rounded p-3">
                  <summary className="text-gray-300 cursor-pointer text-sm font-semibold">
                    Ver Dados Completos (Raw Data)
                  </summary>
                  <pre className="mt-2 text-xs text-gray-400 overflow-auto max-h-60">
                    {JSON.stringify(selectedTemplateFields.raw || selectedTemplateFields, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Configuração do Template */}
      {showSetupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">Configurar Template</h2>
              <button
                onClick={() => {
                  setShowSetupModal(null);
                  setSetupData(null);
                }}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {loadingSetup ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Carregando informações...</p>
              </div>
            ) : setupData ? (
              <div className="space-y-6">
                {/* Status do Template */}
                <div className="p-4 bg-gray-700 rounded">
                  <h3 className="text-lg font-semibold text-white mb-2">Status do Template</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Nome:</span>
                      <span className="text-white ml-2">{setupData.template?.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Status:</span>
                      <span className={`ml-2 ${setupData.template?.status === 'ready' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {setupData.template?.status || 'N/A'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-400">ID Assinafy:</span>
                      <span className="text-cyan-400 font-mono ml-2">{setupData.template?.id}</span>
                    </div>
                  </div>
                </div>

                {/* Passo 1: Verificar/Criar Roles */}
                <div className="p-4 bg-gray-700 rounded">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Passo 1: Roles do Template
                  </h3>
                  {setupData.existingRoles && setupData.existingRoles.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-gray-300 text-sm mb-2">Roles existentes:</p>
                      {setupData.existingRoles.map((role: any, index: number) => (
                        <div key={index} className="p-2 bg-gray-600 rounded">
                          <span className="text-white font-medium">
                            {typeof (role.name || role.assignment_type) === 'string'
                              ? (role.name || role.assignment_type)
                              : String(role.name || role.assignment_type || 'Role sem nome')}
                          </span>
                          <span className="text-gray-400 text-xs ml-2">
                            ID: {typeof role.id === 'string' ? role.id : String(role.id || 'N/A')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="text-yellow-400 text-sm mb-3">
                        ⚠️ Nenhum role Signer encontrado. Você precisa criar um role Signer.
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(`/api/contracts/templates/${showSetupModal}/setup`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                action: 'create_role',
                                name: 'Signer',
                                assignment_type: 'Signer'
                              })
                            });
                            const data = await response.json();
                            if (data.success) {
                              alert('Role criado com sucesso!');
                              fetchSetupInfo(showSetupModal);
                            } else {
                              alert('Erro: ' + (data.error || data.message));
                            }
                          } catch (error: any) {
                            alert('Erro ao criar role: ' + error.message);
                          }
                        }}
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        Criar Role Signer
                      </button>
                    </div>
                  )}
                </div>

                {/* Passo 2: Verificar/Criar Definições de Campos */}
                <div className="p-4 bg-gray-700 rounded">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Passo 2: Definições de Campos Disponíveis
                  </h3>
                  {setupData.availableFieldDefinitions && setupData.availableFieldDefinitions.length > 0 ? (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {setupData.availableFieldDefinitions.map((field: any, index: number) => (
                        <div key={index} className="p-2 bg-gray-600 rounded flex justify-between items-center">
                          <div>
                            <span className="text-white font-medium">
                              {typeof field.name === 'string' ? field.name : field.name?.name || 'Campo sem nome'}
                            </span>
                            <span className="text-gray-400 text-xs ml-2">
                              ({typeof field.type === 'string' ? field.type : field.type?.type || 'N/A'})
                            </span>
                            {field.is_required && (
                              <span className="text-red-400 text-xs ml-2">• Obrigatório</span>
                            )}
                          </div>
                          <span className="text-gray-500 text-xs font-mono">
                            {field.id?.substring(0, 8)}...
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="text-yellow-400 text-sm mb-3">
                        ⚠️ Nenhuma definição de campo encontrada. Crie campos comuns:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {['Nome Completo', 'CPF', 'Email', 'Telefone'].map((fieldName) => (
                          <button
                            key={fieldName}
                            onClick={async () => {
                              try {
                                const fieldType = fieldName === 'CPF' ? 'cpf' : 
                                                 fieldName === 'Email' ? 'email' :
                                                 fieldName === 'Telefone' ? 'phone' : 'text';
                                const response = await fetch(`/api/contracts/templates/${showSetupModal}/setup`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    action: 'create_field',
                                    type: fieldType,
                                    name: fieldName,
                                    is_required: true
                                  })
                                });
                                const data = await response.json();
                                if (data.success) {
                                  alert(`Campo "${fieldName}" criado com sucesso!`);
                                  fetchSetupInfo(showSetupModal);
                                } else {
                                  alert('Erro: ' + (data.error || data.message));
                                }
                              } catch (error: any) {
                                alert('Erro ao criar campo: ' + error.message);
                              }
                            }}
                            className="px-3 py-2 bg-cyan-500 text-white text-sm rounded hover:bg-cyan-600"
                          >
                            Criar {fieldName}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Passo 3: Campos Configurados no Template */}
                <div className="p-4 bg-gray-700 rounded">
                  <h3 className="text-lg font-semibold text-white mb-3">
                    Passo 3: Campos Configurados no Template
                  </h3>
                  {setupData.existingFields && setupData.existingFields.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-green-400 text-sm mb-2">
                        ✅ {setupData.existingFields.length} campo(s) já configurado(s)
                      </p>
                      {setupData.existingFields.slice(0, 5).map((field: any, index: number) => (
                        <div key={index} className="p-2 bg-gray-600 rounded text-sm">
                          <span className="text-white">
                            {typeof (field.name || field.field_name) === 'string'
                              ? (field.name || field.field_name || 'Campo sem nome')
                              : String(field.name || field.field_name || 'Campo sem nome')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <p className="text-yellow-400 text-sm mb-3">
                        ⚠️ Nenhum campo configurado no template. Use a API para adicionar campos.
                      </p>
                      <div className="bg-gray-600 p-3 rounded text-xs font-mono text-gray-300 overflow-x-auto">
                        <p className="mb-2">Exemplo de como adicionar campos:</p>
                        <pre className="text-xs">
{`PUT /api/contracts/templates/${showSetupModal}/fields/update
{
  "fields": [
    {
      "field_id": "id-do-campo",
      "role_id": "id-do-role-signer",
      "page_id": 1,
      "x": 100,
      "y": 200,
      "width": 200,
      "height": 30,
      "is_required": true
    }
  ]
}`}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tipos de Campos Disponíveis */}
                {setupData.availableFieldTypes && setupData.availableFieldTypes.length > 0 && (
                  <div className="p-4 bg-gray-700 rounded">
                    <h3 className="text-lg font-semibold text-white mb-3">
                      Tipos de Campos Disponíveis
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {setupData.availableFieldTypes.map((type: string, index: number) => (
                        <span key={index} className="px-2 py-1 bg-gray-600 text-cyan-400 text-xs rounded">
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-center py-8">
                Clique em "Configurar" para ver as informações
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

