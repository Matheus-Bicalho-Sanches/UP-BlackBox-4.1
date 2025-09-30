"use client";

import { useState, useEffect } from 'react';
import { FirestoreMonitor } from '@/lib/firestoreMonitor';
import { FiBarChart2, FiDownload, FiRefreshCw, FiX, FiChevronDown, FiChevronUp } from 'react-icons/fi';

export default function FirestoreMonitorWidget() {
  const [summary, setSummary] = useState(FirestoreMonitor.getSummary());
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    // Atualizar a cada 2 segundos
    const interval = setInterval(() => {
      setSummary(FirestoreMonitor.getSummary());
    }, 2000);

    // Listener para atualizações imediatas
    const unsubscribe = FirestoreMonitor.addListener(() => {
      setSummary(FirestoreMonitor.getSummary());
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const handleReset = () => {
    if (confirm('Resetar todos os contadores? Esta ação não pode ser desfeita.')) {
      FirestoreMonitor.reset();
      setSummary(FirestoreMonitor.getSummary());
    }
  };

  const handleExport = () => {
    FirestoreMonitor.exportJSON();
  };

  const handleViewReport = () => {
    FirestoreMonitor.getReport();
    alert('📊 Relatório detalhado gerado no console! Pressione F12 para visualizar.');
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-all hover:scale-110"
          title="Abrir monitor"
        >
          <FiBarChart2 size={20} />
          {summary.totalReads > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {summary.totalReads > 999 ? '999+' : summary.totalReads}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transition-all" style={{ minWidth: '320px', maxWidth: '400px' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiBarChart2 size={18} />
          <span className="font-semibold text-sm">Firestore Monitor</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-white/20 p-1 rounded transition-colors"
            title={isExpanded ? "Minimizar" : "Expandir"}
          >
            {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="hover:bg-white/20 p-1 rounded transition-colors"
            title="Ocultar"
          >
            <FiX size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Estatísticas principais */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Reads</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {summary.totalReads.toLocaleString()}
            </div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Custo (USD)</div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              ${summary.estimatedCost.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Tempo decorrido */}
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          ⏱️ {summary.elapsedMinutes} minutos de monitoramento
        </div>

        {/* Top coleções (se expandido) */}
        {isExpanded && summary.topCollections.length > 0 && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Top Coleções:
            </div>
            <div className="space-y-2">
              {summary.topCollections.map((col, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      idx === 0 ? 'bg-red-500' :
                      idx === 1 ? 'bg-orange-500' :
                      idx === 2 ? 'bg-yellow-500' :
                      'bg-blue-500'
                    }`} />
                    <span className="text-gray-700 dark:text-gray-300 truncate" title={col.collection}>
                      {col.collection}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-gray-500 dark:text-gray-400">
                      {col.total}
                    </span>
                    <span className="text-gray-400 dark:text-gray-500 w-12 text-right">
                      {col.percentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botões de ação */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleViewReport}
            className="flex-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 py-2 px-3 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
            title="Ver relatório completo no console"
          >
            <FiBarChart2 size={14} />
            Relatório
          </button>
          <button
            onClick={handleExport}
            className="flex-1 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400 py-2 px-3 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
            title="Exportar dados como JSON"
          >
            <FiDownload size={14} />
            Exportar
          </button>
          <button
            onClick={handleReset}
            className="flex-1 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 py-2 px-3 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
            title="Resetar contadores"
          >
            <FiRefreshCw size={14} />
            Reset
          </button>
        </div>
      </div>

      {/* Footer informativo */}
      {isExpanded && (
        <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            💡 <strong>Dica:</strong> Use <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">window.firestoreMonitor.getReport()</code> no console para relatório detalhado
          </div>
        </div>
      )}
    </div>
  );
}
