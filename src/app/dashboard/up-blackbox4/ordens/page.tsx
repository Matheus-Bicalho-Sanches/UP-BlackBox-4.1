"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "@/config/firebase";
import { collection, query, where, getDocs, orderBy, limit as limitFn, onSnapshot } from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { FiChevronDown, FiChevronRight, FiEdit2, FiTrash2, FiRefreshCcw } from 'react-icons/fi';
import React from "react";
import AccountSelector from "@/components/AccountSelector";

/**
 * Função helper para calcular quantidades - mesma lógica do backend Python
 * Garante consistência entre frontend e backend
 */
function calcularQuantidade(quantity: number, valorInvestido: number): number {
  const fator = valorInvestido / 10000;
  // Usar exatamente a mesma lógica do Python: max(1, int(math.floor(quantity * fator)))
  return Math.max(1, Math.floor(quantity * fator));
}

// ===== Tipagens para os modais =====
interface EditBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: any) => Promise<void> | void;
  batchOrders?: any[];
  valorInvestidoMap: Record<string, number>;
  defaultPrice?: number | string;
  defaultBaseQty?: number | string;
  strategyId?: string;
  strategyName?: string;
  isIceberg?: boolean;
  defaultLote?: number | string;
}

interface DeleteBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  batchOrders?: any[];
}

function EditOrderModal({ isOpen, onClose, onSave, order }: any) {
  const [price, setPrice] = useState(order?.price ?? '');
  const [quantity, setQuantity] = useState(order?.quantity ?? '');
  useEffect(() => {
    setPrice(order?.price ?? '');
    setQuantity(order?.quantity ?? '');
  }, [order]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#222] rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-white mb-4">Editar Ordem</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-1">Preço</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-2 rounded bg-[#181818] text-white border border-gray-600" />
          </div>
          <div>
            <label className="block text-gray-300 mb-1">Quantidade</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full p-2 rounded bg-[#181818] text-white border border-gray-600" />
          </div>
        </div>
        <div className="flex gap-4 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-600 text-white">Cancelar</button>
          <button onClick={() => onSave({ price, quantity })} className="px-4 py-2 rounded bg-blue-600 text-white">Salvar</button>
        </div>
      </div>
    </div>
  );
}

// Modal de edição em lote
function EditBatchModal({ isOpen, onClose, onSave, batchOrders, valorInvestidoMap, defaultPrice, defaultBaseQty, strategyId, strategyName, isIceberg, defaultLote }: EditBatchModalProps) {
  const [price, setPrice] = useState(defaultPrice ?? '');
  const [baseQty, setBaseQty] = useState(defaultBaseQty ?? '');
  const [lote, setLote] = useState(defaultLote ?? '');
  const [loading, setLoading] = useState(false);
  const [valoresAtualizados, setValoresAtualizados] = useState<Record<string, number>>({});
  const [carregandoValores, setCarregandoValores] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);

  // Função para buscar valores atualizados do backend
  // CORREÇÃO BUG #4: Busca valores em tempo real para evitar inconsistências
  const buscarValoresAtualizados = async () => {
    if (!batchOrders || batchOrders.length === 0) return;
    
    setCarregandoValores(true);
    try {
      let valoresMap: Record<string, number> = {};
      
      // Detectar se as ordens pertencem a uma estratégia específica
      const strategyIds = [...new Set(batchOrders.map(o => o.strategy_id).filter(Boolean))];
      const useStrategyAllocations = strategyIds.length === 1 && strategyIds[0];
      
      if (useStrategyAllocations) {
        // Usar alocações da estratégia específica
        const strategyId = strategyIds[0];
        const allocRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/allocations?strategy_id=${strategyId}`);
        if (allocRes.ok) {
          const allocData = await allocRes.json();
          for (const alloc of allocData.allocations || []) {
            valoresMap[alloc.account_id] = alloc.valor_investido || 0;
          }
        }
      } else {
        // Usar valores totais das contas (Master Global)
        const contasDllRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/contasDll`);
        if (contasDllRes.ok) {
          const contasDllData = await contasDllRes.json();
          for (const c of contasDllData.contas || []) {
            valoresMap[c.AccountID] = Number(c["Valor Investido"] || 0);
          }
        }
      }
      
      setValoresAtualizados(valoresMap);
      setUltimaAtualizacao(new Date());
    } catch (error) {
      console.error('Erro ao buscar valores atualizados:', error);
      // Fallback para valores originais
      setValoresAtualizados(valorInvestidoMap);
    } finally {
      setCarregandoValores(false);
    }
  };

  // Buscar valores atualizados quando modal abre ou quando baseQty muda
  useEffect(() => {
    if (isOpen && batchOrders) {
      buscarValoresAtualizados();
    }
  }, [isOpen, batchOrders, baseQty]);

  useEffect(() => {
    setPrice(defaultPrice ?? '');
    setBaseQty(defaultBaseQty ?? '');
    setLote(defaultLote ?? '');
    setLoading(false);
  }, [defaultPrice, defaultBaseQty, defaultLote, batchOrders]);

  if (!isOpen || !batchOrders) return null;

  // Usar valores atualizados se disponíveis, senão usar os originais
  const valoresParaCalculo = Object.keys(valoresAtualizados).length > 0 ? valoresAtualizados : valorInvestidoMap;
  
  // Calcular total investido
  const totalInvestido = batchOrders.reduce((sum, o) => sum + (valoresParaCalculo[o.account_id] || 0), 0);
  
  // Calcular quantidades proporcionais - mesma lógica do backend
  const preview = batchOrders.map(o => {
    const valor = valoresParaCalculo[o.account_id] || 0;
    const quantidade = calcularQuantidade(Number(baseQty), valor);
    return { ...o, quantidadePreview: quantidade, valorInvestido: valor };
  });
  // Consolidar linha da Conta Master
  const totalValorInvestido = preview.reduce((sum, o) => sum + o.valorInvestido, 0);
  const totalQuantidade = preview.reduce((sum, o) => sum + o.quantidadePreview, 0);
  const previewWithMaster = [
    { account_id: 'Conta Master', valorInvestido: totalValorInvestido, quantidadePreview: totalQuantidade, isMaster: true },
    ...preview
  ];

  // limitar a exibição a Master + 5 primeiras contas
  const MAX_ROWS = 6;
  const rowsToShow = previewWithMaster.slice(0, MAX_ROWS);
  const hiddenCount = previewWithMaster.length - rowsToShow.length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#222] rounded-lg p-6 w-full max-w-lg">
        <h3 className="text-xl font-bold text-white mb-4">Editar Lote de Ordens</h3>
        {strategyId && strategyName && (
          <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded">
            <p className="text-blue-300 text-sm">
              <strong>Estratégia:</strong> {strategyName}
            </p>
            <p className="text-blue-300 text-sm">
              <strong>ID:</strong> {strategyId}
            </p>
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-1">Novo Preço</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-2 rounded bg-[#181818] text-white border border-gray-600" />
          </div>
          <div>
            <label className="block text-gray-300 mb-1">Nova Quantidade Base</label>
            <input type="number" value={baseQty} onChange={e => setBaseQty(e.target.value)} className="w-full p-2 rounded bg-[#181818] text-white border border-gray-600" />
          </div>
          {isIceberg && (
            <div>
              <label className="block text-gray-300 mb-1">Novo Tamanho do Lote (Iceberg)</label>
              <input 
                type="number" 
                value={lote} 
                onChange={e => setLote(e.target.value)} 
                className="w-full p-2 rounded bg-[#181818] text-white border border-gray-600" 
                placeholder="Tamanho do lote para próximas ordens"
              />
              <p className="text-xs text-gray-400 mt-1">
                Este valor será usado para os próximos lotes da iceberg em andamento
              </p>
            </div>
          )}
          <div className="mt-4">
            <div className="flex items-center justify-between text-gray-300 mb-2">
              <span>Prévia das quantidades proporcionais:</span>
              <div className="flex items-center gap-2">
                {carregandoValores && (
                  <div className="flex items-center text-blue-400 text-xs">
                    <svg className="animate-spin mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                    </svg>
                    Atualizando...
                  </div>
                )}
                <button
                  type="button"
                  onClick={buscarValoresAtualizados}
                  disabled={carregandoValores}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  🔄 Atualizar
                </button>
                {ultimaAtualizacao && (
                  <div className="text-xs text-green-400">
                    ✓ {ultimaAtualizacao.toLocaleTimeString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
            <table className="w-full text-sm text-white">
              <thead>
                <tr>
                  <th className="text-left">Conta</th>
                  <th className="text-right">Valor Investido</th>
                  <th className="text-right">Qtd Proporcional</th>
                </tr>
              </thead>
              <tbody>
                {rowsToShow.map((o, idx) => (
                  <tr key={o.account_id} style={o.isMaster ? { background: '#333', fontWeight: 700 } : {}}>
                    <td>{o.account_id}</td>
                    <td className="text-right">R$ {o.valorInvestido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="text-right">{o.quantidadePreview}</td>
                  </tr>
                ))}
                {hiddenCount > 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: '#aaa' }}>... e mais {hiddenCount} contas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex gap-4 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-600 text-white" disabled={loading}>Cancelar</button>
          <button
            onClick={async () => {
              setLoading(true);
              await onSave({ price, baseQty, lote, preview: previewWithMaster });
              setLoading(false);
            }}
            className="px-4 py-2 rounded bg-blue-600 text-white flex items-center justify-center min-w-[120px]"
            disabled={loading}
          >
            {loading ? (
              <svg className="animate-spin mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
            ) : null}
            {loading ? 'Salvando...' : 'Salvar Lote'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de exclusão em lote
function DeleteBatchModal({ isOpen, onClose, onConfirm, batchOrders }: DeleteBatchModalProps) {
  if (!isOpen || !batchOrders) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#222] rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-white mb-4">Excluir Lote de Ordens</h3>
        <p className="text-white mb-6">Tem certeza que deseja excluir <b>{batchOrders.length}</b> ordens deste lote?</p>
        <div className="flex gap-4">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-600 text-white">Cancelar</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 text-white">Excluir Lote</button>
        </div>
      </div>
    </div>
  );
}

// Helpers
function copyToClipboard(text: string) {
  if (navigator?.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      alert(`Batch copiado: ${text}`);
    }).catch(() => {
      alert('Falha ao copiar para área de transferência');
    });
  } else {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert(`Batch copiado: ${text}`);
  }
}

export default function OrdensPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("MASTER");
  const [selectedBroker, setSelectedBroker] = useState(0);
  const [orders, setOrders] = useState<any[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [marketTicker, setMarketTicker] = useState("");
  const [marketQuantity, setMarketQuantity] = useState("");
  const [marketSide, setMarketSide] = useState("buy");
  const [marketExchange, setMarketExchange] = useState("");
  const [marketLog, setMarketLog] = useState("");
  const [marketLoading, setMarketLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [orderToEdit, setOrderToEdit] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean, order: any } | null>(null);
  const [expandedBatches, setExpandedBatches] = useState<{ [batchId: string]: boolean }>({});
  const [editBatch, setEditBatch] = useState<{ batchId: string, orders: any[], strategyId?: string, strategyName?: string, isIceberg?: boolean, defaultLote?: number | string } | null>(null);
  const [deleteBatch, setDeleteBatch] = useState<{ batchId: string, orders: any[] } | null>(null);
  const [valorInvestidoMap, setValorInvestidoMap] = useState<Record<string, number>>({});
  const [currentStrategyId, setCurrentStrategyId] = useState<string | null>(null);
  // Listener atual do Firestore
  const listenerRef = useRef<Unsubscribe | null>(null);
  // --- filtros: período, ativo e status ---
  // Usamos string (AAAA-MM-DD) para evitar problemas de fuso ao serializar Date
  // definir período padrão: hoje somente
  const [startDate, setStartDate] = useState<string>(()=>{
    return new Date().toISOString().slice(0,10);
  });
  const [endDate, setEndDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [filterTicker, setFilterTicker] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/accounts`);
        const data = await res.json();
        if (res.ok && data.accounts && data.accounts.length > 0) {
          let fetchedAccounts = data.accounts;
          // Buscar nomes dos clientes no contasDll
          try {
            const contasDllRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/contasDll`);
            if (contasDllRes.ok) {
              const contasDllData = await contasDllRes.json();
              const contasDll: any[] = contasDllData.contas || [];
              const nomeMap: Record<string,string> = {};
              for(const c of contasDll){
                nomeMap[c.AccountID] = c["Nome Cliente"] || "Sem_nome";
              }
              fetchedAccounts = fetchedAccounts.map((acc:any)=>({
                ...acc,
                nomeCliente: nomeMap[acc.AccountID] || "Sem_nome"
              }));
            }
          } catch {}

          // Ordenar alfabeticamente pelo nome
          fetchedAccounts.sort((a:any,b:any)=>{
            const nA = (a.nomeCliente||"").toUpperCase();
            const nB = (b.nomeCliente||"").toUpperCase();
            return nA.localeCompare(nB,'pt-BR');
          });

          setAccounts(fetchedAccounts);
          setSelectedAccount(prev => prev || "MASTER");
          setSelectedBroker(fetchedAccounts[0].BrokerID);
        }
      } catch (err) {}
    }
    fetchAccounts();

    async function fetchStrategies() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/strategies`);
        if (res.ok) {
          const data = await res.json();
          setStrategies(data.strategies || []);
        }
      } catch {}
    }
    fetchStrategies();
  }, []);

  // Função para detectar estratégia das ordens
  const detectStrategyFromOrders = (orders: any[]) => {
    // Verificar se todas as ordens têm o mesmo strategy_id
    const strategyIds = [...new Set(orders.map(o => o.strategy_id).filter(Boolean))];
    return strategyIds.length === 1 ? strategyIds[0] : null;
  };

  // Função para detectar se uma ordem é iceberg
  const detectIcebergFromOrders = (orders: any[]) => {
    return orders.some(o => o.master_batch_id) ? orders[0]?.master_batch_id : null;
  };

  // Função para buscar informações da iceberg
  const fetchIcebergInfo = async (icebergId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/iceberg_info/${icebergId}`);
      const data = await response.json();
      return data.success ? data.iceberg : null;
    } catch (error) {
      console.error('Erro ao buscar informações da iceberg:', error);
      return null;
    }
  };

  useEffect(() => {
    async function fetchValores() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/contasDll`);
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, number> = {};
          for (const c of data.contas || []) {
            map[c.AccountID] = Number(c["Valor Investido"] || 0);
          }
          setValorInvestidoMap(map);
          setCurrentStrategyId(null);
        }
      } catch {}
    }
    fetchValores();
  }, []);

  async function fetchValoresForStrategy(strategyId?: string) {
    try {
      if (strategyId) {
        // Buscar alocações da estratégia específica
        const allocRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/allocations?strategy_id=${strategyId}`);
        if (allocRes.ok) {
          const allocData = await allocRes.json();
          const valorMap: Record<string, number> = {};
          for (const alloc of allocData.allocations || []) {
            valorMap[alloc.account_id] = alloc.valor_investido || 0;
          }
          setValorInvestidoMap(valorMap);
          setCurrentStrategyId(strategyId);
          return;
        }
      }
      
      // Fallback: buscar de contasDll (Master Global)
      const contasDllRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/contasDll`);
      if (contasDllRes.ok) {
        const contasDllData = await contasDllRes.json();
        const contasDll: any[] = contasDllData.contas || [];
        const valorMap: Record<string, number> = {};
        for (const c of contasDll) {
          valorMap[c.AccountID] = c["Valor Investido"] || 0;
        }
        setValorInvestidoMap(valorMap);
        setCurrentStrategyId(null);
      }
    } catch {}
  }

  function handleAccountChange(e: { target: { value: string } }) {
    setSelectedAccount(e.target.value);
  }

  const parseDateString = (s:string)=>{
    if(!s) return null;
    if(s.includes('T')) return new Date(s); // ISO
    // Expect format dd/mm/yyyy hh:mm:ss(.ms)
    const [datePart,timePart] = s.split(' ');
    if(!datePart||!timePart) return null;
    const [d,m,y] = datePart.split('/').map(Number);
    if(!d||!m||!y) return null;
    const [h,min,secMs] = timePart.split(':');
    const secParts = secMs.split('.');
    const sec = Number(secParts[0]);
    const ms = secParts[1]? Number(secParts[1]):0;
    return new Date(y, m-1, d, Number(h), Number(min), sec, ms);
  };

  const parseDate = (o:any)=>{
    if(o.LastUpdate?.toDate) return o.LastUpdate.toDate();
    if(o.LastUpdate) return parseDateString(o.LastUpdate);
    if(o.createdAt) return parseDateString(o.createdAt);
    return null;
  };

  // Aplica filtros escolhidos pelo usuário
  const applyFilters = (arr: any[]) => {
    let filtered = arr;
    if (filterTicker) {
      filtered = filtered.filter((o: any) => ((o.ticker || "").toUpperCase()) === filterTicker.toUpperCase());
    }
    if (filterStatus) {
      filtered = filtered.filter((o: any) => (o.Status || "") === filterStatus);
    }
    if (startDate) {
      const start = new Date(startDate + 'T00:00:00');
      filtered = filtered.filter((o: any) => {
        const d = parseDate(o);
        return d && d >= start;
      });
    }
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59');
      filtered = filtered.filter((o: any) => {
        const d = parseDate(o);
        return d && d <= end;
      });
    }
    return filtered;
  };

  // Monta a query conforme filtro atual (MASTER, estratégia, conta)
  const buildOrdersQuery = () => {
    const base = collection(db, "ordensDLL");
    // Estratégia explicitamente selecionada via prefixo
    if (typeof selectedAccount === 'string' && selectedAccount.startsWith('strategy:')) {
      const sid = selectedAccount.replace('strategy:', '');
      return query(base, where('strategy_id', '==', sid), orderBy('createdAt', 'desc'), limitFn(500));
    }
    // MASTER
    if (selectedAccount === 'MASTER') {
      return query(base, orderBy('LastUpdate', 'desc'), limitFn(500));
    }
    // Conta individual
    return query(base, where('account_id', '==', selectedAccount), orderBy('LastUpdate', 'desc'), limitFn(500));
  };

  // Anexa listener em tempo real, com unsubscribe do anterior
  const attachOrdersListener = () => {
    // limpar listener anterior
    if (listenerRef.current) {
      listenerRef.current();
      listenerRef.current = null;
    }
    setIsLive(false);
    try {
      setLoading(true);
      const q = buildOrdersQuery();
      listenerRef.current = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(d => d.data());
        // Ordenar localmente por data decrescente (garante consistência caso datas variem entre campos)
        const sorted = [...docs].sort((a: any, b: any) => {
          const da = parseDate(a);
          const dbt = parseDate(b);
          if (!da || !dbt) return 0;
          return dbt.getTime() - da.getTime();
        });
        setRawOrders(sorted);
        const filtered = applyFilters(sorted);
        setOrders(filtered);
        setLog(`LIVE: ouvindo ${filtered.length} ordens`);
        setIsLive(true);
        setLoading(false);
      }, (err) => {
        console.error('onSnapshot error:', err);
        setLog('Erro no listener em tempo real: ' + (err.message || JSON.stringify(err)));
        setIsLive(false);
        setLoading(false);
      });
    } catch (err: any) {
      console.error('Falha ao anexar listener:', err);
      setLog('Falha ao anexar listener: ' + (err.message || JSON.stringify(err)));
      setIsLive(false);
      setLoading(false);
    }
  };

  // Função auxiliar para criar filtros de data para o Firestore
  const createDateFilters = () => {
    const filters = [];
    
    if (startDate) {
      const start = new Date(startDate + 'T00:00:00');
      filters.push(where('LastUpdate', '>=', start));
    }
    
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59');
      filters.push(where('LastUpdate', '<=', end));
    }
    
    return filters;
  };

  async function handleListOrders(max?: number) {
    setLoading(true);
    setLog("");
    setOrders([]);
    // Criar filtros de data para otimizar queries
    const dateFilters = createDateFilters();
    const limit = max || 10000; // Limite padrão para evitar queries muito custosas
    
    // If strategy selected, fetch by strategy_id field directly
    if (selectedAccount.startsWith('strategy:')) {
      const sid = selectedAccount.replace('strategy:', '');
      try {
        // Query otimizada com filtros de data
        const q = query(
          collection(db, 'ordensDLL'), 
          where('strategy_id', '==', sid), 
          ...dateFilters,
          orderBy('createdAt', 'desc'), 
          limitFn(limit)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d=>d.data());
        const filtered = applyFilters(list);
        setOrders(filtered);
        setLog(`Ordens da estratégia carregadas (${startDate} a ${endDate}). Total: ${filtered.length}`);
      } catch(err:any) {
        setLog('Erro ao buscar ordens da estratégia: '+ (err.message||JSON.stringify(err)));
      }
      setLoading(false);
      return;
    }
    try {
      let fetchedOrders: any[] = [];
      if (selectedAccount === 'MASTER') {
        // Query otimizada para MASTER com filtros de data
        const qMaster = query(
          collection(db, "ordensDLL"), 
          ...dateFilters,
          orderBy("LastUpdate", "desc"), 
          limitFn(limit)
        );
        const qs = await getDocs(qMaster);
        fetchedOrders = qs.docs.map(d=>d.data());
        
        // Ordenar por LastUpdate decrescente
        fetchedOrders.sort((a, b) => {
          const da=parseDate(a);
          const db=parseDate(b);
          if(!da||!db) return 0;
          return db.getTime()-da.getTime();
        });
        setLog(`Ordens consolidadas de todas as contas (${startDate} a ${endDate})! Total: ${fetchedOrders.length}`);
      } else if (selectedAccount.startsWith('strategy:')) {
        const strategyId = selectedAccount.replace('strategy:','');
        // buscar alocações
        const allocRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/allocations?strategy_id=${strategyId}`);
        const allocData = await allocRes.json();
        const accIds:string[] = (allocData.allocations||[]).map((a:any)=>a.account_id);
        if(accIds.length===0){ setLog('Nenhuma alocação para estratégia'); setLoading(false); return; }
        
        // Query otimizada para estratégia com filtros de data
        const q = query(
          collection(db,'ordensDLL'), 
          where('account_id','in', accIds),
          ...dateFilters,
          orderBy('LastUpdate', 'desc'),
          limitFn(limit)
        );
        const snap= await getDocs(q);
        fetchedOrders = snap.docs.map(d=>d.data());
        fetchedOrders.sort((a,b)=>{
          const da=parseDate(a); const dbt=parseDate(b); if(!da||!dbt) return 0; return dbt.getTime()-da.getTime();
        });
        setLog(`Ordens da estratégia carregadas (${startDate} a ${endDate}): ${fetchedOrders.length}`);
      } else {
        // Query otimizada para conta individual com filtros de data
        const q = query(
          collection(db, "ordensDLL"),
          where("account_id", "==", selectedAccount),
          ...dateFilters,
          orderBy("LastUpdate", "desc"),
          limitFn(limit)
        );
        const querySnapshot = await getDocs(q);
        fetchedOrders = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log("Ordem encontrada:", data);
          return data;
        });
        setLog(`Ordens carregadas do Firebase (${startDate} a ${endDate})! Total: ${fetchedOrders.length}`);
      }
      fetchedOrders.sort((a,b)=>{
        const da=parseDate(a);
        const db=parseDate(b);
        if(!da||!db) return 0;
        return db.getTime()-da.getTime();
      });
      
      // Aplicar filtros adicionais (ticker, status) no frontend
      // Os filtros de data já foram aplicados no Firestore para otimizar custos
      const filteredOrders = applyFilters(fetchedOrders);
      setOrders(filteredOrders);
    } catch (err: any) {
      console.error("Erro ao buscar ordens no Firebase:", err);
      setLog("Erro ao buscar ordens no Firebase: " + (err.message || JSON.stringify(err)));
    }
    setLoading(false);
  }

  // Listener em tempo real: conectar ao montar e a cada troca de filtro de conta/estratégia
  useEffect(() => {
    if (typeof selectedAccount === 'string' && selectedAccount.length > 0) {
      attachOrdersListener();
    }
    return () => {
      if (listenerRef.current) {
        listenerRef.current();
        listenerRef.current = null;
      }
      setIsLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount]);

  // Reaplicar filtros de UI quando mudarem, usando o snapshot mais recente
  useEffect(() => {
    setOrders(applyFilters(rawOrders));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, filterTicker, filterStatus]);

  async function handleEditOrder(values: any) {
    if (!orderToEdit) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/edit_order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: orderToEdit.account_id,
          broker_id: orderToEdit.broker_id,
          order_id: orderToEdit.OrderID,
          price: Number(values.price),
          quantity: Number(values.quantity),
          sub_account_id: orderToEdit.SubAccountID || "",
          password: "" // ajuste se necessário
        })
      });
      const data = await res.json();
      alert(data.log);
      setEditModalOpen(false);
      setOrderToEdit(null);
      // Listener manterá os dados atualizados; opcionalmente reatachar
      attachOrdersListener();
    } catch (err) {
      alert("Erro ao editar ordem.");
    }
  }

  async function handleDeleteOrder(order: any) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cancel_order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: order.account_id,
          broker_id: order.broker_id,
          order_id: Number(order.OrderID),
          sub_account_id: order.SubAccountID || "",
          password: "" // ajuste se necessário
        })
      });
      const data = await res.json();
      alert(data.log);
      setDeleteConfirm(null);
      // Listener manterá os dados atualizados; opcionalmente reatachar
      attachOrdersListener();
    } catch (err) {
      alert("Erro ao cancelar ordem.");
    }
  }

  // Função para calcular valores consolidados de um batch
  // Implementa consolidação de dados para linhas Master:
  // - Quantidade, Executada, Pendente: soma simples
  // - Preço Médio: média ponderada pela quantidade executada
  const calcularValoresConsolidados = (group: any[]) => {
    let totalQuantity = 0;
    let totalTradedQuantity = 0;
    let totalLeavesQuantity = 0;
    let totalPriceWeighted = 0;
    let totalTradedForAverage = 0;
    
    group.forEach(order => {
      // Somas simples
      totalQuantity += Number(order.quantity || 0);
      totalTradedQuantity += Number(order.TradedQuantity || 0);
      totalLeavesQuantity += Number(order.LeavesQuantity || 0);
      
      // Para preço médio ponderado
      const tradedQty = Number(order.TradedQuantity || 0);
      const avgPrice = Number(order.preco_medio_executado || order.AveragePrice || 0);
      
      if (tradedQty > 0 && avgPrice > 0) {
        totalPriceWeighted += tradedQty * avgPrice;
        totalTradedForAverage += tradedQty;
      }
    });
    
    // Calcular preço médio ponderado
    const precoMedioConsolidado = totalTradedForAverage > 0 ? totalPriceWeighted / totalTradedForAverage : 0;
    
    return {
      totalQuantity,
      totalTradedQuantity,
      totalLeavesQuantity,
      precoMedioConsolidado
    };
  };

  // Agrupar ordens por master_batch_id
  const batchGroups: { [batchId: string]: any[] } = {};
  const singleOrders: any[] = [];
  orders.forEach((order) => {
    if (order.master_batch_id) {
      if (!batchGroups[order.master_batch_id]) {
        batchGroups[order.master_batch_id] = [];
      }
      batchGroups[order.master_batch_id].push(order);
    } else {
      singleOrders.push(order);
    }
  });
  const batchIds = Object.keys(batchGroups);

  // Função auxiliar para formatar timestamp
  const formatTs = (o: any): string => {
    let d: Date | null = null;
    if (o.LastUpdate?.toDate) {
      d = o.LastUpdate.toDate();
    } else if (o.LastUpdate) {
      d = parseDate(o);
    }
    if (!d && o.createdAt) {
      d = parseDate(o);
    }
    return d ? d.toLocaleString('pt-BR') : '-';
  };

  return (
    <div style={{ maxWidth: '90%', margin: "40px auto", padding: 8, background: "#222", borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <h2 style={{ color: "#fff", marginBottom: 0 }}>Ordens</h2>
        {isLive && (
          <span
            title="Atualização em tempo real ativa"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px',
              borderRadius: 9999,
              background: '#064e3b',
              color: '#34d399',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981'
              }}
            />
            LIVE
          </span>
        )}
      </div>
      <label style={{ color: '#fff', fontSize: 14, marginTop: 4, display: 'block', marginBottom: 8 }}>Conta</label>
      <AccountSelector
        value={selectedAccount}
        onChange={(val) => {
          handleAccountChange({ target: { value: val } });
          if (typeof val === 'string' && val && !val.startsWith('strategy:') && val !== 'MASTER') {
            const acc = accounts.find((a:any) => a.AccountID === val);
            if (acc) setSelectedBroker(acc.BrokerID);
          }
        }}
        accounts={accounts}
        strategies={strategies}
      />
      <div style={{ height: 8 }} />
      {/* Filtros adicionais */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        {/* Período início */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ color: "#fff", fontSize: 14 }}>Período (início)</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: 6, borderRadius: 4, border: "1px solid #444", background: "#181818", color: "#fff" }}
          />
        </div>
        {/* Período fim */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ color: "#fff", fontSize: 14 }}>Período (fim)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: 6, borderRadius: 4, border: "1px solid #444", background: "#181818", color: "#fff" }}
          />
        </div>
        {/* Ativo */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ color: "#fff", fontSize: 14 }}>Ativo</label>
          <input
            type="text"
            placeholder="PETR4"
            value={filterTicker}
            onChange={(e) => setFilterTicker(e.target.value.toUpperCase())}
            style={{ padding: 6, borderRadius: 4, border: "1px solid #444", background: "#181818", color: "#fff", width: 120 }}
          />
        </div>
        {/* Status */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label style={{ color: "#fff", fontSize: 14 }}>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: 6, borderRadius: 4, border: "1px solid #444", background: "#181818", color: "#fff", width: 140 }}
          >
            <option value="">(Todos)</option>
            <option value="New">New</option>
            <option value="PartiallyFilled">PartiallyFilled</option>
            <option value="Filled">Filled</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        {/* Limpar */}
        <button
          type="button"
          onClick={() => {
            setStartDate("");
            setEndDate("");
            setFilterTicker("");
            setFilterStatus("");
          }}
          style={{ padding: "6px 12px", borderRadius: 4, background: "#444", color: "#fff", height: 36, alignSelf: "flex-end" }}
        >
          Limpar
        </button>
      </div>
      
      <div style={{ marginTop: 16, color: "#fff", whiteSpace: "pre-wrap" }}>
        <strong>Log/Retorno:</strong>
        <div>{log}</div>
      </div>
      {orders.length > 0 && (
        <div style={{ marginTop: 16, color: "#fff" }}>
          <strong>Ordens encontradas:</strong>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr style={{ background: '#333' }}>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Conta</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Status</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Timestamp</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Lado</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Ativo</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Preço</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Quantidade</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Executada</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Pendente</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Batch Master</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Preço Médio</th>
                  <th style={{ padding: 6, border: '1px solid #444', minWidth: 240 }}>Mensagem</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {/* Exibir grupos de batch retráteis */}
                {batchIds.map((batchId, idx) => {
                  const group = batchGroups[batchId];
                  const headerOrder = group[0];
                  const valoresConsolidados = calcularValoresConsolidados(group);
                  
                  return (
                    <React.Fragment key={batchId}>
                      <tr style={{ background: idx % 2 === 0 ? '#222' : '#282828' }}>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700, color: '#0ea5e9' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginRight: 4 }} onClick={() => setExpandedBatches(b => ({ ...b, [batchId]: !b[batchId] }))}>
                            {expandedBatches[batchId] ? <FiChevronDown /> : <FiChevronRight />}
                            <span style={{ marginLeft: 2 }}>
                              {headerOrder.account_id ?? '-'}
                              <span style={{ fontSize: '10px', color: '#10b981', marginLeft: 4 }} title={`${group.length} ordens consolidadas`}>
                                📊 {group.length}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.Status}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{formatTs(headerOrder)}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.side ?? '-'}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.ticker ?? '-'}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.price !== undefined && headerOrder.price !== null ? Number(headerOrder.price).toFixed(2) : '-'}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700, color: '#10b981' }} 
                            title={`Consolidado: ${valoresConsolidados.totalQuantity.toLocaleString()} ações (${group.length} ordens)`}>
                          {valoresConsolidados.totalQuantity.toLocaleString()}
                        </td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700, color: '#10b981' }}
                            title={`Consolidado: ${valoresConsolidados.totalTradedQuantity.toLocaleString()} ações executadas (${group.length} ordens)`}>
                          {valoresConsolidados.totalTradedQuantity.toLocaleString()}
                        </td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700, color: '#10b981' }}
                            title={`Consolidado: ${valoresConsolidados.totalLeavesQuantity.toLocaleString()} ações pendentes (${group.length} ordens)`}>
                          {valoresConsolidados.totalLeavesQuantity.toLocaleString()}
                        </td>
                        <td style={{ padding: 6, border: '1px solid #444', minWidth: 80, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: headerOrder.master_batch_id ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700 }}
                          title={headerOrder.master_batch_id}
                          onClick={() => headerOrder.master_batch_id && copyToClipboard(headerOrder.master_batch_id)}
                        >
                          {headerOrder.master_batch_id
                            ? (headerOrder.master_batch_id.length > 16
                                ? headerOrder.master_batch_id.slice(0, 8) + '...' + headerOrder.master_batch_id.slice(-4)
                                : headerOrder.master_batch_id)
                            : '-'}
                        </td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700, color: '#10b981' }}
                            title={`Preço médio ponderado consolidado: ${valoresConsolidados.precoMedioConsolidado.toFixed(2)} (${group.length} ordens)`}>
                          {valoresConsolidados.precoMedioConsolidado > 0 
                            ? valoresConsolidados.precoMedioConsolidado.toFixed(2)
                            : '-'}
                        </td>
                        <td
                          style={{
                            padding: 6,
                            border: '1px solid #444',
                            minWidth: 80,
                            maxWidth: 180,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            cursor: headerOrder.TextMessage && headerOrder.TextMessage.length > 40 ? 'pointer' : 'default',
                            fontWeight: 700
                          }}
                          title={headerOrder.TextMessage && headerOrder.TextMessage.length > 40 ? headerOrder.TextMessage : undefined}
                        >
                          {headerOrder.TextMessage ?? '-'}
                        </td>
                        <td style={{ padding: 6, border: '1px solid #444', textAlign: 'center', fontWeight: 700 }}>
                          <button title="Editar lote" onClick={async () => {
                            const strategyId = detectStrategyFromOrders(group);
                            const strategyName = strategyId ? strategies.find(s => s.id === strategyId)?.name : undefined;
                            const icebergId = detectIcebergFromOrders(group);
                            let icebergInfo = null;
                            let isIceberg = false;
                            let defaultLote = undefined;
                            
                            if (icebergId) {
                              icebergInfo = await fetchIcebergInfo(icebergId);
                              isIceberg = !!icebergInfo;
                              defaultLote = icebergInfo?.lote;
                            }
                            
                            setEditBatch({ 
                              batchId, 
                              orders: group, 
                              strategyId, 
                              strategyName,
                              isIceberg,
                              defaultLote
                            });
                            // Buscar valores corretos para a estratégia
                            fetchValoresForStrategy(strategyId);
                          }} style={{ marginRight: 6, color: '#0ea5e9', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                            <FiEdit2 size={18} />
                          </button>
                          <button title="Excluir lote" onClick={() => setDeleteBatch({ batchId, orders: group })} style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                            <FiTrash2 size={18} />
                          </button>
                        </td>
                      </tr>
                      {/* Ordens filhas do batch, retráteis */}
                      {expandedBatches[batchId] && group.map((child, cidx) => (
                        <tr key={child.OrderID} style={{ background: '#181818' }}>
                          <td style={{ padding: 6, border: '1px solid #444' }}>{child.account_id ?? '-'}</td>
                          <td style={{ padding: 6, border: '1px solid #444' }}>{child.Status}</td>
                          <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{formatTs(child)}</td>
                          <td style={{ padding: 6, border: '1px solid #444' }}>{child.side ?? '-'}</td>
                          <td style={{ padding: 6, border: '1px solid #444' }}>{child.ticker ?? '-'}</td>
                          <td style={{ padding: 6, border: '1px solid #444' }}>{child.price !== undefined && child.price !== null ? Number(child.price).toFixed(2) : '-'}</td>
                          <td style={{ padding: 6, border: '1px solid #444' }}>{child.quantity ?? '-'}</td>
                          <td style={{ padding: 6, border: '1px solid #444' }}>{child.TradedQuantity ?? '-'}</td>
                          <td style={{ padding: 6, border: '1px solid #444' }}>{child.LeavesQuantity ?? '-'}</td>
                          <td style={{ padding: 6, border: '1px solid #444', minWidth: 80, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: child.master_batch_id ? 'pointer' : 'default' }}
                            title={child.master_batch_id}
                            onClick={() => child.master_batch_id && copyToClipboard(child.master_batch_id)}
                          >
                            {child.master_batch_id
                              ? (child.master_batch_id.length > 16
                                  ? child.master_batch_id.slice(0, 8) + '...' + child.master_batch_id.slice(-4)
                                  : child.master_batch_id)
                              : '-'}
                          </td>
                          <td style={{ padding: 6, border: '1px solid #444' }}>
                            {child.preco_medio_executado !== undefined
                              ? Number(child.preco_medio_executado).toFixed(2)
                              : (child.AveragePrice !== undefined && child.AveragePrice !== null
                                  ? Number(child.AveragePrice).toFixed(2)
                                  : '-')}
                          </td>
                          <td
                            style={{
                              padding: 6,
                              border: '1px solid #444',
                              minWidth: 80,
                              maxWidth: 180,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: child.TextMessage && child.TextMessage.length > 40 ? 'pointer' : 'default'
                            }}
                            title={child.TextMessage && child.TextMessage.length > 40 ? child.TextMessage : undefined}
                          >
                            {child.TextMessage ?? '-'}
                          </td>
                          <td style={{ padding: 6, border: '1px solid #444', textAlign: 'center' }}>
                            <button title="Editar" onClick={() => { setOrderToEdit(child); setEditModalOpen(true); }} style={{ marginRight:6, background:'transparent', border:'none', cursor:'pointer', color:'#0ea5e9' }}>
                              <FiEdit2 size={16} />
                            </button>
                            <button title="Excluir" onClick={() => setDeleteConfirm({ open: true, order: child })} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#dc2626' }}>
                              <FiTrash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                {/* Exibir ordens sem batch normalmente */}
                {singleOrders.map((order, idx) => (
                  <tr key={order.OrderID || idx} style={{ background: '#222' }}>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{order.account_id ?? '-'}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{order.Status}</td>
                    <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{formatTs(order)}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{order.side ?? '-'}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{order.ticker ?? '-'}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{order.price !== undefined && order.price !== null ? Number(order.price).toFixed(2) : '-'}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{order.quantity ?? '-'}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{order.TradedQuantity ?? '-'}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{order.LeavesQuantity ?? '-'}</td>
                    <td style={{ padding: 6, border: '1px solid #444', minWidth: 80, maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: order.master_batch_id ? 'pointer' : 'default' }}
                      title={order.master_batch_id}
                      onClick={() => order.master_batch_id && copyToClipboard(order.master_batch_id)}
                    >
                      {order.master_batch_id
                        ? (order.master_batch_id.length > 16
                            ? order.master_batch_id.slice(0, 8) + '...' + order.master_batch_id.slice(-4)
                            : order.master_batch_id)
                        : '-'}
                    </td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>
                      {order.preco_medio_executado !== undefined
                        ? Number(order.preco_medio_executado).toFixed(2)
                        : (order.AveragePrice !== undefined && order.AveragePrice !== null
                            ? Number(order.AveragePrice).toFixed(2)
                            : '-')}
                    </td>
                    <td
                      style={{
                        padding: 6,
                        border: '1px solid #444',
                        minWidth: 80,
                        maxWidth: 180,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: order.TextMessage && order.TextMessage.length > 40 ? 'pointer' : 'default'
                      }}
                      title={order.TextMessage && order.TextMessage.length > 40 ? order.TextMessage : undefined}
                    >
                      {order.TextMessage ?? '-'}
                    </td>
                    <td style={{ padding: 6, border: '1px solid #444', textAlign: 'center' }}>
                      <button title="Editar" onClick={() => { setOrderToEdit(order); setEditModalOpen(true); }} style={{ marginRight:6, background:'transparent', border:'none', cursor:'pointer', color:'#0ea5e9' }}>
                        <FiEdit2 size={16} />
                      </button>
                      <button title="Excluir" onClick={() => setDeleteConfirm({ open: true, order })} style={{ background:'transparent', border:'none', cursor:'pointer', color:'#dc2626' }}>
                        <FiTrash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Modal de edição */}
      <EditOrderModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleEditOrder}
        order={orderToEdit}
      />
      {/* Modal de confirmação de exclusão */}
      {deleteConfirm?.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#222] rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-4">Excluir Ordem</h3>
            <p className="text-white mb-6">Tem certeza que deseja excluir esta ordem?</p>
            <div className="flex gap-4">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded bg-gray-600 text-white">Cancelar</button>
              <button onClick={() => handleDeleteOrder(deleteConfirm.order)} className="px-4 py-2 rounded bg-red-600 text-white">Excluir</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de edição em lote */}
      <EditBatchModal
        isOpen={!!editBatch}
        onClose={() => setEditBatch(null)}
        onSave={async (data) => {
          if (!editBatch) return;
          try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/edit_orders_batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                master_batch_id: editBatch.batchId,
                price: data.price,
                baseQty: data.baseQty,
                new_lote: data.lote
              })
            });
            const result = await res.json();
            if (res.ok) {
              let message = `Edição em lote concluída! Sucesso: ${result.results.filter((r: any) => r.success).length}, Falha: ${result.results.filter((r: any) => !r.success).length}`);
              if (result.iceberg_lote_updated) {
                message += '\n\n✅ Tamanho do lote da iceberg foi atualizado com sucesso!';
              }
              alert(message);
            } else {
              alert(result.detail || "Erro ao editar lote.");
            }
          } catch (err) {
            alert("Erro de conexão com o backend.");
          }
          setEditBatch(null);
          handleListOrders();
        }}
        batchOrders={editBatch?.orders}
        valorInvestidoMap={valorInvestidoMap}
        defaultPrice={editBatch?.orders[0]?.price}
        defaultBaseQty={editBatch?.orders[0]?.master_base_qty ?? editBatch?.orders.reduce((sum, o) => sum + (o.quantity || 0), 0)}
        strategyId={editBatch?.strategyId}
        strategyName={editBatch?.strategyName}
        isIceberg={editBatch?.isIceberg}
        defaultLote={editBatch?.defaultLote}
      />
      {/* Modal de exclusão em lote */}
      <DeleteBatchModal
        isOpen={!!deleteBatch}
        onClose={() => setDeleteBatch(null)}
        onConfirm={async () => {
          if (!deleteBatch) return;
          try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/cancel_orders_batch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ master_batch_id: deleteBatch.batchId })
            });
            const result = await res.json();
            if (res.ok) {
              alert(`Exclusão em lote concluída! Sucesso: ${result.results.filter((r: any) => r.success).length}, Falha: ${result.results.filter((r: any) => !r.success).length}`));
            } else {
              alert(result.detail || "Erro ao excluir lote.");
            }
          } catch (err) {
            alert("Erro de conexão com o backend.");
          }
          setDeleteBatch(null);
          handleListOrders();
        }}
        batchOrders={deleteBatch?.orders}
      />
    </div>
  );
} 