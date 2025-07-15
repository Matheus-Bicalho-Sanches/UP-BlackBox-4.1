'use client'

import { useState, useEffect } from 'react';
import {
    getFirestore,
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs
} from 'firebase/firestore';
import app from '@/config/firebase';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    Legend
} from 'recharts';
import Link from 'next/link';

interface ClientAllocationSummaryProps {
    clientId: string;
}

interface AllocationAsset {
    type: string;
    investments: { value: number }[];
}

interface LatestAllocation {
    totalValue: number;
    date: string;
    assets: AllocationAsset[];
}

interface PieChartData {
    name: string; // Asset class type
    value: number; // Total value for this class
}

// Cores predefinidas para as classes de ativos (pode personalizar)
const COLORS = ['#38bdf8', '#34d399', '#facc15', '#f87171', '#a78bfa', '#fb923c'];

export default function ClientAllocationSummary({ clientId }: ClientAllocationSummaryProps) {
    const [allocationData, setAllocationData] = useState<LatestAllocation | null>(null);
    const [pieData, setPieData] = useState<PieChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const db = getFirestore(app);

    useEffect(() => {
        const fetchLatestAllocation = async () => {
            setLoading(true);
            setError(null);
            try {
                const allocationRef = collection(db, 'allocations');
                const q = query(
                    allocationRef,
                    where('clientId', '==', clientId),
                    orderBy('date', 'desc'),
                    limit(1)
                );
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const latest = querySnapshot.docs[0].data() as LatestAllocation;
                    setAllocationData(latest);

                    // Processar dados para o gráfico de pizza
                    const dataForPie: PieChartData[] = latest.assets
                         .map(asset => ({
                            name: asset.type,
                            value: asset.investments.reduce((sum, inv) => sum + (inv.value || 0), 0),
                         }))
                         .filter(item => item.value > 0); // Remover classes com valor zero
                         
                    setPieData(dataForPie);

                } else {
                    setAllocationData(null);
                    setPieData([]);
                    // Não é necessariamente um erro, pode não haver dados ainda
                    // setError("Nenhum registro de alocação encontrado.");
                }
            } catch (err: any) {
                console.error("Error fetching latest allocation:", err);
                setError(`Erro ao buscar alocação: ${err.message || 'Erro desconhecido.'}`);
            } finally {
                setLoading(false);
            }
        };

        fetchLatestAllocation();
    }, [clientId, db]);

    const formatCurrency = (value: number | null | undefined) => {
        if (value === null || value === undefined) return '-';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return '-';
        try {
            return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
        } catch (e) { return dateString; }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
            {/* Gráfico de Pizza (ocupa 2 colunas) */}
            <div className="md:col-span-2 h-64 w-full"> {/* Altura fixa */} 
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
                {!loading && !error && pieData.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                // label={renderCustomizedLabel} // Labels podem poluir, usar Tooltip/Legend
                                outerRadius={80} // Ajuste tamanho
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip 
                                formatter={(value: number) => [formatCurrency(value), "Valor"]}
                                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px', fontSize: '12px', padding: '4px 8px' }}
                            />
                            <Legend 
                                layout="vertical" 
                                align="right" 
                                verticalAlign="middle" 
                                iconSize={10}
                                wrapperStyle={{ fontSize: '12px', lineHeight: '1.5' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                )}
                 {!loading && !error && pieData.length === 0 && (
                    <div className="flex justify-center items-center h-full text-gray-500 text-sm">
                        Nenhuma alocação encontrada.
                    </div>
                )}
            </div>

            {/* Informações Resumidas (ocupa 1 coluna) */}
            <div className="md:col-span-1 space-y-3 text-center md:text-left">
                <div>
                    <p className="text-sm text-gray-400 mb-1">Patrimônio Total (Última)</p>
                    <p className="text-xl font-semibold text-white">
                        {loading ? '...' : formatCurrency(allocationData?.totalValue)}
                    </p>
                </div>
                <div>
                    <p className="text-sm text-gray-400 mb-1">Data de Referência</p>
                    <p className="text-xl font-semibold text-white">
                         {loading ? '...' : formatDate(allocationData?.date)}
                    </p>
                </div>
                <div>
                     <Link 
                        href={`/dashboard/clients/${clientId}/allocation`}
                        className="text-sm text-cyan-500 hover:text-cyan-400 hover:underline"
                    >
                        Ver Detalhes e Histórico &rarr;
                     </Link>
                </div>
            </div>
        </div>
    );
} 