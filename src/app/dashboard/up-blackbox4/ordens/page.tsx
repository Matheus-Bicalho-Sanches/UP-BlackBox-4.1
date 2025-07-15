"use client";
import { useState, useEffect } from "react";
import { db } from "@/config/firebase";
import { collection, query, where, getDocs, orderBy, limit as limitFn } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { FiChevronDown, FiChevronRight, FiEdit2, FiTrash2, FiRefreshCcw } from 'react-icons/fi';
import React from "react";

// ===== Tipagens para os modais =====
interface EditBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: any) => Promise<void> | void;
  batchOrders?: any[];
  valorInvestidoMap: Record<string, number>;
  defaultPrice?: number | string;
  defaultBaseQty?: number | string;
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
function EditBatchModal({ isOpen, onClose, onSave, batchOrders, valorInvestidoMap, defaultPrice, defaultBaseQty }: EditBatchModalProps) {
  const [price, setPrice] = useState(defaultPrice ?? '');
  const [baseQty, setBaseQty] = useState(defaultBaseQty ?? '');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setPrice(defaultPrice ?? '');
    setBaseQty(defaultBaseQty ?? '');
    setLoading(false);
  }, [defaultPrice, defaultBaseQty, batchOrders]);
  if (!isOpen || !batchOrders) return null;
  // Calcular total investido
  const totalInvestido = batchOrders.reduce((sum, o) => sum + (valorInvestidoMap[o.account_id] || 0), 0);
  // Calcular quantidades proporcionais
  const preview = batchOrders.map(o => {
    const valor = valorInvestidoMap[o.account_id] || 0;
    const fator = valor / 10000; // divisor fixo, igual ao backend
    const quantidade = Math.max(1, Math.floor(Number(baseQty) * fator));
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
        <div className="space-y-4">
          <div>
            <label className="block text-gray-300 mb-1">Novo Preço</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="w-full p-2 rounded bg-[#181818] text-white border border-gray-600" />
          </div>
          <div>
            <label className="block text-gray-300 mb-1">Nova Quantidade Base</label>
            <input type="number" value={baseQty} onChange={e => setBaseQty(e.target.value)} className="w-full p-2 rounded bg-[#181818] text-white border border-gray-600" />
          </div>
          <div className="mt-4">
            <div className="text-gray-300 mb-2">Prévia das quantidades proporcionais:</div>
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
              await onSave({ price, baseQty, preview: previewWithMaster });
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
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(false);
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
  const [editBatch, setEditBatch] = useState<{ batchId: string, orders: any[] } | null>(null);
  const [deleteBatch, setDeleteBatch] = useState<{ batchId: string, orders: any[] } | null>(null);
  const [valorInvestidoMap, setValorInvestidoMap] = useState<Record<string, number>>({});
  // --- filtros: período, ativo e status ---
  // Usamos string (AAAA-MM-DD) para evitar problemas de fuso ao serializar Date
  // definir período padrão: últimos 10 dias (hoje inclusive)
  const [startDate, setStartDate] = useState<string>(()=>{
    const d = new Date();
    d.setDate(d.getDate()-9); // hoje - 9 => 10 dias contando hoje
    return d.toISOString().slice(0,10);
  });
  const [endDate, setEndDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [filterTicker, setFilterTicker] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("http://localhost:8000/accounts");
        const data = await res.json();
        if (res.ok && data.accounts && data.accounts.length > 0) {
          let fetchedAccounts = data.accounts;
          // Buscar nomes dos clientes no contasDll
          try {
            const contasDllRes = await fetch("http://localhost:8000/contasDll");
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
        const res = await fetch("http://localhost:8000/strategies");
        if (res.ok) {
          const data = await res.json();
          setStrategies(data.strategies || []);
        }
      } catch {}
    }
    fetchStrategies();
  }, []);

  useEffect(() => {
    async function fetchValores() {
      try {
        const res = await fetch("http://localhost:8000/contasDll");
        if (res.ok) {
          const data = await res.json();
          const map: Record<string, number> = {};
          for (const c of data.contas || []) {
            map[c.AccountID] = Number(c["Valor Investido"] || 0);
          }
          setValorInvestidoMap(map);
        }
      } catch {}
    }
    fetchValores();
  }, []);

  function handleAccountChange(e: React.ChangeEvent<HTMLSelectElement>) {
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

  async function handleListOrders(max?: number) {
    setLoading(true);
    setLog("");
    setOrders([]);
    // If strategy selected, fetch by strategy_id field directly
    if (selectedAccount.startsWith('strategy:')) {
      const sid = selectedAccount.replace('strategy:', '');
      try {
        const q = query(collection(db, 'ordensDLL'), where('strategy_id', '==', sid), orderBy('createdAt', 'desc'), limitFn(max || 500));
        const snap = await getDocs(q);
        const list = snap.docs.map(d=>d.data());
        const filtered = applyFilters(list);
        setOrders(filtered);
        setLog(`Ordens da estratégia carregadas. Total ${filtered.length}`);
      } catch(err:any) {
        setLog('Erro ao buscar ordens da estratégia: '+ (err.message||JSON.stringify(err)));
      }
      setLoading(false);
      return;
    }
    try {
      let fetchedOrders: any[] = [];
      if (selectedAccount === 'MASTER') {
        if (max) {
          const qMaster = query(collection(db, "ordensDLL"), orderBy("LastUpdate", "desc"), limitFn(max));
          const qs = await getDocs(qMaster);
          fetchedOrders = qs.docs.map(d=>d.data());
        } else {
          // Busca todas as ordens de todas as contas
          const querySnapshot = await getDocs(collection(db, "ordensDLL"));
          fetchedOrders = querySnapshot.docs.map(doc => {
            const data = doc.data();
            console.log("Ordem encontrada:", data);
            return data;
          });
        }
        // Ordenar por LastUpdate decrescente
        fetchedOrders.sort((a, b) => {
          const da=parseDate(a);
          const db=parseDate(b);
          if(!da||!db) return 0;
          return db.getTime()-da.getTime();
        });
        setLog(`Ordens consolidadas de todas as contas! Total: ${fetchedOrders.length}`);
      } else if (selectedAccount.startsWith('strategy:')) {
        const strategyId = selectedAccount.replace('strategy:','');
        // buscar alocações
        const allocRes = await fetch(`http://localhost:8000/allocations?strategy_id=${strategyId}`);
        const allocData = await allocRes.json();
        const accIds:string[] = (allocData.allocations||[]).map((a:any)=>a.account_id);
        if(accIds.length===0){ setLog('Nenhuma alocação para estratégia'); setLoading(false); return; }
        // buscar ordensDLL dessas contas
        const q = query(collection(db,'ordensDLL'), where('account_id','in', accIds));
        const snap= await getDocs(q);
        fetchedOrders = snap.docs.map(d=>d.data());
        fetchedOrders.sort((a,b)=>{
          const da=parseDate(a); const dbt=parseDate(b); if(!da||!dbt) return 0; return dbt.getTime()-da.getTime();
        });
        setLog(`Ordens da estratégia carregadas: ${fetchedOrders.length}`);
      } else {
        // Busca ordens do Firebase filtrando pela conta selecionada
        const q = query(
          collection(db, "ordensDLL"),
          where("account_id", "==", selectedAccount),
          orderBy("LastUpdate", "desc")
        );
        const querySnapshot = await getDocs(q);
        fetchedOrders = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log("Ordem encontrada:", data);
          return data;
        });
        setLog(`Ordens carregadas do Firebase! Total: ${fetchedOrders.length}`);
      }
      fetchedOrders.sort((a,b)=>{
        const da=parseDate(a);
        const db=parseDate(b);
        if(!da||!db) return 0;
        return db.getTime()-da.getTime();
      });
      const filteredOrders = applyFilters(fetchedOrders);
      setOrders(filteredOrders);
    } catch (err: any) {
      console.error("Erro ao buscar ordens no Firebase:", err);
      setLog("Erro ao buscar ordens no Firebase: " + (err.message || JSON.stringify(err)));
    }
    setLoading(false);
  }

  // carregamento inicial: últimas 10 ordens Master Global
  useEffect(()=>{
    handleListOrders(10);
  },[]);

  async function handleEditOrder(values: any) {
    if (!orderToEdit) return;
    try {
      const res = await fetch("http://localhost:8000/edit_order", {
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
      handleListOrders();
    } catch (err) {
      alert("Erro ao editar ordem.");
    }
  }

  async function handleDeleteOrder(order: any) {
    try {
      const res = await fetch("http://localhost:8000/cancel_order", {
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
      handleListOrders();
    } catch (err) {
      alert("Erro ao cancelar ordem.");
    }
  }

  // Agrupar ordens por master_batch_id
  const batchGroups: { [batchId: string]: any[] } = {};
  const singleOrders: any[] = [];
  orders.forEach(order => {
    if (order.master_batch_id) {
      if (!batchGroups[order.master_batch_id]) batchGroups[order.master_batch_id] = [];
      batchGroups[order.master_batch_id].push(order);
    } else {
      singleOrders.push(order);
    }
  });
  const batchIds = Object.keys(batchGroups);

  const formatTs = (o:any)=>{
    let d:Date|null = null;
    if(o.LastUpdate?.toDate){ d = o.LastUpdate.toDate(); }
    else if(o.LastUpdate){ d = parseDate(o); }
    if(!d && o.createdAt){ d = parseDate(o); }
    return d ? d.toLocaleString('pt-BR') : '-';
  }

  return (
    <div style={{ maxWidth: '90%', margin: "40px auto", padding: 8, background: "#222", borderRadius: 8 }}>
      <h2 style={{ color: "#fff", marginBottom: 24 }}>Ordens</h2>
      <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Conta</label>
      <select
        value={selectedAccount}
        onChange={handleAccountChange}
        required
        style={{ padding: 8, borderRadius: 4, border: "1px solid #444", marginBottom: 12 }}
      >
        <optgroup label="Estratégias">
          {strategies.map((st:any)=>(
            <option key={st.id} value={`strategy:${st.id}`}>{st.name}</option>
          ))}
        </optgroup>
        <optgroup label="Master">
          <option value="MASTER">MASTER - Todas as contas</option>
        </optgroup>
        <optgroup label="Contas Individuais">
          {accounts.map((acc:any,idx:number)=>(
            <option key={idx} value={acc.AccountID}>{acc.AccountID} - {acc.nomeCliente}</option>
          ))}
        </optgroup>
      </select>
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
      <button
        type="button"
        onClick={() => handleListOrders()}
        disabled={loading}
        style={{ marginBottom: 16, padding: 10, borderRadius: 4, background: "#0ea5e9", color: "#fff", fontWeight: 600, border: 0 }}
      >
        {loading ? "Carregando..." : "Listar ordens"}
      </button>
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
                  return (
                    <React.Fragment key={batchId}>
                      <tr style={{ background: idx % 2 === 0 ? '#222' : '#282828' }}>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700, color: '#0ea5e9' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', marginRight: 4 }} onClick={() => setExpandedBatches(b => ({ ...b, [batchId]: !b[batchId] }))}>
                            {expandedBatches[batchId] ? <FiChevronDown /> : <FiChevronRight />}
                            <span style={{ marginLeft: 2 }}>{headerOrder.account_id ?? '-'}</span>
                          </span>
                        </td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.Status}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{formatTs(headerOrder)}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.side ?? '-'}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.ticker ?? '-'}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.price !== undefined && headerOrder.price !== null ? Number(headerOrder.price).toFixed(2) : '-'}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.quantity ?? '-'}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.TradedQuantity ?? '-'}</td>
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>{headerOrder.LeavesQuantity ?? '-'}</td>
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
                        <td style={{ padding: 6, border: '1px solid #444', fontWeight: 700 }}>
                          {headerOrder.preco_medio_executado !== undefined
                            ? Number(headerOrder.preco_medio_executado).toFixed(2)
                            : (headerOrder.AveragePrice !== undefined && headerOrder.AveragePrice !== null
                                ? Number(headerOrder.AveragePrice).toFixed(2)
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
                            cursor: headerOrder.TextMessage && headerOrder.TextMessage.length > 40 ? 'pointer' : 'default',
                            fontWeight: 700
                          }}
                          title={headerOrder.TextMessage && headerOrder.TextMessage.length > 40 ? headerOrder.TextMessage : undefined}
                        >
                          {headerOrder.TextMessage ?? '-'}
                        </td>
                        <td style={{ padding: 6, border: '1px solid #444', textAlign: 'center', fontWeight: 700 }}>
                          <button title="Editar lote" onClick={() => setEditBatch({ batchId, orders: group })} style={{ marginRight: 6, color: '#0ea5e9', background: 'transparent', border: 'none', cursor: 'pointer' }}>
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
            const res = await fetch("http://localhost:8000/edit_orders_batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                master_batch_id: editBatch.batchId,
                price: data.price,
                baseQty: data.baseQty
              })
            });
            const result = await res.json();
            if (res.ok) {
              alert(`Edição em lote concluída! Sucesso: ${result.results.filter((r: any) => r.success).length}, Falha: ${result.results.filter((r: any) => !r.success).length}`);
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
      />
      {/* Modal de exclusão em lote */}
      <DeleteBatchModal
        isOpen={!!deleteBatch}
        onClose={() => setDeleteBatch(null)}
        onConfirm={async () => {
          if (!deleteBatch) return;
          try {
            const res = await fetch("http://localhost:8000/cancel_orders_batch", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ master_batch_id: deleteBatch.batchId })
            });
            const result = await res.json();
            if (res.ok) {
              alert(`Exclusão em lote concluída! Sucesso: ${result.results.filter((r: any) => r.success).length}, Falha: ${result.results.filter((r: any) => !r.success).length}`);
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