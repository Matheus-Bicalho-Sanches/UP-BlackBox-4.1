'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc, deleteDoc, getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import app from '@/config/firebase';

// Interface para contatos (clientes e leads)
interface Contact {
  id: string;
  name: string;
  email?: string;
  phone: string;
  type: 'lead' | 'client';
  status: 'novo' | 'em contato' | 'qualificado' | 'negociando' | 'em teste' | 'convertido' | 'perdido';
  lastContact?: string;
  nextContact?: string;
  notes?: string;
  source?: string;
  createdAt?: any; // Timestamp do Firestore
}

// Interface para interações
interface Interaction {
  id: string;
  type: string;
  description: string;
  createdAt: any;
  createdBy: string;
}

export default function ContactDetailsPage({ params }: { params: { id: string } }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();
  const { id } = params;
  const db = getFirestore(app);

  useEffect(() => {
    const fetchContactAndInteractions = async () => {
      try {
        // Buscar o documento pelo ID
        const contactRef = doc(db, 'contacts', id);
        const contactSnap = await getDoc(contactRef);
        
        if (contactSnap.exists()) {
          const data = contactSnap.data();
          
          // Converter timestamp para string de data, se existir
          let createdAt = null;
          if (data.createdAt && data.createdAt.toDate) {
            createdAt = data.createdAt.toDate().toISOString().split('T')[0];
          }
          
          // Criar objeto de contato com os dados
          setContact({
            id: contactSnap.id,
            ...data,
            createdAt
          } as Contact);
          
          // Buscar o histórico de interações
          const interactionsCollection = collection(db, 'contacts', id, 'interactions');
          const interactionsQuery = query(interactionsCollection, orderBy('createdAt', 'desc'));
          const interactionsSnapshot = await getDocs(interactionsQuery);
          
          const interactionsData = interactionsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              type: data.type,
              description: data.description,
              createdAt: data.createdAt,
              createdBy: data.createdBy
            } as Interaction;
          });
          
          setInteractions(interactionsData);
        } else {
          // Documento não encontrado
          setError('Contato não encontrado');
          // Não redirecionamos para dar tempo ao usuário de ler a mensagem
        }
      } catch (error) {
        console.error('Erro ao buscar contato:', error);
        setError('Ocorreu um erro ao carregar o contato. Por favor, tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    fetchContactAndInteractions();
  }, [id, db]);

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Não informado';
    
    // Corrigindo o problema de fuso horário para strings ISO (YYYY-MM-DD)
    if (dateString.includes('-')) {
      const [year, month, day] = dateString.split('-').map(Number);
      return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
    }
    
    // Fallback para formatos não esperados
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Função para formatar timestamp do Firestore considerando o fuso horário
  const formatFirestoreTimestamp = (timestamp: any) => {
    if (!timestamp || !timestamp.toDate) return 'Data não disponível';
    
    // Obtém a data do timestamp do Firestore
    const date = timestamp.toDate();
    
    // Formata considerando o fuso horário local
    const day = date.getDate();
    const month = date.getMonth() + 1; // getMonth() retorna 0-11
    const year = date.getFullYear();
    
    // Retorna no formato brasileiro
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year}`;
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
        return 'bg-teal-500';
      case 'convertido':
        return 'bg-green-500';
      case 'perdido':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      
      // Excluir o documento do Firestore
      await deleteDoc(doc(db, 'contacts', id));
      
      console.log('Contato excluído com sucesso');
      
      // Redirecionar para a lista após exclusão
      router.push('/dashboard/crm');
    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      setError('Ocorreu um erro ao excluir o contato. Por favor, tente novamente.');
      setShowDeleteModal(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error && !contact) {
    return (
      <div className="w-[95%] max-w-4xl mx-auto">
        <div className="flex items-center mb-6">
          <Link 
            href="/dashboard/crm" 
            className="mr-4 text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-white">Erro</h1>
        </div>
        
        <div className="bg-red-900/50 border border-red-500 rounded-md p-6 text-red-200">
          <p>{error}</p>
          <div className="mt-4">
            <Link href="/dashboard/crm" className="text-cyan-400 hover:underline">
              Voltar para a lista de contatos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-400">Contato não encontrado</p>
        <Link href="/dashboard/crm" className="mt-4 inline-block text-cyan-500 hover:underline">
          Voltar para a lista
        </Link>
      </div>
    );
  }

  return (
    <div className="w-[95%] max-w-4xl mx-auto">
      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-md text-red-200">
          {error}
        </div>
      )}
      
      {/* Cabeçalho */}
      <div className="flex items-center mb-6">
        <Link 
          href="/dashboard/crm" 
          className="mr-4 text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white flex-1 truncate pr-4">{contact.name}</h1>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/crm/${id}/edit`}
            className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar
          </Link>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Excluir
          </button>
        </div>
      </div>

      {/* Informações do contato */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-gray-800 p-6 rounded-lg shadow overflow-hidden">
          <h2 className="text-xl font-bold text-white mb-4">Informações Básicas</h2>
          
          <div className="space-y-3 w-full">
            <div>
              <span className="block text-sm text-gray-400">Tipo</span>
              <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs ${contact.type === 'client' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>
                {contact.type === 'client' ? 'Cliente' : 'Lead'}
              </span>
            </div>
            
            <div>
              <span className="block text-sm text-gray-400">Status</span>
              <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs text-white ${getStatusColor(contact.status)}`}>
                {contact.status.charAt(0).toUpperCase() + contact.status.slice(1)}
              </span>
            </div>
            
            {contact.email && (
              <div>
                <span className="block text-sm text-gray-400">Email</span>
                <a href={`mailto:${contact.email}`} className="text-cyan-500 hover:underline truncate block max-w-full overflow-hidden">{contact.email}</a>
              </div>
            )}
            
            <div>
              <span className="block text-sm text-gray-400">Telefone</span>
              <a
                href={`https://wa.me/55${contact.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center text-cyan-500 hover:underline truncate max-w-full overflow-hidden"
              >
                {formatPhoneNumber(contact.phone)}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            
            <div>
              <span className="block text-sm text-gray-400">Origem</span>
              <span className="text-white truncate block max-w-full overflow-hidden">{contact.source || 'Não informado'}</span>
            </div>
            
            <div>
              <span className="block text-sm text-gray-400">Criado em</span>
              <span className="text-white">{formatDate(contact.createdAt)}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 p-6 rounded-lg shadow md:col-span-2">
          <div className="flex justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Observações</h2>
            <span className="text-sm text-gray-400">Último contato: {formatDate(contact.lastContact)}</span>
          </div>
          
          <div className="bg-gray-700 p-4 rounded-lg text-white overflow-auto max-h-[200px]">
            {contact.notes || 'Nenhuma observação registrada.'}
          </div>
        </div>
      </div>
      
      {/* Histórico de interações */}
      <div className="bg-gray-800 p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold text-white mb-4">Histórico de Interações</h2>
        
        <div className="space-y-4">
          {interactions.length > 0 ? (
            interactions.map(interaction => (
              <div key={interaction.id} className="border-l-2 border-cyan-500 pl-4 py-2">
                <div className="flex justify-between">
                  <h3 className="font-medium text-white">
                    {interaction.type === 'update' ? 'Atualização' : 'Interação'}
                  </h3>
                  <span className="text-gray-400 text-sm">
                    {interaction.createdAt ? formatFirestoreTimestamp(interaction.createdAt) : 'Data não disponível'}
                  </span>
                </div>
                <p className="text-gray-300 mt-1">{interaction.description}</p>
                <p className="text-gray-400 text-xs mt-1">Por: {interaction.createdBy}</p>
              </div>
            ))
          ) : (
            // Exibir o registro de criação como primeira interação
            contact && contact.createdAt && (
              <div className="border-l-2 border-gray-600 pl-4 py-2">
                <div className="flex justify-between">
                  <h3 className="font-medium text-white">Cadastro</h3>
                  <span className="text-gray-400 text-sm">{formatDate(contact.createdAt)}</span>
                </div>
                <p className="text-gray-300 mt-1">
                  Contato adicionado ao sistema.
                </p>
                <p className="text-gray-400 text-xs mt-1">Por: Sistema</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Modal de confirmação de exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">Confirmar Exclusão</h2>
            <p className="text-gray-300 mb-6">
              Tem certeza que deseja excluir o contato <span className="font-semibold">{contact.name}</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
                disabled={deleteLoading}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center"
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Excluindo...
                  </>
                ) : (
                  'Sim, Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 