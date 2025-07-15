'use client'

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import app from '@/config/firebase';
import { 
    ResponsiveContainer, 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend 
} from 'recharts';

interface ChartDataPoint {
    date: string;
    patrimonioTotal: number;
}

export default function Dashboard() {
    const { user } = useAuth();
    const [selectedPeriod, setSelectedPeriod] = useState('MAX');
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [chartLoading, setChartLoading] = useState(true);
    const [chartError, setChartError] = useState<string | null>(null);
    const [totalPatrimonioAtual, setTotalPatrimonioAtual] = useState<number>(0);
    const [variacaoPatrimonio, setVariacaoPatrimonio] = useState<number>(0);

    const db = getFirestore(app);

    useEffect(() => {
        const fetchAllocationData = async () => {
            setChartLoading(true);
            setChartError(null);
            try {
                const allocationsRef = collection(db, 'allocations');
                const q = query(allocationsRef, orderBy('date', 'asc'));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setChartData([]);
                    setTotalPatrimonioAtual(0);
                    setVariacaoPatrimonio(0);
                    setChartLoading(false);
                    return;
                }

                const allocationDataByDate: { [date: string]: number } = {};

                querySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const date = data.date;
                    const totalValue = data.totalValue || 0;

                    if (allocationDataByDate[date]) {
                        allocationDataByDate[date] += totalValue;
                    } else {
                        allocationDataByDate[date] = totalValue;
                    }
                });

                // START: Filtrar para manter apenas o último dia de cada mês
                const filteredDataByLastDayOfMonth: { [date: string]: number } = {};
                const lastDays: { [key: string]: string } = {}; // Armazena a última data encontrada para cada mês/ano

                // Primeiro, encontra a última data registrada para cada mês
                Object.keys(allocationDataByDate).forEach(dateStr => {
                    try {
                        const currentDate = new Date(dateStr + 'T00:00:00Z'); // Usar UTC para consistência
                        const yearMonth = `${currentDate.getUTCFullYear()}-${(currentDate.getUTCMonth() + 1).toString().padStart(2, '0')}`;

                        if (!lastDays[yearMonth] || new Date(dateStr + 'T00:00:00Z') > new Date(lastDays[yearMonth] + 'T00:00:00Z')) {
                            lastDays[yearMonth] = dateStr;
                        }
                    } catch (e) {
                        console.error(`Erro ao processar data: ${dateStr}`, e);
                    }
                });

                // Segundo, filtra allocationDataByDate usando as últimas datas encontradas
                Object.values(lastDays).forEach(lastDateOfMonth => {
                    if (allocationDataByDate[lastDateOfMonth]) {
                        filteredDataByLastDayOfMonth[lastDateOfMonth] = allocationDataByDate[lastDateOfMonth];
                    }
                });
                // END: Filtrar para manter apenas o último dia de cada mês

                // Usar os dados filtrados
                const processedData: ChartDataPoint[] = Object.entries(filteredDataByLastDayOfMonth)
                    .map(([date, patrimonioTotal]) => ({ date, patrimonioTotal }))
                    .sort((a, b) => new Date(a.date + 'T00:00:00Z').getTime() - new Date(b.date + 'T00:00:00Z').getTime()); // Ordenar usando UTC

                setChartData(processedData);

                if (processedData.length > 0) {
                    const ultimoPatrimonio = processedData[processedData.length - 1].patrimonioTotal;
                    setTotalPatrimonioAtual(ultimoPatrimonio);

                    if (processedData.length > 1) {
                        const penultimoPatrimonio = processedData[processedData.length - 2].patrimonioTotal;
                        const variacao = ((ultimoPatrimonio - penultimoPatrimonio) / penultimoPatrimonio) * 100;
                        setVariacaoPatrimonio(isNaN(variacao) || !isFinite(variacao) ? 0 : variacao);
                    } else {
                        setVariacaoPatrimonio(0);
                    }
                } else {
                  setTotalPatrimonioAtual(0);
                  setVariacaoPatrimonio(0);
                }

            } catch (error) {
                console.error("Error fetching allocation data:", error);
                setChartError("Erro ao carregar dados de alocação.");
            } finally {
                setChartLoading(false);
            }
        };

        fetchAllocationData();
    }, [db]);

    const formatCurrency = (value: number) => {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };
    
    const formatDateTick = (tickItem: string) => {
        try {
           const date = new Date(tickItem + 'T00:00:00');
           return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        } catch (e) {
           return tickItem;
        }
    };

    return (
        <div className="w-[95%] mx-auto pb-12">
            {/* Page Title */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-gray-400">Bem-vindo de volta, {user?.email?.split('@')[0]}!</p>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Patrimônio Total Card Atualizado */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                        <div className="text-gray-400">Patrimônio Total</div>
                        <div className="text-cyan-500">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    {chartLoading ? (
                        <div className="h-10 flex items-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-cyan-500"></div>
                        </div>
                    ) : (
                      <>
                        <div className="text-2xl font-bold text-white mb-2">{formatCurrency(totalPatrimonioAtual)}</div>
                        {chartData.length > 1 && (
                          <div className={`flex items-center ${variacaoPatrimonio >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  {variacaoPatrimonio >= 0 ? (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                  ) : (
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                                  )}
                              </svg>
                              <span>{variacaoPatrimonio.toFixed(2)}%</span>
                              <span className="text-gray-400 text-sm ml-2">vs último registro</span>
                          </div>
                        )}
                      </>
                    )}
                </div>

                {/* Rentabilidade */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-gray-400">Rentabilidade</div>
                    <div className="text-cyan-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white mb-2">-</div>
                  <div className="flex items-center text-gray-500">
                    <span>N/A</span>
                  </div>
                </div>

                {/* Risco */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-gray-400">Volatilidade</div>
                    <div className="text-cyan-500">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white mb-2">-</div>
                   <div className="flex items-center text-gray-500">
                    <span>N/A</span>
                  </div>
                </div>

                {/* Alocação */}
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-gray-400">Clientes Ativos</div>
                     <div className="text-cyan-500">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                         <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                       </svg>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-white mb-2">-</div>
                   <div className="flex items-center text-gray-500">
                    <span>N/A</span>
                  </div>
                </div>
            </div>

            {/* Main Chart Area */}
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-white">Evolução Patrimonial Consolidada</h2>
                </div>
                <div className="h-80 w-full">
                    {chartLoading && (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
                        </div>
                    )}
                    {chartError && (
                        <div className="flex justify-center items-center h-full text-red-500">
                            {chartError}
                        </div>
                    )}
                    {!chartLoading && !chartError && chartData.length === 0 && (
                        <div className="flex justify-center items-center h-full text-gray-400">
                           Nenhum dado de alocação encontrado para exibir o gráfico.
                        </div>
                    )}
                    {!chartLoading && !chartError && chartData.length > 0 && (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart 
                              data={chartData}
                              margin={{
                                top: 5,
                                right: 30,
                                left: 20,
                                bottom: 5,
                              }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis 
                                  dataKey="date" 
                                  stroke="#9ca3af"
                                  tickFormatter={formatDateTick}
                                />
                                <YAxis 
                                  stroke="#9ca3af"
                                  tickFormatter={(value) => formatCurrency(value)}
                                />
                                <Tooltip 
                                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }}
                                  labelStyle={{ color: '#e5e7eb' }}
                                  itemStyle={{ color: '#38bdf8' }}
                                  formatter={(value: number) => [formatCurrency(value), "Patrimônio"]}
                                  labelFormatter={(label) => {
                                      try {
                                          // Usar UTC para consistência na formatação do tooltip
                                          return `Data: ${new Date(label + 'T00:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`;
                                      } catch (e) {
                                          return `Data: ${label}`;
                                      }
                                  }}
                                />
                                <Line 
                                  type="monotone" 
                                  dataKey="patrimonioTotal" 
                                  stroke="#38bdf8"
                                  strokeWidth={2} 
                                  dot={{ r: 3, fill: '#38bdf8' }} 
                                  activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Bottom Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Asset Allocation */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-white mb-6">Alocação por Classe</h2>
                  <div className="h-64 w-full bg-gray-700/50 rounded-lg flex items-center justify-center text-gray-400">
                    Gráfico de Pizza
                  </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-lg font-semibold text-white mb-6">Últimas Movimentações</h2>
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between py-3 border-b border-gray-700">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            i % 2 === 0 ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                          }`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              {i % 2 === 0 ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                              ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                              )}
                            </svg>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">PETR4</div>
                            <div className="text-xs text-gray-400">12 Jan 2024</div>
                          </div>
                        </div>
                        <div className={`text-sm font-medium ${
                          i % 2 === 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                          {i % 2 === 0 ? '+' : '-'}R$ 5.000,00
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
            </div>
        </div>
    );
} 