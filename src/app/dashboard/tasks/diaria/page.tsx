'use client'

import { useState, useContext, useEffect, memo } from 'react';
import { CardViewContext } from '@/contexts/CardViewContext';
import { useAuth } from '@/contexts/AuthContext';

// Dados de exemplo para tarefas diárias
const dailyTasksData = [
  {
    id: 1,
    title: 'Verificar e-mails',
    description: 'Verificar e responder e-mails importantes na caixa de entrada',
    date: '2023-10-15',
    estimatedHours: 1,
    priority: 'Alta',
    assignedTo: ['João', 'Maria'],
    status: 'Pendente',
    isCompleted: false,
    observations: 'Priorizar e-mails dos clientes VIP'
  },
  {
    id: 2,
    title: 'Reunião diária com a equipe',
    description: 'Daily scrum para acompanhamento das tarefas e bloqueios',
    date: '2023-10-15',
    estimatedHours: 0.5,
    priority: 'Alta',
    assignedTo: ['Todos'],
    status: 'Concluída',
    isCompleted: true,
    observations: 'Preparar pauta com antecedência'
  },
  {
    id: 3,
    title: 'Atualizar planilha de acompanhamento',
    description: 'Registrar o progresso das atividades na planilha compartilhada',
    date: '2023-10-15',
    estimatedHours: 1,
    priority: 'Média',
    assignedTo: ['Pedro', 'Ana'],
    status: 'Em andamento',
    isCompleted: false,
    observations: 'Verificar dados com as equipes envolvidas'
  },
  {
    id: 4,
    title: 'Backup do banco de dados',
    description: 'Realizar backup diário do banco de dados de produção',
    date: '2023-10-15',
    estimatedHours: 0.5,
    priority: 'Alta',
    assignedTo: ['TI'],
    status: 'Não iniciada',
    isCompleted: false,
    observations: 'Verificar espaço disponível no servidor de backup'
  },
  {
    id: 5,
    title: 'Monitorar indicadores',
    description: 'Acompanhar os KPIs da plataforma e identificar anomalias',
    date: '2023-10-15',
    estimatedHours: 1.5,
    priority: 'Média',
    assignedTo: ['Analista', 'Coordenador'],
    status: 'Pendente',
    isCompleted: false,
    observations: 'Comparar com dados históricos'
  }
];

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
  date: string;
  estimatedHours: number;
  priority: string;
  assignedTo: string[];
  status: string;
  isCompleted: boolean;
  observations: string;
  createdAt?: string;
  updatedAt?: string;
}

// Componente para exibir as tarefas
const TasksArea = memo(({ tasks, tasksByStatus, displayStatuses, getStatusColor, getPriorityColor, expandedTask, toggleTaskExpand, renderAssigneesList, handleTaskCompletionToggle, startEditingTask, deleteTask, moveTaskStatus }: any) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {displayStatuses.map((status: string) => (
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
              tasksByStatus[status].map((task: Task) => (
                <div
                  key={task.id}
                  className="bg-gray-700 rounded-lg overflow-hidden shadow"
                  data-task-id={task.id}
                >
                  <div className="p-3">
                    <div className="flex items-start">
                      <input 
                        type="checkbox" 
                        checked={task.isCompleted} 
                        onChange={() => handleTaskCompletionToggle(task.id)}
                        className="form-checkbox h-5 w-5 text-cyan-600 rounded border-gray-500 focus:ring-cyan-500 mr-3 mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className={`font-medium text-sm ${task.isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>
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
                        </div>
                        
                        <div className="mt-2 flex justify-between items-center">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTaskExpand(task.id);
                            }} 
                            className="text-cyan-400 hover:text-cyan-300 text-xs"
                          >
                            {expandedTask === task.id ? 'Menos detalhes' : 'Mais detalhes'}
                          </button>
                          
                          <div className="flex space-x-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingTask(task.id);
                              }}
                              className="text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteTask(task.id);
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  );
});

TasksArea.displayName = 'TasksArea';

export default function DiariaPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [availableAssignees, setAvailableAssignees] = useState<string[]>([]);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Task>>({
    title: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    estimatedHours: 0,
    priority: 'Média',
    assignedTo: [],
    status: 'Não iniciada',
    isCompleted: false,
    observations: ''
  });
  const { isCardView } = useContext(CardViewContext);
  const { user } = useAuth();

  // Lista hardcoded de responsáveis
  const hardcodedAssignees = ['Matheus', 'Vinícius', 'Igor'];

  // Funções para gerenciar o estado do formulário
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAssigneesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const assignees = e.target.value.split(',').map(a => a.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, assignedTo: assignees }));
  };

  // Iniciar edição de uma tarefa
  const startEditingTask = (taskId: string) => {
    const taskToEdit = tasks.find(task => task.id === taskId);
    if (taskToEdit) {
      setFormData({
        title: taskToEdit.title,
        description: taskToEdit.description,
        date: taskToEdit.date,
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
      date: new Date().toISOString().split('T')[0],
      estimatedHours: 0,
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
          taskType: 'Diária',
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
      
      let url = '/api/tasks/diaria';
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
      
      try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar tarefas: ${response.status}`);
      }
      
      const data = await response.json();
      setTasks(data.tasks || []);
      } catch (apiError) {
        console.warn('Erro ao buscar da API, usando dados de exemplo:', apiError);
        
        // Converter dados de exemplo para o formato correto (usando IDs como strings)
        const mockTasks = dailyTasksData.map(task => ({
          ...task,
          id: String(task.id) // Garantir que ID é string
        })) as Task[];
        
        // Aplicar filtros aos dados de exemplo
        let filteredTasks = [...mockTasks];
        
        if (filterStatus !== 'Todos') {
          filteredTasks = filteredTasks.filter(task => task.status === filterStatus);
        }
        
        if (selectedAssignees.length > 0) {
          filteredTasks = filteredTasks.filter(task => 
            task.assignedTo.some(assignee => selectedAssignees.includes(assignee))
          );
        }
        
        setTasks(filteredTasks);
      }
    } catch (err) {
      console.error('Erro ao buscar tarefas:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar tarefas');
      
      // Fallback para dados de exemplo em caso de erro
      const mockTasks = dailyTasksData.map(task => ({
        ...task,
        id: String(task.id)
      })) as Task[];
      setTasks(mockTasks);
    } finally {
      setLoading(false);
    }
  };

  // Criar uma nova tarefa
  const createTask = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Gerar um ID único para a nova tarefa
      const newTaskId = `task-${Date.now()}`;
      
      const newTask = {
        ...formData,
        id: newTaskId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Task;
      
      // Adicionar a nova tarefa diretamente ao estado local
      setTasks(currentTasks => [...currentTasks, newTask]);
      
      // Tentar criar a tarefa na API em segundo plano
      try {
      const response = await fetch('/api/tasks/diaria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
          console.warn(`API não respondeu corretamente ao criar tarefa. Tarefa foi criada apenas localmente.`);
        } else {
          // Se a API retornou um ID, podemos atualizar o ID local
          const taskData = await response.json();
          if (taskData && taskData.id) {
            setTasks(currentTasks => 
              currentTasks.map(task => 
                task.id === newTaskId 
                  ? { ...task, id: taskData.id }
                  : task
              )
            );
          }
        }
      
      // Criar log de atividade
      await createActivityLog(
        'Tarefa criada',
          newTask,
        `Tarefa diária criada com prioridade ${formData.priority}`
      );
      } catch (apiError) {
        console.warn('Erro ao criar tarefa via API, mas tarefa foi criada localmente:', apiError);
      }
      
      resetForm();
      setShowNewTaskModal(false);
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
      
      // Atualizar o estado localmente primeiro para manter a experiência fluida
      setTasks(currentTasks => 
        currentTasks.map(task => 
          task.id === taskId 
            ? { ...task, ...taskData, updatedAt: new Date().toISOString() }
            : task
        )
      );
      
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
      
      // Tentar atualizar na API em segundo plano
      try {
        const response = await fetch(`/api/tasks/diaria?id=${taskId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(taskData)
        });
        
        if (!response.ok) {
          console.warn(`API não respondeu corretamente ao atualizar tarefa ${taskId}. Estado foi atualizado apenas localmente.`);
      }
      
      // Determinar a ação correta para o log
      const logAction = (taskData.status === 'Concluída' || taskData.isCompleted === true) &&
      (taskToUpdate.status !== 'Concluída' || taskToUpdate.isCompleted === false)
      ? 'Tarefa concluída'
      : 'Tarefa atualizada';

      // Criar log de atividade
      await createActivityLog(
        logAction, // <- Usar a variável aqui
        {
          id: taskId,
          title: taskToUpdate.title
        },
        logDetails
      );
      
      } catch (apiError) {
        console.warn('Erro ao atualizar tarefa na API, mas estado local foi atualizado:', apiError);
      }
      
      resetForm();
      setShowNewTaskModal(false);
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar tarefa');
    } finally {
      setLoading(false);
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
      
      // Remover a tarefa do estado local imediatamente
      setTasks(currentTasks => currentTasks.filter(task => task.id !== taskId));
      
      // Tentar excluir na API em segundo plano
      try {
      const response = await fetch(`/api/tasks/diaria?id=${taskId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
          console.warn(`API não respondeu corretamente ao excluir tarefa ${taskId}. Tarefa foi removida apenas localmente.`);
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
      } catch (apiError) {
        console.warn('Erro ao excluir tarefa via API, mas tarefa foi removida localmente:', apiError);
      }
      
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err);
      setError(err instanceof Error ? err.message : 'Erro ao excluir tarefa');
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

  // Função para resetar tarefas concluídas para pendentes
  const resetCompletedTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Início do dia atual
      const todayString = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      
      // Filtrar as tarefas concluídas cuja data de atualização não seja hoje
      const tasksToReset = tasks.filter(task => {
        // Verificar se a tarefa está concluída
        if (task.status !== 'Concluída' && !task.isCompleted) {
          return false;
        }
        
        // Se não tiver data de atualização, resetar por segurança
        if (!task.updatedAt) {
          return true;
        }
        
        // Verificar se a data de atualização é de hoje
        const taskUpdateDate = task.updatedAt.split('T')[0];
        return taskUpdateDate !== todayString;
      });
      
      if (tasksToReset.length === 0) {
        console.log('Nenhuma tarefa concluída anterior a hoje para resetar.');
        return;
      }
      
      console.log(`Encontradas ${tasksToReset.length} tarefas para resetar.`);
      
      // Array para armazenar promessas de atualização
      const updatePromises = tasksToReset.map(task => {
        return fetch(`/api/tasks/diaria?id=${task.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            status: 'Pendente',
            isCompleted: false,
            updatedAt: new Date().toISOString()
          })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Erro ao resetar tarefa com ID ${task.id}`);
          }
          
          // Criar log de atividade para cada tarefa resetada
          return createActivityLog(
            'Tarefa resetada automaticamente',
            {
              id: task.id,
              title: task.title
            },
            'Status alterado de Concluída para Pendente pelo sistema (tarefa do dia anterior)'
          );
        });
      });
      
      // Executar todas as promessas
      await Promise.all(updatePromises);
      
      console.log(`${tasksToReset.length} tarefas foram resetadas com sucesso.`);
      
      // Atualizar a lista de tarefas após o reset
      await fetchTasks();
    } catch (err) {
      console.error('Erro ao resetar tarefas concluídas:', err);
      setError(err instanceof Error ? err.message : 'Erro ao resetar tarefas concluídas');
    } finally {
      setLoading(false);
    }
  };

  // Carregar tarefas quando componente for montado
  useEffect(() => {
    fetchTasks();
  }, [filterStatus, selectedAssignees]);

  // Verificar se é necessário resetar as tarefas quando a página carrega
  useEffect(() => {
    // Executar verificação após carregar as tarefas
    if (tasks.length > 0 && !loading) {
      (async () => {
        try {
          // Salvar o número de tarefas antes do reset
          const taskCount = tasks.length;
          
          // Executar o reset
          await resetCompletedTasks();
          
          // Verificar quantas tarefas foram resetadas comparando com o novo estado
          const resetCount = taskCount - tasks.filter(t => t.status === 'Concluída' || t.isCompleted).length;
          
          // Mostrar mensagem ao usuário se tarefas foram resetadas
          if (resetCount > 0) {
            setError(null); // Limpar erros anteriores
            setInfoMessage(`${resetCount} ${resetCount === 1 ? 'tarefa foi resetada' : 'tarefas foram resetadas'} automaticamente por serem de dias anteriores.`);
            
            // Limpar a mensagem após alguns segundos
            setTimeout(() => {
              setInfoMessage(null);
            }, 5000);
          }
        } catch (error) {
          console.error('Erro ao verificar tarefas para reset:', error);
        }
      })();
    }
  }, [tasks.length, loading]);

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

  // Tratar alternância de conclusão de tarefa
  const handleTaskCompletionToggle = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const newIsCompleted = !task.isCompleted;
    const newStatus = newIsCompleted ? 'Concluída' : 'Pendente';
    
    await updateTask(taskId, { 
      isCompleted: newIsCompleted,
      status: newStatus
    });
  };

  // Extrair responsáveis únicos
  const allAssignees = tasks.flatMap(task => task.assignedTo);
  const uniqueAssignees = [...new Set(allAssignees)];

  // Para visualização em cards, agrupamos as tarefas por status
  const tasksByStatus = tasks.reduce((acc, task) => {
    // Garantir que o status existe no acumulador
    if (!acc[task.status]) {
      acc[task.status] = [];
    }
    acc[task.status].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  // Inicializar todas as colunas de status, mesmo as vazias
  const statusOrder = ['Não iniciada', 'Pendente', 'Em andamento', 'Concluída'];
  statusOrder.forEach(status => {
    if (!tasksByStatus[status]) {
      tasksByStatus[status] = [];
    }
  });

  // Ordem dos status para exibição
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
            <div className="p-2 border-b border-gray-600">
              <input
                type="text"
                className="w-full bg-gray-650 text-white rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="Buscar responsável..."
                onClick={(e) => e.stopPropagation()}
                // Aqui poderia adicionar funcionalidade de busca se necessário
              />
            </div>
            <div className="max-h-48 overflow-y-auto p-2">
              {hardcodedAssignees.length > 0 ? (
                hardcodedAssignees.map(assignee => (
                  <div 
                    key={assignee} 
                    className="flex items-center py-1 px-2 hover:bg-gray-650 rounded transition-colors duration-150"
                  >
                    <input
                      type="checkbox"
                      id={`form-assignee-${assignee}`}
                      checked={selectedAssignees.includes(assignee)}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setSelectedAssignees(prev => {
                          const newAssignees = isChecked
                            ? [...prev, assignee]
                            : prev.filter(a => a !== assignee);
                          return newAssignees;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="form-checkbox h-4 w-4 text-cyan-600 rounded border-gray-500 focus:ring-cyan-500"
                    />
                    <label 
                      htmlFor={`form-assignee-${assignee}`} 
                      className="ml-2 text-sm text-gray-300 cursor-pointer flex-1"
                    >
                      {assignee}
                    </label>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-2 text-sm">
                  Nenhum responsável encontrado
                </div>
              )}
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
                  setSelectedAssignees([...hardcodedAssignees]);
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
      
      <TasksArea 
        tasks={tasks}
        tasksByStatus={tasksByStatus}
        displayStatuses={displayStatuses}
        getStatusColor={getStatusColor}
        getPriorityColor={getPriorityColor}
        expandedTask={expandedTask}
        toggleTaskExpand={toggleTaskExpand}
        renderAssigneesList={renderAssigneesList}
        handleTaskCompletionToggle={handleTaskCompletionToggle}
        startEditingTask={startEditingTask}
        deleteTask={deleteTask}
        moveTaskStatus={moveTaskStatus}
      />
    </div>
  );

  // Renderizando a página
  return (
    <div className="p-4 md:p-6">
      <style>{animationStyles}</style>
      
      {/* Cabeçalho e barra de ferramentas */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Tarefas Diárias</h1>
          <p className="text-gray-400">Gerencie as tarefas diárias da equipe</p>
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
      
      {/* Mensagem de erro */}
      {error && (
        <div className="bg-red-600/20 border border-red-700 text-red-100 px-4 py-3 rounded mb-4">
          <p>{error}</p>
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
            Não há tarefas diárias correspondentes aos filtros selecionados ou ainda não foram criadas tarefas.
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider w-12">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Tarefa
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                      Responsáveis
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Prioridade
                    </th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-650">
                  {tasks.map((task) => (
                    <tr 
                      key={task.id} 
                      className={`group hover:bg-gray-750 ${expandedTask === task.id ? 'bg-gray-750' : ''}`}
                    >
                      <td className="px-4 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={task.isCompleted}
                          onChange={() => handleTaskCompletionToggle(task.id)}
                          className="form-checkbox h-5 w-5 text-cyan-500 rounded border-gray-500 focus:ring-cyan-500"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div 
                          className="cursor-pointer"
                          onClick={() => toggleTaskExpand(task.id)}
                        >
                          <div className="flex items-center">
                            <span className={`inline-block w-2 h-2 rounded-full ${getStatusColor(task.status)} mr-2`}></span>
                            <span className={`font-medium ${task.isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>
                              {task.title}
                            </span>
                          </div>
                          <p className="text-gray-400 text-sm mt-1 truncate max-w-xs">
                            {task.description}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300 hidden lg:table-cell">
                        {renderAssigneesList(task.assignedTo)}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full text-white ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full text-white ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-3">
                          <button 
                            onClick={() => startEditingTask(task.id)}
                            className="text-cyan-400 hover:text-cyan-300 transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => deleteTask(task.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
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
                      {editingTask ? 'Editar Tarefa' : 'Nova Tarefa Diária'}
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
                      
                      <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-300">
                          Data
                        </label>
                        <input
                          type="date"
                          name="date"
                          id="date"
                          value={formData.date}
                          onChange={handleFormChange}
                          className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-cyan-500 focus:border-cyan-500"
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
                        <div className="mt-1 block w-full">
                          {hardcodedAssignees.map(assignee => (
                            <div key={assignee} className="flex items-center my-1">
                        <input
                                type="checkbox"
                                id={`form-assignee-${assignee}`}
                                checked={formData.assignedTo?.includes(assignee) || false}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  setFormData(prev => {
                                    const currentAssignees = prev.assignedTo || [];
                                    const newAssignees = isChecked
                                      ? [...currentAssignees, assignee]
                                      : currentAssignees.filter(a => a !== assignee);
                                    return {...prev, assignedTo: newAssignees};
                                  });
                                }}
                                className="form-checkbox h-4 w-4 text-cyan-600 rounded border-gray-500 focus:ring-cyan-500"
                              />
                              <label 
                                htmlFor={`form-assignee-${assignee}`} 
                                className="ml-2 text-sm text-gray-300"
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