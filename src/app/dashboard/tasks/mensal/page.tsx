'use client'

import { useState, useContext, useEffect } from 'react';
import { CardViewContext } from '@/contexts/CardViewContext';
import { useAuth } from '@/contexts/AuthContext';

// Definição da animação para o dropdown fade in
const animationStyles = `
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-in-out forwards;
}
`;

// Interface para o tipo de tarefa
interface Task {
  id: string;
  title: string;
  description: string;
  month: string; // Formato YYYY-MM
  executionDay: number; // Adicionado: Dia do mês para execução
  estimatedHours: number;
  priority: string;
  assignedTo: string[];
  status: string;
  isCompleted: boolean;
  observations: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function MensalPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    executionDay: 1,
    priority: 'Média',
    assignedTo: [],
    status: 'Não iniciada',
    isCompleted: false,
    observations: ''
  });
  const { isCardView } = useContext(CardViewContext);
  const { user } = useAuth();

  // Lista de responsáveis fixa
  const fixedAssignees = ['Vinícius', 'Matheus', 'Igor'];

  // Funções para gerenciar o estado do formulário
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    let processedValue: string | number | boolean = value; // Ajustado para incluir boolean

    // Converter campos numéricos para número
    if (name === 'executionDay') {
      const parsedValue = parseInt(value, 10);
      // Garante que seja um número entre 1 e 31, ou mantém 1 como padrão
      processedValue = isNaN(parsedValue) || parsedValue < 1 ? 1 : parsedValue > 31 ? 31 : parsedValue;
    } else if (name === 'estimatedHours') {
      const parsedValue = parseInt(value, 10);
      // Garante que seja um número não negativo, ou 0
      processedValue = isNaN(parsedValue) || parsedValue < 0 ? 0 : parsedValue;
    }
    // Adicione aqui outras conversões se necessário (ex: checkboxes para boolean)

    setFormData(prev => ({ ...prev, [name]: processedValue }));
  };

  const handleAssigneesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const assignees = e.target.value.split(',').map(a => a.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, assignedTo: assignees }));
  };

  // Função para atualizar os responsáveis no formulário (usando checkboxes)
  const handleAssigneeCheckboxChange = (assignee: string, isChecked: boolean) => {
    setFormData(prev => {
      const currentAssignees = prev.assignedTo || [];
      if (isChecked && !currentAssignees.includes(assignee)) {
        return { ...prev, assignedTo: [...currentAssignees, assignee] };
      } else if (!isChecked && currentAssignees.includes(assignee)) {
        return { ...prev, assignedTo: currentAssignees.filter(a => a !== assignee) };
      }
      return prev;
    });
  };

  // Iniciar edição de uma tarefa
  const startEditingTask = (taskId: string) => {
    const taskToEdit = tasks.find(task => task.id === taskId);
    if (taskToEdit) {
      setFormData({
        title: taskToEdit.title,
        description: taskToEdit.description,
        executionDay: taskToEdit.executionDay,
        priority: taskToEdit.priority,
        assignedTo: taskToEdit.assignedTo,
        status: taskToEdit.status,
        isCompleted: taskToEdit.isCompleted,
        observations: taskToEdit.observations
      });
      setEditingTask(taskId);
      setShowNewTaskModal(true);
    }
  };

  // Limpar formulário
  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      executionDay: 1,
      priority: 'Média',
      assignedTo: [],
      status: 'Não iniciada',
      isCompleted: false,
      observations: ''
    });
    setEditingTask(null);
  };

  // Função para criar log de atividade
  const createActivityLog = async (action: string, task: Partial<Task>, details: string) => {
    try {
      // Define o nome do usuário
      let username;
      
      // Se a ação for de reset automático, o usuário será "Sistema"
      if (action === 'Tarefa resetada automaticamente') {
        username = 'Sistema';
      } else {
        // Caso contrário, usa o nome do usuário atual
        const userEmail = user?.email || 'usuario@exemplo.com';
        username = userEmail.split('@')[0]; // Pega a parte antes do @
      }
      
      await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          taskId: task.id || '',
          taskTitle: task.title || '',
          taskType: 'Mensal',
          user: username,
          details
        })
      });
    } catch (err) {
      console.error('Erro ao criar log de atividade:', err);
    }
  };

  // Buscar tarefas do backend
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/tasks/mensal';
      const params = new URLSearchParams();
      
      if (filterStatus !== 'Todos') {
        params.append('status', filterStatus);
      }
      
      if (selectedAssignees.length > 0) {
        params.append('assignedTo', selectedAssignees.join(','));
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar tarefas: ${response.status}`);
      }
      
      const data = await response.json();
      setTasks(data.tasks || []);

      // Verificar tarefas concluídas do mês anterior e resetar quando necessário
      await checkAndResetCompletedTasks(data.tasks || []);
    } catch (err) {
      console.error('Erro ao buscar tarefas:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar tarefas');
    } finally {
      setLoading(false);
    }
  };

  // Verificar tarefas concluídas do mês anterior e resetar para "Pendente"
  const checkAndResetCompletedTasks = async (tasksList: Task[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Filtrar tarefas concluídas
    const completedTasks = tasksList.filter(task => task.status === 'Concluída');
    let tasksUpdated = false;
    let updatedTasks = [...tasksList];
    let resetCount = 0;
    
    for (const task of completedTasks) {
      // Verificar se a tarefa tem data de atualização
      if (task.updatedAt) {
        const updatedDate = new Date(task.updatedAt);
        const updatedMonth = updatedDate.getMonth();
        const updatedYear = updatedDate.getFullYear();
        
        // Se a última atualização foi em mês anterior ao atual
        const isLastMonth = 
          (updatedMonth < currentMonth && updatedYear === currentYear) || 
          (updatedYear < currentYear);
        
        if (isLastMonth) {
          // Resetar status para "Pendente"
          try {
            const response = await fetch(`/api/tasks/mensal?id=${task.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                ...task,
                status: 'Pendente',
                isCompleted: false
              })
            });
            
            if (response.ok) {
              // Atualizar o estado local da tarefa
              updatedTasks = updatedTasks.map(t => {
                if (t.id === task.id) {
                  return {
                    ...t,
                    status: 'Pendente',
                    isCompleted: false,
                    updatedAt: new Date().toISOString()
                  };
                }
                return t;
              });
              tasksUpdated = true;
              resetCount++;
              
              console.log(`Tarefa "${task.title}" resetada de Concluída para Pendente.`);
            }
          } catch (error) {
            console.error(`Erro ao resetar tarefa ${task.id}:`, error);
          }
        }
      }
    }
    
    // Atualizar o estado das tarefas se houver mudanças
    if (tasksUpdated) {
      setTasks(updatedTasks);
      // Mostrar mensagem de notificação
      setInfoMessage(`${resetCount} ${resetCount === 1 ? 'tarefa foi' : 'tarefas foram'} resetada(s) automaticamente de Concluída para Pendente.`);
      
      // Esconder a mensagem após 10 segundos
      setTimeout(() => {
        setInfoMessage(null);
      }, 10000);
    }
  };

  // Criar uma nova tarefa
  const createTask = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/tasks/mensal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao criar tarefa: ${response.status}`);
      }
      
      const taskData = await response.json();
      
      // Criar log de atividade
      await createActivityLog(
        'Tarefa criada',
        taskData,
        `Tarefa mensal criada para ${formData.month} com prioridade ${formData.priority}`
      );
      
      resetForm();
      setShowNewTaskModal(false);
      await fetchTasks(); // Recarregar tarefas
    } catch (err) {
      console.error('Erro ao criar tarefa:', err);
      setError(err instanceof Error ? err.message : 'Erro ao criar tarefa');
    } finally {
      setLoading(false);
    }
  };

  // Atualizar uma tarefa existente
  const updateTask = async (taskId: string, taskData: Partial<Task>) => {
    try {
      setLoading(true);
      setError(null);
      
      // Buscar a tarefa atual para comparação com os dados alterados
      const taskToUpdate = tasks.find(task => task.id === taskId);
      if (!taskToUpdate) {
        throw new Error('Tarefa não encontrada');
      }
      
      const response = await fetch(`/api/tasks/mensal?id=${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(taskData)
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao atualizar tarefa: ${response.status}`);
      }
      
      // Gerar detalhes para o log baseado nas mudanças
      let logDetails = 'Tarefa atualizada: ';
      const changes = [];
      
      // Verificar quais campos foram atualizados
      if (taskData.title && taskData.title !== taskToUpdate.title) {
        changes.push(`título alterado`);
      }
      
      if (taskData.isCompleted !== undefined && taskData.isCompleted !== taskToUpdate.isCompleted) {
        changes.push(`tarefa ${taskData.isCompleted ? 'concluída' : 'reaberta'}`);
      }
      
      if (taskData.status && taskData.status !== taskToUpdate.status) {
        changes.push(`status alterado de "${taskToUpdate.status}" para "${taskData.status}"`);
      }
      
      if (taskData.priority && taskData.priority !== taskToUpdate.priority) {
        changes.push(`prioridade alterada de "${taskToUpdate.priority}" para "${taskData.priority}"`);
      }
      
      // Se estamos atualizando a tarefa por completo após edição
      if (editingTask === taskId) {
        logDetails = 'Tarefa editada com alterações em: ' + 
          (changes.length > 0 ? changes.join(', ') : 'diversos campos');
      } else {
        // Se é apenas uma atualização rápida de um campo
        logDetails += changes.length > 0 ? changes.join(', ') : 'campos diversos';
      }
      
      // Determinar a ação correta para o log
      const logAction = (taskData.status === 'Concluída' || taskData.isCompleted === true) && 
                       (taskToUpdate.status !== 'Concluída' || taskToUpdate.isCompleted === false)
                      ? 'Tarefa concluída' 
                      : 'Tarefa atualizada';

      // Criar log de atividade
      await createActivityLog(
        logAction,
        {
          id: taskId,
          title: taskToUpdate.title
        },
        logDetails
      );
      
      resetForm();
      setShowNewTaskModal(false);
      await fetchTasks(); // Recarregar tarefas
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar tarefa');
    } finally {
      setLoading(false);
    }
  };

  // Salvar tarefa (criar nova ou atualizar existente)
  const saveTask = async () => {
    if (editingTask) {
      await updateTask(editingTask, formData);
    } else {
      await createTask();
    }
  };

  // Excluir uma tarefa
  const deleteTask = async (taskId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tarefa?')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Buscar a tarefa para registrar no log
      const taskToDelete = tasks.find(task => task.id === taskId);
      if (!taskToDelete) {
        throw new Error('Tarefa não encontrada');
      }
      
      const response = await fetch(`/api/tasks/mensal?id=${taskId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao excluir tarefa: ${response.status}`);
      }
      
      // Criar log de atividade
      await createActivityLog(
        'Tarefa excluída',
        {
          id: taskId,
          title: taskToDelete.title
        },
        'Tarefa excluída pelo usuário'
      );
      
      await fetchTasks(); // Recarregar tarefas
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err);
      setError(err instanceof Error ? err.message : 'Erro ao excluir tarefa');
    } finally {
      setLoading(false);
    }
  };

  // Carregar tarefas quando o componente for montado ou quando os filtros mudarem
  useEffect(() => {
    fetchTasks();
  }, [filterStatus, selectedAssignees]);

  // Função para alternar a visualização expandida da tarefa
  const toggleTaskExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
    }
  };

  // Função para lidar com a seleção/deseleção de responsáveis
  const handleAssigneeToggle = (assignee: string) => {
    setSelectedAssignees(prev => 
      prev.includes(assignee)
        ? prev.filter(a => a !== assignee)
        : [...prev, assignee]
    );
  };

  // Extrair responsáveis únicos
  const allAssignees = tasks.flatMap(task => task.assignedTo);
  const uniqueAssignees = [...new Set(allAssignees)];

  // Para visualização em cards, agrupamos as tarefas por status
  const tasksByStatus = tasks.reduce((acc, task) => {
    if (!acc[task.status]) {
      acc[task.status] = [];
    }
    acc[task.status].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Ordem dos status para exibição
  const statusOrder = ['Não iniciada', 'Pendente', 'Em andamento', 'Concluída'];
  
  // Filtrar apenas status que existem nas tarefas
  const availableStatuses = statusOrder.filter(status => 
    Object.keys(tasksByStatus).includes(status)
  );

  // Inicializar todas as colunas de status, mesmo as vazias
  statusOrder.forEach(status => {
    if (!tasksByStatus[status]) {
      tasksByStatus[status] = [];
    }
  });

  // Status para exibição (usamos todos os status ordenados)
  const displayStatuses = statusOrder;

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

  const renderAssigneesList = (assignees: string[]) => {
    return assignees.length > 1 
      ? assignees.join(', ')
      : assignees[0] || 'Não atribuído';
  };

  // Componente para seleção múltipla de responsáveis
  const MultiSelectAssignee = () => {
    const [isOpen, setIsOpen] = useState(false);
    
    return (
      <div className="relative">
        <div 
          className="bg-gray-700 text-white rounded-md px-3 py-2 min-w-[220px] cursor-pointer shadow-md hover:bg-gray-650 transition-colors duration-200"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-cyan-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span className="text-sm truncate">
                {selectedAssignees.length 
                  ? `${selectedAssignees.length} selecionado(s)` 
                  : "Filtrar por responsável"}
              </span>
            </div>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          
          {selectedAssignees.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedAssignees.map(assignee => (
                <span 
                  key={assignee} 
                  className="inline-flex items-center bg-cyan-600/30 text-cyan-100 text-xs rounded px-2 py-1"
                >
                  {assignee}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAssigneeToggle(assignee);
                    }}
                    className="ml-1 text-cyan-300 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </span>
              ))}
              {selectedAssignees.length > 0 && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAssignees([]);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 text-xs"
                >
                  Limpar todos
                </button>
              )}
            </div>
          )}
        </div>
        
        {isOpen && (
          <div className="absolute z-10 mt-1 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg overflow-hidden animate-fadeIn">
            <div className="max-h-48 overflow-y-auto p-2">
              {fixedAssignees.map(assignee => (
                <div 
                  key={assignee} 
                  className="flex items-center py-1 px-2 hover:bg-gray-650 rounded transition-colors duration-150"
                >
                  <input
                    type="checkbox"
                    id={`assignee-${assignee}`}
                    checked={selectedAssignees.includes(assignee)}
                    onChange={() => handleAssigneeToggle(assignee)}
                    onClick={(e) => e.stopPropagation()}
                    className="form-checkbox h-4 w-4 text-cyan-600 rounded border-gray-500 focus:ring-cyan-500"
                  />
                  <label 
                    htmlFor={`assignee-${assignee}`} 
                    className="ml-2 text-sm text-gray-300 cursor-pointer flex-1"
                  >
                    {assignee}
                  </label>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-gray-600 flex justify-between">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAssignees([]);
                }}
                className="text-sm text-gray-300 hover:text-white"
              >
                Limpar
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAssignees([...fixedAssignees]);
                }}
                className="text-sm text-cyan-400 hover:text-cyan-300"
              >
                Selecionar todos
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Função para mover uma tarefa para o próximo ou anterior status
  const moveTaskStatus = async (taskId: string, direction: 'next' | 'prev') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const currentStatusIndex = displayStatuses.indexOf(task.status);
    let newStatusIndex;
    
    if (direction === 'next') {
      // Se já está no último status, não faz nada
      if (currentStatusIndex === displayStatuses.length - 1) return;
      newStatusIndex = currentStatusIndex + 1;
    } else {
      // Se já está no primeiro status, não faz nada
      if (currentStatusIndex === 0) return;
      newStatusIndex = currentStatusIndex - 1;
    }
    
    const newStatus = displayStatuses[newStatusIndex];
    
    try {
      setLoading(true);
      
      // Atualizar apenas o status da tarefa
      await updateTask(taskId, { 
        ...task, 
        status: newStatus 
      });
      
    } catch (err) {
      console.error('Erro ao mover tarefa:', err);
      setError(err instanceof Error ? err.message : 'Erro ao mover tarefa');
    } finally {
      setLoading(false);
    }
  };

  // Para os cards, renderizamos cada tarefa em um cartão
  const renderCardView = () => (
    <div>
      <div className="mb-4 bg-gray-750 px-4 py-3 rounded-md">
        <div className="flex items-center text-gray-300 text-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Utilize os botões "Avançar" e "Voltar" para mover tarefas entre diferentes status.</span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {displayStatuses.map(status => (
          <div key={status} className="bg-gray-750 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center">
                <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(status)} mr-2`}></span>
                {status} 
                <span className="ml-2 text-sm text-gray-400">
                  ({tasksByStatus[status]?.length || 0})
                </span>
              </h3>
            </div>
            
            <div className="space-y-3 min-h-[200px]">
              {tasksByStatus[status] && tasksByStatus[status].length > 0 ? (
                tasksByStatus[status].map((task) => (
                  <div
                    key={task.id}
                    className="bg-gray-700 rounded-lg overflow-hidden shadow"
                    data-task-id={task.id}
                  >
                    <div className="p-3">
                      <div className="flex items-start">
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <h3 className="font-medium text-sm text-white">
                              {task.title}
                            </h3>
                            <span className={`px-2 py-0.5 text-xs rounded-full text-white ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                          </div>
                          
                          <div className="mt-2 text-xs text-gray-400">
                            <div className="flex flex-wrap">
                              <span>Responsáveis: {renderAssigneesList(task.assignedTo)}</span>
                            </div>
                            <div className="mt-1">
                              <span>Dia Execução: {task.executionDay}</span>
                            </div>
                          </div>
                          
                          <div className="mt-2 flex justify-between items-center">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskExpand(task.id);
                              }}
                              className="text-cyan-500 hover:text-cyan-400 text-xs"
                            >
                              {expandedTask === task.id ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            
                            <div className="flex space-x-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingTask(task.id);
                                }}
                                className="text-cyan-500 hover:text-cyan-400 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteTask(task.id);
                                }}
                                className="text-red-500 hover:text-red-400 transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* Informações expandidas */}
                          {expandedTask === task.id && (
                            <div className="mt-3 border-t border-gray-600 pt-2">
                              <h4 className="text-white text-xs font-medium mb-1">Descrição:</h4>
                              <p className="text-gray-300 text-xs mb-2">{task.description}</p>
                              
                              <h4 className="text-white text-xs font-medium mb-1">Observações:</h4>
                              <p className="text-gray-300 text-xs">{task.observations || 'Nenhuma observação.'}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-750 p-2 border-t border-gray-600 flex justify-between items-center">
                      <div className="flex space-x-2">
                        {displayStatuses.indexOf(task.status) > 0 && (
                          <button 
                            onClick={() => moveTaskStatus(task.id, 'prev')}
                            className="text-yellow-400 hover:text-yellow-300 text-xs flex items-center"
                            title={`Mover para ${displayStatuses[displayStatuses.indexOf(task.status) - 1]}`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                            Voltar
                          </button>
                        )}
                        {displayStatuses.indexOf(task.status) < displayStatuses.length - 1 && (
                          <button 
                            onClick={() => moveTaskStatus(task.id, 'next')}
                            className="text-green-400 hover:text-green-300 text-xs flex items-center"
                            title={`Avançar para ${displayStatuses[displayStatuses.indexOf(task.status) + 1]}`}
                          >
                            Avançar
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-500 h-full">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <p className="text-sm">Nenhuma tarefa no momento</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Renderizando a página
  return (
    <div className="p-4 md:p-6">
      <style>{animationStyles}</style>
      
      {/* Cabeçalho e barra de ferramentas */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Tarefas Mensais</h1>
          <p className="text-gray-400">Gerencie as tarefas mensais da equipe</p>
        </div>
        
        <div className="flex flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3 w-full md:w-auto">
          <div className="flex space-x-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-700 text-white rounded-md px-3 py-2 min-w-[150px] shadow-md hover:bg-gray-650 transition-colors duration-200"
            >
              <option value="Todos">Todos os status</option>
              <option value="Não iniciada">Não iniciada</option>
              <option value="Pendente">Pendente</option>
              <option value="Em andamento">Em andamento</option>
              <option value="Concluída">Concluída</option>
            </select>

            <MultiSelectAssignee />
          </div>
          
          <button
            onClick={() => {
              resetForm();
              setShowNewTaskModal(true);
            }}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-md shadow-md transition-colors duration-200 flex items-center justify-center md:ml-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Nova Tarefa
          </button>
        </div>
      </div>
      
      {/* Mensagem de erro */}
      {error && (
        <div className="bg-red-600/20 border border-red-700 text-red-100 px-4 py-3 rounded mb-4">
          <p>{error}</p>
        </div>
      )}
      
      {/* Mensagem de informação */}
      {infoMessage && (
        <div className="bg-blue-600/20 border border-blue-700 text-blue-100 px-4 py-3 rounded mb-4 flex justify-between items-center">
          <p>{infoMessage}</p>
          <button 
            onClick={() => setInfoMessage(null)} 
            className="text-blue-300 hover:text-blue-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
      
      {/* Estado de carregamento */}
      {loading && tasks.length === 0 && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
        </div>
      )}
      
      {/* Lista de tarefas vazia */}
      {!loading && tasks.length === 0 && (
        <div className="bg-gray-700/50 rounded-xl p-8 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-300 mb-2">Nenhuma tarefa encontrada</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            Não há tarefas mensais para o período selecionado ou ainda não foram criadas tarefas.
          </p>
          <button
            onClick={() => {
              resetForm();
              setShowNewTaskModal(true);
            }}
            className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-4 py-2 rounded-md shadow-md transition-colors duration-200 inline-flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Criar primeira tarefa
          </button>
        </div>
      )}
      
      {/* Exibição de tarefas com base na visualização selecionada (lista ou cards) */}
      {!loading && tasks.length > 0 && (
        <>
          {isCardView ? (
            renderCardView()
          ) : (
            <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Tarefa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Dia Exec.
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Prioridade
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                      Responsáveis
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-650">
                  {tasks.map((task) => (
                    <>
                      <tr 
                        key={task.id} 
                        className={`group hover:bg-gray-750 ${expandedTask === task.id ? 'bg-gray-750' : ''}`}
                      >
                        <td className="px-4 py-4">
                          <div 
                            className="cursor-pointer"
                            onClick={() => toggleTaskExpand(task.id)}
                          >
                            <div className="flex items-center">
                              <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor(task.status)} mr-2`}></span>
                              <span className="font-medium text-white">
                                {task.title}
                              </span>
                            </div>
                            <p className="text-gray-400 text-sm mt-1 truncate max-w-xs">
                              {task.description}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full text-white ${getStatusColor(task.status)}`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-center">
                          <span className="text-sm font-medium text-gray-300">
                            {task.executionDay}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full text-white ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 hidden lg:table-cell">
                          {renderAssigneesList(task.assignedTo)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleTaskExpand(task.id);
                              }}
                              className="text-cyan-500 hover:text-cyan-400 transition-colors"
                            >
                              {expandedTask === task.id ? (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => startEditingTask(task.id)}
                              className="text-cyan-500 hover:text-cyan-400 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="text-red-500 hover:text-red-400 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      
                      {/* Detalhes expandidos abaixo da linha da tarefa */}
                      {expandedTask === task.id && (
                        <tr className="bg-gray-700">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <h4 className="text-white font-medium mb-2">Descrição completa:</h4>
                                <p className="text-gray-300">{task.description}</p>
                              </div>
                              <div>
                                <h4 className="text-white font-medium mb-2">Observações:</h4>
                                <p className="text-gray-300">{task.observations || 'Nenhuma observação registrada.'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      
      {/* Modal de criação/edição de tarefa */}
      {showNewTaskModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4">
          <div className="flex items-center justify-center min-h-screen">
            <div 
              className="fixed inset-0 bg-black/70 transition-opacity"
              onClick={() => setShowNewTaskModal(false)}
            ></div>
            
            <div className="inline-block align-bottom bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
              <div className="bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-white mb-4 sticky top-0 bg-gray-800 py-2">
                      {editingTask ? 'Editar Tarefa' : 'Nova Tarefa Mensal'}
                    </h3>
                    
                    <div className="mt-2 space-y-4">
                      <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-300">
                          Título
                        </label>
                        <input
                          type="text"
                          name="title"
                          id="title"
                          value={formData.title}
                          onChange={handleFormChange}
                          className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                          placeholder="Digite o título da tarefa"
                          required
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-300">
                          Descrição
                        </label>
                        <textarea
                          name="description"
                          id="description"
                          value={formData.description}
                          onChange={handleFormChange}
                          rows={3}
                          className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                          placeholder="Descreva a tarefa"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Título */}
                        <div className="sm:col-span-2">
                          <label htmlFor="executionDay" className="block text-sm font-medium text-gray-300 mb-1">Dia de Execução</label>
                          <input
                            type="number"
                            name="executionDay"
                            id="executionDay"
                            min="1"
                            max="31"
                            value={formData.executionDay || 1}
                            onChange={handleFormChange}
                            required
                            className="w-full bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600 focus:border-cyan-500 focus:ring focus:ring-cyan-500 focus:ring-opacity-50 shadow-sm"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="priority" className="block text-sm font-medium text-gray-300">
                              Prioridade
                            </label>
                            <select
                              name="priority"
                              id="priority"
                              value={formData.priority}
                              onChange={handleFormChange}
                              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                            >
                              <option value="Baixa">Baixa</option>
                              <option value="Média">Média</option>
                              <option value="Alta">Alta</option>
                            </select>
                          </div>
                          
                          <div>
                            <label htmlFor="status" className="block text-sm font-medium text-gray-300">
                              Status
                            </label>
                            <select
                              name="status"
                              id="status"
                              value={formData.status}
                              onChange={handleFormChange}
                              className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                            >
                              <option value="Não iniciada">Não iniciada</option>
                              <option value="Pendente">Pendente</option>
                              <option value="Em andamento">Em andamento</option>
                              <option value="Concluída">Concluída</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-300">
                            Responsáveis
                          </label>
                          <div className="bg-gray-700 text-white rounded p-3 mt-1">
                            {fixedAssignees.map(assignee => (
                              <div key={assignee} className="flex items-center mb-2">
                                <input
                                  type="checkbox"
                                  id={`form-assignee-${assignee}`}
                                  checked={formData.assignedTo?.includes(assignee) || false}
                                  onChange={(e) => handleAssigneeCheckboxChange(assignee, e.target.checked)}
                                  className="form-checkbox h-4 w-4 text-cyan-600 rounded border-gray-500 focus:ring-cyan-500"
                                />
                                <label 
                                  htmlFor={`form-assignee-${assignee}`} 
                                  className="ml-2 text-sm text-gray-300 cursor-pointer"
                                >
                                  {assignee}
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label htmlFor="observations" className="block text-sm font-medium text-gray-300">
                            Observações
                          </label>
                          <textarea
                            name="observations"
                            id="observations"
                            value={formData.observations}
                            onChange={handleFormChange}
                            rows={2}
                            className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
                            placeholder="Observações adicionais"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-750 px-4 py-3 sm:px-6 flex flex-col sm:flex-row-reverse space-y-2 sm:space-y-0">
                <button
                  type="button"
                  onClick={saveTask}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-cyan-600 text-base font-medium text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {editingTask ? 'Salvar Alterações' : 'Criar Tarefa'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTaskModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-base font-medium text-gray-300 hover:bg-gray-650 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 