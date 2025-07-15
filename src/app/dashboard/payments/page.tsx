'use client'

import { useState } from 'react';
import Link from 'next/link';

interface Payment {
  id: string;
  clientName: string;
  clientId: string;
  amount: number;
  status: 'Pendente' | 'Pago' | 'Atrasado' | 'Cancelado';
  type: 'Taxa de Administração' | 'Taxa de Performance';
  dueDate: string;
  paidAt?: string;
}

export default function PaymentsPage() {
  const [payments] = useState<Payment[]>([
    {
      id: '1',
      clientName: 'João Silva',
      clientId: 'client1',
      amount: 5000,
      status: 'Pendente',
      type: 'Taxa de Administração',
      dueDate: '2024-04-10',
    },
    {
      id: '2',
      clientName: 'Maria Santos',
      clientId: 'client2',
      amount: 7500,
      status: 'Pago',
      type: 'Taxa de Performance',
      dueDate: '2024-03-15',
      paidAt: '2024-03-15',
    },
    {
      id: '3',
      clientName: 'Pedro Oliveira',
      clientId: 'client3',
      amount: 3000,
      status: 'Atrasado',
      type: 'Taxa de Administração',
      dueDate: '2024-03-01',
    },
  ]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getStatusColor = (status: Payment['status']) => {
    switch (status) {
      case 'Pendente':
        return 'text-yellow-500';
      case 'Pago':
        return 'text-green-500';
      case 'Atrasado':
        return 'text-red-500';
      case 'Cancelado':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusBadgeClass = (status: Payment['status']) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'Pendente':
        return `${baseClasses} bg-yellow-500/20 text-yellow-500`;
      case 'Pago':
        return `${baseClasses} bg-green-500/20 text-green-500`;
      case 'Atrasado':
        return `${baseClasses} bg-red-500/20 text-red-500`;
      case 'Cancelado':
        return `${baseClasses} bg-gray-500/20 text-gray-500`;
      default:
        return `${baseClasses} bg-gray-500/20 text-gray-500`;
    }
  };

  return (
    <div className="w-[95%] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Pagamentos</h1>
        <button
          className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors"
        >
          Novo Pagamento
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 mb-2">Total Recebido</div>
          <div className="text-2xl font-bold text-white">{formatCurrency(7500)}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 mb-2">Pendente</div>
          <div className="text-2xl font-bold text-yellow-500">{formatCurrency(5000)}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 mb-2">Atrasado</div>
          <div className="text-2xl font-bold text-red-500">{formatCurrency(3000)}</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 mb-2">Próximo Vencimento</div>
          <div className="text-2xl font-bold text-white">{formatDate('2024-04-10')}</div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-gray-800 rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-700">
                <th className="px-6 py-3 text-gray-300">Cliente</th>
                <th className="px-6 py-3 text-gray-300">Tipo</th>
                <th className="px-6 py-3 text-gray-300">Valor</th>
                <th className="px-6 py-3 text-gray-300">Vencimento</th>
                <th className="px-6 py-3 text-gray-300">Status</th>
                <th className="px-6 py-3 text-gray-300">Data Pagamento</th>
                <th className="px-6 py-3 text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr
                  key={payment.id}
                  className="border-b border-gray-700 hover:bg-gray-700/50"
                >
                  <td className="px-6 py-4">
                    <Link 
                      href={`/dashboard/clients/${payment.clientId}`}
                      className="text-white hover:text-cyan-500"
                    >
                      {payment.clientName}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-white">{payment.type}</td>
                  <td className="px-6 py-4 text-white">{formatCurrency(payment.amount)}</td>
                  <td className="px-6 py-4 text-white">{formatDate(payment.dueDate)}</td>
                  <td className="px-6 py-4">
                    <span className={getStatusBadgeClass(payment.status)}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white">
                    {payment.paidAt ? formatDate(payment.paidAt) : '-'}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      className="text-cyan-500 hover:text-cyan-400"
                      onClick={() => {/* Handle payment action */}}
                    >
                      {payment.status === 'Pago' ? 'Ver Comprovante' : 'Registrar Pagamento'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 