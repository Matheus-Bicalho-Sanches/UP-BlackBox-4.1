"use client";
import { useState, useEffect } from "react";
import { db } from "@/config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

export default function PosicoesPage() {
  const [log, setLog] = useState("");
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("MASTER");
  const [selectedBroker, setSelectedBroker] = useState(0);
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("");
  const [subAccount, setSubAccount] = useState("");
  const [positionType, setPositionType] = useState("2"); // 1=DayTrade, 2=Consolidado

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("http://localhost:8000/accounts");
        const data = await res.json();
        if (res.ok && data.accounts && data.accounts.length > 0) {
          let fetchedAccounts = data.accounts;
          // Buscar nomes dos clientes na coleção contasDll
          try {
            const contasDllRes = await fetch("http://localhost:8000/contasDll");
            if (contasDllRes.ok) {
              const contasDllData = await contasDllRes.json();
              const contasDll: any[] = contasDllData.contas || [];
              // Criar mapa AccountID -> Nome Cliente
              const nomeMap: Record<string, string> = {};
              for (const c of contasDll) {
                nomeMap[c.AccountID] = c["Nome Cliente"] || "Sem_nome";
              }
              // Anexar nome ao objeto da conta
              fetchedAccounts = fetchedAccounts.map((acc:any) => ({
                ...acc,
                nomeCliente: nomeMap[acc.AccountID] || "Sem_nome"
              }));
            }
          } catch {}

          // Ordenar alfabeticamente pelo nome do cliente
          fetchedAccounts.sort((a:any,b:any)=>{
            const nomeA = (a.nomeCliente||'').toUpperCase();
            const nomeB = (b.nomeCliente||'').toUpperCase();
            return nomeA.localeCompare(nomeB,'pt-BR');
          });
          setAccounts(fetchedAccounts);
          setSelectedAccount(prev => prev || "MASTER");
          setSelectedBroker(fetchedAccounts[0].BrokerID);
        }
      } catch (err) {}
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

  // Carregar posições da conta Master automaticamente ao abrir a página
  useEffect(() => {
    // Somente se estiver na conta Master para evitar chamadas duplicadas quando o usuário trocar manualmente
    if (selectedAccount === 'MASTER') {
      handleListPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAccountChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedAccount(e.target.value);
  }

  async function handleListPositions() {
    setLog("");
    setPositions([]);
    setLoading(true);
    if (selectedAccount.startsWith('strategy:')) {
      const sid = selectedAccount.replace('strategy:', '');
      try {
        const res = await fetch(`http://localhost:8000/positions_strategy?strategy_id=${sid}`);
        if (res.ok) {
          const data = await res.json();
          setPositions(data.positions || []);
          setLog(`Posições da estratégia carregadas! Total: ${(data.positions||[]).length}`);
        } else {
          setLog('Erro ao buscar posições da estratégia.');
        }
      } catch(err:any){
        setLog('Erro de conexão com backend: '+ (err.message||JSON.stringify(err)));
      }
      setLoading(false);
      return;
    }
    try {
      let positionsArr: any[] = [];
      if (selectedAccount === 'MASTER') {
        // Busca todas as posições de todas as contas
        const querySnapshot = await getDocs(collection(db, "posicoesDLL"));
        const allPositions = querySnapshot.docs.map(doc => doc.data());
        // Consolidar por ticker
        const tickerMap: Record<string, { ticker: string, quantity: number, totalBuy: number }> = {};
        for (const pos of allPositions) {
          if (!pos.ticker) continue;
          if (!tickerMap[pos.ticker]) {
            tickerMap[pos.ticker] = { ticker: pos.ticker, quantity: 0, totalBuy: 0 };
          }
          tickerMap[pos.ticker].quantity += Number(pos.quantity) || 0;
          tickerMap[pos.ticker].totalBuy += (Number(pos.avgPrice) || 0) * (Number(pos.quantity) || 0);
        }
        positionsArr = Object.values(tickerMap).map(pos => ({
          ticker: pos.ticker,
          quantity: pos.quantity,
          avgPrice: pos.quantity !== 0 ? pos.totalBuy / pos.quantity : 0
        }));
        setLog(`Posições consolidadas de todas as contas! Total: ${positionsArr.length}`);
      } else if (selectedAccount.startsWith('strategy:')) {
        const strategyId = selectedAccount.replace('strategy:', '');
        // buscar alocações
        const allocRes = await fetch(`http://localhost:8000/allocations?strategy_id=${strategyId}`);
        const allocData = await allocRes.json();
        const accIds: string[] = (allocData.allocations || []).map((a: any) => a.account_id);
        if (accIds.length === 0) {
          setLog('Nenhuma alocação para esta estratégia.');
          setLoading(false);
          return;
        }
        // pegar posicoes de cada conta
        const q = query(collection(db, 'posicoesDLL'), where('account_id', 'in', accIds));
        const snap = await getDocs(q);
        const all = snap.docs.map(d=>d.data());
        const map: Record<string, { qty:number, totalBuy:number}> = {};
        for(const p of all){
          if(!p.ticker) continue;
          if(!map[p.ticker]) map[p.ticker]={qty:0,totalBuy:0};
          map[p.ticker].qty+= Number(p.quantity)||0;
          map[p.ticker].totalBuy += (Number(p.avgPrice)||0)*(Number(p.quantity)||0);
        }
        positionsArr = Object.keys(map).map(t=>({ticker:t, quantity:map[t].qty, avgPrice: map[t].qty!==0? map[t].totalBuy/map[t].qty:0}));
        setLog(`Posições consolidadas da estratégia. Total ${positionsArr.length}`);
      } else {
        // Busca as posições já calculadas do cliente na coleção posicoesDLL
        const q = query(
          collection(db, "posicoesDLL"),
          where("account_id", "==", selectedAccount)
        );
        console.log("Query Firestore: posicoesDLL, account_id =", selectedAccount);
        const querySnapshot = await getDocs(q);
        console.log("QuerySnapshot size:", querySnapshot.size);
        positionsArr = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log("Posição encontrada:", data);
          return data;
        });
        setLog(`Posições carregadas do Firebase! Total: ${positionsArr.length}`);
      }
      setPositions(positionsArr);
    } catch (err: any) {
      console.error("Erro ao buscar posições no Firebase:", err);
      setLog("Erro ao buscar posições no Firebase: " + (err.message || JSON.stringify(err)));
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", padding: 24, background: "#222", borderRadius: 8 }}>
      <h2 style={{ color: "#fff", marginBottom: 24 }}>Posições</h2>
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
      <button
        type="button"
        onClick={handleListPositions}
        disabled={loading}
        style={{ marginBottom: 16, padding: 10, borderRadius: 4, background: "#0ea5e9", color: "#fff", fontWeight: 600, border: 0 }}
      >
        {loading ? "Carregando..." : "Listar posições"}
      </button>
      <div style={{ marginTop: 16, color: "#fff", whiteSpace: "pre-wrap" }}>
        <strong>Log/Retorno:</strong>
        <div>{log}</div>
      </div>
      {positions.length > 0 && (
        <div style={{ marginTop: 16, color: "#fff" }}>
          <strong>Posições encontradas:</strong>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
              <thead>
                <tr style={{ background: '#333' }}>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Ticker</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Quantidade Líquida</th>
                  <th style={{ padding: 6, border: '1px solid #444' }}>Preço Médio (Compra)</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#222' : '#282828' }}>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{pos.ticker}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{pos.quantity}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{pos.avgPrice !== 0 ? pos.avgPrice.toFixed(2) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
} 