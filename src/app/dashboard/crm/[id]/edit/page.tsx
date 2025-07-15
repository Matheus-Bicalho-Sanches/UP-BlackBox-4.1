'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import app from '@/config/firebase';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface FormData {
  name: string;
  email: string;
  phone: string;
  type: 'lead' | 'client';
  status: 'novo' | 'em contato' | 'qualificado' | 'negociando' | 'convertido' | 'perdido' | 'em teste';
  notes: string;
  source: string;
}

export default function EditContactPage({ params }: { params: { id: string } }) {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    type: 'lead',
    status: 'novo',
    notes: '',
    source: '',
  });
  const [originalData, setOriginalData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const db = getFirestore(app);
  const { id } = params;
  const { user } = useAuth();

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const contactDoc = doc(db, 'contacts', id);
        const contactSnapshot = await getDoc(contactDoc);
        
        if (contactSnapshot.exists()) {
          const contactData = contactSnapshot.data();
          const formattedData = {
            name: contactData.name || '',
            email: contactData.email || '',
            phone: contactData.phone || '',
            type: contactData.type || 'lead',
            status: contactData.status || 'novo',
            notes: contactData.notes || '',
            source: contactData.source || '',
          };
          
          setFormData(formattedData);
          setOriginalData(formattedData);
          setLoading(false);
        } else {
          setError('Contato não encontrado');
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao buscar contato:', error);
        setError('Erro ao carregar dados do contato. Por favor, tente novamente.');
        setLoading(false);
      }
    };

    fetchContact();
  }, [id, db]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Função para registrar interação no histórico
  const registerInteraction = async (contactId: string, changes: any) => {
    try {
      // Obtém informações do usuário atual do contexto de autenticação
      const currentUser = {
        name: user?.displayName || user?.email?.split('@')[0] || 'Colaborador',
        id: user?.uid || 'system'
      };
      
      // Cria uma descrição das alterações
      let description = 'Informações atualizadas:';
      const changedFields: string[] = [];
      
      Object.keys(changes).forEach(field => {
        let fieldName = field;
        switch(field) {
          case 'name': fieldName = 'Nome'; break;
          case 'email': fieldName = 'Email'; break;
          case 'phone': fieldName = 'Telefone'; break;
          case 'type': 
            fieldName = 'Tipo'; 
            changes[field] = changes[field] === 'lead' ? 'Lead' : 'Cliente';
            break;
          case 'status': 
            fieldName = 'Status'; 
            changes[field] = changes[field].charAt(0).toUpperCase() + changes[field].slice(1);
            break;
          case 'notes': fieldName = 'Observações'; break;
          case 'source': fieldName = 'Origem'; break;
        }
        changedFields.push(`${fieldName}: ${changes[field]}`);
      });
      
      description += ' ' + changedFields.join(', ');
      
      // Cria a interação no histórico
      const interactionCollection = collection(db, 'contacts', contactId, 'interactions');
      await addDoc(interactionCollection, {
        type: 'update',
        description,
        createdAt: serverTimestamp(),
        createdBy: currentUser.name,
        userId: currentUser.id,
      });
      
      console.log('Interação registrada com sucesso');
    } catch (error) {
      console.error('Erro ao registrar interação:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    
    try {
      const contactDoc = doc(db, 'contacts', id);
      
      // Verifica quais campos foram alterados
      if (!originalData) {
        throw new Error('Dados originais não disponíveis');
      }
      
      const changes: Record<string, any> = {};
      
      Object.keys(formData).forEach(key => {
        if (formData[key as keyof FormData] !== originalData[key as keyof FormData]) {
          changes[key] = formData[key as keyof FormData];
        }
      });
      
      if (Object.keys(changes).length > 0) {
        // Atualizar o documento com os novos dados
        await updateDoc(contactDoc, {
          ...formData,
          updatedAt: new Date().toISOString(),
        });
        
        // Registrar no histórico de interações
        await registerInteraction(id, changes);
      }
      
      setSuccess(true);
      
      // Redirecionamento após atualização bem-sucedida
      setTimeout(() => {
        router.push(`/dashboard/crm/${id}`);
      }, 1500);
    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      setError('Erro ao atualizar contato. Por favor, tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="w-[95%] max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Editar Contato</h1>
        <Link
          href={`/dashboard/crm/${id}`}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Voltar
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-md text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-md text-green-200">
          Contato atualizado com sucesso!
        </div>
      )}

      <div className="bg-gray-800 rounded-lg p-6 shadow">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-300 mb-2">Nome*</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Telefone*</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Status*</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              >
                <option value="novo">Novo</option>
                <option value="em contato">Em Contato</option>
                <option value="qualificado">Qualificado</option>
                <option value="negociando">Negociando</option>
                <option value="em teste">Em Teste</option>
                <option value="convertido">Convertido</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-300 mb-2">Origem</label>
              <input
                type="text"
                name="source"
                value={formData.source}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Ex: Instagram, Indicação, Site..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-gray-300 mb-2">Observações</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 h-32"
                placeholder="Informações adicionais sobre o contato..."
              ></textarea>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <Link
              href={`/dashboard/crm/${id}`}
              className="px-6 py-2 mr-4 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className={`px-6 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {submitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </span>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 