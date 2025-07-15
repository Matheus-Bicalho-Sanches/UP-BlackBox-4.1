'use client'

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, getDoc, updateDoc, getFirestore, collection, addDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import app from '@/config/firebase';
import { formatCurrency } from '@/lib/utils';

interface Investment {
  name: string;
  value: number;
}

interface Asset {
  type: string;
  investments: Investment[];
}

interface AllocationRecord {
  id?: string;
  clientId: string;
  assets: Asset[];
  totalValue: number;
  date: string;
  lastUpdate: string;
}

interface Feedback {
  type: 'success' | 'error';
  message: string;
}

// Definição da estrutura padrão de ativos
const DEFAULT_ASSET_STRUCTURE: Asset[] = [
  { type: 'Caixa', investments: [{ name: '', value: 0 }] },
  { type: 'Renda Fixa Pós-fixada', investments: [{ name: '', value: 0 }] },
  { type: 'Renda Fixa Indexada', investments: [{ name: '', value: 0 }] },
  { type: 'Renda Fixa Prefixada', investments: [{ name: '', value: 0 }] },
  { type: 'Multimercado', investments: [{ name: '', value: 0 }] },
  { type: 'Renda Variável', investments: [{ name: '', value: 0 }] },
  { type: 'Fundos Imobiliários', investments: [{ name: '', value: 0 }] },
  { type: 'Internacional', investments: [{ name: '', value: 0 }] },
  { type: 'Previdência', investments: [{ name: '', value: 0 }] },
  { type: 'Alternativos', investments: [{ name: '', value: 0 }] },
];

function AllocationEditContent({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams?.get('date');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [client, setClient] = useState<{ name: string } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    dateFromUrl || new Date().toISOString().split('T')[0]
  );
  const [initialLoadDate, setInitialLoadDate] = useState<string | null>(null);

  // Inicializar o estado com a estrutura padrão
  const [assets, setAssets] = useState<Asset[]>(DEFAULT_ASSET_STRUCTURE);
  const [existingRecord, setExistingRecord] = useState<AllocationRecord | null>(null);

  const db = getFirestore(app);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const dateToLoad = dateFromUrl || new Date().toISOString().split('T')[0];
      setInitialLoadDate(dateToLoad);
      setExistingRecord(null);
      // Resetar para a estrutura padrão antes de buscar os dados
      setAssets(DEFAULT_ASSET_STRUCTURE);
      setFeedback(null);

      try {
        if (!client) {
          const clientDoc = await getDoc(doc(db, 'clients', params.id));
          if (!clientDoc.exists()) {
            router.push('/dashboard/clients');
            return;
          }
          setClient({ name: clientDoc.data().name });
        }

        const allocationsRef = collection(db, 'allocations');
        const q = query(
          allocationsRef,
          where('clientId', '==', params.id),
          where('date', '==', dateToLoad)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const record = {
            id: querySnapshot.docs[0].id,
            ...querySnapshot.docs[0].data()
          } as AllocationRecord;
          setExistingRecord(record);

          // Mapear os assets existentes para fácil acesso
          const existingAssetsMap = new Map(record.assets.map(asset => [asset.type, asset]));

          // Mesclar os dados existentes com a estrutura padrão
          const mergedAssets = DEFAULT_ASSET_STRUCTURE.map(defaultAsset => {
            const existingAsset = existingAssetsMap.get(defaultAsset.type);
            // Se o asset existe no registro E tem investimentos, usa ele.
            // Senão, usa a estrutura padrão (garantindo que a classe apareça).
            // Adiciona um investimento vazio se não houver nenhum, para ter pelo menos um campo de input.
            if (existingAsset && existingAsset.investments.length > 0) {
              return existingAsset;
            } else if (existingAsset) { // Existe mas está vazio
              return { ...existingAsset, investments: [{ name: '', value: 0 }] };
            } else { // Não existe no registro
              return defaultAsset; // Já tem { name: '', value: 0 }
            }
          });

          setAssets(mergedAssets);
        } else {
          // Se não encontrou registro para a data, já resetamos para DEFAULT_ASSET_STRUCTURE no início do fetchData
          // Nenhuma ação extra necessária aqui para os assets
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setFeedback({ type: 'error', message: 'Erro ao buscar dados da alocação inicial.' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, dateFromUrl, db, router, client]);

  const handleInvestmentChange = (
    assetIndex: number,
    investmentIndex: number,
    field: keyof Investment,
    value: string | number
  ) => {
    const newAssets = [...assets];
    let internalValue: number | string;

    if (field === 'value') {
      const digits = (value as string).replace(/\D/g, '');
      const numericValue = digits ? parseInt(digits, 10) / 100 : 0;
      internalValue = isNaN(numericValue) || numericValue < 0 ? 0 : numericValue;
    } else {
      internalValue = value as string;
    }

    newAssets[assetIndex].investments[investmentIndex] = {
      ...newAssets[assetIndex].investments[investmentIndex],
      [field]: internalValue
    };

    setAssets(newAssets);
    setFeedback(null);
  };

  const addInvestment = (assetIndex: number) => {
    const newAssets = [...assets];
    newAssets[assetIndex].investments.push({ name: '', value: 0 });
    setAssets(newAssets);
  };

  const removeInvestment = (assetIndex: number, investmentIndex: number) => {
    const newAssets = [...assets];
    if (newAssets[assetIndex].investments.length > 1) {
      newAssets[assetIndex].investments.splice(investmentIndex, 1);
      setAssets(newAssets);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const totalValue = assets.reduce((sum, asset) =>
        sum + asset.investments.reduce((assetSum, inv) => assetSum + inv.value, 0), 0
      );

      if (isNaN(totalValue)) {
        throw new Error("Valor total inválido detectado.");
      }
      assets.forEach(asset => {
        asset.investments = asset.investments.filter(inv => inv.name.trim() !== '' || inv.value !== 0);
        asset.investments.forEach(inv => {
          if (isNaN(inv.value)) {
             throw new Error(`Valor inválido para o investimento "${inv.name || 'sem nome'}" no tipo "${asset.type}".`);
          }
          if (inv.value < 0) {
             throw new Error(`Valor negativo não permitido para o investimento "${inv.name || 'sem nome'}".`);
          }
        });
      });
       const finalAssets = assets.filter(asset => asset.investments.length > 0);

      const allocationData: Omit<AllocationRecord, 'id'> = {
        clientId: params.id,
        assets: finalAssets,
        totalValue,
        date: selectedDate,
        lastUpdate: new Date().toISOString()
      };

      if (existingRecord?.id && selectedDate === existingRecord.date) {
        await updateDoc(doc(db, 'allocations', existingRecord.id), allocationData);
        setFeedback({ type: 'success', message: 'Alocação atualizada com sucesso!' });
      } else {
        const allocationsRef = collection(db, 'allocations');
        const q = query(
          allocationsRef,
          where('clientId', '==', params.id),
          where('date', '==', selectedDate)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const docToUpdateId = querySnapshot.docs[0].id;
          await updateDoc(doc(db, 'allocations', docToUpdateId), allocationData);
          setFeedback({ type: 'success', message: `Alocação para ${selectedDate} (já existente) atualizada com sucesso!` });
        } else {
          const newDocRef = await addDoc(collection(db, 'allocations'), allocationData);
          setFeedback({ type: 'success', message: `Nova alocação para ${selectedDate} criada com sucesso!` });
          setExistingRecord({ ...allocationData, id: newDocRef.id });
          setInitialLoadDate(selectedDate);
        }
      }

      setTimeout(() => {
        router.push(`/dashboard/clients/${params.id}/allocation?date=${selectedDate}`);
      }, 1500);

    } catch (error: any) {
      console.error('Error saving allocation:', error);
      setFeedback({ type: 'error', message: `Erro ao salvar alocação: ${error.message || 'Erro desconhecido.'}` });
    } finally {
      setSaving(false);
    }
  };

  const deleteAllocation = async () => {
    if (!existingRecord?.id) return;

    if (!confirm(`Tem certeza que deseja excluir a alocação de ${existingRecord.date}?`)) {
        return;
    }

    setSaving(true);
    setFeedback(null);
    try {
      await deleteDoc(doc(db, 'allocations', existingRecord.id));
      setFeedback({ type: 'success', message: 'Alocação excluída com sucesso!' });
       setTimeout(() => {
          router.push(`/dashboard/clients/${params.id}/allocation`);
       }, 1500);
    } catch (error) {
      console.error('Error deleting allocation:', error);
       setFeedback({ type: 'error', message: 'Erro ao excluir alocação.' });
       setSaving(false);
    }
  };

  const displayTotalValue = useMemo(() => {
     const total = assets.reduce((sum, asset) =>
       sum + asset.investments.reduce((assetSum, inv) => assetSum + inv.value, 0), 0
     );
     return formatCurrency(total);
   }, [assets]);

  return (
    <div className="w-[95%] mx-auto pb-12">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {initialLoadDate && existingRecord && existingRecord.date === initialLoadDate
              ? `Editar Alocação (${initialLoadDate})`
              : `Nova Alocação`
            }
          </h1>
          <p className="text-gray-400">Cliente: {client?.name || 'Carregando...'}</p>
        </div>
         <button
             onClick={() => router.push(`/dashboard/clients/${params.id}/allocation`)}
             className="text-gray-300 hover:text-white"
             disabled={saving}
         >
             Voltar para Alocações
         </button>
      </div>

       {feedback && (
         <div className={`p-4 mb-4 rounded ${feedback.type === 'success' ? 'bg-green-900 text-green-100' : 'bg-red-900 text-red-100'}`}>
           {feedback.message}
         </div>
       )}

      <div className="bg-gray-800 rounded-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className='flex-grow'>
                  <label htmlFor="allocationDate" className="block text-sm font-medium text-gray-300 mb-1">
                  Data de Referência
                  </label>
                  <input
                  id="allocationDate"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setFeedback(null);
                      if(existingRecord && e.target.value !== existingRecord.date) {
                          // setExistingRecord(null);
                      }
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-70"
                  required
                  disabled={saving || loading}
                  />
              </div>
               <div className="text-right sm:text-left">
                  <span className="text-sm font-medium text-gray-300">Valor Total: </span>
                  <span className="text-lg font-semibold text-white">{displayTotalValue}</span>
              </div>
          </div>

          {loading ? (
             <div className="flex justify-center items-center py-10">
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
             </div>
           ) : (
            <div className="space-y-8">
              {assets.map((asset, assetIndex) => (
                <div key={asset.type} className="space-y-4 border-t border-gray-700 pt-6 first:border-t-0 first:pt-0">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-white">{asset.type}</h3>
                    <button
                      type="button"
                      onClick={() => addInvestment(assetIndex)}
                      className="text-sm text-cyan-500 hover:text-cyan-400 disabled:opacity-50"
                      disabled={saving}
                    >
                      + Adicionar Investimento
                    </button>
                  </div>

                  {asset.investments.map((investment, investmentIndex) => (
                    <div key={investmentIndex} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end border-b border-gray-700 pb-4 last:border-b-0 last:pb-0">
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-300 mb-1">
                          Nome do Investimento {investmentIndex + 1}
                        </label>
                        <input
                          type="text"
                          placeholder="Ex: CDB Banco X, Ação Y"
                          value={investment.name}
                          onChange={(e) => handleInvestmentChange(assetIndex, investmentIndex, 'name', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-70"
                          disabled={saving}
                        />
                      </div>
                      <div className="md:col-span-1">
                         <label className="block text-sm font-medium text-gray-300 mb-1">
                           Valor (R$)
                         </label>
                         <input
                           type="text"
                           inputMode="decimal"
                           placeholder="0,00"
                           value={investment.value === 0 ? '' : investment.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                           onChange={(e) => handleInvestmentChange(assetIndex, investmentIndex, 'value', e.target.value)}
                           className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-70 text-right"
                           disabled={saving}
                         />
                      </div>
                      <div className="md:col-span-1 flex justify-end">
                        {asset.investments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeInvestment(assetIndex, investmentIndex)}
                            className="px-3 py-2 text-red-500 hover:text-red-400 disabled:opacity-50"
                            disabled={saving}
                            title="Remover Investimento"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
           )}

          <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-gray-700 mt-6 space-y-4 sm:space-y-0">
             {existingRecord?.id && selectedDate === existingRecord.date && (
                 <button
                     type="button"
                     onClick={deleteAllocation}
                     className="w-full sm:w-auto px-4 py-2 text-red-500 hover:text-red-400 hover:bg-red-900/30 rounded border border-red-500/50 disabled:opacity-50"
                     disabled={saving || loading}
                 >
                     Excluir Alocação de {existingRecord.date}
                 </button>
             )}
             <div className="flex w-full sm:w-auto justify-end space-x-3">
                 <button
                     type="button"
                     onClick={() => router.back()}
                     className="px-4 py-2 text-gray-300 hover:text-white disabled:opacity-50"
                     disabled={saving}
                 >
                     Cancelar
                 </button>
                 <button
                     type="submit"
                     className="px-6 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:opacity-50"
                     disabled={saving || loading}
                 >
                     {saving ? 'Salvando...' : 'Salvar Alocação'}
                 </button>
             </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AllocationEditPage({ params }: { params: { id: string } }) {
    return <AllocationEditContent params={params} />;
} 