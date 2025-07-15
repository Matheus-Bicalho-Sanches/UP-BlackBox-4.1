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
  dueDate: string;
  estimatedHours: number;
  priority: string;
  assignedTo: string[];
  status: string;
  observations: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function NaoRecorrentePage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [sortByDueDate, setSortByDueDate] = useState<'none' | 'asc' | 'desc'>('asc');
  const [filterDueDate, setFilterDueDate] = useState<'all' | 'today' | 'week' | 'month' | 'overdue'>('all');
  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    dueDate: new Date().toISOString().split('T')[0],
    priority: 'Média',
    assignedTo: [],
    status: 'Não iniciada',
    observations: ''
  });
  const { isCardView } = useContext(CardViewContext);
  const { user } = useAuth();

  // Lista de responsáveis fixa
  const fixedAssignees = ['Vinícius', 'Matheus', 'Igor'];

  // Funções para gerenciar o estado do formulário
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        dueDate: taskToEdit.dueDate,
        priority: taskToEdit.priority,
        assignedTo: taskToEdit.assignedTo,
        status: taskToEdit.status,
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
      dueDate: new Date().toISOString().split('T')[0],
      priority: 'Média',
      assignedTo: [],
      status: 'Não iniciada',
      observations: ''
    });
    setEditingTask(null);
  };

  // Buscar tarefas do backend
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/tasks/naorecorrente';
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
    } catch (err) {
      console.error('Erro ao buscar tarefas:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar tarefas');
    } finally {
      setLoading(false);
    }
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
          taskType: 'Não recorrente',
          user: username,
          details
        })
      });
    } catch (err) {
      console.error('Erro ao criar log de atividade:', err);
    }
  };

  // Criar uma nova tarefa
  const createTask = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/tasks/naorecorrente', {
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
        `Tarefa não recorrente criada com prioridade ${formData.priority}`
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
      
      const response = await fetch(`/api/tasks/naorecorrente?id=${taskId}`, {
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
      
      if (taskData.status && taskData.status !== taskToUpdate.status) {
        changes.push(`status alterado de "${taskToUpdate.status}" para "${taskData.status}"`);
      }
      
      if (taskData.priority && taskData.priority !== taskToUpdate.priority) {
        changes.push(`prioridade alterada de "${taskToUpdate.priority}" para "${taskData.priority}"`);
      }
      
      if (taskData.dueDate && taskData.dueDate !== taskToUpdate.dueDate) {
        changes.push(`prazo alterado`);
      }
      
      // Se estamos atualizando a tarefa por completo após edição
      if (editingTask === taskId) {
        logDetails = 'Tarefa editada com alterações em: ' + 
          (changes.length > 0 ? changes.join(', ') : 'diversos campos');
      } else {
        // Se é apenas uma atualização rápida de um campo
        logDetails += changes.length > 0 ? changes.join(', ') : 'campos diversos';
      }
      
      // Criar log de atividade
      await createActivityLog(
        'Tarefa atualizada',
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
      
      const response = await fetch(`/api/tasks/naorecorrente?id=${taskId}`, {
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

  // Função para ordenar tarefas por prazo
  const sortTasksByDueDate = (tasksToSort: Task[]) => {
    if (sortByDueDate === 'none') return tasksToSort;
    
    return [...tasksToSort].sort((a, b) => {
      const dateA = new Date(a.dueDate).getTime();
      const dateB = new Date(b.dueDate).getTime();
      
      return sortByDueDate === 'asc' ? dateA - dateB : dateB - dateA;
    });
  };
  
  // Aplicar ordenação às tarefas
  const sortedTasks = sortTasksByDueDate(tasks);

  // Função para alternar a visualização expandida da tarefa
  const toggleTaskExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
    }
  };

  // Função para verificar se uma tarefa está atrasada
  const isTaskOverdue = (dueDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDate = new Date(dueDate);
    return taskDate < today;
  };

  // Função para formatar a data de yyyy-mm-dd para dd/mm/yy
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    
    const isOverdue = isTaskOverdue(dateString);
    
    // Retornar com classe de cor para tarefas atrasadas
    return (
      <span className={isOverdue ? 'text-red-400' : ''}>
        {`${parts[2]}/${parts[1]}/${parts[0].slice(2)}`}
        {isOverdue && (
          <span className="ml-1 text-red-400" title="Tarefa atrasada">
            ⚠️
          </span>
        )}
      </span>
    );
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
  const tasksByStatus = sortedTasks.reduce((acc, task) => {
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
    
    const currentStatusIndex = statusOrder.indexOf(task.status);
    let newStatusIndex;
    
    if (direction === 'next') {
      // Se já está no último status, não faz nada
      if (currentStatusIndex === statusOrder.length - 1) return;
      newStatusIndex = currentStatusIndex + 1;
    } else {
      // Se já está no primeiro status, não faz nada
      if (currentStatusIndex === 0) return;
      newStatusIndex = currentStatusIndex - 1;
    }
    
    const newStatus = statusOrder[newStatusIndex];
    
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

  const createNewTaskInStatus = (status: string) => {
    resetForm();
    setFormData(prev => ({
      ...prev,
      status: status
    }));
    setShowNewTaskModal(true);
  };

  const renderCardView = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {statusOrder.map(status => {
        return (
          <div key={status} className="flex flex-col">
            <div className="bg-gray-800 rounded-t-lg p-3 flex items-center sticky top-0">
              <span className={`w-3 h-3 rounded-full mr-2 ${getStatusColor(status)}`}></span>
              <h3 className="text-white font-medium">{status}</h3>
              <span className="ml-2 bg-gray-700 text-gray-300 text-xs rounded-full px-2 py-1">
                {tasksByStatus[status]?.length || 0}
              </span>
              <button 
                onClick={() => createNewTaskInStatus(status)}
                className="ml-auto text-cyan-400 hover:text-cyan-300"
                title={`Adicionar tarefa em ${status}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            
            <div className="bg-gray-800/70 flex-1 rounded-b-lg p-3 min-h-[200px] overflow-y-auto max-h-[calc(100vh-200px)]">
              {tasksByStatus[status]?.map(task => (
                <div key={task.id} className="bg-gray-700 rounded-lg overflow-hidden shadow mb-3 border border-gray-600">
                  <div className="p-4">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-medium text-white">{task.title}</h3>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full text-white ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>
                    
                    <div className="mt-2 text-sm text-gray-400">
                      <div className="flex justify-between">
                        <span>Responsáveis: {renderAssigneesList(task.assignedTo)}</span>
                        <span>Prazo: {formatDate(task.dueDate)}</span>
                      </div>
                    </div>
                    
                    <div className="mt-3">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskExpand(task.id);
                        }} 
                        className="text-cyan-400 hover:text-cyan-300 text-sm"
                      >
                        {expandedTask === task.id ? 'Menos informações' : 'Mais informações'}
                      </button>
                    </div>

                    {/* Informações expandidas */}
                    {expandedTask === task.id && (
                      <div className="mt-4 border-t border-gray-600 pt-3">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-white font-medium mb-2">Descrição:</h4>
                            <p className="text-gray-300 mb-4">{task.description}</p>
                          </div>
                          
                          <div>
                            <h4 className="text-white font-medium mb-2">Observações:</h4>
                            <p className="text-gray-300 text-sm">{task.observations || 'Nenhuma observação registrada.'}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-gray-650 p-2 flex justify-between">
                    <button
                      onClick={() => startEditingTask(task.id)}
                      className="text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <div className="flex space-x-2">
                      {statusOrder.indexOf(task.status) > 0 && (
                        <button 
                          onClick={() => moveTaskStatus(task.id, 'prev')}
                          className="text-yellow-400 hover:text-yellow-300 text-sm flex items-center"
                          title={`Mover para ${statusOrder[statusOrder.indexOf(task.status) - 1]}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                          </svg>
                          Voltar
                        </button>
                      )}
                      {statusOrder.indexOf(task.status) < statusOrder.length - 1 && (
                        <button 
                          onClick={() => moveTaskStatus(task.id, 'next')}
                          className="text-green-400 hover:text-green-300 text-sm flex items-center"
                          title={`Avançar para ${statusOrder[statusOrder.indexOf(task.status) + 1]}`}
                        >
                          Avançar
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {(!tasksByStatus[status] || tasksByStatus[status].length === 0) && (
                <div className="flex flex-col items-center justify-center h-32 bg-gray-700/50 rounded-lg border border-dashed border-gray-600">
                  <p className="text-gray-400 text-sm mb-2">Nenhuma tarefa</p>
                  <button 
                    onClick={() => createNewTaskInStatus(status)}
                    className="text-cyan-400 hover:text-cyan-300 text-sm flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Adicionar tarefa
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStandardView = () => (
    <div className="bg-gray-700 rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-600">
        <thead className="bg-gray-800">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Título
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Responsáveis
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              <div className="flex items-center gap-1">
                Prazo
                <button 
                  onClick={() => setSortByDueDate(current => {
                    if (current === 'none') return 'asc';
                    if (current === 'asc') return 'desc';
                    return 'none';
                  })}
                  className="text-gray-400 hover:text-cyan-400 focus:outline-none"
                  title="Ordenar por prazo"
                >
                  {sortByDueDate === 'none' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  ) : sortByDueDate === 'asc' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 17l-4 4m0 0l-4-4m4 4V3" />
                    </svg>
                  )}
                </button>
              </div>
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Prioridade
            </th>
            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="bg-gray-700 divide-y divide-gray-600">
          {sortedTasks.map((task) => (
            <>
              <tr key={task.id}>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="text-white">{task.title}</span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                  {renderAssigneesList(task.assignedTo)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                  {formatDate(task.dueDate)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full text-white ${getStatusColor(task.status)}`}>
                    {task.status}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full text-white ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm flex">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskExpand(task.id);
                    }} 
                    className="text-cyan-400 hover:text-cyan-300 mr-3"
                    title={expandedTask === task.id ? "Menos detalhes" : "Mais detalhes"}
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
                    className="text-cyan-400 hover:text-cyan-300 mr-3"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </td>
              </tr>
              
              {/* Informações expandidas */}
              {expandedTask === task.id && (
                <tr>
                  <td colSpan={6} className="p-4 bg-gray-650 border-t border-gray-600">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-white font-medium mb-2">Descrição:</h4>
                        <p className="text-gray-300">
                          {task.description}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-white font-medium mb-2">Observações:</h4>
                        <p className="text-gray-300">
                          {task.observations || 'Nenhuma observação registrada.'}
                        </p>
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
  );

  return (
    <div>
      <style jsx global>{animationStyles}</style>
      <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
        <h2 className="text-xl font-semibold text-white">Tarefas Não Recorrentes</h2>
        <div className="flex flex-wrap items-center gap-3">
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
          
          <MultiSelectAssignee />
          <button 
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded"
            onClick={() => {
              resetForm();
              setShowNewTaskModal(true);
            }}
          >
            Nova Tarefa
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-4 text-gray-300">Carregando tarefas...</div>}
      {error && <div className="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded mb-4">{error}</div>}
      {!loading && !error && tasks.length === 0 && (
        <div className="bg-gray-700 text-center py-8 rounded">
          <p className="text-gray-300 mb-4">Nenhuma tarefa encontrada.</p>
          <button 
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded"
            onClick={() => {
              resetForm();
              setShowNewTaskModal(true);
            }}
          >
            Criar nova tarefa
          </button>
        </div>
      )}
      {!loading && !error && tasks.length > 0 && (
        isCardView ? renderCardView() : renderStandardView()
      )}

      {/* Modal para Nova/Editar Tarefa */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold text-white mb-4">
              {editingTask ? 'Editar Tarefa' : 'Nova Tarefa Não Recorrente'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 mb-1">Título</label>
                <input 
                  type="text" 
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 outline-none"
                  placeholder="Título da tarefa"
                />
              </div>
              
              <div>
                <label className="block text-gray-300 mb-1">Descrição</label>
                <textarea 
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 outline-none"
                  placeholder="Descreva a tarefa"
                  rows={3}
                ></textarea>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">Data de prazo</label>
                  <input 
                    type="date" 
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleFormChange}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 outline-none"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 mb-1">Responsáveis</label>
                  <div className="bg-gray-700 text-white rounded p-3">
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
                  <label className="block text-gray-300 mb-1">Prioridade</label>
                  <select 
                    name="priority"
                    value={formData.priority}
                    onChange={handleFormChange}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 outline-none"
                  >
                    <option value="Alta">Alta</option>
                    <option value="Média">Média</option>
                    <option value="Baixa">Baixa</option>
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 mb-1">Status</label>
                <select 
                  name="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 outline-none"
                >
                  <option value="Não iniciada">Não iniciada</option>
                  <option value="Pendente">Pendente</option>
                  <option value="Em andamento">Em andamento</option>
                  <option value="Concluída">Concluída</option>
                </select>
              </div>
              
              <div>
                <label className="block text-gray-300 mb-1">Observações</label>
                <textarea 
                  name="observations"
                  value={formData.observations}
                  onChange={handleFormChange}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 outline-none"
                  placeholder="Observações adicionais"
                  rows={3}
                ></textarea>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 mt-6">
              <button 
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded w-full sm:w-auto"
                onClick={() => {
                  resetForm();
                  setShowNewTaskModal(false);
                }}
              >
                Cancelar
              </button>
              <button 
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded w-full sm:w-auto"
                onClick={saveTask}
                disabled={loading}
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 