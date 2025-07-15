'use client'

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, getFirestore, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import app from '@/config/firebase';

interface Investment {
  name: string;
  value: number;
}

interface Asset {
  type: string;
  investments: Investment[];
}

interface AllocationRecord {
  id: string;
  clientId: string;
  assets: Asset[];
  totalValue: number;
  date: string;
  lastUpdate: string;
}

function AllocationContent({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<{ name: string } | null>(null);
  const [allocations, setAllocations] = useState<AllocationRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const db = getFirestore(app);

  const searchParams = useSearchParams();
  const dateFromUrl = searchParams?.get('date');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const clientDoc = await getDoc(doc(db, 'clients', params.id));
        if (!clientDoc.exists()) {
          setError("Cliente não encontrado.");
          setLoading(false);
          return;
        }
        setClient({ name: clientDoc.data().name });

        const allocationsRef = collection(db, 'allocations');
        const q = query(
          allocationsRef,
          where('clientId', '==', params.id),
          orderBy('date', 'desc')
        );
        const querySnapshot = await getDocs(q);
        
        const records = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as AllocationRecord[];
        
        setAllocations(records);

        if (dateFromUrl && records.some(r => r.date === dateFromUrl)) {
            setSelectedDate(dateFromUrl);
        } else if (records.length > 0) {
            setSelectedDate(records[0].date);
        }
      } catch (error: any) {
        console.error('Error fetching data:', error);
        setError(`Erro ao buscar dados: ${error.message || 'Erro desconhecido.'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, db, dateFromUrl]);

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
    } catch (e) {
       return dateString;
    }
  };

  const selectedAllocation = selectedDate
    ? allocations.find(a => a.date === selectedDate)
    : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
      return (
        <div className="w-[95%] mx-auto">
           <div className="flex justify-end mb-6">
             <button
               onClick={() => router.back()}
               className="text-gray-300 hover:text-white"
             >
               Voltar
             </button>
           </div>
           <div className="bg-red-900 text-red-100 p-4 rounded-lg text-center">
              <p>{error}</p>
              <p className="mt-2 text-sm">Por favor, tente recarregar a página ou contate o suporte.</p>
           </div>
        </div>
      );
  }

  return (
    <div className="w-[95%] mx-auto pb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Alocação</h1>
          <p className="text-gray-400">Cliente: {client?.name || 'Não encontrado'}</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/dashboard/clients/${params.id}/transactions`)}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
          >
             Movimentações
           </button>
          <button
            onClick={() => router.push(`/dashboard/clients/${params.id}/allocation/edit${selectedDate ? `?date=${selectedDate}` : ''}`)}
            className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors"
          >
            {allocations.length === 0 ? 'Adicionar Primeira' : 'Nova Alocação'}
          </button>
          <button
            onClick={() => router.back()}
            className="text-gray-300 hover:text-white"
          >
            Voltar
          </button>
        </div>
      </div>

      {allocations.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-6 text-center border border-gray-700">
          <p className="text-gray-400">Nenhuma alocação registrada para este cliente.</p>
          <button
            onClick={() => router.push(`/dashboard/clients/${params.id}/allocation/edit`)}
            className="mt-4 px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors"
          >
            Adicionar Primeira Alocação
          </button>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <label htmlFor="allocationDateSelect" className="block text-sm font-medium text-gray-300 mb-2">
              Selecione a Data de Referência
            </label>
            <select
              id="allocationDateSelect"
              value={selectedDate || ''}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full md:w-auto px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {allocations.map((allocation) => (
                <option key={allocation.date} value={allocation.date}>
                  {formatDate(allocation.date)}
                </option>
              ))}
            </select>
          </div>

          {selectedAllocation ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                 <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="text-gray-400 mb-2">Patrimônio Total</div>
                  <div className="text-2xl font-bold text-white">
                    {formatCurrency(selectedAllocation.totalValue)}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="text-gray-400 mb-2">Data de Referência</div>
                  <div className="text-2xl font-bold text-white">
                    {formatDate(selectedAllocation.date)}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                  <div className="text-gray-400 mb-2">Última Atualização</div>
                  <div className="text-2xl font-bold text-white">
                    {selectedAllocation.lastUpdate 
                       ? new Date(selectedAllocation.lastUpdate).toLocaleString('pt-BR')
                       : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="text-left bg-gray-700/50">
                        <th className="px-6 py-3 text-gray-300 font-medium">Tipo</th>
                        <th className="px-6 py-3 text-gray-300 font-medium">Investimento</th>
                        <th className="px-6 py-3 text-gray-300 font-medium text-right">Valor</th>
                        <th className="px-6 py-3 text-gray-300 font-medium text-right">% Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAllocation.assets.filter(asset => asset.investments.length > 0 && asset.investments.some(inv => inv.value > 0)).map((asset, assetIndex) => {
                        const assetTotalValue = asset.investments.reduce((sum, inv) => sum + (inv.value || 0), 0);
                        return (
                          <>
                            {asset.investments.filter(inv => inv.value > 0).map((investment, investmentIndex) => (
                              <tr
                                key={`${asset.type}-${investmentIndex}`}
                                className="border-b border-gray-700 hover:bg-gray-700/50 last:border-b-0"
                              >
                                {investmentIndex === 0 && (
                                  <td
                                    className="px-6 py-4 text-white font-medium align-top"
                                    rowSpan={asset.investments.filter(inv => inv.value > 0).length}
                                  >
                                    {asset.type}
                                  </td>
                                )}
                                <td className="px-6 py-4 text-white">
                                  {investment.name || <span className="text-gray-500">Não informado</span>}
                                </td>
                                <td className="px-6 py-4 text-white text-right">{formatCurrency(investment.value)}</td>
                                <td className="px-6 py-4 text-white text-right">
                                  {selectedAllocation.totalValue > 0 
                                    ? ((investment.value / selectedAllocation.totalValue) * 100).toFixed(2) + '%' 
                                    : '0.00%'}
                                </td>
                              </tr>
                            ))}
                             {/* Subtotal row for each asset type - Only if more than one investment or value > 0 */}
                            {assetTotalValue > 0 && (
                              <tr className="bg-gray-700/30">
                                <td className="px-6 py-3 text-gray-300 font-medium" colSpan={2}>
                                  Total {asset.type}
                                </td>
                                <td className="px-6 py-3 text-gray-300 font-medium text-right">
                                  {formatCurrency(assetTotalValue)}
                                </td>
                                <td className="px-6 py-3 text-gray-300 font-medium text-right">
                                  {selectedAllocation.totalValue > 0
                                    ? ((assetTotalValue / selectedAllocation.totalValue) * 100).toFixed(2) + '%'
                                    : '0.00%'} 
                                </td>
                              </tr>
                            )}
                          </>
                        )
                       }
                      )}
                    </tbody>
                     {/* Footer com total geral */} 
                    <tfoot>
                       <tr className="bg-gray-900">
                           <td className="px-6 py-4 text-white font-bold" colSpan={2}>TOTAL GERAL</td>
                           <td className="px-6 py-4 text-white font-bold text-right">{formatCurrency(selectedAllocation.totalValue)}</td>
                           <td className="px-6 py-4 text-white font-bold text-right">100.00%</td>
                       </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => router.push(`/dashboard/clients/${params.id}/allocation/edit?date=${selectedAllocation.date}`)}
                  className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors"
                >
                  Editar Alocação Desta Data
                </button>
              </div>
            </>
           ) : (
             <div className="bg-gray-800 rounded-lg p-6 text-center border border-gray-700">
                 <p className="text-gray-400">Não foi possível carregar os detalhes para a data selecionada.</p>
             </div>
           )}
        </>
      )}
    </div>
  );
}

export default function AllocationPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    }>
      <AllocationContent params={params} />
    </Suspense>
  );
} 