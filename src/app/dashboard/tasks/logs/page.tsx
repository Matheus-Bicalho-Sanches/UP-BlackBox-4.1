'use client'

import { useState, useEffect } from 'react';

// Interface para o tipo de log
interface Log {
  id: string;
  action: string;
  taskId: string;
  taskTitle: string;
  taskType: string;
  dateTime: string;
  user: string;
  details: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('Todos');
  const [filterUser, setFilterUser] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Buscar logs ao carregar a página
  useEffect(() => {
    fetchLogs();
  }, []);

  // Buscar logs do backend
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/logs');

      if (!response.ok) {
        throw new Error(`Erro ao buscar logs: ${response.status}`);
      }

      const data = await response.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar logs');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar logs
  const filteredLogs = logs.filter(log => {
    // Filtro por tipo de tarefa
    if (filterType !== 'Todos' && log.taskType !== filterType) {
      return false;
    }

    // Filtro por usuário
    if (filterUser !== 'Todos' && log.user !== filterUser) {
      return false;
    }

    // Filtro por termo de busca (busca em action, taskTitle, details e user)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        log.action.toLowerCase().includes(searchLower) ||
        log.taskTitle.toLowerCase().includes(searchLower) ||
        log.details.toLowerCase().includes(searchLower) ||
        log.user.toLowerCase().includes(searchLower)
      );
    }

    return true;
  });

  // Obter tipos únicos de tarefa
  const uniqueTaskTypes = Array.from(new Set(logs.map(log => log.taskType)));

  // Obter usuários únicos
  const uniqueUsers = Array.from(new Set(logs.map(log => log.user)));

  // Formatar data/hora para exibição
  const formatDateTime = (dateTime: string) => {
    try {
      const date = new Date(dateTime);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (err) {
      return dateTime;
    }
  };

  // Obter cor da badge baseada no tipo de ação
  const getActionBadgeColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('criada') || actionLower.includes('criado')) {
      return 'bg-green-500/20 text-green-300 border-green-500/50';
    } else if (actionLower.includes('atualizada') || actionLower.includes('atualizado')) {
      return 'bg-blue-500/20 text-blue-300 border-blue-500/50';
    } else if (actionLower.includes('excluída') || actionLower.includes('excluído')) {
      return 'bg-red-500/20 text-red-300 border-red-500/50';
    } else if (actionLower.includes('concluída') || actionLower.includes('concluído')) {
      return 'bg-purple-500/20 text-purple-300 border-purple-500/50';
    } else if (actionLower.includes('resetada') || actionLower.includes('resetado')) {
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50';
    }
    return 'bg-gray-500/20 text-gray-300 border-gray-500/50';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-300">
        <p className="font-semibold mb-2">Erro ao carregar logs</p>
        <p>{error}</p>
        <button
          onClick={fetchLogs}
          className="mt-4 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros e Busca */}
      <div className="bg-gray-900 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Busca */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Buscar
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar em ações, tarefas, detalhes..."
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Filtro por Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tipo de Tarefa
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="Todos">Todos</option>
              {uniqueTaskTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Filtro por Usuário */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Usuário
            </label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="Todos">Todos</option>
              {uniqueUsers.map(user => (
                <option key={user} value={user}>{user}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            Mostrando <span className="font-semibold text-white">{filteredLogs.length}</span> de{' '}
            <span className="font-semibold text-white">{logs.length}</span> logs
          </div>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors text-sm"
          >
            Atualizar
          </button>
        </div>
      </div>

      {/* Lista de Logs */}
      {filteredLogs.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-8 text-center text-gray-400">
          <p>Nenhum log encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-gray-900 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="flex-1 space-y-2">
                  {/* Header com Ação e Tipo */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getActionBadgeColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300">
                      {log.taskType}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDateTime(log.dateTime)}
                    </span>
                  </div>

                  {/* Título da Tarefa */}
                  <div>
                    <h3 className="font-semibold text-white text-lg">
                      {log.taskTitle}
                    </h3>
                  </div>

                  {/* Detalhes */}
                  {log.details && (
                    <div className="text-sm text-gray-400">
                      {log.details}
                    </div>
                  )}

                  {/* Footer com Usuário e ID da Tarefa */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                    <span>
                      <span className="font-medium">Usuário:</span> {log.user}
                    </span>
                    {log.taskId && (
                      <span>
                        <span className="font-medium">ID Tarefa:</span> {log.taskId}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


