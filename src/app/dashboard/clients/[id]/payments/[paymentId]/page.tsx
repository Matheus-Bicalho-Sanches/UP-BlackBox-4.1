'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, deleteDoc, getFirestore } from 'firebase/firestore';
import app from '@/config/firebase';

interface Payment {
  id: string;
  date: string;
  dueDate: string;
  value: number;
  status: 'pending' | 'paid' | 'overdue';
}

export default function EditPaymentPage({ 
  params 
}: { 
  params: { id: string; paymentId: string } 
}) {
  const router = useRouter();
  const db = getFirestore(app);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);

  useEffect(() => {
    const fetchPayment = async () => {
      try {
        const docRef = doc(db, 'payments', params.paymentId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setPayment({
            id: docSnap.id,
            ...docSnap.data()
          } as Payment);
        } else {
          router.push(`/dashboard/clients/${params.id}`);
        }
      } catch (error) {
        console.error('Error fetching payment:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPayment();
  }, [params.id, params.paymentId, db, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, 'payments', payment.id), {
        date: payment.date,
        dueDate: payment.dueDate,
        value: payment.value,
        status: payment.status,
        updatedAt: new Date().toISOString()
      });

      router.push(`/dashboard/clients/${params.id}`);
    } catch (error) {
      console.error('Error updating payment:', error);
      alert('Erro ao atualizar pagamento. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!payment || !confirm('Tem certeza que deseja excluir este pagamento?')) {
      return;
    }

    setSaving(true);
    try {
      await deleteDoc(doc(db, 'payments', payment.id));
      router.push(`/dashboard/clients/${params.id}`);
    } catch (error) {
      console.error('Error deleting payment:', error);
      alert('Erro ao excluir pagamento. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleValueChange = (value: string) => {
    if (!payment) return;

    // Remove any non-numeric characters except comma and period
    const numericValue = value.replace(/[^\d.,]/g, '');
    
    // Convert to number
    const number = Number(numericValue.replace(',', '.'));

    setPayment(prev => prev ? ({
      ...prev,
      value: number
    }) : null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!payment) {
    return null;
  }

  return (
    <div className="w-[95%] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Editar Pagamento</h1>
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
                onChange={(e) => setPayment(prev => prev ? ({ ...prev, date: e.target.value }) : null)}
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
                onChange={(e) => setPayment(prev => prev ? ({ ...prev, dueDate: e.target.value }) : null)}
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
                value={payment.value.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL'
                })}
                onChange={(e) => handleValueChange(e.target.value)}
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
                onChange={(e) => setPayment(prev => prev ? ({
                  ...prev,
                  status: e.target.value as 'pending' | 'paid' | 'overdue'
                }) : null)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                required
              >
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="overdue">Atrasado</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 text-red-500 hover:text-red-400"
              disabled={saving}
            >
              Excluir
            </button>
            <div className="flex space-x-3">
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
          </div>
        </form>
      </div>
    </div>
  );
} 