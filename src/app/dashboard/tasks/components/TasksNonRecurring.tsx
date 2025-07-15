'use client'

import { useState } from 'react';

// Dados de exemplo para tarefas não recorrentes
const nonRecurringTasksData = [
  {
    id: 1,
    title: 'Revisão de contrato Cliente XYZ',
    description: 'Revisar os termos do contrato e ajustar conforme necessário',
    dueDate: '2023-10-15',
    priority: 'Alta',
    assignedTo: 'Ana Silva',
    status: 'Pendente'
  },
  {
    id: 2,
    title: 'Apresentação de resultados Q3',
    description: 'Preparar slides com os resultados financeiros do terceiro trimestre',
    dueDate: '2023-10-20',
    priority: 'Alta',
    assignedTo: 'Carlos Mendes',
    status: 'Em andamento'
  },
  {
    id: 3,
    title: 'Treinamento de equipe nova',
    description: 'Realizar treinamento para novos colaboradores sobre processos internos',
    dueDate: '2023-10-25',
    priority: 'Média',
    assignedTo: 'Mariana Costa',
    status: 'Pendente'
  },
  {
    id: 4,
    title: 'Auditoria interna de carteiras',
    description: 'Revisar alocações e verificar conformidade com políticas internas',
    dueDate: '2023-11-05',
    priority: 'Alta',
    assignedTo: 'Pedro Santos',
    status: 'Não iniciada'
  },
  {
    id: 5,
    title: 'Implementação de novo sistema de risco',
    description: 'Configurar e testar o novo sistema de análise de risco',
    dueDate: '2023-11-10',
    priority: 'Média',
    assignedTo: 'João Oliveira',
    status: 'Em andamento'
  }
];

export default function TasksNonRecurring() {
  const [tasks, setTasks] = useState(nonRecurringTasksData);
  const [filterStatus, setFilterStatus] = useState('Todos');

  const filteredTasks = filterStatus === 'Todos' 
    ? tasks 
    : tasks.filter(task => task.status === filterStatus);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return 'bg-red-500';
      case 'Média': return 'bg-yellow-500';
      case 'Baixa': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendente': return 'bg-yellow-500';
      case 'Em andamento': return 'bg-blue-500';
      case 'Concluída': return 'bg-green-500';
      case 'Não iniciada': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Tarefas Não Recorrentes</h2>
        <div className="flex items-center space-x-4">
          <select 
            className="bg-gray-700 text-white rounded px-3 py-2 outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="Todos">Todos os status</option>
            <option value="Não iniciada">Não iniciada</option>
            <option value="Pendente">Pendente</option>
            <option value="Em andamento">Em andamento</option>
            <option value="Concluída">Concluída</option>
          </select>
          <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
            Nova Tarefa
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-gray-700 rounded-lg overflow-hidden">
          <thead className="bg-gray-600">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tarefa</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Prazo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Prioridade</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Responsável</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-600">
            {filteredTasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-600">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-white">{task.title}</span>
                    <span className="text-sm text-gray-400">{task.description}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">{task.dueDate}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">{task.assignedTo}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button className="text-cyan-400 hover:text-cyan-300 mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button className="text-red-400 hover:text-red-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 