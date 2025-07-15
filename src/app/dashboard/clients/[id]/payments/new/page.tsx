'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDoc, collection, getFirestore } from 'firebase/firestore';
import app from '@/config/firebase';

export default function NewPaymentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const db = getFirestore(app);
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState({
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    value: '',
    status: 'pending' as 'pending' | 'paid' | 'overdue'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Convert value string to number
      const numericValue = Number(payment.value.replace(/[^\d.,]/g, '').replace(',', '.'));

      await addDoc(collection(db, 'payments'), {
        clientId: params.id,
        date: payment.date,
        dueDate: payment.dueDate,
        value: numericValue,
        status: payment.status,
        createdAt: new Date().toISOString()
      });

      router.push(`/dashboard/clients/${params.id}`);
    } catch (error) {
      console.error('Error saving payment:', error);
      alert('Erro ao salvar pagamento. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (value: string) => {
    // Remove any non-numeric characters except comma and period
    const numericValue = value.replace(/[^\d.,]/g, '');
    
    // Convert to number format
    const number = Number(numericValue.replace(',', '.'));
    
    // Format as currency
    const formatted = number.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    setPayment(prev => ({
      ...prev,
      value: formatted
    }));
  };

  return (
    <div className="w-[95%] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Novo Pagamento</h1>
        <button
          onClick={() => router.back()}
          className="text-gray-300 hover:text-white"
        >
          Voltar
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Data do Pagamento
              </label>
              <input
                type="date"
                value={payment.date}
                onChange={(e) => setPayment(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={payment.dueDate}
                onChange={(e) => setPayment(prev => ({ ...prev, dueDate: e.target.value }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Valor
              </label>
              <input
                type="text"
                value={payment.value}
                onChange={(e) => handleValueChange(e.target.value)}
                placeholder="R$ 0,00"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Status
              </label>
              <select
                value={payment.status}
                onChange={(e) => setPayment(prev => ({ 
                  ...prev, 
                  status: e.target.value as 'pending' | 'paid' | 'overdue' 
                }))}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              >
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="overdue">Atrasado</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-300 hover:text-white"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 