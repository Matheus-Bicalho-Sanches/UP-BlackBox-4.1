"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, setDoc, updateDoc, doc, serverTimestamp, collection as fbCollection, query, where, Timestamp, addDoc } from "firebase/firestore";
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

interface SaldoLogChange {
  field: string;
  before: number;
  after: number;
  format: "currency" | "percent" | "quantity";
}

function EditSaldoModal({ isOpen, onClose, onSave, values, setValues, displayValues, setDisplayValues, loading, clientName, clientAccountId, indicators }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#222] rounded-lg p-6 w-full max-w-lg">
        <h3 className="text-xl font-bold text-white mb-4">
          Editar Conta
          {clientName || clientAccountId ? (
            <>
              {` — ${clientName || ''}`}
              {clientAccountId ? ` (${clientAccountId})` : ''}
            </>
          ) : null}
        </h3>
        <div className="space-y-4">
          {/* Seção de Saldos */}
          <div className="border-b border-gray-600 pb-4">
            <h4 className="text-lg font-semibold text-white mb-3">Saldos</h4>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-gray-300 mb-1">Saldo Hoje</label>
                <input
                  type="text"
                  value={displayValues["Saldo Hoje"]}
                  onChange={e => {
                    const inputValue = e.target.value;
                    const normalized = inputValue.replace(/\./g, ',');
                    setDisplayValues((v: any) => ({ ...v, "Saldo Hoje": normalized }));
                    // parse estilo pt-BR: remove milhares e troca vírgula por ponto
                    const numericValue = parseFloat(inputValue.replace(/\./g, '').replace(',', '.')) || 0;
                    setValues((v: any) => ({ ...v, "Saldo Hoje": numericValue }));
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                />
                {values && (
                  <p className="text-gray-400 text-xs mt-1">
                    Projetado D+1: {(Number(values["Saldo Hoje"] || 0) + Number(values["Saldo D+1"] || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Saldo D+1</label>
                <input
                  type="text"
                  value={displayValues["Saldo D+1"]}
                  onChange={e => {
                    const inputValue = e.target.value;
                    const normalized = inputValue.replace(/\./g, ',');
                    setDisplayValues((v: any) => ({ ...v, "Saldo D+1": normalized }));
                    // Converter pt-BR para número
                    const numericValue = parseFloat(inputValue.replace(/\./g, '').replace(',', '.')) || 0;
                    setValues((v: any) => ({ ...v, "Saldo D+1": numericValue }));
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                />
                {indicators && (
                  <p className="text-gray-400 text-xs mt-1">
                    Calculado: {Number(indicators.calcD1 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {" • "}
                    Ajuste manual: {Number(indicators.ajusteD1 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {" • "}
                    Final: {Number(values["Saldo D+1"] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Saldo D+2</label>
                <input
                  type="text"
                  value={displayValues["Saldo D+2"]}
                  onChange={e => {
                    const inputValue = e.target.value;
                    const normalized = inputValue.replace(/\./g, ',');
                    setDisplayValues((v: any) => ({ ...v, "Saldo D+2": normalized }));
                    // Converter pt-BR para número
                    const numericValue = parseFloat(inputValue.replace(/\./g, '').replace(',', '.')) || 0;
                    setValues((v: any) => ({ ...v, "Saldo D+2": numericValue }));
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                />
                {indicators && (
                  <p className="text-gray-400 text-xs mt-1">
                    Calculado: {Number(indicators.calcD2 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {" • "}
                    Ajuste manual: {Number(indicators.ajusteD2 || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    {" • "}
                    Final: {Number(values["Saldo D+2"] || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-300 mb-1">% Min Caixa</label>
                  <input
                    type="text"
                    value={displayValues.PctSaldoMin}
                    onChange={e => {
                      const inputValue = e.target.value;
                      const normalized = inputValue.replace(/\./g, ',');
                      setDisplayValues((v: any) => ({ ...v, PctSaldoMin: normalized }));
                      // Converter pt-BR para número
                      const numericValue = parseFloat(inputValue.replace(/\./g, '').replace(',', '.')) || 0;
                      setValues((v: any) => ({ ...v, PctSaldoMin: numericValue }));
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-1">% Max Caixa</label>
                  <input
                    type="text"
                    value={displayValues.PctSaldoMax}
                    onChange={e => {
                      const inputValue = e.target.value;
                      const normalized = inputValue.replace(/\./g, ',');
                      setDisplayValues((v: any) => ({ ...v, PctSaldoMax: normalized }));
                      // Converter pt-BR para número
                      const numericValue = parseFloat(inputValue.replace(/\./g, '').replace(',', '.')) || 0;
                      setValues((v: any) => ({ ...v, PctSaldoMax: numericValue }));
                    }}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção de LFTS11 */}
          <div>
            <h4 className="text-lg font-semibold text-white mb-3">LFTS11</h4>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-gray-300 mb-1">Quantidade</label>
                <input
                  type="text"
                  value={displayValues.quantity}
                  onChange={e => {
                    const inputValue = e.target.value;
                    setDisplayValues((v: any) => ({ ...v, quantity: inputValue }));
                    
                    // Converter para number apenas quando necessário
                    const numericValue = parseInt(inputValue) || 0;
                    setValues((v: any) => ({ ...v, quantity: numericValue }));
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="Ex: 1000"
                />
              </div>
              <div>
                <label className="block text-gray-300 mb-1">Preço Médio (Fixo)</label>
                <input
                  type="number"
                  step="0.01"
                  value={values.avgPrice ?? ""}
                  disabled
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-400 cursor-not-allowed"
                  placeholder="Preço fixo do sistema"
                />
                <p className="text-gray-400 text-xs mt-1">
                  O preço médio é fixo e igual ao preço LFTS11 definido no sistema.
                </p>
              </div>
            </div>
            {values.quantity && values.avgPrice && (
              <div className="bg-gray-800 p-3 rounded-md mt-3">
                <p className="text-gray-300 text-sm">
                  <strong>Valor Total LFTS11:</strong> {(values.quantity * values.avgPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  <strong>Nota:</strong> Apenas a quantidade pode ser ajustada manualmente. O preço médio é fixo.
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
  const [editDisplayValues, setEditDisplayValues] = useState<{
    "Saldo Hoje": string;
    "Saldo D+1": string;
    "Saldo D+2": string;
    PctSaldoMin: string;
    PctSaldoMax: string;
    quantity: string;
    avgPrice: string;
  }>({
    "Saldo Hoje": "",
    "Saldo D+1": "",
    "Saldo D+2": "",
    PctSaldoMin: "",
    PctSaldoMax: "",
    quantity: "",
    avgPrice: ""
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [lftsPositions, setLftsPositions] = useState<Record<string, { quantity: number; avgPrice: number }>>({});
  const [saldosFuturos, setSaldosFuturos] = useState<any>({});
  const [lftsValor, setLftsValor] = useState<Record<string, number>>({});

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
  // Seleção de contas para ajuste em massa
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const { user } = useAuth();

  function toggleSelectAccount(accountId: string) {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = clientes
      .filter((c: any) => c?.AccountID && c.AccountID !== 'MASTER')
      .map((c: any) => c.AccountID as string);
    setSelectedAccounts((prev) => {
      const allSelected = selectable.length > 0 && selectable.every((id) => prev.has(id));
      if (allSelected) return new Set();
      const next = new Set(prev);
      selectable.forEach((id) => next.add(id));
      return next;
    });
  }

  // ===== FASE 1: Estados para Atualização Manual de Saldos =====
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>("");
  const [atualizandoSaldos, setAtualizandoSaldos] = useState(false);
  const [podeAtualizar, setPodeAtualizar] = useState(true);

  useEffect(() => {
    async function fetchClientes() {
      setLoading(true);
      try {
        // Primeiro, carregar o preço LFTS11 do Firebase
        let precoLftsCarregado = 0;
        try {
          const snap = await getDoc(doc(db, "config", "lftsPrice"));
          if (snap.exists()) {
            const v = Number(snap.data().value);
            if (!isNaN(v) && v > 0) {
              precoLftsCarregado = v;
              setManualLftsPrice(v);
              console.log(`[LFTS] Preço carregado do Firebase: R$ ${v}`);
            } else {
              console.log(`[LFTS] Preço no Firebase inválido: ${v}`);
            }
          } else {
            console.log(`[LFTS] Nenhum preço encontrado no Firebase`);
          }
        } catch (err) {
          console.error("[LFTS] Falha ao obter preço configurado:", err);
        }

        // Busca clientes
        // OTIMIZAÇÃO FASE 1: Query de ordens otimizada para buscar apenas dados dos últimos 6 dias
        // Isso reduz drasticamente o tempo de carregamento e custos do Firebase
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

        // ===== OTIMIZAÇÃO FASE 1: Query otimizada para buscar apenas ordens dos últimos 6 dias =====
        // Considerando que ordens têm prazo máximo de D+2, 6 dias são suficientes para cobrir feriados/finais de semana
        const hoje = new Date();
        hoje.setHours(0,0,0,0);
        
        // Calcula data limite: 6 dias atrás para garantir cobertura de feriados/finais de semana
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - 6);
        dataLimite.setHours(0,0,0,0);
        
        console.log(`[SALDO] Buscando ordens executadas a partir de: ${dataLimite.toISOString()}`);
        
        // Query otimizada: apenas ordens executadas dos últimos 6 dias
        const qOrdens = query(
          collection(db, "ordensDLL"),
          where("createdAt", ">=", dataLimite.toISOString()),
          where("TradedQuantity", ">", 0) // Apenas ordens que foram executadas (total ou parcialmente)
        );
        
        const ordensSnap = await getDocs(qOrdens);
        const ordensAll = ordensSnap.docs.map(doc => doc.data());
        
        console.log(`[SALDO] Encontradas ${ordensAll.length} ordens executadas nos últimos 6 dias`);
        
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
        
        console.log(`[SALDO] Processamento concluído: ${Object.keys(saldos).length} contas processadas`);
        setSaldosFuturos(saldos);

        // ---- Carregar posição em LFTS11 (com ajustes manuais) ----
        try {
          const qLfts = query(collection(db, "posicoesDLL"), where("ticker", "==", "LFTS11"));
          const snapLfts = await getDocs(qLfts);
          const map: Record<string, number> = {};
          const positions: Record<string, { quantity: number; avgPrice: number }> = {};
          let totalValor = 0;
          let totalQty = 0;
          
          // Primeiro, carrega as posições calculadas do Firebase
          const posicoesCalculadas: Record<string, { quantity: number; avgPrice: number }> = {};
          snapLfts.forEach((docSnap) => {
            const d = docSnap.data() as any;
            const quantity = Number(d.quantity) || 0;
            const avgPrice = Number(d.avgPrice) || 0;
            if (d.account_id) {
              posicoesCalculadas[d.account_id] = { quantity, avgPrice };
            }
          });
          
          // Depois, aplica os ajustes manuais de cada cliente
          for (const cli of lista) {
            const accId = cli.AccountID;
            const posicaoCalculada = posicoesCalculadas[accId] || { quantity: 0, avgPrice: 0 };
            const ajusteQuantity = cli["AjusteQuantityLFTS11"] ?? 0;
            
            // Calcula posição final (calculada + ajuste)
            const quantityFinal = posicaoCalculada.quantity + ajusteQuantity;
            
            // USAR O PREÇO CARREGADO DO FIREBASE
            const avgPriceToUse = precoLftsCarregado || 0;
            console.log(`[LFTS11] Preço sendo usado para ${accId}: R$ ${avgPriceToUse}`);
            
            const valor = quantityFinal * avgPriceToUse;
            
            map[accId] = valor;
            positions[accId] = { quantity: quantityFinal, avgPrice: avgPriceToUse };
            
            totalValor += valor;
            totalQty += quantityFinal;
            
            console.log(`[LFTS11] Conta ${accId}:`, {
              calculado: posicaoCalculada,
              ajusteQuantity,
              final: { quantity: quantityFinal, avgPrice: avgPriceToUse },
              valor
            });
          }
          
          setLftsValor(map);
          setLftsPositions(positions);
        } catch (err) {
          console.error("[SALDO] Erro ao buscar posição LFTS11:", err);
          setLftsValor({});
          setLftsPositions({});
        }

        // NOTA: Removida a atualização automática do saldo no Firebase para evitar mudanças indesejadas
        // O saldo é calculado apenas para exibição na tela, sem modificar o valor salvo no Firebase
        // Para atualizar o saldo, use o botão de editar (ícone de lápis) na tabela

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
    master['Saldo Hoje'] += cli["Saldo Hoje"] ?? 0;
    
    // Saldo D+1 final (calculado + ajuste manual)
    const saldoD1Calculado = saldosFuturos[accId]?.d1 ?? 0;
    const ajusteD1 = cli["AjusteSaldoD1"] ?? 0;
    const saldoD1Final = saldoD1Calculado + ajusteD1;
    
    // Saldo D+2 final (calculado + ajuste manual)
    const saldoD2Calculado = saldosFuturos[accId]?.d2 ?? 0;
    const ajusteD2 = cli["AjusteSaldoD2"] ?? 0;
    const saldoD2Final = saldoD2Calculado + ajusteD2;
    
    master.d1 += saldoD1Final;
    master.d2 += saldoD2Final;
    master.lfts += lftsValor[accId] ?? 0;
  }

  // ======================= Ajustar Caixa ========================
  async function handleAjustarCaixa(cliente: any, silent: boolean = false): Promise<string | null> {
    function notify(msg: string) {
      if (!silent) alert(msg);
    }
    const accId = cliente.AccountID;
    if (ajusteLoadingMap[accId]) return null; // já processando
    
    // Saldo hoje atual (apenas o valor do Firebase, sem somar ordens vencidas)
    const saldoHojeAtual = cliente["Saldo Hoje"] ?? 0;
    
    // Saldo D+1 final (calculado + ajuste manual)
    const saldoD1Calculado = saldosFuturos[accId]?.d1 ?? 0;
    const ajusteD1 = cliente["AjusteSaldoD1"] ?? 0;
    const saldoD1Final = saldoD1Calculado + ajusteD1;
    
    // Saldo projetado para o próximo dia (hoje + D+1 final)
    const saldoProximoDia = saldoHojeAtual + saldoD1Final;

    // Log para debug - mostra os valores considerados no cálculo
    console.log(`[AJUSTE] Conta ${accId} - Cálculo do saldo projetado:`, {
      saldoHojeAtual,
      saldoD1Calculado,
      ajusteD1,
      saldoD1Final,
      saldoProximoDia,
      saldoHojeFirebase: cliente["Saldo Hoje"] ?? 0,
      ordensVencidas: saldosFuturos[accId]?.vencidos ?? 0
    });

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

    // Obter posição LFTS11 (calculada + ajuste manual)
    let qtyPos = 0;
    try {
      // Buscar posição calculada do Firebase
      const posSnap = await getDoc(doc(db, "posicoesDLL", `${accId}_LFTS11`));
      let posicaoCalculada = { quantity: 0, avgPrice: 0 };
      if (posSnap.exists()) {
        const d: any = posSnap.data();
        posicaoCalculada = {
          quantity: Number(d.quantity) || 0,
          avgPrice: Number(d.avgPrice) || 0
        };
      }
      
      // Aplicar ajustes manuais (apenas quantidade)
      const ajusteQuantity = cliente["AjusteQuantityLFTS11"] ?? 0;
      
      qtyPos = posicaoCalculada.quantity + ajusteQuantity;
      
      console.log(`[AJUSTE] Posição LFTS11 - Conta ${accId}:`, {
        calculado: posicaoCalculada,
        ajusteQuantity,
        final: { quantity: qtyPos, avgPrice: manualLftsPrice || 0 }
      });
      
    } catch (err) {
      console.error(`[AJUSTE] Erro obtendo posição LFTS11 de ${accId}:`, err);
    }

    const precoRef = manualLftsPrice || 0;
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
    
    // Log de debug para verificar a determinação do side
    console.log(`[SIDE] Determinação da operação:`, {
      saldoProximoDia,
      minCaixa,
      maxCaixa,
      saldoProximoDiaMenorQueMin: saldoProximoDia < minCaixa,
      side,
      valorNecessario
    });

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

    // DUPLA VERIFICAÇÃO ANTES DE ENVIAR A ORDEM
    const nomeCliente = cliente["Nome Cliente"] || accId;
    const valorOperacao = qty * precoRef;
    const operacao = side === "buy" ? "COMPRAR" : "VENDER";
    
    // Valor com sinal correto para fluxo de caixa
    const valorFluxoCaixa = side === "buy" ? -valorOperacao : valorOperacao;
    
    // Log de debug para verificar os valores
    console.log(`[CONFIRMAÇÃO] Debug valores:`, {
      side,
      operacao,
      qty,
      precoRef,
      valorOperacao,
      valorFluxoCaixa,
      saldoProximoDia,
      minCaixa,
      maxCaixa
    });
    
    const mensagemConfirmacao = `CONFIRMAR AJUSTE DE CAIXA?\n\n` +
      `Cliente: ${nomeCliente}\n` +
      `Conta: ${accId}\n` +
      `Operação: ${operacao} ${qty} unidades de LFTS11\n` +
      `Preço: R$ ${precoRef.toFixed(2)}\n` +
      `Valor Total: R$ ${valorFluxoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
      `Saldo Projetado: R$ ${saldoProximoDia.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
      `Faixa Ideal: R$ ${minCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - R$ ${maxCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
      `Deseja confirmar esta operação?`;
    
    if (!silent) {
      const confirmacao = window.confirm(mensagemConfirmacao);
      if (!confirmacao) {
        const msg = `Operação cancelada pelo usuário.`;
        notify(msg);
        return msg;
      }
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
      const res = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URL}/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        // NOVA LÓGICA: Se vendeu toda a posição, zerar ajuste manual automaticamente
        if (side === "sell" && qty >= qtyPos) {
          try {
            await updateDoc(doc(db, "contasDll", cliente._id), {
              "AjusteQuantityLFTS11": 0,
              "AjusteAvgPriceLFTS11": 0
            });
            console.log(`[AJUSTE] ✅ Ajuste manual zerado automaticamente para ${accId} - venda total de ${qty} unidades`);
          } catch (err) {
            console.error(`[AJUSTE] ❌ Erro ao zerar ajuste manual para ${accId}:`, err);
          }
        }
        
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

  // Ajuste de caixa em massa - apenas contas selecionadas, com confirmação
  async function handleAjustarCaixaEmMassa() {
    if (globalAdjustLoading) return;
    if (selectedAccounts.size === 0) {
      alert("Selecione ao menos uma conta para ajustar.");
      return;
    }

    // Confirmação única antes de executar em massa
    const num = selectedAccounts.size;
    const preco = manualLftsPrice || 0;
    const msgConf = `Você está prestes a ajustar o caixa de ${num} conta(s) usando LFTS11.\n` +
      `Preço de referência atual: R$ ${preco.toFixed(2)}.\n\n` +
      `Deseja continuar?`;
    const ok = window.confirm(msgConf);
    if (!ok) return;

    setGlobalAdjustLoading(true);
    setAdjustSummary([]);
    const results: string[] = [];
    for (const cli of clientes) {
      if (!selectedAccounts.has(cli.AccountID)) continue;
      if (cli.AccountID === 'MASTER') continue;
      const res = await handleAjustarCaixa(cli, true);
      if (res) results.push(res);
    }
    setGlobalAdjustLoading(false);
    setAdjustSummary(results);
  }



  // Se ainda não temos preço manual, usa média global quando esta for calculada


  // ===== FASE 1: Carregar última atualização ao montar componente =====
  useEffect(() => {
    carregarUltimaAtualizacao();
  }, []);

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

  // ===== FASE 1: Funções para Atualização Manual de Saldos =====
  
  // Função para obter a última data de atualização do Firebase
  async function getUltimaDataAtualizacao(): Promise<string> {
    try {
      const docRef = doc(db, "config", "ultimaAtualizacaoSaldos");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data().ultimaData || "";
      }
      return "";
    } catch (error) {
      console.error("[ATUALIZAÇÃO] Erro ao buscar última atualização:", error);
      return "";
    }
  }

  // Função para validar se já foi atualizado hoje
  async function verificarDuplicacao(): Promise<boolean> {
    const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const ultimaData = await getUltimaDataAtualizacao();
    
    if (ultimaData === hoje) {
      const confirmar = window.confirm(
        "Já foi atualizado hoje. Deseja forçar nova atualização?"
      );
      return confirmar;
    }
    return true;
  }

  // Função para validar horário (19:00)
  function validarHorario(): boolean {
    const agora = new Date();
    const horaBrasilia = new Date(agora.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    const hora = horaBrasilia.getHours();
    const minutos = horaBrasilia.getMinutes();
    
    // Converte para minutos desde meia-noite para facilitar comparação
    const minutosAtuais = hora * 60 + minutos;
    const minutosLimite = 19 * 60; // 19:00 = 1140 minutos
    
    if (minutosAtuais < minutosLimite) {
      const confirmar = window.confirm(
        `Ainda não são 19:00 (atual: ${hora.toString().padStart(2, '0')}:${minutos.toString().padStart(2, '0')}). Deseja atualizar mesmo assim?`
      );
      return confirmar;
    }
    return true;
  }

  // Função para carregar última atualização
  async function carregarUltimaAtualizacao() {
    try {
      const docRef = doc(db, "config", "ultimaAtualizacaoSaldos");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const ultimaData = new Date(data.ultimaAtualizacao);
        const formato = ultimaData.toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        setUltimaAtualizacao(formato);
      }
    } catch (error) {
      console.error("[ÚLTIMA ATUALIZAÇÃO] Erro:", error);
    }
  }

  // ===== FASE 1: Função principal de atualização de saldos =====
  async function handleAtualizarSaldos() {
    setAtualizandoSaldos(true);
    
    try {
      console.log("[ATUALIZAÇÃO] Iniciando processo de atualização de saldos");
      
      // 1. Validar permissões
      const podeDuplicar = await verificarDuplicacao();
      const podeHorario = validarHorario();
      
      if (!podeDuplicar || !podeHorario) {
        console.log("[ATUALIZAÇÃO] Atualização cancelada pelo usuário");
        setAtualizandoSaldos(false);
        return;
      }
      
      // 2. Executar atualização para cada conta
      let contasAtualizadas = 0;
      
      for (const cliente of clientes) {
        // Usar a mesma lógica da coluna D+1 da tabela (calculado + ajuste)
        const saldoD1Calculado = saldosFuturos[cliente.AccountID]?.d1 ?? 0;
        const ajusteD1 = cliente["AjusteSaldoD1"] ?? 0;
        const saldoD1Final = saldoD1Calculado + ajusteD1;
        const saldoHojeAtual = cliente["Saldo Hoje"] ?? 0;
        const novoSaldoHoje = saldoHojeAtual + saldoD1Final;
        
        console.log(`[ATUALIZAÇÃO] Conta ${cliente.AccountID}:`, {
          saldoHojeAtual,
          saldoD1Calculado,
          ajusteD1,
          saldoD1Final,
          novoSaldoHoje
        });
        
        await updateDoc(doc(db, "contasDll", cliente._id), {
          "Saldo Hoje": novoSaldoHoje,
          updatedAt: new Date().toISOString()
        });
        
        contasAtualizadas++;
      }
      
      // 3. Salvar registro da atualização
      const hoje = new Date().toISOString().split('T')[0];
      await setDoc(doc(db, "config", "ultimaAtualizacaoSaldos"), {
        ultimaData: hoje,
        ultimaAtualizacao: new Date().toISOString(),
        proximaAtualizacao: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        totalContasAtualizadas: contasAtualizadas
      }, { merge: true });
      
      // 4. Atualizar estado local
      await carregarUltimaAtualizacao();
      
      // 5. Recarregar dados dos clientes (chama o useEffect)
      setLoading(true);
      const querySnapshot = await getDocs(collection(db, "contasDll"));
      const lista: any[] = [];
      querySnapshot.forEach((docSnap) => {
        lista.push({ ...docSnap.data(), _id: docSnap.id });
      });
      lista.sort((a, b) => {
        const nomeA = (a["Nome Cliente"] || a.AccountID || "").toUpperCase();
        const nomeB = (b["Nome Cliente"] || b.AccountID || "").toUpperCase();
        return nomeA.localeCompare(nomeB, 'pt-BR');
      });
      setClientes(lista);
      setLoading(false);
      
      console.log(`[ATUALIZAÇÃO] Processo concluído: ${contasAtualizadas} contas atualizadas`);
      alert(`Saldos atualizados com sucesso! ${contasAtualizadas} contas processadas.`);
      
    } catch (error) {
      console.error("[ATUALIZAÇÃO] Erro:", error);
      alert("Erro ao atualizar saldos. Verifique o console.");
    } finally {
      setAtualizandoSaldos(false);
    }
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
          onClick={handleAjustarCaixaEmMassa}
          disabled={globalAdjustLoading || selectedAccounts.size === 0}
          style={{ marginLeft: 12, padding: '6px 12px', background: '#16a34a', color: '#fff', border: 0, borderRadius: 4, cursor: (globalAdjustLoading || selectedAccounts.size === 0) ? 'default' : 'pointer' }}
          title={selectedAccounts.size === 0 ? 'Selecione contas para ajustar' : `Ajustar ${selectedAccounts.size} conta(s)`}
        >
          {globalAdjustLoading ? 'Ajustando...' : 'Ajustar caixa em massa'}
        </button>
        <span style={{ marginLeft: 8, color: '#9ca3af', fontSize: 14 }}>Selecionadas: {selectedAccounts.size}</span>
        {/* ===== FASE 1: Botão de Atualização de Saldos ===== */}
        <button
          onClick={handleAtualizarSaldos}
          disabled={atualizandoSaldos}
          style={{ 
            marginLeft: 12, 
            padding: '6px 12px', 
            background: podeAtualizar ? '#dc2626' : '#059669', 
            color: '#fff', 
            border: 0, 
            borderRadius: 4, 
            cursor: atualizandoSaldos ? 'default' : 'pointer' 
          }}
          title="Atualizar saldo hoje de todas as contas (Saldo Hoje += Saldo D+1)"
        >
          {atualizandoSaldos ? 'Atualizando...' : 'Atualizar Saldos'}
        </button>
        {ultimaAtualizacao && (
          <span style={{ marginLeft: 12, color: '#9ca3af', fontSize: 14 }}>
            Última: {ultimaAtualizacao}
          </span>
        )}
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
            <th style={{ padding: 10, width: 36, textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={
                  clientes.filter((c: any) => c?.AccountID && c.AccountID !== 'MASTER').length > 0 &&
                  clientes.filter((c: any) => c?.AccountID && c.AccountID !== 'MASTER').every((c: any) => selectedAccounts.has(c.AccountID))
                }
                onChange={toggleSelectAll}
                title="Selecionar todas as contas"
              />
            </th>
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
            <td style={{ padding: 10, textAlign: 'center' }}>-</td>
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
            <tr><td colSpan={11} style={{ color: '#fff', textAlign: 'center', padding: 20 }}>Carregando...</td></tr>
          ) : clientes.length === 0 ? (
            <tr><td colSpan={11} style={{ color: '#fff', textAlign: 'center', padding: 20 }}>Nenhum cliente encontrado.</td></tr>
          ) : (
            clientes.map((item, idx) => {
              const saldoHoje = item["Saldo Hoje"] ?? 0;
              // Saldo D+1 final (calculado + ajuste manual) para coloração da linha
              const saldoD1Calculado = saldosFuturos[item.AccountID]?.d1 ?? 0;
              const ajusteD1 = item["AjusteSaldoD1"] ?? 0;
              const saldoD1Final = saldoD1Calculado + ajusteD1;
              const saldoProjetado = saldoHoje + saldoD1Final;
              
              // Calcular faixa ideal
              const valorInvestido = Number(item["Valor Investido"] ?? 0);
              const pctMin = Number(item.PctSaldoMin ?? DEFAULT_PCT_MIN);
              const pctMax = Number(item.PctSaldoMax ?? DEFAULT_PCT_MAX);
              const minCaixa = valorInvestido * pctMin / 100;
              const maxCaixa = valorInvestido * pctMax / 100;
              
              let bg = '#222'; // cinza escuro (normal)
              if (saldoHoje < 0) {
                bg = '#7f1d1d'; // vermelho (saldo hoje negativo)
              } else if (saldoProjetado < minCaixa || saldoProjetado > maxCaixa) {
                bg = '#78350f'; // laranja (fora da faixa ideal)
              }
              return (
                <tr key={item._id || idx} style={{ background: bg, borderBottom: '1px solid #333' }}>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {item.AccountID !== 'MASTER' && (
                      <input
                        type="checkbox"
                        checked={selectedAccounts.has(item.AccountID)}
                        onChange={() => toggleSelectAccount(item.AccountID)}
                        title="Selecionar conta para ajuste em massa"
                      />
                    )}
                  </td>
                  <td style={{ padding: 10, textAlign: 'left' }}>{item["Nome Cliente"] || "-"}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>{item.AccountID || "-"}</td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(item["Valor Investido"] ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(item["Saldo Hoje"] ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(lftsValor[item.AccountID] ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(() => {
                      const saldoCalculado = saldosFuturos[item.AccountID]?.d1 ?? 0;
                      const ajuste = item["AjusteSaldoD1"] ?? 0;
                      const saldoFinal = saldoCalculado + ajuste;
                      return saldoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    })()}
                  </td>
                  <td style={{ padding: 10, textAlign: 'center' }}>
                    {(() => {
                      const saldoCalculado = saldosFuturos[item.AccountID]?.d2 ?? 0;
                      const ajuste = item["AjusteSaldoD2"] ?? 0;
                      const saldoFinal = saldoCalculado + ajuste;
                      return saldoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    })()}
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
                        
                        // Calcula saldos finais (calculado + ajuste) para exibir no modal
                        const saldoD1Calculado = saldosFuturos[item.AccountID]?.d1 ?? 0;
                        const saldoD2Calculado = saldosFuturos[item.AccountID]?.d2 ?? 0;
                        const ajusteD1 = item["AjusteSaldoD1"] ?? 0;
                        const ajusteD2 = item["AjusteSaldoD2"] ?? 0;
                        const saldoD1Final = saldoD1Calculado + ajusteD1;
                        const saldoD2Final = saldoD2Calculado + ajusteD2;
                        
                        console.log(`[EDIT] Conta ${item.AccountID}:`, {
                          saldoD1Calculado,
                          ajusteD1,
                          saldoD1Final,
                          saldoD2Calculado,
                          ajusteD2,
                          saldoD2Final,
                          lftsPosition: position
                        });
                        
                        setEditValues({ 
                          "Saldo Hoje": item["Saldo Hoje"], 
                          "Saldo D+1": saldoD1Final, 
                          "Saldo D+2": saldoD2Final, 
                          PctSaldoMin: item.PctSaldoMin ?? DEFAULT_PCT_MIN, 
                          PctSaldoMax: item.PctSaldoMax ?? DEFAULT_PCT_MAX,
                          quantity: position.quantity, 
                          avgPrice: manualLftsPrice || 0 // Usar preço manual
                        }); 
                        setEditDisplayValues({
                          "Saldo Hoje": (item["Saldo Hoje"] || 0).toString(),
                          "Saldo D+1": (saldoD1Final || 0).toString(),
                          "Saldo D+2": (saldoD2Final || 0).toString(),
                          PctSaldoMin: ((item.PctSaldoMin ?? DEFAULT_PCT_MIN) || 0).toString(),
                          PctSaldoMax: ((item.PctSaldoMax ?? DEFAULT_PCT_MAX) || 0).toString(),
                          quantity: (position.quantity || 0).toString(),
                          avgPrice: ((manualLftsPrice || 0) || 0).toString()
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
        onClose={() => { 
          setModalOpen(false); 
          setEditIdx(null); 
          setEditValues({}); 
          setEditDisplayValues({
            "Saldo Hoje": "",
            "Saldo D+1": "",
            "Saldo D+2": "",
            PctSaldoMin: "",
            PctSaldoMax: "",
            quantity: "",
            avgPrice: ""
          });
        }}
        loading={editLoading}
        displayValues={editDisplayValues}
        setDisplayValues={setEditDisplayValues}
        clientName={editIdx !== null ? (clientes[editIdx]?.["Nome Cliente"] || '') : ''}
        clientAccountId={editIdx !== null ? (clientes[editIdx]?.AccountID || '') : ''}
        indicators={(() => {
          if (editIdx === null) return null as any;
          const item = clientes[editIdx];
          if (!item) return null as any;
          const accId = item.AccountID;
          const calcD1 = saldosFuturos[accId]?.d1 ?? 0;
          const calcD2 = saldosFuturos[accId]?.d2 ?? 0;
          const ajusteD1 = item["AjusteSaldoD1"] ?? 0;
          const ajusteD2 = item["AjusteSaldoD2"] ?? 0;
          return { calcD1, calcD2, ajusteD1, ajusteD2 };
        })()}
        onSave={async () => {
          if (editIdx !== null) {
            setEditLoading(true);
            try {
              const cliente = clientes[editIdx];
              const accountId = cliente.AccountID;
              const clienteDocId = cliente._id;
              const accountName = cliente["Nome Cliente"] || "";
              
              const previousSaldoHoje = Number(cliente["Saldo Hoje"] ?? 0);
              const previousSaldoD1Final = (saldosFuturos[accountId]?.d1 ?? 0) + Number(cliente["AjusteSaldoD1"] ?? 0);
              const previousSaldoD2Final = (saldosFuturos[accountId]?.d2 ?? 0) + Number(cliente["AjusteSaldoD2"] ?? 0);
              const previousPctMin = Number(cliente.PctSaldoMin ?? DEFAULT_PCT_MIN);
              const previousPctMax = Number(cliente.PctSaldoMax ?? DEFAULT_PCT_MAX);
              const previousQuantityFinal = Number(lftsPositions[accountId]?.quantity ?? 0);

              const getNumericValue = (value: unknown, fallback: number) =>
                typeof value === "number" && !Number.isNaN(value) ? value : fallback;

              const newValores = {
                saldoHoje: getNumericValue(editValues["Saldo Hoje"], previousSaldoHoje),
                saldoD1: getNumericValue(editValues["Saldo D+1"], previousSaldoD1Final),
                saldoD2: getNumericValue(editValues["Saldo D+2"], previousSaldoD2Final),
                pctMin: getNumericValue(editValues.PctSaldoMin, previousPctMin),
                pctMax: getNumericValue(editValues.PctSaldoMax, previousPctMax),
                quantity: getNumericValue(editValues.quantity, previousQuantityFinal),
              };

              const changes: SaldoLogChange[] = [];
              const logChange = (
                field: string,
                before: number,
                after: number,
                format: SaldoLogChange["format"]
              ) => {
                const safeBefore = Number.isFinite(before) ? before : 0;
                const safeAfter = Number.isFinite(after) ? after : 0;
                let tolerance = 0.0001;
                if (format === "currency") tolerance = 0.005;
                if (format === "percent") tolerance = 0.001;
                if (Math.abs(safeBefore - safeAfter) > tolerance) {
                  changes.push({ field, before: safeBefore, after: safeAfter, format });
                }
              };

              logChange("Saldo Hoje", previousSaldoHoje, newValores.saldoHoje, "currency");
              logChange("Saldo D+1", previousSaldoD1Final, newValores.saldoD1, "currency");
              logChange("Saldo D+2", previousSaldoD2Final, newValores.saldoD2, "currency");
              logChange("% min caixa", previousPctMin, newValores.pctMin, "percent");
              logChange("% max caixa", previousPctMax, newValores.pctMax, "percent");
              logChange("Quantidade LFTS11", previousQuantityFinal, newValores.quantity, "quantity");

              // ========== SALVAR DADOS DE SALDO ==========
              const saldoUpdateData: any = {
                updatedAt: new Date().toISOString(),
              };
              
              // Saldo Hoje e percentuais são salvos normalmente
              if (editValues["Saldo Hoje"] !== undefined) saldoUpdateData["Saldo Hoje"] = newValores.saldoHoje;
              if (editValues.PctSaldoMin !== undefined) saldoUpdateData.PctSaldoMin = newValores.pctMin;
              if (editValues.PctSaldoMax !== undefined) saldoUpdateData.PctSaldoMax = newValores.pctMax;
              
              // ========== CALCULAR E SALVAR AJUSTES DE SALDO D+1 E D+2 ==========
              if (editValues["Saldo D+1"] !== undefined) {
                const saldoD1Calculado = saldosFuturos[accountId]?.d1 ?? 0;
                const novoSaldoD1 = newValores.saldoD1;
                const novoAjusteD1 = novoSaldoD1 - saldoD1Calculado;
                
                console.log(`[SAVE] Saldo D+1 - Conta ${accountId}:`, {
                  saldoCalculado: saldoD1Calculado,
                  novoSaldo: novoSaldoD1,
                  novoAjuste: novoAjusteD1
                });
                
                saldoUpdateData["AjusteSaldoD1"] = novoAjusteD1;
              }
              
              if (editValues["Saldo D+2"] !== undefined) {
                const saldoD2Calculado = saldosFuturos[accountId]?.d2 ?? 0;
                const novoSaldoD2 = newValores.saldoD2;
                const novoAjusteD2 = novoSaldoD2 - saldoD2Calculado;
                
                console.log(`[SAVE] Saldo D+2 - Conta ${accountId}:`, {
                  saldoCalculado: saldoD2Calculado,
                  novoSaldo: novoSaldoD2,
                  novoAjuste: novoAjusteD2
                });
                
                saldoUpdateData["AjusteSaldoD2"] = novoAjusteD2;
              }

              // ========== SALVAR DADOS DE LFTS11 (com ajustes manuais) ==========
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

              // ========== CALCULAR E SALVAR AJUSTES DE LFTS11 ==========
              if (editValues.quantity !== undefined) {
                // Buscar posição calculada atual do Firebase
                let posicaoCalculada = { quantity: 0, avgPrice: 0 };
                try {
                  const posSnap = await getDoc(doc(db, "posicoesDLL", `${accountId}_LFTS11`));
                  if (posSnap.exists()) {
                    const data = posSnap.data() as any;
                    posicaoCalculada = {
                      quantity: Number(data.quantity) || 0,
                      avgPrice: Number(data.avgPrice) || 0
                    };
                  }
                } catch (err) {
                  console.error(`[SAVE] Erro ao buscar posição calculada de ${accountId}:`, err);
                }

                // Calcular novo ajuste de quantidade (preço médio agora é fixo)
                const novoAjusteQuantity = newValores.quantity - posicaoCalculada.quantity;
                
                console.log(`[SAVE] LFTS11 - Conta ${accountId}:`, {
                  posicaoCalculada,
                  novoValor: { quantity: newValores.quantity, avgPrice: manualLftsPrice || 0 },
                  novoAjusteQuantity,
                  precoFixo: manualLftsPrice || 0
                });
                
                // Salvar apenas ajuste de quantidade (preço médio é fixo)
                saldoUpdateData["AjusteQuantityLFTS11"] = novoAjusteQuantity;
                // Remover ajuste de preço médio (não é mais necessário)
                saldoUpdateData["AjusteAvgPriceLFTS11"] = 0;
              }

              // SALVAR TODOS OS DADOS NO FIREBASE (incluindo ajustes de LFTS11)
              await updateDoc(doc(db, "contasDll", clienteDocId), saldoUpdateData);

              if (changes.length > 0) {
                try {
                  await addDoc(collection(db, "saldologs"), {
                    accountId,
                    accountName,
                    accountDocId: clienteDocId,
                    changes,
                    changedBy: user
                      ? {
                          uid: user.uid,
                          email: user.email || null,
                          displayName: user.displayName || user.email || null,
                        }
                      : {
                          uid: null,
                          email: null,
                          displayName: null,
                        },
                    createdAt: serverTimestamp(),
                    createdAtIso: new Date().toISOString(),
                  });
                } catch (logError) {
                  console.error("[SALDO] Erro ao registrar log de saldo:", logError);
                }
              }

              // Atualiza os dados do cliente no estado local
              const novosClientes = [...clientes];
              novosClientes[editIdx] = {
                ...novosClientes[editIdx],
                "Saldo Hoje": newValores.saldoHoje,
                PctSaldoMin: newValores.pctMin,
                PctSaldoMax: newValores.pctMax,
                // Atualiza os ajustes calculados
                "AjusteSaldoD1": saldoUpdateData["AjusteSaldoD1"] ?? novosClientes[editIdx]["AjusteSaldoD1"],
                "AjusteSaldoD2": saldoUpdateData["AjusteSaldoD2"] ?? novosClientes[editIdx]["AjusteSaldoD2"],
                // Atualiza os ajustes de LFTS11 (apenas quantidade, preço médio é fixo)
                "AjusteQuantityLFTS11": saldoUpdateData["AjusteQuantityLFTS11"] ?? novosClientes[editIdx]["AjusteQuantityLFTS11"],
                "AjusteAvgPriceLFTS11": 0, // Preço médio agora é fixo
              };
              setClientes(novosClientes);
              
              // Recarregar posições LFTS11 para refletir os novos ajustes
              setLoading(true);
              try {
                // Carregar o preço LFTS11 atual do Firebase
                let precoLftsAtual = 0;
                try {
                  const snap = await getDoc(doc(db, "config", "lftsPrice"));
                  if (snap.exists()) {
                    const v = Number(snap.data().value);
                    if (!isNaN(v) && v > 0) {
                      precoLftsAtual = v;
                    }
                  }
                } catch (err) {
                  console.error("[LFTS] Falha ao obter preço configurado:", err);
                }

                const qLfts = query(collection(db, "posicoesDLL"), where("ticker", "==", "LFTS11"));
                const snapLfts = await getDocs(qLfts);
                const map: Record<string, number> = {};
                const positions: Record<string, { quantity: number; avgPrice: number }> = {};
                let totalValor = 0;
                let totalQty = 0;
                
                // Primeiro, carrega as posições calculadas do Firebase
                const posicoesCalculadas: Record<string, { quantity: number; avgPrice: number }> = {};
                snapLfts.forEach((docSnap) => {
                  const d = docSnap.data() as any;
                  const quantity = Number(d.quantity) || 0;
                  const avgPrice = Number(d.avgPrice) || 0;
                  if (d.account_id) {
                    posicoesCalculadas[d.account_id] = { quantity, avgPrice };
                  }
                });
                
                // Depois, aplica os ajustes manuais de cada cliente
                for (const cli of novosClientes) {
                  const accId = cli.AccountID;
                  const posicaoCalculada = posicoesCalculadas[accId] || { quantity: 0, avgPrice: 0 };
                  const ajusteQuantity = cli["AjusteQuantityLFTS11"] ?? 0;
                  
                  // Calcula posição final (calculada + ajuste)
                  const quantityFinal = posicaoCalculada.quantity + ajusteQuantity;
                  
                  // USAR O PREÇO ATUAL DO FIREBASE
                  const avgPriceToUse = precoLftsAtual || 0;
                  
                  const valor = quantityFinal * avgPriceToUse;
                  
                  map[accId] = valor;
                  positions[accId] = { quantity: quantityFinal, avgPrice: avgPriceToUse };
                  
                  totalValor += valor;
                  totalQty += quantityFinal;
                }
                
                setLftsValor(map);
                setLftsPositions(positions);
              } catch (err) {
                console.error("[SALDO] Erro ao recarregar posições LFTS11:", err);
              }
              setLoading(false);
              
              alert("Dados atualizados com sucesso!");
              setModalOpen(false);
              setEditIdx(null);
              setEditValues({});
              setEditDisplayValues({
                "Saldo Hoje": "",
                "Saldo D+1": "",
                "Saldo D+2": "",
                PctSaldoMin: "",
                PctSaldoMax: "",
                quantity: "",
                avgPrice: ""
              });
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