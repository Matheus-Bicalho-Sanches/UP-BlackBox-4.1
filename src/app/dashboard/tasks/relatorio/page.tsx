'use client'

import { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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

// Interface para o período do relatório
interface ReportPeriod {
  type: 'period';
  startDate: string;
  endDate: string;
  totalLogs: number;
}

// Interface para dados de usuário no relatório
interface UserReportData {
  type: 'userData';
  totalTasks: number;
  created: number;
  completed: number;
  updated: number;
  actions: {
    [key: string]: number;
  };
  tasksByType: {
    [key: string]: number;
  };
  details: Array<{
    action: string;
    taskTitle: string;
    taskType: string;
    dateTime: string;
    details: string;
  }>;
}

// Interface para dados agrupados do relatório
interface ReportData {
  [key: string]: ReportPeriod | UserReportData;
}

export default function RelatorioPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<ReportData>({});
  const reportRef = useRef<HTMLDivElement>(null);
  const [printLoading, setPrintLoading] = useState(false);

  // Função para imprimir o relatório em PDF
  const handlePrint = async () => {
    if (!reportRef.current) return;
    
    try {
      setPrintLoading(true);
      
      const element = reportRef.current;
      
      // Abordagem 1: Tentar dividir o conteúdo em páginas
      try {
        // Configurações para capturar todo o conteúdo
        const canvas = await html2canvas(element, {
          scale: 2, // Aumentar a escala para melhor qualidade
          useCORS: true,
          logging: false,
          allowTaint: true,
          windowHeight: element.scrollHeight,
          height: element.scrollHeight,
          scrollY: 0,
          scrollX: 0,
          backgroundColor: '#374151' // Cor de fundo gray-700 para manter o estilo
        });
        
        const imgData = canvas.toDataURL('image/png');
        
        // Usar orientação retrato para melhor legibilidade
        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4',
          compress: true
        });
        
        // Dimensões da página A4 em mm
        const pageWidth = 210;
        const pageHeight = 297;
        
        // Calcular as dimensões da imagem para preencher toda a página
        const imgWidth = pageWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        // Dividir em múltiplas páginas
        let heightLeft = imgHeight;
        let position = 0;
        
        // Adicionar a primeira página sem margens
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        
        // Adicionar páginas adicionais se necessário
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(
            imgData, 
            'PNG', 
            0, 
            position, 
            imgWidth, 
            imgHeight
          );
          heightLeft -= pageHeight;
        }
        
        const title = `Relatório_Tarefas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`;
        pdf.save(title + '.pdf');
        return;
      } catch (err) {
        console.warn('Erro ao tentar abordagem 1, tentando outra abordagem:', err);
      }
      
      // Abordagem 2: Gerar um PDF para cada seção do usuário
      const report = reportRef.current;
      const userSections = report.querySelectorAll('[data-user-section]');
      
      if (userSections.length > 0) {
        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4',
          compress: true
        });
        
        // Adicionar cabeçalho do relatório
        const headerSection = report.querySelector('[data-report-header]');
        if (headerSection) {
          const headerCanvas = await html2canvas(headerSection as HTMLElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#374151' // Cor de fundo gray-700
          });
          
          const headerImgData = headerCanvas.toDataURL('image/png');
          const headerImgWidth = 210; // Largura da página A4 - sem margens
          const headerImgHeight = (headerCanvas.height * headerImgWidth) / headerCanvas.width;
          
          pdf.addImage(headerImgData, 'PNG', 0, 0, headerImgWidth, headerImgHeight);
        }
        
        let yPosition = headerSection ? 40 : 0; // Posição Y inicial após o cabeçalho
        
        // Adicionar cada seção de usuário como uma nova página
        for (let i = 0; i < userSections.length; i++) {
          if (i > 0) {
            pdf.addPage();
            yPosition = 0;
          }
          
          const canvas = await html2canvas(userSections[i] as HTMLElement, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#374151' // Cor de fundo gray-700
          });
          
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 210; // Sem margens
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          // Se a seção for muito alta, dividir em múltiplas páginas
          if (imgHeight > 297) { // Altura da página A4
            let heightLeft = imgHeight;
            let srcY = 0;
            
            pdf.addImage(imgData, 'PNG', 0, yPosition, imgWidth, imgHeight);
            heightLeft -= (297 - yPosition);
            
            while (heightLeft > 0) {
              srcY = imgHeight - heightLeft;
              pdf.addPage();
              pdf.addImage(
                imgData, 
                'PNG', 
                0, 
                0, 
                imgWidth, 
                imgHeight, 
                undefined, 
                undefined,
                srcY / imgHeight * canvas.height
              );
              heightLeft -= 297;
            }
          } else {
            pdf.addImage(imgData, 'PNG', 0, yPosition, imgWidth, imgHeight);
          }
        }
        
        const title = `Relatório_Tarefas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`;
        pdf.save(title + '.pdf');
      } else {
        // Fallback: Tentar gerar um PDF simples sem paginação
        const canvas = await html2canvas(element, {
          scale: 1.5,
          useCORS: true,
          backgroundColor: '#374151' // Cor de fundo gray-700
        });
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: 'a4',
          compress: true
        });
        
        const imgWidth = 210; // Sem margens
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        
        const title = `Relatório_Tarefas_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`;
        pdf.save(title + '.pdf');
      }
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF. Tente novamente.');
    } finally {
      setPrintLoading(false);
    }
  };

  // Buscar logs do período selecionado
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      // Usar datas específicas selecionadas e garantir que sejam interpretadas no fuso horário local
      // Criar as datas usando o formato "YYYY/MM/DD" para evitar problemas de fuso horário
      const formattedStartDate = startDate.replace(/-/g, '/');
      const formattedEndDate = endDate.replace(/-/g, '/');
      
      const startDateObj = new Date(formattedStartDate);
      const endDateObj = new Date(formattedEndDate);
      
      // Ajustar os horários para garantir que todo o período seja incluído
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj.setHours(23, 59, 59, 999);

      // Formatar datas para exibição
      const startDateFormatted = startDateObj.toLocaleDateString('pt-BR');
      const endDateFormatted = endDateObj.toLocaleDateString('pt-BR');

      // Buscar todos os logs
      const response = await fetch('/api/logs');
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar logs: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Filtrar logs pelo período
      const filteredLogs = data.logs.filter((log: Log) => {
        const logDate = new Date(log.dateTime);
        return logDate >= startDateObj && logDate <= endDateObj;
      });
      
      setLogs(filteredLogs);
      
      // Processar dados para o relatório
      processReportData(filteredLogs, startDateFormatted, endDateFormatted);
    } catch (err) {
      console.error('Erro ao buscar logs:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar logs');
    } finally {
      setLoading(false);
    }
  };

  // Processar dados para o relatório
  const processReportData = (logs: Log[], startDate: string, endDate: string) => {
    const reportData: ReportData = {};

    // Filtrar logs para remover "Tarefa criada" e logs do "Sistema"
    const filteredLogs = logs.filter(log => 
      log.action !== 'Tarefa criada' && log.user !== 'Sistema'
    );
    
    // Adicionar um registro especial para o período do relatório
    reportData['__reportPeriod'] = {
      type: 'period',
      startDate,
      endDate,
      totalLogs: filteredLogs.length, // Usar o total de logs filtrados
    };

    // Agrupar por usuário
    filteredLogs.forEach(log => { // Usar filteredLogs aqui
      const user = log.user;
      
      if (!reportData[user]) {
        reportData[user] = {
          type: 'userData',
          totalTasks: 0,
          created: 0,
          completed: 0,
          updated: 0,
          actions: {},
          tasksByType: {},
          details: []
        };
      }
      
      // Incrementar o contador para a ação específica
      if (reportData[user].type === 'userData') {
        reportData[user].actions[log.action] = (reportData[user].actions[log.action] || 0) + 1;
        
        // Incrementar o contador para o tipo de tarefa
        reportData[user].tasksByType[log.taskType] = (reportData[user].tasksByType[log.taskType] || 0) + 1;
        
        // Contadores específicos para ações comuns
        if (log.action === 'Tarefa concluída') {
          reportData[user].completed++;
        } else if (log.action.includes('atualizada') || log.action.includes('alterada')) {
          reportData[user].updated++;
        }
        
        // Adicionar detalhes da atividade
        reportData[user].details.push({
          action: log.action,
          taskTitle: log.taskTitle,
          taskType: log.taskType,
          dateTime: new Date(log.dateTime).toLocaleString('pt-BR'),
          details: log.details
        });
      }
    });
    
    setReportData(reportData);
  };

  // Atualizar relatório quando os filtros mudarem
  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate]);

  // Formatar a data para exibição
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  };

  // Renderizar o relatório
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl font-semibold text-white">Relatório de Atividades</h2>
        
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
          {/* Filtro por período específico */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center">
              <label className="text-gray-300 mr-2 whitespace-nowrap">De:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-700 text-white rounded px-3 py-2 outline-none"
              />
            </div>
            <div className="flex items-center">
              <label className="text-gray-300 mr-2 ml-2 whitespace-nowrap">Até:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-700 text-white rounded px-3 py-2 outline-none"
              />
            </div>
          </div>
          
          <button
            onClick={handlePrint}
            disabled={printLoading || loading || logs.length === 0}
            className={`${
              printLoading || loading || logs.length === 0 
                ? 'bg-gray-600 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700'
            } text-white px-4 py-2 rounded flex items-center whitespace-nowrap transition-colors`}
          >
            {printLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Gerando PDF...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Imprimir em PDF
              </>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8 text-gray-300">
          Gerando relatório...
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 p-4 rounded mb-4">
          {error}
        </div>
      )}

      {!loading && !error && logs.length === 0 && (
        <div className="bg-gray-700 text-center py-8 rounded">
          <p className="text-gray-300">Nenhuma atividade encontrada no período selecionado.</p>
        </div>
      )}

      {!loading && !error && logs.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-6" ref={reportRef} data-pdf-content>
          <div className="mb-6 border-b border-gray-600 pb-4" data-report-header>
            <h3 className="text-lg font-semibold text-white mb-2">Relatório de Atividades</h3>
            {reportData['__reportPeriod'] && reportData['__reportPeriod'].type === 'period' && (
              <>
                <p className="text-gray-300">
                  Período: {reportData['__reportPeriod'].startDate} até {reportData['__reportPeriod'].endDate}
                </p>
                <p className="text-gray-300">
                  Total de atividades registradas: {reportData['__reportPeriod'].totalLogs}
                </p>
              </>
            )}
          </div>

          {Object.entries(reportData)
            .filter(([key, data]) => key !== '__reportPeriod' && data.type === 'userData')
            .map(([user, data]) => {
              // TypeScript não reconhece o narrowing dentro do filter, então precisamos fazer um type assertion
              const userData = data as UserReportData;
              return (
                <div key={user} className="mb-8 border border-gray-600 rounded-lg overflow-hidden" data-user-section>
                  <div className="bg-gray-800 p-4">
                    <h3 className="text-lg font-semibold text-white">{user}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                      <div className="bg-gray-700/50 p-3 rounded">
                        <p className="text-cyan-400 font-medium">Total de Atividades</p>
                        <p className="text-2xl text-white mt-1">{Object.values(userData.actions).reduce((a, b) => a + b, 0)}</p>
                      </div>
                      <div className="bg-blue-900/30 p-3 rounded">
                        <p className="text-blue-400 font-medium">Tarefas Atualizadas</p>
                        <p className="text-2xl text-white mt-1">{userData.updated}</p>
                      </div>
                      <div className="bg-purple-900/30 p-3 rounded">
                        <p className="text-purple-400 font-medium">Tarefas Concluídas</p>
                        <p className="text-2xl text-white mt-1">{userData.completed}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Resumo por tipo de ação */}
                      <div>
                        <h4 className="text-white font-medium mb-3 border-b border-gray-600 pb-2">Ações realizadas</h4>
                        <div className="space-y-2">
                          {Object.entries(userData.actions)
                            .sort(([, countA], [, countB]) => countB - countA)
                            .map(([action, count]) => (
                              <div key={action} className="flex justify-between">
                                <span className="text-gray-300">{action}</span>
                                <span className="text-cyan-400 font-medium">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                      
                      {/* Resumo por tipo de tarefa */}
                      <div>
                        <h4 className="text-white font-medium mb-3 border-b border-gray-600 pb-2">Tipos de tarefas</h4>
                        <div className="space-y-2">
                          {Object.entries(userData.tasksByType)
                            .sort(([, countA], [, countB]) => countB - countA)
                            .map(([type, count]) => (
                              <div key={type} className="flex justify-between">
                                <span className="text-gray-300">{type}</span>
                                <span className="text-cyan-400 font-medium">{count}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Detalhes das atividades */}
                    <div className="mt-6">
                      <h4 className="text-white font-medium mb-3 border-b border-gray-600 pb-2">Detalhes das atividades</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-gray-800">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ação</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tarefa</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tipo</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data/Hora</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Detalhes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-600">
                            {userData.details
                              .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
                              .map((detail, index) => (
                                <tr key={index} className={index % 2 === 0 ? 'bg-gray-800/50' : ''}>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{detail.action}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-white">{detail.taskTitle}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{detail.taskType}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-300">{detail.dateTime}</td>
                                  <td className="px-4 py-2 text-sm text-gray-300">{detail.details}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
} 