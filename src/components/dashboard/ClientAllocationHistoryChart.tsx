'use client'

import { useState, useEffect, useMemo } from 'react';
import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    getDocs
} from 'firebase/firestore';
import app from '@/config/firebase';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import Link from 'next/link';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, eachDayOfInterval, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils'; // Assuming formatCurrency is here

interface ClientAllocationHistoryChartProps {
    clientId: string;
}

interface AllocationAsset {
    type: string;
    investments: { value: number }[];
}

interface AllocationRecord {
    date: string; // YYYY-MM-DD
    totalValue: number;
    assets: AllocationAsset[];
}

interface ChartDataPoint {
    date: string;
    [assetType: string]: number | string; // Mapeia tipo de ativo para seu valor
}

// Definir a paleta ordenada
const ORDERED_PALETTE = [
    '#AED3E3', // Mais Clara
    '#86BEDA',
    '#009DCF',
    '#008DC0',
    '#007AA2',
    '#006A89',
    '#00609C',
    '#00527C',
    '#004B57',
    '#003F5D'  // Mais Escura
    // Adicione mais cores se houver mais de 10 classes
];

// Componente Customizado para Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    // Calcular valor total
    const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);

    // Formatar Data (label)
    const formattedDate = new Date(label + 'T00:00:00').toLocaleDateString('pt-BR');

    return (
      <div 
        className="bg-gray-800/90 p-3 rounded shadow-lg border border-gray-700 text-sm"
        style={{ backdropFilter: 'blur(2px)' }} // Efeito de desfoque opcional
      >
        <p className="mb-2 font-semibold text-white">{`Data: ${formattedDate}`}</p>
        {payload.map((entry: any, index: number) => {
          // Reutilizar lógica de formatação percentual se necessário
          const percentage = total > 0 ? ((entry.value / total) * 100).toFixed(2) : 0;
          const formattedValue = formatCurrency(entry.value);
          return (
            <p key={`item-${index}`} style={{ color: entry.color || '#ffffff' }} className="text-xs">
              {`${entry.name}: ${percentage}% (${formattedValue})`}
            </p>
          );
        })}
        <hr className="my-2 border-gray-600" />
        <p className="font-semibold text-white">
          {`Valor total: ${formatCurrency(total)}`}
        </p>
      </div>
    );
  }

  return null;
};

export default function ClientAllocationHistoryChart({ clientId }: ClientAllocationHistoryChartProps) {
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [assetKeys, setAssetKeys] = useState<string[]>([]); // Guarda os nomes das classes de ativos encontradas
    const [orderedRenderKeys, setOrderedRenderKeys] = useState<string[]>([]);
    const [dynamicColors, setDynamicColors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const db = getFirestore(app);

    useEffect(() => {
        const fetchAllocationHistory = async () => {
            setLoading(true);
            setError(null);
            setOrderedRenderKeys([]);
            setDynamicColors({});
            try {
                const allocationRef = collection(db, 'allocations');
                const q = query(
                    allocationRef,
                    where('clientId', '==', clientId),
                    orderBy('date', 'asc') // Ordenar por data ascendente para o gráfico
                );
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    setChartData([]);
                    setAssetKeys([]);
                    // setError("Nenhum histórico de alocação encontrado.");
                    return; // Não é um erro se não houver dados
                }

                const allAllocations = querySnapshot.docs.map(doc => doc.data() as AllocationRecord);
                
                const uniqueAssetKeys = Array.from(
                    new Set(allAllocations.flatMap(alloc => alloc.assets.map(asset => asset.type)))
                );
                setAssetKeys(uniqueAssetKeys);

                // Processar dados para o gráfico de área empilhada
                const dataForChart = allAllocations.map(alloc => {
                    const point: ChartDataPoint = { date: alloc.date };
                    uniqueAssetKeys.forEach(key => {
                        const asset = alloc.assets.find(a => a.type === key);
                        point[key] = asset ? asset.investments.reduce((sum, inv) => sum + (inv.value || 0), 0) : 0;
                    });
                    return point;
                });

                setChartData(dataForChart);

                // --- Lógica para Ordenação e Cores Dinâmicas ---
                if (dataForChart.length > 0) {
                    const lastDataPoint = dataForChart[dataForChart.length - 1];
                    
                    // Filtrar chaves com valor numérico > 0 no último ponto e ordenar por valor (desc)
                    const sortedKeys = uniqueAssetKeys
                        .filter(key => {
                            const value = lastDataPoint[key];
                            return typeof value === 'number' && value > 0; // Correção: Checar tipo antes da comparação
                        })
                        .sort((a, b) => (lastDataPoint[b] as number) - (lastDataPoint[a] as number));
                    
                    // Incluir chaves com valor 0 ou não numérico no final
                    const zeroValueKeys = uniqueAssetKeys.filter(key => {
                       const value = lastDataPoint[key];
                       return !(typeof value === 'number' && value > 0); // Chaves não incluídas no sortedKeys
                    });
                    const finalOrderedKeys = [...sortedKeys, ...zeroValueKeys];
                    setOrderedRenderKeys(finalOrderedKeys);

                    // Criar mapeamento dinâmico de cores
                    const colorsMap: Record<string, string> = {};
                    sortedKeys.forEach((key, index) => {
                        // Usar a paleta ordenada, com fallback para a última cor se exceder
                        colorsMap[key] = ORDERED_PALETTE[index % ORDERED_PALETTE.length];
                    });
                    // Atribuir uma cor padrão (talvez a última) para chaves com valor zero
                    zeroValueKeys.forEach(key => {
                         colorsMap[key] = ORDERED_PALETTE[ORDERED_PALETTE.length - 1]; // Última cor para zero
                    });
                    setDynamicColors(colorsMap);
                }
                // --- Fim da Lógica --- 

            } catch (err: any) {
                console.error("Error fetching allocation history:", err);
                setError(`Erro ao buscar histórico: ${err.message || 'Erro desconhecido.'}`);
            } finally {
                setLoading(false);
            }
        };

        fetchAllocationHistory();
    }, [clientId, db]);

    const formatCurrency = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '-';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDateTick = (tickItem: string) => {
        try {
            const date = new Date(tickItem + 'T00:00:00');
            return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        } catch (e) { return tickItem; }
    };
    
    // Formatter para Tooltip mostrando percentuais (removido do Tooltip, mas pode ser usado no CustomTooltip se preferir)
    // const tooltipFormatter = ... (removido/comentado)

    return (
        <div className="h-80 w-full"> {/* Altura um pouco maior */} 
            {loading && (
                <div className="flex justify-center items-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
                </div>
            )}
            {error && !loading && (
                <div className="flex justify-center items-center h-full text-center">
                    <p className="text-xs text-red-500/80">{error}</p>
                </div>
            )}
            {!loading && !error && chartData.length > 1 && (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                            dataKey="date" 
                            stroke="#9ca3af"
                            tickFormatter={formatDateTick}
                            fontSize={10}
                        />
                        <YAxis 
                            tickFormatter={(value) => formatCurrency(value)}
                            stroke="#9ca3af"
                            fontSize={10}
                            width={80}
                        />
                        <Tooltip 
                            // Remover props antigas
                            // formatter={tooltipFormatter}
                            // contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px', fontSize: '12px', padding: '4px 8px' }}
                            // labelFormatter={(label) => `Data: ${new Date(label + 'T00:00:00').toLocaleDateString('pt-BR')}`}
                            // labelStyle={{ color: '#ffffff' }} 
                            // Usar o componente customizado
                            content={<CustomTooltip />}
                            cursor={{ fill: 'rgba(100, 116, 139, 0.1)' }} // Mantém um cursor sutil
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        {orderedRenderKeys.map((key) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId="1"
                                fill={dynamicColors[key] || '#8884d8'}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            )}
            {!loading && !error && chartData.length <= 1 && (
                <div className="flex justify-center items-center h-full text-gray-500 text-sm">
                    {chartData.length === 1 ? 'Apenas um registro de alocação encontrado. Necessário histórico para gráfico.' : 'Nenhum histórico de alocação encontrado.'}
                </div>
            )}
        </div>
    );
} 