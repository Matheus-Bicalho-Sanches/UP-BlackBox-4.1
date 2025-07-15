'use client'

import { useState } from 'react';

// Dados de exemplo para tarefas mensais
const monthlyTasksData = [
  {
    id: 1,
    title: 'Fechamento contábil',
    description: 'Preparar todos os documentos para o fechamento contábil mensal',
    dueDay: 5,
    estimatedHours: 8,
    priority: 'Alta',
    assignedTo: 'Financeiro',
    status: 'Pendente',
    progress: 10
  },
  {
    id: 2,
    title: 'Relatório de performance para clientes',
    description: 'Preparar e enviar relatórios personalizados de performance para cada cliente',
    dueDay: 10,
    estimatedHours: 12,
    priority: 'Alta', 
    assignedTo: 'Equipe de Análise',
    status: 'Em andamento',
    progress: 45
  },
  {
    id: 3,
    title: 'Reunião com parceiros estratégicos',
    description: 'Reunião mensal para discutir oportunidades de negócio e parcerias',
    dueDay: 15,
    estimatedHours: 3,
    priority: 'Média',
    assignedTo: 'Diretoria',
    status: 'Não iniciada',
    progress: 0
  },
  {
    id: 4,
    title: 'Manutenção de sistemas',
    description: 'Atualização de software e manutenção preventiva dos sistemas',
    dueDay: 20,
    estimatedHours: 5,
    priority: 'Média',
    assignedTo: 'TI',
    status: 'Pendente',
    progress: 0
  },
  {
    id: 5,
    title: 'Análise de métricas e KPIs',
    description: 'Revisar métricas de performance e KPIs dos projetos e carteiras',
    dueDay: 25,
    estimatedHours: 6,
    priority: 'Alta',
    assignedTo: 'Gestores',
    status: 'Concluída',
    progress: 100
  }
];

// Meses para exibição
const months = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function TasksMonthly() {
  const currentMonth = new Date().getMonth(); // 0-indexed
  const [tasks, setTasks] = useState(monthlyTasksData);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [filterPriority, setFilterPriority] = useState('Todas');

  const filteredTasks = filterPriority === 'Todas'
    ? tasks
    : tasks.filter(task => task.priority === filterPriority);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return 'bg-red-500';
      case 'Média': return 'bg-yellow-500';
      case 'Baixa': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress === 100) return 'bg-green-500';
    if (progress >= 50) return 'bg-blue-500';
    if (progress > 0) return 'bg-yellow-500';
    return 'bg-gray-500';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-white">Tarefas Mensais</h2>
        <div className="flex items-center space-x-4">
          <select 
            className="bg-gray-700 text-white rounded px-3 py-2 outline-none"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          >
            {months.map((month, index) => (
              <option key={index} value={index}>{month}</option>
            ))}
          </select>
          <select 
            className="bg-gray-700 text-white rounded px-3 py-2 outline-none"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="Todas">Todas as prioridades</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>
          <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
            Nova Tarefa
          </button>
        </div>
      </div>

      <div className="bg-gray-700 rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filteredTasks.map((task) => (
            <div key={task.id} className="bg-gray-600 rounded-lg overflow-hidden shadow">
              <div className="p-4">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium text-white">{task.title}</h3>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </div>
                <p className="text-gray-400 text-sm mt-2">{task.description}</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Responsável:</span>
                    <span className="text-gray-300">{task.assignedTo}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Prazo:</span>
                    <span className="text-gray-300">Dia {task.dueDay}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Horas estimadas:</span>
                    <span className="text-gray-300">{task.estimatedHours}h</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Status:</span>
                    <span className="text-gray-300">{task.status}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-300">Progresso:</span>
                    <span className="text-sm text-gray-300">{task.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getProgressColor(task.progress)}`}
                      style={{ width: `${task.progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-700 p-3 flex justify-between">
                <button className="text-cyan-400 hover:text-cyan-300 text-sm">Marcar como concluída</button>
                <button className="text-cyan-400 hover:text-cyan-300 text-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 