'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import app from '@/config/firebase';

export default function NewContactPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const db = getFirestore(app);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    type: 'lead',
    status: 'novo',
    notes: '',
    source: '',
    nextContact: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Criar um objeto com os dados do formulário e informações adicionais
      const contactData = {
        ...formData,
        createdAt: serverTimestamp(), // Adiciona timestamp do servidor
        lastContact: new Date().toISOString().split('T')[0], // Data atual como último contato
      };
      
      // Salvar no Firestore
      const contactsCollection = collection(db, 'contacts');
      const docRef = await addDoc(contactsCollection, contactData);
      
      console.log('Contato salvo com ID:', docRef.id);
      
      // Redirecionar para a página principal do CRM
      router.push('/dashboard/crm');
    } catch (error) {
      console.error('Erro ao adicionar contato:', error);
      setError('Ocorreu um erro ao salvar o contato. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-[95%] max-w-3xl mx-auto">
      <div className="flex items-center mb-6">
        <Link 
          href="/dashboard/crm" 
          className="mr-4 text-gray-400 hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-white">Adicionar Novo Contato</h1>
      </div>

      <div className="bg-gray-800 rounded-lg shadow p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-md text-red-200">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nome */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Nome *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Telefone */}
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
                Telefone *
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="(XX) XXXXX-XXXX"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Status */}
            <div>
              <label htmlFor="status" className="block text-sm font-medium text-gray-300 mb-1">
                Status *
              </label>
              <select
                id="status"
                name="status"
                required
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="novo">Novo</option>
                <option value="em contato">Em contato</option>
                <option value="qualificado">Qualificado</option>
                <option value="negociando">Negociando</option>
                <option value="em teste">Em teste</option>
                <option value="convertido">Convertido</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>

            {/* Origem */}
            <div>
              <label htmlFor="source" className="block text-sm font-medium text-gray-300 mb-1">
                Origem
              </label>
              <input
                type="text"
                id="source"
                name="source"
                value={formData.source}
                onChange={handleChange}
                placeholder="Site, Indicação, LinkedIn, etc."
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Próximo Contato */}
            <div>
              <label htmlFor="nextContact" className="block text-sm font-medium text-gray-300 mb-1">
                Próximo Contato
              </label>
              <input
                type="date"
                id="nextContact"
                name="nextContact"
                value={formData.nextContact}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
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
            ></textarea>
          </div>

          <div className="flex justify-end space-x-4">
            <Link
              href="/dashboard/crm"
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Salvando...' : 'Salvar Contato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 