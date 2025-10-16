"use client";
import { useState, useEffect, useRef } from "react";
import { db } from "@/config/firebase";
import { collection, query, where, getDocs, setDoc, doc, onSnapshot } from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import { FiChevronDown, FiChevronRight, FiEdit2 } from "react-icons/fi";
import AccountSelector from "@/components/AccountSelector";

/**
 * Página de Posições - UP BlackBox 4.0
 * 
 * FUNCIONALIDADES:
 * - Visualização de posições por conta individual
 * - Consolidação de posições por estratégia (ex: UP BlackBox FIIs, UP BlackBox Multi)
 * - Consolidação geral (MASTER) de todas as contas
 * 
 * IMPORTANTE:
 * - "MASTER" não é uma conta real, apenas abstração para consolidar dados
 * - Estratégias representam carteiras específicas (FIIs, Multi, etc.)
 * - Posições são calculadas a partir das ordens executadas no Firebase
 */

export default function PosicoesPage() {
  const [log, setLog] = useState("");
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("MASTER");
  const [selectedBroker, setSelectedBroker] = useState(0);
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState("");
  const [subAccount, setSubAccount] = useState("");
  const [positionType, setPositionType] = useState("2"); // 1=DayTrade, 2=Consolidado

  // Estados para dropdown das contas individuais
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [accountPositions, setAccountPositions] = useState<Record<string, any[]>>({});
  const [strategyAccounts, setStrategyAccounts] = useState<any[]>([]);
  const [strategyAccIds, setStrategyAccIds] = useState<string[]>([]);
  const [accountLiveMap, setAccountLiveMap] = useState<Record<string, boolean>>({});

  // Estados para modal de edição de posições
  const [editPositionModal, setEditPositionModal] = useState<{
    isOpen: boolean;
    position: any;
    accountId: string;
  } | null>(null);
  const [editPositionData, setEditPositionData] = useState<{
    quantidadeDesejada: number;
    precoMedioAjuste?: number;
    motivo?: string;
  }>({
    quantidadeDesejada: 0,
    precoMedioAjuste: 0,
    motivo: ''
  });
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  // Estados para modal de nova posição
  const [newPositionModal, setNewPositionModal] = useState<{
    isOpen: boolean;
    accountId: string;
  } | null>(null);
  const [newPositionData, setNewPositionData] = useState<{
    ticker: string;
    quantity: number;
    avgPrice: number;
    motivo: string;
  }>({
    ticker: '',
    quantity: 0,
    avgPrice: 0,
    motivo: ''
  });
  const [savingNewPosition, setSavingNewPosition] = useState(false);
  // Inputs localizados (pt-BR) para preço médio
  const [newPositionAvgPriceInput, setNewPositionAvgPriceInput] = useState<string>("");
  const [editPrecoMedioAjusteInput, setEditPrecoMedioAjusteInput] = useState<string>("");

  function parsePtBRDecimal(input: string): number {
    if (!input) return NaN;
    const normalized = input.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return parsed;
  }

  function formatPtBR2(n: number): string {
    try {
      return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch {
      return String(n);
    }
  }

  // Refs para listeners em tempo real
  const positionsUnsubsRef = useRef<Unsubscribe[] | null>(null);
  const ajustesUnsubRef = useRef<Unsubscribe | null>(null);
  const strategyChunkDataRef = useRef<any[][]>([]);
  const strategyAjustesRef = useRef<any[]>([]);
  // Realtime por conta expandida
  const accountPosUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
  const accountAdjUnsubsRef = useRef<Map<string, Unsubscribe>>(new Map());
  const accountCalcRef = useRef<Map<string, any[]>>(new Map());
  const accountAjustesRef = useRef<Map<string, any[]>>(new Map());

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URL}/accounts");
        const data = await res.json();
        if (res.ok && data.accounts && data.accounts.length > 0) {
          let fetchedAccounts = data.accounts;
          // Buscar nomes dos clientes na coleção contasDll
          try {
            const contasDllRes = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URL}/contasDll");
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
        const res = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URL}/strategies");
        if (res.ok) {
          const data = await res.json();
          setStrategies(data.strategies || []);
        }
      } catch {}
    }
    fetchStrategies();
  }, []);

  // Limpar listeners atuais
  const cleanupListeners = () => {
    if (positionsUnsubsRef.current) {
      for (const u of positionsUnsubsRef.current) {
        try { u && u(); } catch {}
      }
      positionsUnsubsRef.current = null;
    }
    if (ajustesUnsubRef.current) {
      try { ajustesUnsubRef.current(); } catch {}
      ajustesUnsubRef.current = null;
    }
    strategyChunkDataRef.current = [];
    strategyAjustesRef.current = [];
    // Desvincular todos os listeners por conta expandida
    for (const u of accountPosUnsubsRef.current.values()) {
      try { u && u(); } catch {}
    }
    for (const u of accountAdjUnsubsRef.current.values()) {
      try { u && u(); } catch {}
    }
    accountPosUnsubsRef.current.clear();
    accountAdjUnsubsRef.current.clear();
    accountCalcRef.current.clear();
    accountAjustesRef.current.clear();
    setIsLive(false);
  };

  // Consolidação MASTER (todas as contas) a partir de posicoesDLL
  const consolidarMaster = (allPositions: any[]) => {
    const tickerMap: Record<string, { ticker: string, quantity: number, totalBuy: number }> = {};
    for (const pos of allPositions) {
      if (!pos?.ticker) continue;
      if (!tickerMap[pos.ticker]) tickerMap[pos.ticker] = { ticker: pos.ticker, quantity: 0, totalBuy: 0 };
      tickerMap[pos.ticker].quantity += Number(pos.quantity) || 0;
      tickerMap[pos.ticker].totalBuy += (Number(pos.avgPrice) || 0) * (Number(pos.quantity) || 0);
    }
    return Object.values(tickerMap)
      .filter(p => p.quantity !== 0)
      .map(p => ({
        ticker: p.ticker,
        quantity: p.quantity,
        avgPrice: p.quantity !== 0 ? p.totalBuy / p.quantity : 0
      }));
  };

  // Recomputar posições da conta expandida
  const recomputeAccountPositions = (accountId: string) => {
    const calc = accountCalcRef.current.get(accountId) || [];
    const ajustes = accountAjustesRef.current.get(accountId) || [];
    const finalPositions = consolidarPosicoesConta(calc, ajustes);
    setAccountPositions(prev => ({ ...prev, [accountId]: finalPositions }));
  };

  // Anexar listeners para uma conta expandida
  const attachAccountListeners = (accountId: string) => {
    // Apenas na visão de estratégia
    if (!(typeof selectedAccount === 'string' && selectedAccount.startsWith('strategy:'))) return;
    const strategyId = selectedAccount.replace('strategy:', '');
    // Limpar anteriores desta conta
    detachAccountListeners(accountId);
    setAccountLiveMap(prev => ({ ...prev, [accountId]: false }));
    // posicoes calculadas da conta
    const qPos = query(collection(db, 'posicoesDLL'), where('account_id', '==', accountId));
    const uPos = onSnapshot(qPos, (snap) => {
      const list = snap.docs.map(d => d.data());
      accountCalcRef.current.set(accountId, list);
      recomputeAccountPositions(accountId);
      setAccountLiveMap(prev => ({ ...prev, [accountId]: true }));
    }, (err) => {
      console.error('onSnapshot conta expandida posicoesDLL error:', err);
    });
    accountPosUnsubsRef.current.set(accountId, uPos);
    // ajustes manuais da conta na estratégia
    const qAdj = query(
      collection(db, 'posicoesAjusteManual'),
      where('strategy_id', '==', strategyId),
      where('account_id', '==', accountId)
    );
    const uAdj = onSnapshot(qAdj, (snap) => {
      const list = snap.docs.map(d => d.data());
      accountAjustesRef.current.set(accountId, list);
      recomputeAccountPositions(accountId);
    }, (err) => {
      console.error('onSnapshot conta expandida ajustes error:', err);
    });
    accountAdjUnsubsRef.current.set(accountId, uAdj);
  };

  // Remover listeners de uma conta expandida
  const detachAccountListeners = (accountId: string) => {
    const uPos = accountPosUnsubsRef.current.get(accountId);
    if (uPos) { try { uPos(); } catch {}; accountPosUnsubsRef.current.delete(accountId); }
    const uAdj = accountAdjUnsubsRef.current.get(accountId);
    if (uAdj) { try { uAdj(); } catch {}; accountAdjUnsubsRef.current.delete(accountId); }
    accountCalcRef.current.delete(accountId);
    accountAjustesRef.current.delete(accountId);
    setAccountLiveMap(prev => ({ ...prev, [accountId]: false }));
  };

  // Recalcular consolidação da estratégia combinando chunks e ajustes
  const recomputeStrategyPositions = () => {
    const posicoesCalculadas = strategyChunkDataRef.current.flat();
    const ajustesManuais = strategyAjustesRef.current;
    const finalPositions = consolidarPosicoesEstrategia(posicoesCalculadas, ajustesManuais);
    setPositions(finalPositions);
    setLog(`LIVE: estratégia com ${finalPositions.length} posições`);
    setIsLive(true);
  };

  // Anexar listeners conforme o filtro (MASTER, estratégia, conta)
  const attachPositionsListeners = async () => {
    cleanupListeners();
    setLoading(true);
    try {
      if (selectedAccount === 'MASTER') {
        const unsub = onSnapshot(collection(db, 'posicoesDLL'), (snap) => {
          const all = snap.docs.map(d => d.data());
          const consolidated = consolidarMaster(all);
          setPositions(consolidated);
          setLog(`LIVE: MASTER com ${consolidated.length} posições`);
          setIsLive(true);
          setLoading(false);
        }, (err) => {
          console.error('onSnapshot MASTER posicoesDLL error:', err);
          setLog('Erro no listener MASTER: ' + (err.message || JSON.stringify(err)));
          setIsLive(false);
          setLoading(false);
        });
        positionsUnsubsRef.current = [unsub];
        return;
      }

      if (typeof selectedAccount === 'string' && selectedAccount.startsWith('strategy:')) {
        const strategyId = selectedAccount.replace('strategy:', '');
        // Buscar contas alocadas
        const allocRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/allocations?strategy_id=${strategyId}`);
        const allocData = await allocRes.json();
        const accIds: string[] = (allocData.allocations || []).map((a: any) => a.account_id);

        // Atualizar lista de contas exibidas
        const uniqueAccIds = [...new Set(accIds)];
        setStrategyAccIds(uniqueAccIds);
        const strategyAccountsList = accounts.filter(acc => uniqueAccIds.includes(acc.AccountID));
        const uniqueStrategyAccounts = strategyAccountsList.filter((account, index, self) => index === self.findIndex(a => a.AccountID === account.AccountID));
        setStrategyAccounts(uniqueStrategyAccounts);

        if (uniqueAccIds.length === 0) {
          setPositions([]);
          setLog('Nenhuma alocação para esta estratégia.');
          setLoading(false);
          return;
        }

        // Criar listeners por chunks de até 10 contas
        const chunks: string[][] = [];
        for (let i = 0; i < uniqueAccIds.length; i += 10) {
          chunks.push(uniqueAccIds.slice(i, i + 10));
        }
        strategyChunkDataRef.current = new Array(chunks.length).fill([]);
        const unsubs: Unsubscribe[] = [];
        chunks.forEach((chunk, idx) => {
          const q = query(collection(db, 'posicoesDLL'), where('account_id', 'in', chunk));
          const u = onSnapshot(q, (snap) => {
            strategyChunkDataRef.current[idx] = snap.docs.map(d => d.data());
            recomputeStrategyPositions();
            setLoading(false);
          }, (err) => {
            console.error('onSnapshot estratégia posicoesDLL error:', err);
            setLog('Erro no listener de posições da estratégia: ' + (err.message || JSON.stringify(err)));
            setLoading(false);
          });
          unsubs.push(u);
        });
        positionsUnsubsRef.current = unsubs;

        // Listener para ajustes manuais da estratégia
        ajustesUnsubRef.current = onSnapshot(
          query(collection(db, 'posicoesAjusteManual'), where('strategy_id', '==', strategyId)),
          (snap) => {
            strategyAjustesRef.current = snap.docs.map(d => d.data());
            recomputeStrategyPositions();
          },
          (err) => {
            console.error('onSnapshot estratégia ajustes error:', err);
          }
        );
        return;
      }

      // Conta individual
      if (typeof selectedAccount === 'string' && selectedAccount) {
        const q = query(collection(db, 'posicoesDLL'), where('account_id', '==', selectedAccount));
        const unsub = onSnapshot(q, (snap) => {
          const list = snap.docs.map(d => d.data()).filter((pos: any) => pos.quantity !== 0);
          setPositions(list);
          setLog(`LIVE: conta ${selectedAccount} com ${list.length} posições`);
          setIsLive(true);
          setLoading(false);
        }, (err) => {
          console.error('onSnapshot conta posicoesDLL error:', err);
          setLog('Erro no listener da conta: ' + (err.message || JSON.stringify(err)));
          setIsLive(false);
          setLoading(false);
        });
        positionsUnsubsRef.current = [unsub];
      }
    } catch (err: any) {
      console.error('Falha ao anexar listeners de posições:', err);
      setLog('Falha ao anexar listeners de posições: ' + (err.message || JSON.stringify(err)));
      setIsLive(false);
      setLoading(false);
    }
  };

  // Conectar listeners ao mudar filtro e limpar ao desmontar
  useEffect(() => {
    if (typeof selectedAccount === 'string' && selectedAccount.length > 0) {
      attachPositionsListeners();
    }
    return () => cleanupListeners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount]);

  // Recalcular a lista de contas da estratégia quando `accounts` carregar/atualizar
  useEffect(() => {
    if (typeof selectedAccount === 'string' && selectedAccount.startsWith('strategy:') && strategyAccIds.length > 0) {
      const strategyAccountsList = accounts.filter(acc => strategyAccIds.includes(acc.AccountID));
      const uniqueStrategyAccounts = strategyAccountsList.filter((account, index, self) => index === self.findIndex(a => a.AccountID === account.AccountID));
      setStrategyAccounts(uniqueStrategyAccounts);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, strategyAccIds]);

  // Monitorar mudanças no strategyAccounts para debug
  useEffect(() => {
    if (strategyAccounts.length > 0) {
      console.log('strategyAccounts atualizado:', {
        length: strategyAccounts.length,
        accounts: strategyAccounts.map(acc => acc.AccountID)
      });
    }
  }, [strategyAccounts]);

  function handleAccountChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedAccount(e.target.value);
    // Limpar estados quando trocar de conta/estratégia
    setExpandedAccounts(new Set());
    setAccountPositions({});
    setStrategyAccounts([]);
  }

  // Função para expandir/recolher conta
  const toggleAccountExpansion = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
      // Desanexar listeners em tempo real desta conta
      detachAccountListeners(accountId);
    } else {
      newExpanded.add(accountId);
      // Carregar posições da conta se ainda não foram carregadas
      if (!accountPositions[accountId]) {
        loadAccountPositions(accountId);
      }
      // Anexar listeners em tempo real para a conta
      attachAccountListeners(accountId);
    }
    setExpandedAccounts(newExpanded);
  };

  // Função para calcular preço médio ponderado
  const calcularPrecoMedioPonderado = (posicaoCalculada: any, ajusteManual: any) => {
    if (!ajusteManual || ajusteManual.quantidade_ajuste === 0) {
      return posicaoCalculada.avgPrice;
    }
    
    const qtyCalculada = posicaoCalculada.quantity;
    const qtyAjuste = ajusteManual.quantidade_ajuste;
    const precoCalculado = posicaoCalculada.avgPrice;
    const precoAjuste = ajusteManual.preco_medio_ajuste || precoCalculado;
    
    const valorTotal = (qtyCalculada * precoCalculado) + (qtyAjuste * precoAjuste);
    const quantidadeTotal = qtyCalculada + qtyAjuste;
    
    return quantidadeTotal > 0 ? valorTotal / quantidadeTotal : 0;
  };

  // Função para consolidar posições de uma estratégia
  const consolidarPosicoesEstrategia = (posicoesCalculadas: any[], ajustesManuais: any[]) => {
    const mapaPosicoes = new Map();
    const mapaAjustes = new Map();
    
    // 1. Organizar ajustes por ticker para facilitar o acesso
    ajustesManuais.forEach(ajuste => {
      if (!mapaAjustes.has(ajuste.ticker)) {
        mapaAjustes.set(ajuste.ticker, []);
      }
      mapaAjustes.get(ajuste.ticker).push(ajuste);
    });
    
    // 2. Adicionar posições calculadas
    posicoesCalculadas.forEach(pos => {
      if (!pos.ticker) return;
      
      if (!mapaPosicoes.has(pos.ticker)) {
        mapaPosicoes.set(pos.ticker, {
          ticker: pos.ticker,
          quantity: 0,
          totalBuy: 0,
          hasAjustes: false
        });
      }
      
      const posicao = mapaPosicoes.get(pos.ticker);
      posicao.quantity += Number(pos.quantity) || 0;
      posicao.totalBuy += (Number(pos.avgPrice) || 0) * (Number(pos.quantity) || 0);
    });
    
    // 3. Aplicar ajustes manuais
    ajustesManuais.forEach(ajuste => {
      if (!mapaPosicoes.has(ajuste.ticker)) {
        // Posição não existe, criar apenas com ajuste
        mapaPosicoes.set(ajuste.ticker, {
          ticker: ajuste.ticker,
          quantity: ajuste.quantidade_ajuste,
          totalBuy: (ajuste.preco_medio_ajuste || 0) * ajuste.quantidade_ajuste,
          hasAjustes: true
        });
      } else {
        // Posição existe, somar ajuste
        const posicao = mapaPosicoes.get(ajuste.ticker);
        posicao.quantity += ajuste.quantidade_ajuste;
        posicao.totalBuy += (ajuste.preco_medio_ajuste || 0) * ajuste.quantidade_ajuste;
        posicao.hasAjustes = true;
      }
    });
    
    // 4. Calcular preços médios finais
            return Array.from(mapaPosicoes.values())
          .filter(pos => pos.quantity !== 0) // Filtrar posições zeradas
          .map(pos => ({
            ticker: pos.ticker,
            quantity: pos.quantity,
            avgPrice: pos.quantity !== 0 ? pos.totalBuy / pos.quantity : 0,
            avgBuyPrice: pos.avgBuyPrice || 0,      // NOVO
            avgSellPrice: pos.avgSellPrice || 0,    // NOVO
            totalBuyQty: pos.totalBuyQty || 0,      // NOVO
            totalSellQty: pos.totalSellQty || 0,    // NOVO
            hasAjustes: pos.hasAjustes
          }));
  };

  // Função para consolidar posições de uma conta individual
  const consolidarPosicoesConta = (posicoesCalculadas: any[], ajustesManuais: any[]) => {
    const mapaPosicoes = new Map();
    
    // Adicionar posições calculadas
    posicoesCalculadas.forEach(pos => {
      mapaPosicoes.set(pos.ticker, {
        ticker: pos.ticker,
        quantity: pos.quantity,
        avgPrice: pos.avgPrice,
        isAjuste: false
      });
    });
    
    // Aplicar ajustes manuais
    ajustesManuais.forEach(ajuste => {
      const posicaoAtual = mapaPosicoes.get(ajuste.ticker);
      
      if (posicaoAtual) {
        // Posição já existe, aplicar ajuste
        const novaQuantidade = posicaoAtual.quantity + ajuste.quantidade_ajuste;
        const novoPrecoMedio = calcularPrecoMedioPonderado(posicaoAtual, ajuste);
        
        mapaPosicoes.set(ajuste.ticker, {
          ...posicaoAtual,
          quantity: novaQuantidade,
          avgPrice: novoPrecoMedio,
          hasAjuste: true,
          ajusteManual: ajuste
        });
      } else {
        // Posição não existe, criar apenas com ajuste
        mapaPosicoes.set(ajuste.ticker, {
          ticker: ajuste.ticker,
          quantity: ajuste.quantidade_ajuste,
          avgPrice: ajuste.preco_medio_ajuste || 0,
          isAjuste: true,
          ajusteManual: ajuste
        });
      }
    });
    
    return Array.from(mapaPosicoes.values())
      .filter(pos => pos.quantity !== 0) // Filtrar posições zeradas
      .map(pos => ({
        ...pos,
        avgBuyPrice: pos.avgBuyPrice || 0,      // NOVO
        avgSellPrice: pos.avgSellPrice || 0,    // NOVO
        totalBuyQty: pos.totalBuyQty || 0,      // NOVO
        totalSellQty: pos.totalSellQty || 0     // NOVO
      }));
  };

  // Função para carregar posições de uma conta específica
  const loadAccountPositions = async (accountId: string) => {
    try {
      // 1. Buscar posições calculadas
      const q = query(collection(db, "posicoesDLL"), where("account_id", "==", accountId));
      const querySnapshot = await getDocs(q);
      const posicoesCalculadas = querySnapshot.docs.map(doc => doc.data());
      
      // 2. Buscar ajustes manuais da estratégia atual
      const strategyId = selectedAccount.replace('strategy:', '');
      const qAjustes = query(
        collection(db, "posicoesAjusteManual"), 
        where("strategy_id", "==", strategyId),
        where("account_id", "==", accountId)
      );
      const ajustesSnapshot = await getDocs(qAjustes);
      const ajustesManuais = ajustesSnapshot.docs.map(doc => doc.data());
      
      console.log(`=== DEBUG CONTA ${accountId} ===`);
      console.log('Strategy ID:', strategyId);
      console.log('Account ID:', accountId);
      console.log('Posições calculadas:', posicoesCalculadas);
      console.log('Ajustes manuais:', ajustesManuais);
      
      // 3. Consolidar posições
      const posicoesConsolidadas = consolidarPosicoesConta(posicoesCalculadas, ajustesManuais);
      
      console.log('Posições consolidadas da conta:', posicoesConsolidadas);
      console.log(`=== FIM DEBUG CONTA ${accountId} ===`);
      
      setAccountPositions(prev => ({
        ...prev,
        [accountId]: posicoesConsolidadas
      }));
    } catch (err) {
      console.error(`Erro ao carregar posições da conta ${accountId}:`, err);
    }
  };

  // Função para abrir modal de edição
  const handleEditPosition = (position: any, accountId: string) => {
    setEditPositionData({
      quantidadeDesejada: position.quantity,
      precoMedioAjuste: position.avgPrice,
      motivo: ''
    });
    setEditPrecoMedioAjusteInput(position.avgPrice ? formatPtBR2(position.avgPrice) : '');
    setEditPositionModal({
      isOpen: true,
      position,
      accountId
    });
  };

  // Função para salvar ajuste de posição
  const savePositionAdjustment = async () => {
    if (!editPositionModal) return;
    
    try {
      setSavingAdjustment(true);
      const { position, accountId } = editPositionModal;
      const { quantidadeDesejada, precoMedioAjuste, motivo } = editPositionData;
      const strategyId = selectedAccount.replace('strategy:', '');
      
      // Buscar posição atual (sem ajustes)
      const q = query(collection(db, "posicoesDLL"), where("account_id", "==", accountId), where("ticker", "==", position.ticker));
      const querySnapshot = await getDocs(q);
      const posicaoCalculada = querySnapshot.docs[0]?.data();
      const quantidadeCalculada = posicaoCalculada?.quantity || 0;
      
      // Calcular diferença
      const quantidadeAjuste = quantidadeDesejada - quantidadeCalculada;
      
      // Permitir salvar apenas preço ou motivo mesmo quando quantidade não muda
      if (quantidadeAjuste === 0 && (precoMedioAjuste === undefined || precoMedioAjuste === null) && (!motivo || motivo.trim() === '')) {
        alert('Não há mudanças para salvar');
        return;
      }
      
      // Salvar ajuste manual
      const ajusteData = {
        strategy_id: strategyId,
        account_id: accountId,
        ticker: position.ticker,
        quantidade_ajuste: quantidadeAjuste,
        preco_medio_ajuste: precoMedioAjuste,
        motivo: motivo || 'Ajuste manual via interface',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const docId = `${strategyId}_${accountId}_${position.ticker}_ajuste`;
      await setDoc(doc(db, 'posicoesAjusteManual', docId), ajusteData, { merge: true });
      
      // Listener refletirá automaticamente
      await loadAccountPositions(accountId);
      
      alert('Ajuste salvo com sucesso!');
      setEditPositionModal(null);
      setEditPositionData({
        quantidadeDesejada: 0,
        precoMedioAjuste: 0,
        motivo: ''
      });
    } catch (err) {
      console.error('Erro ao salvar ajuste:', err);
      alert('Erro ao salvar ajuste');
    } finally {
      setSavingAdjustment(false);
    }
  };

  // Função para abrir modal de nova posição
  const handleAddNewPosition = (accountId: string) => {
    setNewPositionData({
      ticker: '',
      quantity: 0,
      avgPrice: 0,
      motivo: ''
    });
    setNewPositionAvgPriceInput('');
    setNewPositionModal({
      isOpen: true,
      accountId
    });
  };

  // Função para salvar nova posição
  const saveNewPosition = async () => {
    if (!newPositionModal) return;
    
    try {
      setSavingNewPosition(true);
      const { accountId } = newPositionModal;
      const { ticker, quantity, avgPrice, motivo } = newPositionData;
      const strategyId = selectedAccount.replace('strategy:', '');
      
      // Validações
      if (!ticker.trim()) {
        alert('Ticker é obrigatório');
        return;
      }
      
      if (quantity === 0) {
        alert('Quantidade não pode ser zero');
        return;
      }
      
      if (avgPrice <= 0) {
        alert('Preço médio deve ser maior que zero');
        return;
      }
      
      // Verificar se ticker já existe na conta
      const existingPosition = accountPositions[accountId]?.find(
        pos => pos.ticker.toUpperCase() === ticker.toUpperCase()
      );
      
      if (existingPosition) {
        alert(`Ticker ${ticker.toUpperCase()} já existe nesta conta. Use a opção de edição para ajustar a posição existente.`);
        return;
      }
      
      // Salvar como ajuste manual (nova posição)
      const ajusteData = {
        strategy_id: strategyId,
        account_id: accountId,
        ticker: ticker.toUpperCase(),
        quantidade_ajuste: quantity, // Para nova posição, quantidade_ajuste = quantidade total
        preco_medio_ajuste: avgPrice,
        motivo: motivo || 'Nova posição adicionada manualmente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const docId = `${strategyId}_${accountId}_${ticker.toUpperCase()}_ajuste`;
      await setDoc(doc(db, 'posicoesAjusteManual', docId), ajusteData, { merge: true });
      
      // Listener refletirá automaticamente
      await loadAccountPositions(accountId);
      
      alert('Nova posição adicionada com sucesso!');
      setNewPositionModal(null);
      setNewPositionData({
        ticker: '',
        quantity: 0,
        avgPrice: 0,
        motivo: ''
      });
    } catch (err) {
      console.error('Erro ao adicionar nova posição:', err);
      alert('Erro ao adicionar nova posição');
    } finally {
      setSavingNewPosition(false);
    }
  };

  async function handleListPositions() {
    console.log('=== handleListPositions chamada ===', new Date().toISOString());
    setLog("");
    setPositions([]);
    setLoading(true);
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
        positionsArr = Object.values(tickerMap)
          .filter(pos => pos.quantity !== 0) // Filtrar posições zeradas
          .map(pos => ({
            ticker: pos.ticker,
            quantity: pos.quantity,
            avgPrice: pos.quantity !== 0 ? pos.totalBuy / pos.quantity : 0
          }));
        setLog(`Posições consolidadas de todas as contas! Total: ${positionsArr.length}`);
      } else if (selectedAccount.startsWith('strategy:')) {
        const strategyId = selectedAccount.replace('strategy:', '');
        
        // Sempre buscar alocações para carregar as contas da estratégia
        const allocRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/allocations?strategy_id=${strategyId}`);
        const allocData = await allocRes.json();
        const accIds: string[] = (allocData.allocations || []).map((a: any) => a.account_id);
        
        // Carregar informações das contas da estratégia
        // Remover duplicatas dos Account IDs
        const uniqueAccIds = [...new Set(accIds)];
        console.log('Account IDs únicos da estratégia:', uniqueAccIds);
        
        const strategyAccountsList = accounts.filter(acc => uniqueAccIds.includes(acc.AccountID));
        
        // Remover duplicatas da lista final (caso haja contas com mesmo AccountID)
        const uniqueStrategyAccounts = strategyAccountsList.filter((account, index, self) => 
          index === self.findIndex(a => a.AccountID === account.AccountID)
        );
        
        console.log('Contas da estratégia encontradas:', strategyAccountsList);
        console.log('Contas únicas após filtro:', uniqueStrategyAccounts);
        console.log('Account IDs da estratégia (original):', accIds);
        console.log('Account IDs únicos da estratégia:', uniqueAccIds);
        console.log('Todas as contas disponíveis:', accounts);
        console.log('Estratégia selecionada:', selectedAccount);
        setStrategyAccounts(uniqueStrategyAccounts);
        
        if (accIds.length === 0) {
          setLog('Nenhuma alocação para esta estratégia.');
          setLoading(false);
          return;
        }
        
        // Primeiro tenta buscar via API do backend
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/positions_strategy?strategy_id=${strategyId}`);
          if (res.ok) {
            const data = await res.json();
            positionsArr = data.positions || [];
            setLog(`Posições da estratégia carregadas via API! Total: ${positionsArr.length}`);
          } else {
            // Se a API falhar, usa o método manual
            throw new Error('API falhou, usando método manual');
          }
        } catch(err:any) {
          console.log('Usando método manual para carregar posições da estratégia');
          
          // Buscar posições calculadas de todas as contas da estratégia
          const q = query(collection(db, 'posicoesDLL'), where('account_id', 'in', accIds));
          const snap = await getDocs(q);
          const posicoesCalculadas = snap.docs.map(d=>d.data());
          
          // Buscar TODOS os ajustes manuais da estratégia
          const qAjustes = query(collection(db, 'posicoesAjusteManual'), where('strategy_id', '==', strategyId));
          const ajustesSnap = await getDocs(qAjustes);
          const ajustesManuais = ajustesSnap.docs.map(d => d.data());
          
          console.log('=== DEBUG CONSOLIDAÇÃO ESTRATÉGIA ===');
          console.log('Strategy ID:', strategyId);
          console.log('Account IDs:', accIds);
          console.log('Posições calculadas:', posicoesCalculadas);
          console.log('Ajustes manuais da estratégia:', ajustesManuais);
          
          // Consolidar posições incluindo ajustes
          const posicoesConsolidadas = consolidarPosicoesEstrategia(posicoesCalculadas, ajustesManuais);
          
          console.log('Posições consolidadas finais:', posicoesConsolidadas);
          console.log('=== FIM DEBUG ===');
          
          positionsArr = posicoesConsolidadas;
          setLog(`Posições consolidadas da estratégia (com ajustes). Total ${positionsArr.length}`);
        }
      } else {
        // Busca as posições já calculadas do cliente na coleção posicoesDLL
        const q = query(
          collection(db, "posicoesDLL"),
          where("account_id", "==", selectedAccount)
        );
        console.log("Query Firestore: posicoesDLL, account_id =", selectedAccount);
        const querySnapshot = await getDocs(q);
        console.log("QuerySnapshot size:", querySnapshot.size);
        positionsArr = querySnapshot.docs
          .map(doc => {
            const data = doc.data();
            console.log("Posição encontrada:", data);
            return data;
          })
          .filter(pos => pos.quantity !== 0); // Filtrar posições zeradas
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
    <div style={{ width: '90%', margin: "40px auto", padding: 24, background: "#222", borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <h2 style={{ color: "#fff", marginBottom: 0 }}>Posições</h2>
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
          // Adaptar ao contrato atual do handleAccountChange
          handleAccountChange({ target: { value: val } } as any);
          // Atualizar Broker se uma conta individual foi selecionada
          if (typeof val === 'string' && val && !val.startsWith('strategy:') && val !== 'MASTER') {
            const acc = accounts.find((a:any) => a.AccountID === val);
            if (acc) setSelectedBroker(acc.BrokerID);
          }
        }}
        accounts={accounts}
        strategies={strategies}
      />
      <div style={{ height: 8 }} />
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
                {[...positions].sort((a:any,b:any)=> (a.ticker||'').toUpperCase().localeCompare((b.ticker||'').toUpperCase(),'pt-BR')).map((pos, idx) => (
                  <tr key={idx} style={{ 
                    background: idx % 2 === 0 ? '#222' : '#282828',
                    borderLeft: pos.hasAjustes ? '3px solid #0ea5e9' : 'none'
                  }}>
                    <td style={{ padding: 6, border: '1px solid #444' }}>
                      {pos.ticker}
                      {pos.hasAjustes && (
                        <span 
                          title={(() => {
                            if (pos.contas_com_ajuste && pos.contas_com_ajuste.length > 0) {
                              // Buscar nomes dos clientes que têm ajustes
                              const contasComAjuste = pos.contas_com_ajuste.map((accountId: string) => {
                                const account = accounts.find(acc => acc.AccountID === accountId);
                                return account ? `${account.nomeCliente || accountId} (${accountId})` : accountId;
                              });
                              return `Ajustes manuais nas contas:\n${contasComAjuste.join('\n')}`;
                            }
                            return "Posição com ajustes manuais";
                          })()}
                          style={{ marginLeft: 8, color: '#0ea5e9', cursor: 'help' }}
                        >
                          ⚙️
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>{pos.quantity}</td>
                    <td style={{ padding: 6, border: '1px solid #444' }}>
                      {pos.quantity > 0 ? (
                        // Posição comprada: mostrar preço médio das compras
                        <span title={`Preço médio das compras (${pos.totalBuyQty || 0} ações)`}>
                          R$ {formatPtBR2(pos.avgBuyPrice ? pos.avgBuyPrice : pos.avgPrice)}
                        </span>
                      ) : pos.quantity < 0 ? (
                        // Posição vendida: mostrar preço médio das vendas
                        <span style={{ color: '#dc2626' }} title={`Preço médio das vendas (${pos.totalSellQty || 0} ações)`}>
                          R$ {formatPtBR2(pos.avgSellPrice ? pos.avgSellPrice : pos.avgPrice)}
                        </span>
                      ) : (
                        // Posição zerada
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Seção de Contas Individuais da Estratégia */}
      {typeof selectedAccount === 'string' && selectedAccount.startsWith('strategy:') && strategyAccounts.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h3 style={{ color: "#fff", marginBottom: 16 }}>Contas da Estratégia</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {strategyAccounts.map((account) => (
              <div key={account.AccountID} style={{ 
                background: '#181818', 
                borderRadius: 8, 
                border: '1px solid #444',
                overflow: 'hidden'
              }}>
                {/* Cabeçalho da conta */}
                <div 
                  style={{ 
                    padding: '16px 20px',
                    background: '#333',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: expandedAccounts.has(account.AccountID) ? '1px solid #555' : 'none'
                  }}
                  onClick={() => toggleAccountExpansion(account.AccountID)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {expandedAccounts.has(account.AccountID) ? (
                      <FiChevronDown size={20} color="#06b6d4" />
                    ) : (
                      <FiChevronRight size={20} color="#06b6d4" />
                    )}
                    <div>
                      <h4 style={{ 
                        color: '#fff', 
                        margin: 0, 
                        fontSize: 16,
                        fontWeight: 'bold'
                      }}>
                        {account.nomeCliente || account.AccountID}
                      </h4>
                      <p style={{ 
                        color: '#9ca3af', 
                        margin: 0, 
                        fontSize: 14 
                      }}>
                        Conta: {account.AccountID}
                      </p>
                    </div>
                    {accountLiveMap[account.AccountID] && (
                      <span
                        title="Atualização em tempo real ativa para esta conta"
                        style={{
                          marginLeft: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '2px 8px',
                          borderRadius: 9999,
                          background: '#064e3b',
                          color: '#34d399',
                          fontSize: 10,
                          fontWeight: 700
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#10b981',
                            boxShadow: '0 0 6px #10b981'
                          }}
                        />
                        LIVE
                      </span>
                    )}
                  </div>
                  
                  {/* Botão Nova Posição */}
                  <button
                    title="Adicionar nova posição"
                    onClick={(e) => {
                      e.stopPropagation(); // Evitar expandir/colapsar ao clicar no botão
                      handleAddNewPosition(account.AccountID);
                    }}
                    style={{
                      background: '#16a34a',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#15803d';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#16a34a';
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>+</span>
                    Nova Posição
                  </button>
                </div>

                {/* Tabela de posições (expandida) */}
                {expandedAccounts.has(account.AccountID) && (
                  <div style={{ padding: 20 }}>
                    <div style={{ 
                      background: '#1a1a1a', 
                      borderRadius: 8, 
                      overflow: 'hidden',
                      border: '1px solid #444'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#2a2a2a' }}>
                            <th style={{ 
                              padding: '12px 16px', 
                              textAlign: 'left', 
                              color: '#fff',
                              borderBottom: '1px solid #555',
                              fontWeight: 'bold'
                            }}>
                              Ticker
                            </th>
                            <th style={{ 
                              padding: '12px 16px', 
                              textAlign: 'right', 
                              color: '#fff',
                              borderBottom: '1px solid #555',
                              fontWeight: 'bold'
                            }}>
                              Quantidade Líquida
                            </th>
                            <th style={{ 
                              padding: '12px 16px', 
                              textAlign: 'right', 
                              color: '#fff',
                              borderBottom: '1px solid #555',
                              fontWeight: 'bold'
                            }}>
                              Preço Médio (Compra)
                            </th>
                            <th style={{ 
                              padding: '12px 16px', 
                              textAlign: 'center', 
                              color: '#fff',
                              borderBottom: '1px solid #555',
                              fontWeight: 'bold'
                            }}>
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {!accountPositions[account.AccountID] ? (
                            <tr>
                              <td colSpan={4} style={{ 
                                padding: '20px', 
                                textAlign: 'center', 
                                color: '#9ca3af' 
                              }}>
                                Carregando posições...
                              </td>
                            </tr>
                          ) : accountPositions[account.AccountID].length === 0 ? (
                            <tr>
                              <td colSpan={4} style={{ 
                                padding: '20px', 
                                textAlign: 'center', 
                                color: '#9ca3af' 
                              }}>
                                Nenhuma posição encontrada para esta conta.
                              </td>
                            </tr>
                          ) : (
                            accountPositions[account.AccountID].map((position, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid #444' }}>
                                <td style={{ 
                                  padding: '12px 16px', 
                                  color: '#fff',
                                  fontWeight: 'bold'
                                }}>
                                  {position.ticker}
                                </td>
                                <td style={{ 
                                  padding: '12px 16px', 
                                  textAlign: 'right', 
                                  color: '#fff'
                                }}>
                                  {position.quantity}
                                </td>
                                <td style={{ 
                                  padding: '12px 16px', 
                                  textAlign: 'right', 
                                  color: '#fff'
                                }}>
                                  {position.quantity > 0 ? (
                                    // Posição comprada: mostrar preço médio das compras
                                    <span title={`Preço médio das compras (${position.totalBuyQty || 0} ações)`}>
                                      R$ {formatPtBR2(position.avgBuyPrice ? position.avgBuyPrice : position.avgPrice)}
                                    </span>
                                  ) : position.quantity < 0 ? (
                                    // Posição vendida: mostrar preço médio das vendas
                                    <span style={{ color: '#dc2626' }} title={`Preço médio das vendas (${position.totalSellQty || 0} ações)`}>
                                      R$ {formatPtBR2(position.avgSellPrice ? position.avgSellPrice : position.avgPrice)}
                                    </span>
                                  ) : (
                                    // Posição zerada
                                    '-'
                                  )}
                                </td>
                                <td style={{ 
                                  padding: '12px 16px', 
                                  textAlign: 'center'
                                }}>
                                  <button
                                    title="Editar posição"
                                    onClick={() => handleEditPosition(position, account.AccountID)}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: position.hasAjuste ? '#facc15' : '#0ea5e9',
                                      padding: '4px',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#1e293b';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                    }}
                                  >
                                    <FiEdit2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal de Edição de Posição */}
      {editPositionModal?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#222] rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold text-white mb-4">
              Editar Posição - {editPositionModal.position.ticker}
            </h3>
            
            <div className="space-y-4">
              {/* Informações atuais */}
              <div className="bg-gray-800 p-4 rounded-md">
                <h4 className="text-lg font-semibold text-white mb-2">Posição Atual</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-300">Quantidade:</span>
                    <span className="text-white ml-2">{editPositionModal.position.quantity}</span>
                  </div>
                  <div>
                    <span className="text-gray-300">Preço Médio:</span>
                    <span className="text-white ml-2">
                      {editPositionModal.position.avgPrice !== 0 ? formatPtBR2(editPositionModal.position.avgPrice) : '-'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Campos de edição */}
              <div>
                <label className="block text-gray-300 mb-1">Quantidade Desejada</label>
                <input
                  type="number"
                  value={editPositionData.quantidadeDesejada}
                  onChange={e => setEditPositionData(prev => ({ 
                    ...prev, 
                    quantidadeDesejada: Number(e.target.value) 
                  }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  min="0"
                  step="1"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Preço Médio do Ajuste (opcional)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editPrecoMedioAjusteInput}
                  onChange={e => {
                    const raw = e.target.value;
                    setEditPrecoMedioAjusteInput(raw);
                    const parsed = parsePtBRDecimal(raw);
                    setEditPositionData(prev => ({ ...prev, precoMedioAjuste: isNaN(parsed) ? undefined : parsed }));
                  }}
                  onBlur={() => {
                    if (editPositionData.precoMedioAjuste !== undefined && editPositionData.precoMedioAjuste !== null) {
                      setEditPrecoMedioAjusteInput(formatPtBR2(editPositionData.precoMedioAjuste));
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="Ex: 7,00"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Motivo (opcional)</label>
                <textarea
                  value={editPositionData.motivo || ''}
                  onChange={e => setEditPositionData(prev => ({ 
                    ...prev, 
                    motivo: e.target.value 
                  }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  rows={3}
                  placeholder="Motivo do ajuste..."
                />
              </div>

              {/* Diferença calculada */}
              {editPositionData.quantidadeDesejada !== editPositionModal.position.quantity && (
                <div className="bg-blue-900/20 border border-blue-500 p-3 rounded-md">
                  <p className="text-blue-300 text-sm">
                    <strong>Diferença:</strong> {editPositionData.quantidadeDesejada - editPositionModal.position.quantity} ações
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setEditPositionModal(null);
                  setEditPositionData({
                    quantidadeDesejada: 0,
                    precoMedioAjuste: 0,
                    motivo: ''
                  });
                }}
                disabled={savingAdjustment}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={savePositionAdjustment}
                disabled={(() => {
                  const noQtyChange = editPositionData.quantidadeDesejada === editPositionModal.position.quantity;
                  const noPriceChange = (editPositionData.precoMedioAjuste === undefined || editPositionData.precoMedioAjuste === null) || editPositionData.precoMedioAjuste === editPositionModal.position.avgPrice;
                  const noReason = !editPositionData.motivo || editPositionData.motivo.trim() === '';
                  // desabilita apenas se não houver nenhuma mudança e não estiver salvando
                  return savingAdjustment || (noQtyChange && noPriceChange && noReason);
                })()}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
              >
                {savingAdjustment ? 'Salvando...' : 'Salvar Ajuste'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Nova Posição */}
      {newPositionModal?.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#222] rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-xl font-bold text-white mb-4">
              Nova Posição - {newPositionModal.accountId}
            </h3>
            
            <div className="space-y-4">
              {/* Campos do formulário */}
              <div>
                <label className="block text-gray-300 mb-1">Ticker *</label>
                <input
                  type="text"
                  value={newPositionData.ticker}
                  onChange={e => setNewPositionData(prev => ({ 
                    ...prev, 
                    ticker: e.target.value.toUpperCase()
                  }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="Ex: PETR4"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Quantidade (Compra/Venda) *</label>
                <input
                  type="number"
                  value={newPositionData.quantity || ''}
                  onChange={e => setNewPositionData(prev => ({ 
                    ...prev, 
                    quantity: Number(e.target.value) 
                  }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  step="1"
                  placeholder="Ex: 100 (positivo) ou -100 (short)"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Use valores positivos para compra e negativos para venda (short)
                </p>
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Preço Médio *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={newPositionAvgPriceInput}
                  onChange={e => {
                    const raw = e.target.value;
                    setNewPositionAvgPriceInput(raw);
                    const parsed = parsePtBRDecimal(raw);
                    setNewPositionData(prev => ({ ...prev, avgPrice: isNaN(parsed) ? 0 : parsed }));
                  }}
                  onBlur={() => {
                    if (newPositionData.avgPrice > 0) {
                      setNewPositionAvgPriceInput(formatPtBR2(newPositionData.avgPrice));
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  placeholder="Ex: 25,50"
                />
              </div>

              <div>
                <label className="block text-gray-300 mb-1">Motivo (opcional)</label>
                <textarea
                  value={newPositionData.motivo || ''}
                  onChange={e => setNewPositionData(prev => ({ 
                    ...prev, 
                    motivo: e.target.value 
                  }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                  rows={3}
                  placeholder="Motivo da nova posição..."
                />
              </div>

              {/* Validação de ticker existente */}
              {newPositionData.ticker && accountPositions[newPositionModal.accountId]?.some(
                pos => pos.ticker.toUpperCase() === newPositionData.ticker.toUpperCase()
              ) && (
                <div className="bg-red-900/20 border border-red-500 p-3 rounded-md">
                  <p className="text-red-300 text-sm">
                    ⚠️ <strong>Atenção:</strong> Ticker {newPositionData.ticker.toUpperCase()} já existe nesta conta.
                  </p>
                </div>
              )}

              {/* Cálculo do valor total */}
              {newPositionData.quantity !== 0 && newPositionData.avgPrice > 0 && (
                <div className={`p-3 rounded-md ${
                  newPositionData.quantity > 0 
                    ? 'bg-blue-900/20 border border-blue-500' 
                    : 'bg-red-900/20 border border-red-500'
                }`}>
                  <p className={`text-sm ${
                    newPositionData.quantity > 0 ? 'text-blue-300' : 'text-red-300'
                  }`}>
                    <strong>Tipo:</strong> {newPositionData.quantity > 0 ? 'Compra' : 'Venda (Short)'}
                  </p>
                  <p className={`text-sm ${newPositionData.quantity > 0 ? 'text-blue-300' : 'text-red-300'}`}>
                    <strong>Valor Total:</strong> R$ {formatPtBR2(Math.abs(newPositionData.quantity) * newPositionData.avgPrice)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setNewPositionModal(null);
                  setNewPositionData({
                    ticker: '',
                    quantity: 0,
                    avgPrice: 0,
                    motivo: ''
                  });
                }}
                disabled={savingNewPosition}
                className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveNewPosition}
                disabled={
                  savingNewPosition || 
                  !newPositionData.ticker.trim() || 
                  newPositionData.quantity === 0 || 
                  newPositionData.avgPrice <= 0 ||
                  accountPositions[newPositionModal.accountId]?.some(
                    pos => pos.ticker.toUpperCase() === newPositionData.ticker.toUpperCase()
                  )
                }
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
              >
                {savingNewPosition ? 'Adicionando...' : 'Adicionar Posição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 