"use client";
import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, setDoc, updateDoc, doc, serverTimestamp, collection as fbCollection, query, where, Timestamp } from "firebase/firestore";
import { FiEdit2, FiHelpCircle, FiDollarSign } from "react-icons/fi";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function EditSaldoModal({ isOpen, onClose, onSave, values, setValues, loading }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#222] rounded-lg p-6 w-full max-w-lg">
        <h3 className="text-xl font-bold text-white mb-4">Editar Conta</h3>
        <div className="space-y-4">
          {/* Seção de Saldos */}
          <div className="border-b border-gray-600 pb-4">
            <h4 className="text-lg font-semibold text-white mb-3">Saldos</h4>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-gray-300 mb-1">Saldo Hoje</label>
                <input
                  type="number"
                  value={values["Saldo Hoje"] ?? ""}
                  onChange={e => setValues((v: any) => ({ ...v, "Saldo Hoje": Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Saldo D+1</label>
                <input
                  type="number"
                  value={values["Saldo D+1"] ?? ""}
                  onChange={e => setValues((v: any) => ({ ...v, "Saldo D+1": Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Saldo D+2</label>
                <input
                  type="number"
                  value={values["Saldo D+2"] ?? ""}
                  onChange={e => setValues((v: any) => ({ ...v, "Saldo D+2": Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1">% Min Caixa</label>
                  <input
                    type="number"
                    step="0.1"
                    value={values["PctSaldoMin"] ?? ""}
                    onChange={e => setValues((v: any) => ({ ...v, PctSaldoMin: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">% Max Caixa</label>
                  <input
                    type="number"
                    step="0.1"
                    value={values["PctSaldoMax"] ?? ""}
                    onChange={e => setValues((v: any) => ({ ...v, PctSaldoMax: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção de LFTS11 */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">LFTS11</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-300 mb-1">Quantidade</label>
                <input
                  type="number"
                  step="1"
                  value={values.quantity ?? ""}
                  onChange={e => setValues((v: any) => ({ ...v, quantity: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="Ex: 1000"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Preço Médio</label>
                <input
                  type="number"
                  step="0.01"
                  value={values.avgPrice ?? ""}
                  onChange={e => setValues((v: any) => ({ ...v, avgPrice: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="Ex: 110.50"
                />
              </div>
            </div>
            {values.quantity && values.avgPrice && (
              <div className="bg-gray-800 p-3 rounded-md mt-3">
                <p className="text-gray-300 text-sm">
                  <strong>Valor Total LFTS11:</strong> {(values.quantity * values.avgPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50"
          >Cancelar</button>
          <button
            onClick={onSave}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SaldoPage() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [lftsPositions, setLftsPositions] = useState<Record<string, { quantity: number; avgPrice: number }>>({});
  const [saldosFuturos, setSaldosFuturos] = useState<any>({});
  const [lftsValor, setLftsValor] = useState<Record<string, number>>({});
  const [lftsRefPrice, setLftsRefPrice] = useState<number>(110);
  // Flag de envio para evitar cliques múltiplos simultâneos
  const [ajusteLoadingMap, setAjusteLoadingMap] = useState<Record<string, boolean>>({});
  const [globalAdjustLoading, setGlobalAdjustLoading] = useState(false);
  // Valores percentuais padrão caso não existam no documento
  const DEFAULT_PCT_MIN = 2;
  const DEFAULT_PCT_MAX = 5;
  // Preço manual da LFTS11 e estado de salvamento
  const [manualLftsPrice, setManualLftsPrice] = useState<number>(0);
  const [savingPrice, setSavingPrice] = useState(false);
  const [adjustSummary, setAdjustSummary] = useState<string[]>([]);

  useEffect(() => {
    async function fetchClientes() {
      setLoading(true);
      try {
        // Busca clientes
        const querySnapshot = await getDocs(collection(db, "contasDll"));
        const lista: any[] = [];
        querySnapshot.forEach((docSnap) => {
          lista.push({ ...docSnap.data(), _id: docSnap.id });
        });
        // Ordena contas (exceto Master, que não está em lista) alfabeticamente pelo nome ou AccountID
        lista.sort((a, b) => {
          const nomeA = (a["Nome Cliente"] || a.AccountID || "").toUpperCase();
          const nomeB = (b["Nome Cliente"] || b.AccountID || "").toUpperCase();
          return nomeA.localeCompare(nomeB, 'pt-BR');
        });
        setClientes(lista);

        // Função para contar dias úteis entre duas datas (exclui a data inicial)
        function countBusinessDays(start: Date, end: Date) {
          let count = 0;
          let current = new Date(start);
          current.setHours(0,0,0,0);
          end = new Date(end);
          end.setHours(0,0,0,0);
          while (current < end) {
            current.setDate(current.getDate() + 1);
            const day = current.getDay();
            if (day !== 0 && day !== 6) count++;
          }
          return count;
        }

        // Buscar todas as ordens
        const ordensSnap = await getDocs(fbCollection(db, "ordensDLL"));
        const ordensAll = ordensSnap.docs.map(doc => doc.data());
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        // Agrupa por AccountID
        const saldos: any = {};
        for (const cli of lista) {
          const accId = cli.AccountID;
          saldos[accId] = { d1: 0, d2: 0, vencidos: 0 };
        }
        for (const ordem of ordensAll) {
          const accId = ordem.account_id;
          if (!accId || !saldos[accId]) continue;
          // Usa o preço médio executado se existir, senão o valor_executado
          let valor = 0;
          if (ordem.preco_medio_executado !== undefined && ordem.TradedQuantity !== undefined) {
            valor = Number(ordem.preco_medio_executado) * Number(ordem.TradedQuantity);
          } else if (ordem.valor_executado !== undefined) {
            valor = Number(ordem.valor_executado);
          } else if (ordem.price !== undefined && ordem.TradedQuantity !== undefined) {
            valor = Number(ordem.price) * Number(ordem.TradedQuantity);
          }
          if (!valor) continue;
          if (!ordem.createdAt) continue;
          const dataOrdem = new Date(ordem.createdAt);
          dataOrdem.setHours(0,0,0,0);
          const diasUteis = countBusinessDays(dataOrdem, hoje);
          if (ordem.prazo_liquidacao === 'D+1') {
            if (diasUteis === 0) {
              saldos[accId].d1 += ordem.side === 'buy' ? -valor : valor;
            } else {
              saldos[accId].vencidos += ordem.side === 'buy' ? -valor : valor;
            }
          } else if (ordem.prazo_liquidacao === 'D+2') {
            if (diasUteis === 0) {
              saldos[accId].d2 += ordem.side === 'buy' ? -valor : valor;
            } else if (diasUteis === 1) {
              saldos[accId].d1 += ordem.side === 'buy' ? -valor : valor;
            } else {
              saldos[accId].vencidos += ordem.side === 'buy' ? -valor : valor;
            }
          }
        }
        setSaldosFuturos(saldos);

        // ---- Carregar posição em LFTS11 ----
        try {
          const qLfts = query(collection(db, "posicoesDLL"), where("ticker", "==", "LFTS11"));
          const snapLfts = await getDocs(qLfts);
          const map: Record<string, number> = {};
          const positions: Record<string, { quantity: number; avgPrice: number }> = {};
          let totalValor = 0;
          let totalQty = 0;
          snapLfts.forEach((docSnap) => {
            const d = docSnap.data() as any;
            const quantity = Number(d.quantity) || 0;
            const avgPrice = Number(d.avgPrice) || 0;
            const valor = quantity * avgPrice;
            if (d.account_id) {
              map[d.account_id] = (map[d.account_id] || 0) + valor;
              positions[d.account_id] = { quantity, avgPrice };
            }
            totalValor += valor;
            totalQty += quantity;
          });
          setLftsValor(map);
          setLftsPositions(positions);
          if (totalQty > 0) {
            setLftsRefPrice(totalValor / totalQty);
          }
        } catch (err) {
          console.error("[SALDO] Erro ao buscar posição LFTS11:", err);
          setLftsValor({});
          setLftsPositions({});
        }

        // Atualizar saldo no Firebase se necessário
        for (const cli of lista) {
          const accId = cli.AccountID;
          const saldoOriginal = cli["Saldo Hoje"] ?? 0;
          const vencidos = saldos[accId]?.vencidos ?? 0;
          const saldoCalculado = saldoOriginal + vencidos;
          // Só atualiza se for diferente (considerando arredondamento de centavos)
          if (Math.abs(saldoCalculado - saldoOriginal) > 0.009) {
            try {
              await updateDoc(doc(db, "contasDll", cli._id), { "Saldo Hoje": saldoCalculado });
              console.log(`[SALDO] Saldo atualizado no Firebase para cliente ${accId}:`, saldoCalculado);
            } catch (err) {
              console.error(`[SALDO] Erro ao atualizar saldo no Firebase para cliente ${accId}:`, err);
            }
          }
        }
      } catch (err) {
        console.error("[SALDO] Erro ao buscar clientes ou ordens:", err);
        setClientes([]);
        setSaldosFuturos({});
      }
      setLoading(false);
    }
    fetchClientes();
  }, []);

  // Calcular totais consolidados (Conta Master) fora do useEffect, antes do return
  const master = {
    AccountID: 'MASTER',
    Nome: 'Conta Master',
    'Saldo Hoje': 0,
    d1: 0,
    d2: 0,
    lfts: 0,
  };
  for (const cli of clientes) {
    const accId = cli.AccountID;
    master['Saldo Hoje'] += (cli["Saldo Hoje"] ?? 0) + (saldosFuturos[accId]?.vencidos ?? 0);
    master.d1 += saldosFuturos[accId]?.d1 ?? 0;
    master.d2 += saldosFuturos[accId]?.d2 ?? 0;
    master.lfts += lftsValor[accId] ?? 0;
  }

  // ======================= Ajustar Caixa ========================
  async function handleAjustarCaixa(cliente: any, silent: boolean = false): Promise<string | null> {
    function notify(msg: string) {
      if (!silent) alert(msg);
    }
    const accId = cliente.AccountID;
    if (ajusteLoadingMap[accId]) return null; // já processando
    const saldoHojeAtual = (cliente["Saldo Hoje"] ?? 0) + (saldosFuturos[accId]?.vencidos ?? 0);
    const saldoD1 = saldosFuturos[accId]?.d1 ?? 0;
    const saldoProximoDia = saldoHojeAtual + saldoD1;

    const valorInvestido = Number(cliente["Valor Investido"] ?? 0);
    const pctMin = Number(cliente.PctSaldoMin ?? DEFAULT_PCT_MIN);
    const pctMax = Number(cliente.PctSaldoMax ?? DEFAULT_PCT_MAX);
    const minCaixa = valorInvestido * pctMin / 100;
    const maxCaixa = valorInvestido * pctMax / 100;

    // Critério: dentro da banda dinâmica
    if (saldoProximoDia >= minCaixa && saldoProximoDia <= maxCaixa) {
      const msg = `Conta ${accId}: Saldo projetado para D+1 dentro da faixa (${pctMin}%-${pctMax}%), nada a ajustar.`;
      notify(msg);
      return msg;
    }

    // Obter posição LFTS11
    let qtyPos = 0;
    let avgPrice = 0;
    try {
      const posSnap = await getDoc(doc(db, "posicoesDLL", `${accId}_LFTS11`));
      if (posSnap.exists()) {
        const d: any = posSnap.data();
        qtyPos = Number(d.quantity) || 0;
        avgPrice = Number(d.avgPrice) || 0;
      }
    } catch (err) {
      console.error(`[AJUSTE] Erro obtendo posição LFTS11 de ${accId}:`, err);
    }

    const precoRef = manualLftsPrice || avgPrice || lftsRefPrice;
    if (!precoRef || precoRef <= 0) {
      const msg = `Conta ${accId}: Preço de referência da LFTS11 inválido. Defina um valor válido e tente novamente.`;
      notify(msg);
      return msg;
    }
    let valorNecessario = 0;
    let side: "buy" | "sell" = "buy";
    if (saldoProximoDia < minCaixa) {
      side = "sell";
      valorNecessario = minCaixa - saldoProximoDia; // elevar até faixa mínima
    } else {
      side = "buy";
      valorNecessario = saldoProximoDia - maxCaixa; // reduzir até faixa máxima
    }

    let qty = Math.ceil(valorNecessario / precoRef);
    if (qty <= 0) {
      const msg = `Conta ${accId}: Quantidade calculada zero. Nenhuma ordem enviada.`;
      notify(msg);
      return msg;
    }
    if (side === "sell" && qty > qtyPos) {
      qty = qtyPos; // não vende mais do que possui
    }
    if (qty === 0) {
      const msg = `Conta ${accId}: Sem posição suficiente em LFTS11 para vender.`;
      notify(msg);
      return msg;
    }

    // Envio da ordem
    setAjusteLoadingMap((m) => ({ ...m, [accId]: true }));
    const payload = {
      account_id: accId,
      broker_id: Number(cliente.BrokerID ?? 0),
      ticker: "LFTS11",
      quantity: qty,
      price: -1,
      side,
      exchange: "B",
    };
    try {
      const res = await fetch("http://localhost:8000/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        const msg = `Conta ${accId}: Ordem enviada com sucesso.`;
        notify(msg);
        return msg;
      } else {
        const msgFail = `Conta ${accId}: Erro ao enviar ordem.`;
        notify(msgFail);
        return msgFail;
      }
    } catch (err) {
      console.error(`[AJUSTE] Erro enviando ordem para ${accId}:`, err);
      const msgConn = `Conta ${accId}: Erro de conexão com o backend.`;
      notify(msgConn);
      return msgConn;
    }
  }

  // Ajuste de caixa global
  async function handleAjustarCaixaGlobal() {
    if (globalAdjustLoading) return;
    setGlobalAdjustLoading(true);
    setAdjustSummary([]);
    const results: string[] = [];
    for (const cli of clientes) {
      if (cli.AccountID === 'MASTER') continue;
      const res = await handleAjustarCaixa(cli, true);
      if (res) results.push(res);
    }
    setGlobalAdjustLoading(false);
    setAdjustSummary(results);
  }

  // Buscar preço salvo em Firestore (config/lftsPrice)
  useEffect(() => {
    async function fetchLftsPrice() {
      try {
        const snap = await getDoc(doc(db, "config", "lftsPrice"));
        if (snap.exists()) {
          const v = Number(snap.data().value);
          if (!isNaN(v) && v > 0) {
            setManualLftsPrice(v);
          }
        }
      } catch (err) {
        console.error("[LFTS] Falha ao obter preço configurado:", err);
      }
    }
    fetchLftsPrice();
  }, []);

  // Se ainda não temos preço manual, usa média global quando esta for calculada
  useEffect(() => {
    if (manualLftsPrice === 0 && lftsRefPrice > 0) {
      setManualLftsPrice(lftsRefPrice);
    }
  }, [lftsRefPrice]);

  // Função para salvar preço manual no Firebase
  async function handleSavePrice() {
    if (!manualLftsPrice || manualLftsPrice <= 0) {
      alert("Digite um preço válido (> 0).");
      return;
    }
    setSavingPrice(true);
    try {
      await setDoc(doc(db, "config", "lftsPrice"), { value: manualLftsPrice, updatedAt: serverTimestamp() }, { merge: true });
      alert("Preço salvo com sucesso!");
    } catch (err) {
      console.error("[LFTS] Erro ao salvar preço:", err);
      alert("Falha ao salvar preço no Firebase.");
    }
    setSavingPrice(false);
  }

  return (
    <div style={{ width: '90%', margin: "40px auto", padding: 8, background: "#222", borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: "#fff", margin: 0, marginRight: 8 }}>Saldo dos Clientes</h2>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <FiHelpCircle
            size={22}
            color="#bbb"
            style={{ cursor: 'pointer' }}
            onMouseEnter={e => {
              const tooltip = document.getElementById('saldo-tooltip');
              if (tooltip) tooltip.style.display = 'block';
            }}
            onMouseLeave={e => {
              const tooltip = document.getElementById('saldo-tooltip');
              if (tooltip) tooltip.style.display = 'none';
            }}
          />
          <div
            id="saldo-tooltip"
            style={{
              display: 'none',
              position: 'absolute',
              left: 28,
              top: -8,
              background: '#222',
              color: '#fff',
              padding: '10px 16px',
              borderRadius: 8,
              boxShadow: '0 2px 8px #0008',
              zIndex: 100,
              width: 340,
              fontSize: 14,
              fontWeight: 400,
            }}
          >
            <b>Como o saldo é calculado?</b><br/>
            O saldo disponível é atualizado automaticamente todos os dias úteis, somando ou subtraindo as ordens que vencem em D+1 e D+2. Quando uma ordem vence, seu valor é incorporado ao saldo disponível. Os campos D+1 e D+2 mostram valores de ordens que ainda vão vencer nos próximos dias úteis.
          </div>
        </div>
        {/* Label e Input de preço LFTS11 */}
        <span style={{ color: '#fff', marginLeft: 16 }}>Preço LFTS11:</span>
        <input
          type="number"
          step="0.01"
          value={manualLftsPrice}
          onChange={e => setManualLftsPrice(Number(e.target.value))}
          style={{ width: 100, marginLeft: 6, padding: '6px 8px', background: '#181818', color: '#fff', border: '1px solid #444', borderRadius: 4 }}
          title="Preço de referência da LFTS11"
        />
        <button
          onClick={handleSavePrice}
          disabled={savingPrice}
          style={{ marginLeft: 6, padding: '6px 10px', background: '#0ea5e9', color: '#fff', border: 0, borderRadius: 4, cursor: savingPrice ? 'default' : 'pointer' }}
        >
          {savingPrice ? 'Salvando...' : 'Salvar'}
        </button>
        <button
          onClick={handleAjustarCaixaGlobal}
          disabled={globalAdjustLoading}
          style={{ marginLeft: 12, padding: '6px 12px', background: '#16a34a', color: '#fff', border: 0, borderRadius: 4, cursor: globalAdjustLoading ? 'default' : 'pointer' }}
        >
          {globalAdjustLoading ? 'Ajustando...' : 'Ajustar caixa (todas)'}
        </button>
      </div>
      {adjustSummary.length > 0 && (
        <div style={{ background: '#1e293b', color: '#fff', padding: 12, marginBottom: 16, borderRadius: 8 }}>
          <b>Resultado do ajuste:</b>
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {adjustSummary.map((m, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <table style={{ width: "100%", color: "#fff", background: "#181818", borderRadius: 8, padding: 0 }}>
        <thead>
          <tr style={{ background: '#333' }}>
            <th style={{ padding: 10 }}>Nome</th>
            <th style={{ padding: 10 }}>Conta</th>
            <th style={{ padding: 10 }}>Valor Investido</th>
            <th style={{ padding: 10 }}>Saldo Hoje</th>
            <th style={{ padding: 10 }}>LFTS11</th>
            <th style={{ padding: 10 }}>Saldo D+1</th>
            <th style={{ padding: 10 }}>Saldo D+2</th>
            <th style={{ padding: 10 }}>% Min</th>
            <th style={{ padding: 10 }}>% Max</th>
            <th style={{ padding: 10 }}>Editar</th>
          </tr>
        </thead>
        <tbody>
          {/* Linha Conta Master */}
          <tr style={{ background: '#0ea5e9', color: '#fff', fontWeight: 700 }}>
            <td style={{ padding: 10 }}>Conta Master</td>
            <td style={{ padding: 10, textAlign: 'center' }}>MASTER</td>
            <td style={{ padding: 10, textAlign: 'center' }}>-</td>
            <td style={{ padding: 10, textAlign: 'center' }}>{master['Saldo Hoje'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style={{ padding: 10, textAlign: 'center' }}>{master.lfts.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style={{ padding: 10, textAlign: 'center' }}>{master.d1.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style={{ padding: 10, textAlign: 'center' }}>{master.d2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            <td style={{ padding: 10, textAlign: 'center' }}>-</td>
            <td style={{ padding: 10, textAlign: 'center' }}>-</td>
            <td style={{ padding: 10, textAlign: 'center' }}>-</td>
          </tr>
          {/* Demais contas */}
          {loading ? (
            <tr><td colSpan={7} style={{ color: '#fff', textAlign: 'center', padding: 20 }}>Carregando...</td></tr>
          ) : clientes.length === 0 ? (
            <tr><td colSpan={7} style={{ color: '#fff', textAlign: 'center', padding: 20 }}>Nenhum cliente encontrado.</td></tr>
          ) : (
            clientes.map((item, idx) => {
              const baseSaldo = (item["Saldo Hoje"] ?? 0) + (saldosFuturos[item.AccountID]?.vencidos ?? 0);
              const projD1 = baseSaldo + (saldosFuturos[item.AccountID]?.d1 ?? 0);
              let bg = '#222';
              if (baseSaldo < 0) {
                bg = '#7f1d1d'; // vermelho
              } else if (projD1 < 0) {
                bg = '#78350f'; // laranja
              }
              return (
                <tr key={item._id || idx} style={{ background: bg, borderBottom: '1px solid #333' }}>
                  <td style={{ padding: 10, textAlign: 'left' }}>{item["Nome Cliente"] || "-"}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>{item.AccountID || "-"}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(item["Valor Investido"] ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(() => {
                      const base = item["Saldo Hoje"] ?? 0;
                      const vencidos = saldosFuturos[item.AccountID]?.vencidos ?? 0;
                      return (base + vencidos).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    })()}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(lftsValor[item.AccountID] ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {saldosFuturos[item.AccountID] && typeof saldosFuturos[item.AccountID].d1 === 'number'
                      ? saldosFuturos[item.AccountID].d1.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : (item["Saldo D+1"] !== undefined
                          ? item["Saldo D+1"].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : "")}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {saldosFuturos[item.AccountID] && typeof saldosFuturos[item.AccountID].d2 === 'number'
                      ? saldosFuturos[item.AccountID].d2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                      : (item["Saldo D+2"] !== undefined
                          ? item["Saldo D+2"].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          : "")}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(item.PctSaldoMin ?? DEFAULT_PCT_MIN).toFixed(1)}%
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(item.PctSaldoMax ?? DEFAULT_PCT_MAX).toFixed(1)}%
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    <button 
                      title="Editar conta" 
                      onClick={() => { 
                        setEditIdx(idx); 
                        const accountId = item.AccountID;
                        const position = lftsPositions[accountId] || { quantity: 0, avgPrice: 0 };
                        setEditValues({ 
                          "Saldo Hoje": item["Saldo Hoje"], 
                          "Saldo D+1": item["Saldo D+1"], 
                          "Saldo D+2": item["Saldo D+2"], 
                          PctSaldoMin: item.PctSaldoMin ?? DEFAULT_PCT_MIN, 
                          PctSaldoMax: item.PctSaldoMax ?? DEFAULT_PCT_MAX,
                          quantity: position.quantity, 
                          avgPrice: position.avgPrice 
                        }); 
                        setModalOpen(true); 
                      }} 
                      style={{ marginRight: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#0ea5e9' }}
                    >
                      <FiEdit2 size={16} />
                    </button>
                    <button title={ajusteLoadingMap[item.AccountID] ? 'Processando...' : 'Ajustar caixa'} onClick={() => handleAjustarCaixa(item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#facc15' }}>
                      <FiDollarSign size={16} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <EditSaldoModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditIdx(null); setEditValues({}); }}
        loading={editLoading}
        onSave={async () => {
          if (editIdx !== null) {
            setEditLoading(true);
            try {
              const cliente = clientes[editIdx];
              const accountId = cliente.AccountID;
              const clienteDocId = cliente._id;
              
              // ========== SALVAR DADOS DE SALDO ==========
              const saldoUpdateData: any = {
                updatedAt: new Date().toISOString(),
              };
              if (editValues["Saldo Hoje"] !== undefined) saldoUpdateData["Saldo Hoje"] = editValues["Saldo Hoje"];
              if (editValues["Saldo D+1"] !== undefined) saldoUpdateData["Saldo D+1"] = editValues["Saldo D+1"];
              if (editValues["Saldo D+2"] !== undefined) saldoUpdateData["Saldo D+2"] = editValues["Saldo D+2"];
              if (editValues.PctSaldoMin !== undefined) saldoUpdateData.PctSaldoMin = editValues.PctSaldoMin;
              if (editValues.PctSaldoMax !== undefined) saldoUpdateData.PctSaldoMax = editValues.PctSaldoMax;

              await updateDoc(doc(db, "contasDll", clienteDocId), saldoUpdateData);

              // ========== SALVAR DADOS DE LFTS11 ==========
              // Validação dos dados de LFTS11
              if (editValues.quantity !== undefined && editValues.quantity < 0) {
                alert("Por favor, insira uma quantidade válida (maior ou igual a 0).");
                setEditLoading(false);
                return;
              }
              
              if (editValues.quantity > 0 && (!editValues.avgPrice || editValues.avgPrice <= 0)) {
                alert("Por favor, insira um preço médio válido (maior que 0).");
                setEditLoading(false);
                return;
              }

              const lftsDocId = `${accountId}_LFTS11`;
              
              if (editValues.quantity !== undefined && editValues.avgPrice !== undefined) {
                const positionData = {
                  account_id: accountId,
                  ticker: "LFTS11",
                  quantity: editValues.quantity,
                  avgPrice: editValues.avgPrice,
                  updatedAt: serverTimestamp(),
                };

                // Se a quantidade for 0, remove a posição; caso contrário, cria/atualiza
                if (editValues.quantity === 0) {
                  const posRef = doc(db, "posicoesDLL", lftsDocId);
                  const posSnap = await getDoc(posRef);
                  if (posSnap.exists()) {
                    await updateDoc(posRef, { quantity: 0 });
                  }
                } else {
                  await setDoc(doc(db, "posicoesDLL", lftsDocId), positionData, { merge: true });
                }

                // Atualiza os estados locais de LFTS11
                const newPositions = { ...lftsPositions };
                const newValores = { ...lftsValor };
                
                if (editValues.quantity === 0) {
                  delete newPositions[accountId];
                  newValores[accountId] = 0;
                } else {
                  newPositions[accountId] = { 
                    quantity: editValues.quantity, 
                    avgPrice: editValues.avgPrice 
                  };
                  newValores[accountId] = editValues.quantity * editValues.avgPrice;
                }
                
                setLftsPositions(newPositions);
                setLftsValor(newValores);
              }

              // Atualiza os dados do cliente no estado local
              const novosClientes = [...clientes];
              novosClientes[editIdx] = {
                ...novosClientes[editIdx],
                "Saldo Hoje": editValues["Saldo Hoje"],
                "Saldo D+1": editValues["Saldo D+1"],
                "Saldo D+2": editValues["Saldo D+2"],
                PctSaldoMin: editValues.PctSaldoMin,
                PctSaldoMax: editValues.PctSaldoMax,
              };
              setClientes(novosClientes);
              
              alert("Dados atualizados com sucesso!");
              setModalOpen(false);
              setEditIdx(null);
              setEditValues({});
            } catch (err: any) {
              console.error("Erro ao atualizar dados:", err);
              alert("Erro ao atualizar dados: " + (err?.message || "Erro desconhecido"));
            } finally {
              setEditLoading(false);
            }
          }
        }}
        values={editValues}
        setValues={setEditValues}
      />
    </div>
  );
} 