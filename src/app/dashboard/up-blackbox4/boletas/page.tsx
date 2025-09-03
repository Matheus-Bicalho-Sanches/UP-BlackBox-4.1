"use client";
import { useState, useEffect } from "react";
import app, { db } from "@/config/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { v4 as uuidv4 } from 'uuid';
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

/**
 * Página de Boletas - UP BlackBox 4.0
 * 
 * CONTEXTO:
 * - Sistema de envio de ordens para execução manual ou automatizada
 * - Suporte a ordens individuais, em lote (MASTER) e iceberg
 * - Integração com estratégias para alocação proporcional de capital
 * 
 * FUNCIONALIDADES:
 * - Envio de ordens por conta individual
 * - Envio de ordens consolidadas (MASTER) com alocação proporcional
 * - Ordens iceberg para execução gradual
 * - Fechamento de posições em lote
 * 
 * IMPORTANTE:
 * - MASTER não é conta real, apenas consolidação de ordens
 * - Alocação proporcional baseada no valor investido por cliente
 */

const EXCHANGES = [
  { value: "B", label: "B3 (Ações)" },
  { value: "F", label: "Futuros" },
  { value: "M", label: "Câmbio" },
  { value: "E", label: "ETF" },
  // Adicione outras exchanges conforme necessário
];

export default function BoletasPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedBroker, setSelectedBroker] = useState(0);
  const [selectedStrategy, setSelectedStrategy] = useState("");
  const [ticker, setTicker] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [exchange, setExchange] = useState("B");
  const [side, setSide] = useState("buy");
  const [log, setLog] = useState("");
  const [allocSummary, setAllocSummary] = useState<any[]>([]);
  const [iceAllocSummary, setIceAllocSummary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [boletaAberta, setBoletaAberta] = useState(false);
  const [icebergAberta, setIcebergAberta] = useState(false);
  const [icebergQuantity, setIcebergQuantity] = useState(1);
  const [icebergLote, setIcebergLote] = useState(1);
  const [icebergGroupSize, setIcebergGroupSize] = useState(1); // Para Master
  const [icebergLog, setIcebergLog] = useState("");
  const [icebergLoading, setIcebergLoading] = useState(false);
  const [icebergTicker, setIcebergTicker] = useState("");
  const [icebergPrice, setIcebergPrice] = useState(0);
  const [icebergExchange, setIcebergExchange] = useState("B");
  const [icebergSide, setIcebergSide] = useState("buy");
  const [icebergAccount, setIcebergAccount] = useState("");
  const [icebergBroker, setIcebergBroker] = useState(0);
  const [icebergStrategy, setIcebergStrategy] = useState("");
  const [closeBatchId, setCloseBatchId] = useState("");
  const [closeTicker, setCloseTicker] = useState("");
  const [closeExchange, setCloseExchange] = useState("B");
  const [closePct, setClosePct] = useState(1);
  const [closeOrderType, setCloseOrderType] = useState("market");
  const [closePrice, setClosePrice] = useState(0);
  const [closeLote, setCloseLote] = useState(1);
  const [closeGroupSize, setCloseGroupSize] = useState(1);
  const [closeLog, setCloseLog] = useState("");
  const [closeLoading, setCloseLoading] = useState(false);

  // Estados para TWAP
  const [icebergTwapEnabled, setIcebergTwapEnabled] = useState(false);
  const [icebergTwapInterval, setIcebergTwapInterval] = useState(30);
  const [icebergMasterTwapEnabled, setIcebergMasterTwapEnabled] = useState(false);
  const [icebergMasterTwapInterval, setIcebergMasterTwapInterval] = useState(30);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("http://localhost:8000/accounts");
        const data = await res.json();
        if (res.ok && data.accounts && data.accounts.length > 0) {
          let fetchedAccounts = data.accounts;
          // Buscar nomes de clientes no contasDll
          try {
            const contasDllRes = await fetch("http://localhost:8000/contasDll");
            if (contasDllRes.ok) {
              const contasDllData = await contasDllRes.json();
              const contasDll:any[] = contasDllData.contas || [];
              const nomeMap: Record<string,string> = {};
              for(const c of contasDll){
                nomeMap[c.AccountID] = c["Nome Cliente"] || "Sem_nome";
              }
              fetchedAccounts = fetchedAccounts.map((acc:any)=>({
                ...acc,
                nomeCliente: nomeMap[acc.AccountID] || "Sem_nome"
              }));
            }
          } catch{}

          // Ordenar por nome
          fetchedAccounts.sort((a:any,b:any)=>{
            const nA = (a.nomeCliente||"").toUpperCase();
            const nB = (b.nomeCliente||"").toUpperCase();
            return nA.localeCompare(nB,'pt-BR');
          });

          setAccounts(fetchedAccounts);
          setSelectedBroker(fetchedAccounts[0].BrokerID);
        }
      } catch (err) {
        // opcional: setLog("Erro ao buscar contas.");
      }
    }
    fetchAccounts();
    // fetch strategies
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

  function handleAccountChange(e: { target: { value: string } }) {
    const value = e.target.value;
    setSelectedAccount(value);
    // only set broker if selecting real account
    if (!value.startsWith("strategy:") && value !== "MASTER") {
      const accObj = accounts.find(a=>a.AccountID === value);
      if(accObj) setSelectedBroker(accObj.BrokerID || 0);
      setAllocSummary([]);
      // Reset strategy selection for individual accounts
      setSelectedStrategy("");
    } else {
      // Reset strategy for strategy/master selections
      setSelectedStrategy("");
    }
    // if strategy selected, fetch allocations summary
    if (value.startsWith('strategy:')) {
      const sid = value.replace('strategy:', '');
      fetch(`http://localhost:8000/allocations?strategy_id=${sid}`)
        .then(res=>res.json())
        .then(data=>{
           setAllocSummary(data.allocations||[]);
        })
        .catch(()=>setAllocSummary([]));
    }
  }

  function handleIcebergAccountChange(e: { target: { value: string } }) {
    const value = e.target.value;
    setIcebergAccount(value);
    if (!value.startsWith('strategy:') && value !== "MASTER") {
      const accObj = accounts.find(a=>a.AccountID === value);
      if(accObj) setIcebergBroker(accObj.BrokerID || 0);
      setIceAllocSummary([]);
      // Reset strategy selection for individual accounts
      setIcebergStrategy("");
    } else {
      // Reset strategy for strategy/master selections
      setIcebergStrategy("");
    }
    if (value.startsWith('strategy:')) {
      const sid = value.replace('strategy:', '');
      fetch(`http://localhost:8000/allocations?strategy_id=${sid}`)
        .then(res=>res.json())
        .then(data=>setIceAllocSummary(data.allocations||[]))
        .catch(()=>setIceAllocSummary([]));
    }
  }

  async function handleOrder(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLog("");
    try {
      if (selectedAccount.startsWith('strategy:')) {
        const strategyId = selectedAccount.replace('strategy:', '');
        const orderPayload = { account_id: 'MASTER', strategy_id: strategyId, ticker, quantity, price, side, exchange };
        const res = await fetch("http://localhost:8000/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });
        const data = await res.json();
        if (res.ok) {
          setLog(JSON.stringify(data, null, 2));
          // Checar avisos de quantidade zero
          if (Array.isArray(data.results)) {
            const zeradas = data.results.filter((r:any)=>!r.success && (r.log||"").includes("Quantidade calculada"));
            if (zeradas.length>0) {
              alert(`Atenção: ${zeradas.length} conta(s) sem alocação para esta estratégia ou valor alocado = 0. Verifique a aba Estratégias.`);
            }
          }
        } else {
          setLog(data.detail || "Erro ao enviar ordem.");
        }
        setLoading(false);
        return;
      }

      if (selectedAccount === 'MASTER') {
        // Gerar um master_batch_id único
        const master_batch_id = uuidv4();
        // Buscar Valor Investido de cada conta na coleção contasDLL
        const contasSnap = await fetch("http://localhost:8000/accounts");
        const contasData = await contasSnap.json();
        const contas = contasData.accounts || [];
        // Buscar os valores investidos de cada conta
        let contasDll: any[] = [];
        let contasDllLog = '';
        try {
          const contasDllSnap = await fetch("http://localhost:8000/contasDll");
          if (contasDllSnap.ok) {
            const contasDllData = await contasDllSnap.json();
            contasDll = contasDllData.contas || [];
            contasDllLog = `contasDll retornado: ${JSON.stringify(contasDll)}`;
          } else {
            contasDllLog = `Erro ao buscar contasDll: status ${contasDllSnap.status}`;
          }
        } catch (err) {
          contasDllLog = `Exceção ao buscar contasDll: ${err}`;
        }
        // Mapear por AccountID
        const valorInvestidoMap: Record<string, number> = {};
        for (const c of contasDll) {
          valorInvestidoMap[c.AccountID] = Number(c["Valor Investido"] || 0);
        }
        // Ordenar contas pelo valor investido decrescente para priorizar maiores
        contas.sort((a:any,b:any)=>{
          const va = valorInvestidoMap[a.AccountID] || 0;
          const vb = valorInvestidoMap[b.AccountID] || 0;
          return vb - va;
        });

        let results: string[] = [contasDllLog];
        for (const acc of contas) {
          // Buscar registro exato no contasDll pelo par AccountID+BrokerID
          const registro = contasDll.find((c:any)=> c.AccountID === acc.AccountID && Number(c.BrokerID) === Number(acc.BrokerID));
          if (!registro) {
            // Conta não cadastrada no Firebase → ignorar
            continue;
          }
          const valorInvestido = Number(registro["Valor Investido"] || 0);
          const quantidadeEnviada = calcularQuantidade(quantity, valorInvestido);
          if (quantidadeEnviada <= 0) {
            const fator = valorInvestido / 10000;
            results.push(`Conta ${acc.AccountID} (Broker ${acc.BrokerID}): Valor Investido = R$ ${valorInvestido.toFixed(2)}, fator = ${fator.toFixed(3)}, quantidade = 0 (NÃO ENVIADA)`);
            continue;
          }
          // Incluir master_batch_id e master_base_qty no payload
          const orderPayload = { account_id: acc.AccountID, broker_id: acc.BrokerID, ticker, quantity: quantidadeEnviada, price, side, exchange, master_batch_id, master_base_qty: quantity };
          try {
            const res = await fetch("http://localhost:8000/order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(orderPayload),
            });
            const data = await res.json();
            const fator = valorInvestido / 10000;
            if (res.ok) {
              results.push(`Conta ${acc.AccountID}: Valor Investido = R$ ${valorInvestido.toFixed(2)}, fator = ${fator.toFixed(3)}, quantidade = ${quantidadeEnviada} → ${data.log || "Ordem enviada com sucesso!"}`);
            } else {
              results.push(`Conta ${acc.AccountID}: Valor Investido = R$ ${valorInvestido.toFixed(2)}, fator = ${fator.toFixed(3)}, quantidade = ${quantidadeEnviada} → ${data.detail || "Erro ao enviar ordem."}`);
            }
          } catch (err) {
            results.push(`Conta ${acc.AccountID}: Valor Investido = R$ ${valorInvestido.toFixed(2)}, fator = ${fator.toFixed(3)}, quantidade = ${quantidadeEnviada} → Erro de conexão com o backend.`);
          }
        }
        console.log("[BOLETA] contasDllLog:", contasDllLog);
        setLog(results.join("\n"));
        setLoading(false);
        return;
      } else {
        const orderPayload: any = { account_id: selectedAccount, broker_id: selectedBroker, ticker, quantity, price, side, exchange };
        // Add strategy_id if selected for individual account
        if (selectedStrategy) {
          orderPayload.strategy_id = selectedStrategy;
        }
        const res = await fetch("http://localhost:8000/order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });
        const data = await res.json();
        if (res.ok) {
          setLog(data.log || "Ordem enviada com sucesso!");
        } else {
          setLog(data.detail || "Erro ao enviar ordem.");
        }
      }
    } catch (err) {
      setLog("Erro de conexão com o backend.");
    }
    setLoading(false);
  }

  async function handleIcebergOrder(e: React.FormEvent) {
    e.preventDefault();
    setIcebergLoading(true);
    setIcebergLog("");
    
    // Validação TWAP
    const isTwapEnabled = icebergAccount.startsWith('strategy:') || icebergAccount === "MASTER" 
      ? icebergMasterTwapEnabled 
      : icebergTwapEnabled;
    const twapInterval = icebergAccount.startsWith('strategy:') || icebergAccount === "MASTER"
      ? icebergMasterTwapInterval
      : icebergTwapInterval;
      
    if (isTwapEnabled && (twapInterval < 1 || twapInterval > 3600)) {
      setIcebergLog("Tempo entre ordens deve estar entre 1 e 3600 segundos");
      setIcebergLoading(false);
      return;
    }
    
    try {
      let endpoint = "http://localhost:8000/order_iceberg";
      let payload: any = {
        account_id: icebergAccount,
        broker_id: icebergBroker,
        ticker: icebergTicker,
        quantity_total: Number(icebergQuantity),
        lote: Number(icebergLote),
        price: Number(icebergPrice),
        side: icebergSide,
        exchange: icebergExchange,
        // Parâmetros TWAP
        twap_enabled: isTwapEnabled,
        twap_interval: isTwapEnabled ? Number(twapInterval) : null
      };
      if (icebergAccount.startsWith('strategy:')) {
        endpoint = "http://localhost:8000/order_iceberg_master";
        payload.strategy_id = icebergAccount.replace('strategy:', '');
        payload.account_id = 'MASTER';
        delete payload.broker_id;
        payload.group_size = Number(icebergGroupSize);
      } else if (icebergAccount === "MASTER") {
        endpoint = "http://localhost:8000/order_iceberg_master";
        payload.group_size = Number(icebergGroupSize);
      } else {
        // Individual account - add strategy_id if selected
        if (icebergStrategy) {
          payload.strategy_id = icebergStrategy;
        }
      }
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setIcebergLog(data.log || "Ordem iceberg enviada com sucesso!");
      } else {
        setIcebergLog(data.detail || "Erro ao enviar ordem iceberg.");
      }
    } catch (err) {
      setIcebergLog("Erro de conexão com o backend.");
    }
    setIcebergLoading(false);
  }

  async function handleCloseBatch(e: React.FormEvent) {
    e.preventDefault();
    setCloseLoading(true);
    setCloseLog("");
    try {
      const payload: any = {
        master_batch_id: closeBatchId,
        ticker: closeTicker,
        exchange: closeExchange,
        pct: Number(closePct),
        order_type: closeOrderType,
      };
      if (closeOrderType !== "market") {
        payload.price = Number(closePrice);
      }
      if (closeOrderType === "iceberg") {
        payload.lote = Number(closeLote);
        payload.group_size = Number(closeGroupSize);
      }
      const res = await fetch("http://localhost:8000/close_master_batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setCloseLog(JSON.stringify(data.results || data, null, 2));
      } else {
        setCloseLog(data.detail || "Erro ao fechar batch");
      }
    } catch (err) {
      setCloseLog("Erro de conexão com backend");
    }
    setCloseLoading(false);
  }

  return (
    <div style={{ maxWidth: 1200, margin: "40px auto", padding: 8, background: "#222", borderRadius: 8 }}>
      <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
        {/* Coluna 1: Boleta Simples */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <h2
            style={{ color: "#fff", marginBottom: boletaAberta ? 24 : 0, cursor: 'pointer', userSelect: 'none', background: '#181818', borderRadius: 8, padding: '12px 16px' }}
            onClick={() => setBoletaAberta(v => !v)}
          >
            Enviar boleta simples {boletaAberta ? '▲' : '▼'}
          </h2>
          {boletaAberta && (
            <>
              <form onSubmit={handleOrder} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ color: '#fff', fontSize: 14, marginTop: 4, display: 'block', marginBottom: 8 }}>Conta</label>
                <AccountSelector
                  value={selectedAccount || "MASTER"}
                  onChange={(val) => {
                    handleAccountChange({ target: { value: val } });
                    if (typeof val === 'string' && val && !val.startsWith('strategy:') && val !== 'MASTER') {
                      const acc = accounts.find((a:any) => a.AccountID === val);
                      if (acc) setSelectedBroker(acc.BrokerID || 0);
                    }
                  }}
                  accounts={accounts}
                  strategies={strategies}
                />
                <div style={{ height: 8 }} />
                
                {/* Campo de estratégia para contas individuais */}
                {selectedAccount && !selectedAccount.startsWith('strategy:') && selectedAccount !== 'MASTER' && (
                  <>
                    <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Estratégia (opcional)</label>
                    <select
                      value={selectedStrategy}
                      onChange={e => setSelectedStrategy(e.target.value)}
                      style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                    >
                      <option value="">Nenhuma estratégia</option>
                      {strategies.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </>
                )}
                
                <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Exchange</label>
                <select
                  value={exchange}
                  onChange={e => setExchange(e.target.value)}
                  required
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                >
                  {EXCHANGES.map((ex) => (
                    <option key={ex.value} value={ex.value}>{ex.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Ativo (ex: PETR4)"
                  value={ticker}
                  onChange={e => setTicker(e.target.value.toUpperCase())}
                  required
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                />
                <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Quantidade (base 10k)</label>
                <input
                  type="number"
                  placeholder="Quantidade (base 10k)"
                  value={quantity}
                  min={1}
                  onChange={e => setQuantity(Number(e.target.value))}
                  required
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                />
                <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Preço</label>
                <input
                  type="number"
                  placeholder="Preço"
                  value={price}
                  min={0}
                  step={0.01}
                  onChange={e => setPrice(Number(e.target.value))}
                  required
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                />
                <select
                  value={side}
                  onChange={e => setSide(e.target.value)}
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                >
                  <option value="buy">Compra</option>
                  <option value="sell">Venda</option>
                </select>
                <div style={{ height: 60 }} />
                <button type="submit" disabled={loading} style={{ padding: 10, borderRadius: 4, background: "#06b6d4", color: "#fff", fontWeight: 600, border: 0 }}>
                  {loading ? "Enviando..." : "Enviar ordem"}
                </button>
                            </form>
              
              {/* Mensagem de confirmação/erro */}
              {log && (
                <div style={{ 
                  marginTop: 16, 
                  padding: 12, 
                  borderRadius: 4, 
                  background: (log.includes('sucesso') || log.includes('Sucesso') || log.includes('enviada') || log.includes('Enviada')) ? '#1a1a1a' : '#2a1a1a',
                  border: (log.includes('sucesso') || log.includes('Sucesso') || log.includes('enviada') || log.includes('Enviada')) ? '1px solid #10b981' : '1px solid #dc2626',
                  color: (log.includes('sucesso') || log.includes('Sucesso') || log.includes('enviada') || log.includes('Enviada')) ? '#10b981' : '#dc2626',
                  fontSize: 14,
                  fontWeight: 500
                }}>
                  {(log.includes('sucesso') || log.includes('Sucesso') || log.includes('enviada') || log.includes('Enviada')) ? '✅ Ordem enviada com sucesso.' : '❌ Ordem NÃO enviada. Verifique o que ocorreu!'}
                </div>
              )}

              {/* resumo alocação */}
              {selectedAccount.startsWith('strategy:') && allocSummary.length > 0 && (
                <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 12, color:'#fff', border:'1px solid #333', borderRadius:4, padding:6 }}>
                  <b>Alocação estratégia:</b>
                  {(() => {
                    const totalValor = allocSummary.reduce((sum, al) => sum + Number(al.valor_investido || 0), 0);
                    const totalQuantidade = allocSummary.reduce((sum, al) => sum + calcularQuantidade(quantity, Number(al.valor_investido || 0)), 0);
                    const operacao = side === 'buy' ? 'COMPRA' : 'VENDE';
                    return (
                      <>
                        <div style={{marginBottom: 8, fontWeight: 'bold', color: '#06b6d4'}}>
                          TOTAL: R$ {totalValor.toLocaleString('pt-BR')} - {operacao} {totalQuantidade} unidades
                        </div>
                        <ul style={{margin:4, paddingLeft:18}}>
                          {allocSummary.map((al:any)=>(
                            <li key={al.account_id}>
                              {al.account_id}: R$ {Number(al.valor_investido||0).toLocaleString('pt-BR')} - {operacao} {calcularQuantidade(quantity, Number(al.valor_investido || 0))} unidades
                            </li>
                          ))}
                        </ul>
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
        {/* Coluna 2: Boleta Iceberg */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <h2
            style={{ color: "#fff", marginBottom: icebergAberta ? 24 : 0, cursor: 'pointer', userSelect: 'none', background: '#181818', borderRadius: 8, padding: '12px 16px' }}
            onClick={() => setIcebergAberta(v => !v)}
          >
            Enviar boleta iceberg {icebergAberta ? '▲' : '▼'}
          </h2>
          {icebergAberta && (
            <>
              <form onSubmit={handleIcebergOrder} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ color: '#fff', fontSize: 14, marginTop: 4, display: 'block', marginBottom: 8 }}>Conta</label>
                <AccountSelector
                  value={icebergAccount || "MASTER"}
                  onChange={(val) => {
                    handleIcebergAccountChange({ target: { value: val } });
                    if (typeof val === 'string' && val && !val.startsWith('strategy:') && val !== 'MASTER') {
                      const acc = accounts.find((a:any) => a.AccountID === val);
                      if (acc) setIcebergBroker(acc.BrokerID || 0);
                    }
                  }}
                  accounts={accounts}
                  strategies={strategies}
                />
                <div style={{ height: 8 }} />
                
                {/* Campo de estratégia para contas individuais no iceberg */}
                {icebergAccount && !icebergAccount.startsWith('strategy:') && icebergAccount !== 'MASTER' && (
                  <>
                    <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Estratégia (opcional)</label>
                    <select
                      value={icebergStrategy}
                      onChange={e => setIcebergStrategy(e.target.value)}
                      style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                    >
                      <option value="">Nenhuma estratégia</option>
                      {strategies.map(st => (
                        <option key={st.id} value={st.id}>{st.name}</option>
                      ))}
                    </select>
                  </>
                )}
                
                <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Exchange</label>
                <select
                  value={icebergExchange}
                  onChange={e => setIcebergExchange(e.target.value)}
                  required
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                >
                  {EXCHANGES.map((ex) => (
                    <option key={ex.value} value={ex.value}>{ex.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Ativo (ex: PETR4)"
                  value={icebergTicker}
                  onChange={e => setIcebergTicker(e.target.value.toUpperCase())}
                  required
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                />
                <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Quantidade total (base 10k)</label>
                <input
                  type="number"
                  placeholder="Quantidade total (base 10k)"
                  value={icebergQuantity}
                  min={1}
                  onChange={e => setIcebergQuantity(Number(e.target.value))}
                  required
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                />
                <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Tamanho do lote (iceberg)</label>
                <input
                  type="number"
                  placeholder="Tamanho do lote"
                  value={icebergLote}
                  min={1}
                  onChange={e => setIcebergLote(Number(e.target.value))}
                  required
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                />
                {icebergAccount.startsWith('strategy:') && (
                  <>
                    <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Contas por onda</label>
                    <input
                      type="number"
                      placeholder="Contas por onda"
                      value={icebergGroupSize}
                      min={1}
                      onChange={e => setIcebergGroupSize(Number(e.target.value))}
                      required
                      style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                    />
                  </>
                )}
                
                <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>Preço</label>
                <input
                  type="number"
                  placeholder="Preço"
                  value={icebergPrice}
                  min={0}
                  step={0.01}
                  onChange={e => setIcebergPrice(Number(e.target.value))}
                  required
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                />
                <select
                  value={icebergSide}
                  onChange={e => setIcebergSide(e.target.value)}
                  style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                >
                  <option value="buy">Compra</option>
                  <option value="sell">Venda</option>
                </select>
                
                {/* Campos TWAP - CORREÇÃO: Apenas um checkbox baseado no tipo de conta */}
                {/* Evita duplicação do checkbox "Ligar TWAP" */}
                {(icebergAccount.startsWith('strategy:') || icebergAccount === "MASTER") ? (
                  // TWAP para Iceberg Master (estratégias ou MASTER)
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <input
                        type="checkbox"
                        id="icebergMasterTwapEnabled"
                        checked={icebergMasterTwapEnabled}
                        onChange={e => setIcebergMasterTwapEnabled(e.target.checked)}
                        style={{ margin: 0 }}
                      />
                      <label htmlFor="icebergMasterTwapEnabled" style={{ color: '#fff', fontSize: 14, margin: 0 }}>
                        Ligar TWAP
                      </label>
                    </div>

                    {icebergMasterTwapEnabled && (
                      <>
                        <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>
                          Tempo entre ordens (segundos)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={3600}
                          placeholder="30"
                          value={icebergMasterTwapInterval}
                          onChange={e => setIcebergMasterTwapInterval(Number(e.target.value))}
                          style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                        />
                        <div style={{ 
                          color: '#06b6d4', 
                          fontSize: 12, 
                          marginTop: 4,
                          padding: 8,
                          background: '#1a1a1a',
                          borderRadius: 4
                        }}>
                          ⏱️ TWAP ativo: {icebergMasterTwapInterval}s entre ordens
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  // TWAP para Iceberg Simples (contas individuais)
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <input
                        type="checkbox"
                        id="icebergTwapEnabled"
                        checked={icebergTwapEnabled}
                        onChange={e => setIcebergTwapEnabled(e.target.checked)}
                        style={{ margin: 0 }}
                      />
                      <label htmlFor="icebergTwapEnabled" style={{ color: '#fff', fontSize: 14, margin: 0 }}>
                        Ligar TWAP
                      </label>
                    </div>

                    {icebergTwapEnabled && (
                      <>
                        <label style={{ color: '#fff', fontSize: 14, marginTop: 4 }}>
                          Tempo entre ordens (segundos)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={3600}
                          placeholder="30"
                          value={icebergTwapInterval}
                          onChange={e => setIcebergTwapInterval(Number(e.target.value))}
                          style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
                        />
                        <div style={{ 
                          color: '#06b6d4', 
                          fontSize: 12, 
                          marginTop: 4,
                          padding: 8,
                          background: '#1a1a1a',
                          borderRadius: 4
                        }}>
                          ⏱️ TWAP ativo: {icebergTwapInterval}s entre ordens
                        </div>
                      </>
                    )}
                  </>
                )}
                <button type="submit" disabled={icebergLoading} style={{ padding: 10, borderRadius: 4, background: "#06b6d4", color: "#fff", fontWeight: 600, border: 0 }}>
                  {icebergLoading ? "Enviando..." : "Enviar ordem iceberg"}
                </button>
                            </form>
              
              {/* Mensagem de confirmação/erro */}
              {icebergLog && (
                <div style={{ 
                  marginTop: 16, 
                  padding: 12, 
                  borderRadius: 4, 
                  background: (icebergLog.includes('sucesso') || icebergLog.includes('Sucesso') || icebergLog.includes('iniciada') || icebergLog.includes('Iniciada')) ? '#1a1a1a' : '#2a1a1a',
                  border: (icebergLog.includes('sucesso') || icebergLog.includes('Sucesso') || icebergLog.includes('iniciada') || icebergLog.includes('Iniciada')) ? '1px solid #10b981' : '1px solid #dc2626',
                  color: (icebergLog.includes('sucesso') || icebergLog.includes('Sucesso') || icebergLog.includes('iniciada') || icebergLog.includes('Iniciada')) ? '#10b981' : '#dc2626',
                  fontSize: 14,
                  fontWeight: 500
                }}>
                  {(icebergLog.includes('sucesso') || icebergLog.includes('Sucesso') || icebergLog.includes('iniciada') || icebergLog.includes('Iniciada')) ? '✅ Ordem enviada com sucesso.' : '❌ Ordem NÃO enviada. Verifique o que ocorreu!'}
                </div>
              )}

              {icebergAccount.startsWith('strategy:') && iceAllocSummary.length > 0 && (
                <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 12, color:'#fff', border:'1px solid #333', borderRadius:4, padding:6, marginTop:8 }}>
                  <b>Alocação estratégia:</b>
                  {(() => {
                    const totalValor = iceAllocSummary.reduce((sum, al) => sum + Number(al.valor_investido || 0), 0);
                    const totalQuantidade = iceAllocSummary.reduce((sum, al) => sum + calcularQuantidade(icebergQuantity, Number(al.valor_investido || 0)), 0);
                    const operacao = icebergSide === 'buy' ? 'COMPRA' : 'VENDE';
                    return (
                      <>
                        <div style={{marginBottom: 8, fontWeight: 'bold', color: '#06b6d4'}}>
                          TOTAL: R$ {totalValor.toLocaleString('pt-BR')} - {operacao} {totalQuantidade} unidades
                        </div>
                        <ul style={{margin:4, paddingLeft:18}}>
                          {iceAllocSummary.map((al:any)=>(
                            <li key={al.account_id}>
                              {al.account_id}: R$ {Number(al.valor_investido||0).toLocaleString('pt-BR')} - {operacao} {calcularQuantidade(icebergQuantity, Number(al.valor_investido || 0))} unidades
                            </li>
                          ))}
                        </ul>
                      </>
                    );
                  })()}
                </div>
              )}
            </>
          )}
        </div>
        {/* Coluna 3: Fechar/Reduzir Batch */}
        <div style={{ flex: 1, minWidth: 320, background: "#181818", padding: 16, borderRadius: 8 }}>
          <h3 style={{ color: "#fff", marginBottom: 12 }}>Fechar / Reduzir Batch</h3>
          <form onSubmit={handleCloseBatch} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input type="text" placeholder="Master Batch ID" value={closeBatchId} onChange={e=>setCloseBatchId(e.target.value)} required style={{ padding: 8, borderRadius: 4, border: '1px solid #444' }} />
            <input type="text" placeholder="Ticker" value={closeTicker} onChange={e=>setCloseTicker(e.target.value.toUpperCase())} required style={{ padding: 8, borderRadius: 4, border: '1px solid #444' }} />
            <select value={closeExchange} onChange={e=>setCloseExchange(e.target.value)} style={{ padding: 8, borderRadius: 4, border: '1px solid #444' }}>
              {EXCHANGES.map(ex=> <option key={ex.value} value={ex.value}>{ex.label}</option>)}
            </select>
            <label style={{ color: '#fff' }}>Porcentagem a Fechar (0-100%)</label>
            <input type="number" min={1} max={100} value={closePct*100} onChange={e=>setClosePct(Number(e.target.value)/100)} style={{ padding: 8, borderRadius: 4, border: '1px solid #444' }} />
            <label style={{ color:'#fff' }}>Tipo de Ordem</label>
            <select value={closeOrderType} onChange={e=>setCloseOrderType(e.target.value)} style={{ padding: 8, borderRadius: 4, border: '1px solid #444' }}>
              <option value="market">Market</option>
              <option value="limit">Limitada</option>
              <option value="iceberg">Iceberg</option>
            </select>
            {closeOrderType !== 'market' && (
              <>
                <label style={{ color:'#fff', fontSize: 14, marginTop:4 }}>Preço</label>
                <input type="number" placeholder="Preço" value={closePrice} onChange={e=>setClosePrice(Number(e.target.value))} style={{ padding: 8, borderRadius: 4, border: '1px solid #444' }} />
              </>
            )}
            {closeOrderType === 'iceberg' && (
              <>
                <label style={{ color:'#fff', fontSize: 14, marginTop:4 }}>Tamanho do lote (iceberg)</label>
                <input type="number" placeholder="Lote" value={closeLote} onChange={e=>setCloseLote(Number(e.target.value))} style={{ padding: 8, borderRadius: 4, border: '1px solid #444' }} />
                <label style={{ color:'#fff', fontSize: 14, marginTop:4 }}>Contas por onda</label>
                <input type="number" placeholder="Group Size" value={closeGroupSize} onChange={e=>setCloseGroupSize(Number(e.target.value))} style={{ padding: 8, borderRadius: 4, border: '1px solid #444' }} />
              </>
            )}
            <div style={{ height: 80 }} />
            <button type="submit" disabled={closeLoading} style={{ padding: 10, borderRadius: 4, background: '#d946ef', color: '#fff', fontWeight: 600, border: 0 }}>
              {closeLoading ? 'Enviando...' : 'Fechar/Reduzir'}
            </button>
          </form>
          {closeLog && <pre style={{ whiteSpace: 'pre-wrap', color: '#fff', marginTop: 12 }}>{closeLog}</pre>}
        </div>
      </div>
    </div>
  );
} 