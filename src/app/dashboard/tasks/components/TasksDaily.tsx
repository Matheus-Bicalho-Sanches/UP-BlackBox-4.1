'use client'

import { useState } from 'react';

// Dados de exemplo para tarefas diárias
const dailyTasksData = [
  {
    id: 1,
    title: 'Verificação de e-mails',
    description: 'Checar e responder e-mails pendentes de clientes e parceiros',
    timeEstimate: '30 min',
    priority: 'Alta',
    assignedTo: 'Toda equipe',
    status: 'Pendente',
    checklist: ['Inbox principal', 'Filtro de urgentes', 'Responder prioridades']
  },
  {
    id: 2,
    title: 'Monitoramento de mercado',
    description: 'Acompanhar oscilações e notícias relevantes dos mercados',
    timeEstimate: '45 min',
    priority: 'Alta',
    assignedTo: 'Pedro Santos',
    status: 'Em andamento',
    checklist: ['Relatórios diários', 'Notícias importantes', 'Ativos em foco']
  },
  {
    id: 3,
    title: 'Atualização de relatórios',
    description: 'Atualizar relatórios internos de performance das carteiras',
    timeEstimate: '60 min',
    priority: 'Média',
    assignedTo: 'Carlos Mendes',
    status: 'Não iniciada',
    checklist: ['Dados de performance', 'Gráficos comparativos', 'Resumo executivo']
  },
  {
    id: 4,
    title: 'Reunião de alinhamento',
    description: 'Verificar status de projetos e alinhar prioridades',
    timeEstimate: '15 min',
    priority: 'Média',
    assignedTo: 'Equipe de gestão',
    status: 'Pendente',
    checklist: ['Pauta do dia', 'Pendências anteriores', 'Distribuição de demandas']
  },
  {
    id: 5,
    title: 'Backup de dados',
    description: 'Realizar backup dos sistemas principais',
    timeEstimate: '10 min',
    priority: 'Baixa',
    assignedTo: 'Suporte TI',
    status: 'Concluída',
    checklist: ['Banco de dados principal', 'Arquivos de clientes', 'Configurações de sistema']
  }
];

export default function TasksDaily() {
  const [tasks, setTasks] = useState(dailyTasksData);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [filterAssignee, setFilterAssignee] = useState('Todos');

  const toggleTaskExpand = (taskId: number) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
    }
  };

  const uniqueAssignees = ['Todos', ...new Set(tasks.map(task => task.assignedTo))];

  const filteredTasks = filterAssignee === 'Todos' 
    ? tasks 
    : tasks.filter(task => task.assignedTo === filterAssignee);

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
        <h2 className="text-xl font-semibold text-white">Tarefas Diárias</h2>
        <div className="flex items-center space-x-4">
          <select 
            className="bg-gray-700 text-white rounded px-3 py-2 outline-none"
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
          >
            {uniqueAssignees.map(assignee => (
              <option key={assignee} value={assignee}>{assignee}</option>
            ))}
          </select>
          <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded">
            Nova Tarefa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.map((task) => (
          <div key={task.id} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">{task.title}</h3>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">{task.timeEstimate}</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                  </div>
                </div>
                <p className="text-gray-400 mt-1">{task.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm text-gray-300">Responsável: {task.assignedTo}</span>
                  <button 
                    onClick={() => toggleTaskExpand(task.id)} 
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    {expandedTask === task.id ? 'Ocultar checklist' : 'Ver checklist'}
                  </button>
                </div>
              </div>
            </div>

            {/* Checklist expandido */}
            {expandedTask === task.id && (
              <div className="mt-4 border-t border-gray-600 pt-3">
                <h4 className="text-white font-medium mb-2">Checklist:</h4>
                <ul className="space-y-2">
                  {task.checklist.map((item, index) => (
                    <li key={index} className="flex items-center">
                      <input 
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-cyan-600 rounded border-gray-500 focus:ring-cyan-500"
                      />
                      <span className="ml-2 text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 