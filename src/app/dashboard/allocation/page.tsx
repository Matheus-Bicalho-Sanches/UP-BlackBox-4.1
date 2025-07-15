'use client'

import { useState } from 'react';

interface AssetAllocation {
  class: string;
  percentage: number;
  value: number;
  risk: 'Baixo' | 'Médio' | 'Alto';
  lastUpdate: string;
}

export default function AllocationPage() {
  const [allocations] = useState<AssetAllocation[]>([
    {
      class: 'Renda Fixa Pós-fixada',
      percentage: 40,
      value: 2500000,
      risk: 'Baixo',
      lastUpdate: '2024-03-20',
    },
    {
      class: 'Renda Variável',
      percentage: 30,
      value: 1875000,
      risk: 'Alto',
      lastUpdate: '2024-03-20',
    },
    {
      class: 'Fundos Imobiliários',
      percentage: 15,
      value: 937500,
      risk: 'Médio',
      lastUpdate: '2024-03-20',
    },
    {
      class: 'Internacional',
      percentage: 10,
      value: 625000,
      risk: 'Alto',
      lastUpdate: '2024-03-20',
    },
    {
      class: 'Alternativos',
      percentage: 5,
      value: 312500,
      risk: 'Alto',
      lastUpdate: '2024-03-20',
    },
  ]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const getRiskColor = (risk: AssetAllocation['risk']) => {
    switch (risk) {
      case 'Baixo':
        return 'text-green-500';
      case 'Médio':
        return 'text-yellow-500';
      case 'Alto':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="w-[95%] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Alocação de Ativos</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 mb-2">Patrimônio Total</div>
          <div className="text-2xl font-bold text-white">{formatCurrency(6250000)}</div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 mb-2">Classes de Ativos</div>
          <div className="text-2xl font-bold text-white">5</div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="text-gray-400 mb-2">Última Atualização</div>
          <div className="text-2xl font-bold text-white">{formatDate('2024-03-20')}</div>
        </div>
      </div>

      {/* Allocation Table */}
      <div className="bg-gray-800 rounded-lg shadow">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-gray-700">
                <th className="px-6 py-3 text-gray-300">Classe</th>
                <th className="px-6 py-3 text-gray-300">Alocação</th>
                <th className="px-6 py-3 text-gray-300">Valor</th>
                <th className="px-6 py-3 text-gray-300">Risco</th>
                <th className="px-6 py-3 text-gray-300">Última Atualização</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((allocation) => (
                <tr
                  key={allocation.class}
                  className="border-b border-gray-700 hover:bg-gray-700/50"
                >
                  <td className="px-6 py-4 text-white">{allocation.class}</td>
                  <td className="px-6 py-4 text-white">{allocation.percentage}%</td>
                  <td className="px-6 py-4 text-white">{formatCurrency(allocation.value)}</td>
                  <td className="px-6 py-4">
                    <span className={`${getRiskColor(allocation.risk)}`}>
                      {allocation.risk}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white">{formatDate(allocation.lastUpdate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Allocation Chart - Placeholder */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Distribuição da Carteira</h2>
        <div className="h-64 bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400">
          Gráfico de Pizza
        </div>
      </div>
    </div>
  );
} 