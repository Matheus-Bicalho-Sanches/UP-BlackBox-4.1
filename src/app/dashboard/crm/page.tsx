'use client'

import { useState, useEffect } from 'react';
import { collection, getDocs, getFirestore, query, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import app from '@/config/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// Interface para contatos (clientes e leads)
interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: 'lead' | 'client';
  status: 'novo' | 'em contato' | 'qualificado' | 'negociando' | 'em teste' | 'convertido' | 'perdido';
  lastContact?: string;
  nextContact?: string;
  notes?: string;
  source?: string;
  createdAt?: any; // Timestamp do Firestore
}

// Interface para controlar qual célula está sendo editada
interface EditingCell {
  contactId: string;
  field: 'lastContact' | 'nextContact' | null;
}

export default function CRMPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'lead' | 'client'>('lead');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastContact' | 'nextContact'>('nextContact');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [error, setError] = useState('');
  const [editingCell, setEditingCell] = useState<EditingCell>({ contactId: '', field: null });
  const [savingDate, setSavingDate] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const router = useRouter();
  const db = getFirestore(app);
  const { user } = useAuth();

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        // Configurar a query para ordenar por data de criação (mais recentes primeiro)
        const contactsCollection = collection(db, 'contacts');
        const contactsQuery = query(contactsCollection, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(contactsQuery);
        
        // Mapear os documentos para o formato necessário
        const fetchedContacts = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Converter timestamp para string de data, se existir
          let lastContact = data.lastContact || null;
          let nextContact = data.nextContact || null;
          let createdAt = null;
          
          if (data.createdAt) {
            // Se for um timestamp do Firestore
            if (data.createdAt.toDate) {
              createdAt = data.createdAt.toDate().toISOString().split('T')[0];
            }
          }
          
          return {
            id: doc.id,
            ...data,
            lastContact,
            nextContact,
            createdAt
          } as Contact;
        });
        
        setContacts(fetchedContacts);
      } catch (error) {
        console.error('Erro ao buscar contatos:', error);
        setError('Não foi possível carregar os contatos. Por favor, tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [db]);

  const formatPhoneNumber = (phone: string) => {
    // Remove caracteres não numéricos
    const cleaned = phone.replace(/\D/g, '');
    
    // Formata como (XX) XXXXX-XXXX
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  // Função para copiar número de telefone para a área de transferência
  const copyPhoneNumber = async (phone: string, contactId: string) => {
    try {
      // Remove caracteres não numéricos para copiar apenas os números
      const cleanPhone = phone.replace(/\D/g, '');
      await navigator.clipboard.writeText(cleanPhone);
      
      // Mostra feedback visual
      setCopiedPhone(contactId);
      
      // Remove o feedback após 2 segundos
      setTimeout(() => {
        setCopiedPhone(null);
      }, 2000);
    } catch (error) {
      console.error('Erro ao copiar número:', error);
      // Fallback para navegadores mais antigos
      const textArea = document.createElement('textarea');
      textArea.value = phone.replace(/\D/g, '');
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopiedPhone(contactId);
      setTimeout(() => {
        setCopiedPhone(null);
      }, 2000);
    }
  };

  const getStatusColor = (status: Contact['status']) => {
    switch (status) {
      case 'novo':
        return 'bg-blue-500';
      case 'em contato':
        return 'bg-yellow-500';
      case 'qualificado':
        return 'bg-purple-500';
      case 'negociando':
        return 'bg-orange-500';
      case 'em teste':
        return 'bg-indigo-500';
      case 'convertido':
        return 'bg-green-500';
      case 'perdido':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Não informado';
    
    // Corrigindo o problema de fuso horário
    // Formatamos a data diretamente da string ISO sem criar um objeto Date
    // que causaria o problema de fuso horário
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    }
    
    // Fallback para formatos não esperados
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Manipula o clique em uma célula de data
  const handleDateCellClick = (e: React.MouseEvent, contactId: string, field: 'lastContact' | 'nextContact') => {
    e.stopPropagation(); // Evita propagação do clique para a linha
    setEditingCell({ contactId, field });
    
    // Aguarda o próximo ciclo de renderização para encontrar e focar o input
    setTimeout(() => {
      const dateInput = document.getElementById(`date-input-${contactId}-${field}`);
      if (dateInput) {
        (dateInput as HTMLInputElement).showPicker();
      }
    }, 50);
  };

  // Atualiza a data no Firestore
  const updateContactDate = async (contactId: string, field: 'lastContact' | 'nextContact', newDate: string) => {
    try {
      setSavingDate(true);
      const contactRef = doc(db, 'contacts', contactId);
      
      // Salvamos a data no formato ISO (YYYY-MM-DD) diretamente
      // sem nenhuma manipulação adicional para evitar problemas de fuso horário
      await updateDoc(contactRef, {
        [field]: newDate,
        updatedAt: new Date().toISOString()
      });
      
      // Registrar a interação no histórico
      try {
        // Obtém informações do usuário atual do contexto de autenticação
        const currentUser = {
          name: user?.displayName || user?.email?.split('@')[0] || 'Colaborador',
          id: user?.uid || 'system'
        };
        
        // Nome amigável do campo
        const fieldName = field === 'lastContact' ? 'Último Contato' : 'Próximo Contato';
        
        // Formata a data para exibição
        const formattedDate = formatDate(newDate);
        
        // Cria a interação no histórico
        const interactionCollection = collection(db, 'contacts', contactId, 'interactions');
        await addDoc(interactionCollection, {
          type: 'update',
          description: `${fieldName} atualizado para ${formattedDate}`,
          createdAt: serverTimestamp(),
          createdBy: currentUser.name,
          userId: currentUser.id,
        });
        
        console.log('Interação registrada com sucesso');
      } catch (error) {
        console.error('Erro ao registrar interação:', error);
      }
      
      // Atualiza o estado local
      setContacts(prevContacts => 
        prevContacts.map(contact => 
          contact.id === contactId 
            ? { ...contact, [field]: newDate } 
            : contact
        )
      );
    } catch (error) {
      console.error(`Erro ao atualizar ${field}:`, error);
      setError(`Não foi possível atualizar a data. Por favor, tente novamente.`);
    } finally {
      setSavingDate(false);
      setEditingCell({ contactId: '', field: null });
    }
  };

  // Filtra e ordena os contatos
  const filteredAndSortedContacts = contacts
    .filter(contact => {
      // Filtro por termo de busca (considera nome e email)
      const matchesSearch = 
        contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.email ? contact.email.toLowerCase().includes(searchTerm.toLowerCase()) : false);
      
      // Classificação baseada apenas no status
      const isClient = contact.status === 'convertido';
      const isLost = contact.status === 'perdido';
      
      // Filtro por tipo (lead/client/all)
      const typeFilter = (() => {
        if (filterType === 'lead') {
          return !isClient && !isLost;
        } else if (filterType === 'client') {
          return isClient;
        } else {
          return true; // all
        }
      })();
      
      // Filtro por status específico
      const statusFilter = filterStatus === 'all' || contact.status === filterStatus;
      
      return matchesSearch && typeFilter && statusFilter;
    })
    .sort((a, b) => {
      // Ordenação por campo
      if (sortBy === 'lastContact') {
        const dateA = a.lastContact ? new Date(a.lastContact).getTime() : 0;
        const dateB = b.lastContact ? new Date(b.lastContact).getTime() : 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else if (sortBy === 'nextContact') {
        const dateA = a.nextContact ? new Date(a.nextContact).getTime() : Infinity;
        const dateB = b.nextContact ? new Date(b.nextContact).getTime() : Infinity;
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
    <div className="w-[95%] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">CRM</h1>
        <Link
          href="/dashboard/crm/new"
          className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors"
        >
          Adicionar Contato
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-md text-red-200">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col gap-4">
        {/* Filtros principais */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar por nome ou email..."
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
          
          <div className="flex gap-2">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded ${filterType === 'all' ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilterType('lead')}
              className={`px-4 py-2 rounded ${filterType === 'lead' ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Leads
            </button>
            <button 
              onClick={() => setFilterType('client')}
              className={`px-4 py-2 rounded ${filterType === 'client' ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Clientes
            </button>
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
              <option value="novo">Novo</option>
              <option value="em contato">Em contato</option>
              <option value="qualificado">Qualificado</option>
              <option value="negociando">Negociando</option>
              <option value="em teste">Em teste</option>
              <option value="convertido">Convertido</option>
              <option value="perdido">Perdido</option>
            </select>
          </div>
          
          {/* Ordenação */}
          <div className="flex items-center">
            <label htmlFor="sort-by" className="text-gray-300 mr-2 whitespace-nowrap">Ordenar por:</label>
            <select 
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'lastContact' | 'nextContact')}
              className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="createdAt">Data de criação</option>
              <option value="lastContact">Último contato</option>
              <option value="nextContact">Próximo contato</option>
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

      <div className="bg-gray-800 rounded-lg shadow">
        {filteredAndSortedContacts.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            {contacts.length === 0 ? 'Nenhum contato cadastrado.' : 'Nenhum contato encontrado.'}
          </div>
        ) : (
          <div className="overflow-x-hidden">
            <table className="w-full table-fixed">
              <thead>
                <tr className="text-left border-b border-gray-700">
                  <th className="px-3 py-3 text-gray-300 w-[20%]">Nome</th>
                  <th className="px-3 py-3 text-gray-300 w-[14%]">Status</th>
                  <th className="px-3 py-3 text-gray-300 w-[14%]">Contato</th>
                  <th className="px-3 py-3 text-gray-300 w-[13%]">Último Contato</th>
                  <th className="px-3 py-3 text-gray-300 w-[13%]">Próximo Contato</th>
                  <th className="px-3 py-3 text-gray-300 w-[11%]">Origem</th>
                  <th className="px-3 py-3 text-gray-300 w-[15%]">Observações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => router.push(`/dashboard/crm/${contact.id}`)}
                    className="border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer"
                  >
                    <td className="px-3 py-4 text-white">
                      <div className="truncate font-medium">{contact.name}</div>
                      <div className="truncate text-xs text-gray-400">{contact.email || 'Email não informado'}</div>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs text-white ${getStatusColor(contact.status)}`}>
                        {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-3 py-4 text-white">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Evita clique na linha
                          copyPhoneNumber(contact.phone, contact.id);
                        }}
                        className={`truncate block text-left w-full transition-colors ${
                          copiedPhone === contact.id 
                            ? 'text-green-400' 
                            : 'text-cyan-500 hover:text-cyan-400'
                        }`}
                        title={copiedPhone === contact.id ? 'Número copiado!' : 'Clique para copiar o número'}
                      >
                        <div className="flex items-center">
                          <span>{formatPhoneNumber(contact.phone)}</span>
                          {copiedPhone === contact.id ? (
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 ml-2 opacity-0 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>
                      </button>
                    </td>
                    <td 
                      className="px-3 py-4 text-white truncate relative"
                      onClick={(e) => handleDateCellClick(e, contact.id, 'lastContact')}
                    >
                      <div className="flex items-center group cursor-pointer">
                        <span>{formatDate(contact.lastContact)}</span>
                        <svg 
                          className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 text-cyan-500" 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                      {editingCell.contactId === contact.id && editingCell.field === 'lastContact' && (
                        <input 
                          id={`date-input-${contact.id}-lastContact`}
                          type="date" 
                          className="opacity-0 absolute top-0 left-0 w-0 h-0"
                          defaultValue={contact.lastContact || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateContactDate(contact.id, 'lastContact', e.target.value);
                            }
                          }}
                          onBlur={() => setEditingCell({ contactId: '', field: null })}
                        />
                      )}
                    </td>
                    <td 
                      className="px-3 py-4 text-white truncate relative"
                      onClick={(e) => handleDateCellClick(e, contact.id, 'nextContact')}
                    >
                      <div className="flex items-center group cursor-pointer">
                        <span>{formatDate(contact.nextContact)}</span>
                        <svg 
                          className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 text-cyan-500" 
                          xmlns="http://www.w3.org/2000/svg" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                      {editingCell.contactId === contact.id && editingCell.field === 'nextContact' && (
                        <input 
                          id={`date-input-${contact.id}-nextContact`}
                          type="date" 
                          className="opacity-0 absolute top-0 left-0 w-0 h-0"
                          defaultValue={contact.nextContact || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              updateContactDate(contact.id, 'nextContact', e.target.value);
                            }
                          }}
                          onBlur={() => setEditingCell({ contactId: '', field: null })}
                        />
                      )}
                    </td>
                    <td className="px-3 py-4 text-white truncate">
                      {contact.source || 'Não informado'}
                    </td>
                    <td className="px-3 py-4 text-white">
                      {contact.notes ? (
                        <div className="relative group max-w-full">
                          <div className="truncate">
                            {contact.notes}
                          </div>
                          {contact.notes.length > 20 && (
                            <div className="absolute z-10 invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-opacity bg-gray-900 border border-gray-700 p-2 rounded-md shadow-lg min-w-[200px] max-w-[300px] text-white text-sm -top-2 left-1/2 -translate-x-1/2">
                              {contact.notes}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">Sem observações</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cards com estatísticas */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm">Total de Contatos</h3>
          <p className="text-2xl font-bold text-white">{contacts.length}</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm">Leads Ativos</h3>
          <p className="text-2xl font-bold text-white">
            {contacts.filter(c => c.status !== 'perdido' && c.status !== 'convertido').length}
          </p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm">Taxa de Conversão</h3>
          <p className="text-2xl font-bold text-white">
            {contacts.length > 0 
              ? Math.round((contacts.filter(c => c.status === 'convertido').length / contacts.length) * 100) 
              : 0}%
          </p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
          <h3 className="text-gray-400 text-sm">Contatos Recentes</h3>
          <p className="text-2xl font-bold text-white">
            {contacts.filter(c => {
              if (!c.lastContact) return false;
              const lastContact = new Date(c.lastContact);
              const today = new Date();
              const diffTime = Math.abs(today.getTime() - lastContact.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays <= 7;
            }).length}
          </p>
        </div>
      </div>
    </div>
  );
} 