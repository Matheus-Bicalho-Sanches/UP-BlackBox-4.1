'use client'

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CardViewContext } from '@/contexts/CardViewContext';

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isCardView, setIsCardView] = useState(false);

  const toggleCardView = () => {
    setIsCardView(!isCardView);
  };

  return (
    <CardViewContext.Provider value={{ isCardView, toggleCardView }}>
      <div className="bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Gestão de Tarefas</h1>
          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="cardViewToggle"
              checked={isCardView}
              onChange={toggleCardView}
              className="form-checkbox h-5 w-5 text-cyan-600 rounded border-gray-500 focus:ring-cyan-500"
            />
            <label htmlFor="cardViewToggle" className="ml-2 text-white">
              Visualização em Cards
            </label>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-700 mb-6">
          <nav className="flex -mb-px">
            <Link
              href="/dashboard/tasks/naorecorrente"
              className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${
                pathname === '/dashboard/tasks/naorecorrente'
                  ? 'border-cyan-500 text-cyan-500'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Não Recorrentes
            </Link>
            <Link
              href="/dashboard/tasks/diaria"
              className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${
                pathname === '/dashboard/tasks/diaria'
                  ? 'border-cyan-500 text-cyan-500'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Diárias
            </Link>
            <Link
              href="/dashboard/tasks/mensal"
              className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${
                pathname === '/dashboard/tasks/mensal'
                  ? 'border-cyan-500 text-cyan-500'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Mensais
            </Link>
            <Link
              href="/dashboard/tasks/logs"
              className={`mr-8 py-4 px-1 border-b-2 font-medium text-sm ${
                pathname === '/dashboard/tasks/logs'
                  ? 'border-cyan-500 text-cyan-500'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Logs
            </Link>
            <Link
              href="/dashboard/tasks/relatorio"
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                pathname === '/dashboard/tasks/relatorio'
                  ? 'border-cyan-500 text-cyan-500'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }`}
            >
              Relatório
            </Link>
          </nav>
        </div>

        {/* Conteúdo da página */}
        <div className="mt-4">
          {children}
        </div>
      </div>
    </CardViewContext.Provider>
  );
} 