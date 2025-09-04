"use client";
import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, getDoc, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { FiChevronDown, FiChevronRight, FiX, FiPlus, FiTrash2, FiEdit3 } from "react-icons/fi";
import { v4 as uuidv4 } from 'uuid';

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

interface Strategy {
  id: string;
  name: string;
  description?: string;
}

interface Position {
  id: string;
  ticker: string;
  price: number;
  quantity: number;
  percentage?: number;
  actions?: string;
}

interface ReferencePosition {
  id?: string;
  strategy_id: string;
  ticker: string;
  price: number;
  quantity: number;
  percentage?: number;
  createdAt?: any;
}

interface Account {
  _id: string;
  "Nome Cliente": string;
  "Valor Investido": number;
  BrokerID: string;
  AccountID: string;
  "Valor Investido Estrategia"?: number;
}

interface AccountPosition {
  id: string;
  ticker: string;
  quantity: number;
  price: number;
  avgBuyPrice?: number;    // NOVO
  avgSellPrice?: number;   // NOVO
  totalBuyQty?: number;    // NOVO
  totalSellQty?: number;   // NOVO
  percentage?: number;
  idealPercentage?: number;
}

interface StrategyAllocation {
  account_id: string;
  broker_id: number;
  strategy_id: string;
  valor_investido: number;
}

interface SyncAssetData {
  ticker: string;
  totalQuantity: number;
  action: 'buy' | 'sell';
  accounts: {
    accountId: string;
    accountName: string;
    quantity: number;
    action: 'buy' | 'sell';
    difference: number;
    targetValueBRL?: number;
    dynamicQuantity?: number;
  }[];
  avgPrice: number;
  totalValue: number;
  hasConflicts?: boolean; // Novo campo para identificar conflitos
  targetValueBRL?: number;
}

export default function SyncPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountPositions, setAccountPositions] = useState<Record<string, AccountPosition[]>>({});
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [strategyAllocations, setStrategyAllocations] = useState<StrategyAllocation[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Estados para o modal de nova posição
  const [showNewPositionModal, setShowNewPositionModal] = useState(false);
  const [newPositionData, setNewPositionData] = useState<{
    ticker: string;
    price: number;
    quantity: number;
    percentage: number;
  }>({
    ticker: "",
    price: 0,
    quantity: 0,
    percentage: 0
  });
  const [newPositionDisplay, setNewPositionDisplay] = useState<{
    price: string;
    quantity: string;
    percentage: string;
  }>({
    price: "",
    quantity: "",
    percentage: ""
  });
  const [savingPosition, setSavingPosition] = useState(false);

  // Estados para o modal de edição
  const [showEditPositionModal, setShowEditPositionModal] = useState(false);
  const [editingPosition, setEditingPosition] = useState<ReferencePosition | null>(null);
  const [editingPositionDisplay, setEditingPositionDisplay] = useState<{
    price: string;
    quantity: string;
    percentage: string;
  }>({
    price: "",
    quantity: "",
    percentage: ""
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados para o modal de seleção de tipo de ordem
  const [showOrderTypeModal, setShowOrderTypeModal] = useState(false);
  const [syncContext, setSyncContext] = useState<{
    type: 'position' | 'all';
    accountId?: string;
    position?: AccountPosition;
  } | null>(null);
  
  // Estados para ajustes de preço e quantidade
  const [adjustedPrice, setAdjustedPrice] = useState(0);
  const [adjustedQuantity, setAdjustedQuantity] = useState(0);
  const [selectedExchange, setSelectedExchange] = useState('B');
  
  // Estados para ordem iceberg
  const [icebergLote, setIcebergLote] = useState(1);
  const [icebergGroupSize, setIcebergGroupSize] = useState(1); // Contas por onda
  const [icebergTwapEnabled, setIcebergTwapEnabled] = useState(false);
  const [icebergTwapInterval, setIcebergTwapInterval] = useState(30);

  // Estados para o valor mínimo de investimento
  const [minInvestmentValue, setMinInvestmentValue] = useState<number>(0);
  const [showEditMinInvestmentModal, setShowEditMinInvestmentModal] = useState(false);
  const [savingMinInvestment, setSavingMinInvestment] = useState(false);

  // Estados para o modal de sincronização de todos os ativos
  const [showSyncAllModal, setShowSyncAllModal] = useState(false);
  const [syncAllData, setSyncAllData] = useState<any[]>([]);
  
  // Estados para o modal de sincronização individual de ativos
  const [showIndividualSyncModal, setShowIndividualSyncModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [individualOrderType, setIndividualOrderType] = useState<'simple' | 'iceberg'>('simple');
  const [individualPrice, setIndividualPrice] = useState(0);
  const [individualQuantity, setIndividualQuantity] = useState(0);
  const [individualExchange, setIndividualExchange] = useState('B');
  const [individualIcebergLote, setIndividualIcebergLote] = useState(1);
  const [individualIcebergTwapEnabled, setIndividualIcebergTwapEnabled] = useState(false);
  const [individualIcebergTwapInterval, setIndividualIcebergTwapInterval] = useState(30);
  
  // Estados para controle da ordem simples individual
  const [isSendingOrder, setIsSendingOrder] = useState(false);
  const [orderResults, setOrderResults] = useState<any[]>([]);

  // Recalcular quantidades dinamicamente com base no preço do modal para o ativo selecionado
  useEffect(() => {
    if (!showIndividualSyncModal || !selectedAsset) return;
    const price = Number(individualPrice) || 0;
    if (price <= 0) {
      // Se preço inválido, manter as quantidades originais do asset
      const totalOrig = (selectedAsset.accounts || []).reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
      setIndividualQuantity(totalOrig);
      return;
    }

    // Recalcular quantidade dinâmica por conta usando targetValueBRL
    const updatedAccounts = (selectedAsset.accounts || []).map((acc: any) => {
      const targetValue = Number(acc.targetValueBRL || 0);
      // Fallback: se não houver alvo em R$, usar a quantidade base calculada previamente
      const baseQty = Number(acc.quantity || 0);
      const dynQty = targetValue > 0 ? Math.round(targetValue / price) : baseQty;
      return { ...acc, dynamicQuantity: Math.max(0, dynQty) };
    });

    // Atualizar soma de quantidades
    const totalDynQty = updatedAccounts.reduce((sum: number, a: any) => sum + (a.dynamicQuantity || 0), 0);

    // Persistir dynamicQuantity no selectedAsset em memória (imutável via novo objeto)
    setSelectedAsset({ ...selectedAsset, accounts: updatedAccounts });
    setIndividualQuantity(totalDynQty);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [individualPrice]);
  
  // Estados para controle da ordem iceberg individual
  const [isSendingIcebergOrder, setIsSendingIcebergOrder] = useState(false);
  const [icebergOrderResults, setIcebergOrderResults] = useState<any[]>([]);
  
  // Estados para controle do progresso sequencial de iceberg
  const [icebergStatus, setIcebergStatus] = useState<Record<string, {
    status: 'waiting' | 'executing' | 'completed' | 'failed' | 'timeout' | 'cancelled';
    progress: number;
    message: string;
    orderId?: string;
  }>>({});
  const [currentExecutingAccount, setCurrentExecutingAccount] = useState<string | null>(null);
  const [canCancelExecution, setCanCancelExecution] = useState(false);

  // Buscar estratégias e contas ao montar o componente
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // Buscar estratégias
        const strategiesSnapshot = await getDocs(collection(db, "strategies"));
        const strategiesList: Strategy[] = [];
        strategiesSnapshot.forEach((doc) => {
          const data = doc.data();
          strategiesList.push({
            id: doc.id,
            name: data.name || "",
            description: data.description || ""
          });
        });
        setStrategies(strategiesList);
        
        // Buscar contas
        const accountsSnapshot = await getDocs(collection(db, "contasDll"));
        const accountsList: Account[] = [];
        accountsSnapshot.forEach((doc) => {
          const data = doc.data();
          accountsList.push({
            _id: doc.id,
            "Nome Cliente": data["Nome Cliente"] || "",
            "Valor Investido": data["Valor Investido"] || 0,
            BrokerID: data.BrokerID || "",
            AccountID: data.AccountID || ""
          });
        });
        setAccounts(accountsList);
        
        // Buscar alocações de estratégias
        const allocationsSnapshot = await getDocs(collection(db, "strategyAllocations"));
        const allocationsList: StrategyAllocation[] = [];
        allocationsSnapshot.forEach((doc) => {
          const data = doc.data();
          allocationsList.push({
            account_id: data.account_id || "",
            broker_id: data.broker_id || 0,
            strategy_id: data.strategy_id || "",
            valor_investido: data.valor_investido || 0
          });
        });
        setStrategyAllocations(allocationsList);
        
      } catch (err: any) {
        setError(`Erro ao buscar dados: ${err.message}`);
        console.error("Erro ao buscar dados do Firebase:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Buscar posições de referência da estratégia selecionada
  const fetchReferencePositions = async (strategyId: string) => {
    try {
      setLoading(true);
      const positionsSnapshot = await getDocs(collection(db, "CarteirasDeRefDLL"));
      const positionsList: Position[] = [];
      
      positionsSnapshot.forEach((doc) => {
        const data = doc.data() as ReferencePosition;
        if (data.strategy_id === strategyId) {
          positionsList.push({
            id: doc.id,
            ticker: data.ticker,
            price: data.price,
            quantity: data.quantity,
            percentage: data.percentage || 0,
            actions: "Editar"
          });
        }
      });
      
      setPositions(positionsList);
    } catch (err: any) {
      setError(`Erro ao buscar posições de referência: ${err.message}`);
      console.error("Erro ao buscar posições de referência:", err);
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar contas baseado na estratégia selecionada e buscar posições
  useEffect(() => {
    if (!selectedStrategy) {
      setPositions([]);
      setFilteredAccounts([]);
      setMinInvestmentValue(0);
      return;
    }

    // Buscar posições de referência da estratégia
    fetchReferencePositions(selectedStrategy.id);

    // Buscar valor mínimo de investimento da estratégia
    fetchMinInvestmentValue(selectedStrategy.id);

    // Filtrar contas que têm alocação na estratégia selecionada e adicionar valor investido da estratégia
    const accountsWithAllocation = accounts
      .filter(account => 
        strategyAllocations.some(allocation => 
          allocation.account_id === account.AccountID && 
          allocation.strategy_id === selectedStrategy.id
        )
      )
      .map(account => {
        // Encontrar a alocação específica para esta conta e estratégia
        const allocation = strategyAllocations.find(allocation => 
          allocation.account_id === account.AccountID && 
          allocation.strategy_id === selectedStrategy.id
        );
        
        // Retornar conta com valor investido da estratégia
        return {
          ...account,
          "Valor Investido Estrategia": allocation?.valor_investido || 0
        };
      });
    setFilteredAccounts(accountsWithAllocation);
  }, [selectedStrategy, accounts, strategyAllocations]);

  // Recarregar posições das contas quando as posições de referência forem carregadas
  useEffect(() => {
    if (positions.length > 0) {
      // Recarregar posições para todas as contas que estão expandidas
      expandedAccounts.forEach(accountId => {
        if (accountPositions[accountId]) {
          console.log(`[useEffect] Recarregando posições para conta ${accountId} após carregamento das posições de referência`);
          loadAccountPositions(accountId);
        }
      });
    }
  }, [positions]);

  // Pré-carregar posições das contas exibidas quando estratégia, contas e posições de referência estiverem prontos
  useEffect(() => {
    if (!selectedStrategy || positions.length === 0 || filteredAccounts.length === 0) return;
    const missingAccounts = filteredAccounts
      .map(acc => acc._id)
      .filter(accId => !accountPositions[accId]);
    if (missingAccounts.length > 0) {
      console.log('[Sincronizador] Pré-carregando posições para contas sem cache:', missingAccounts);
      missingAccounts.forEach(accId => loadAccountPositions(accId));
    }
  }, [selectedStrategy, positions, filteredAccounts]);

  const handleNewPosition = () => {
    setNewPositionData({
      ticker: "",
      price: 0,
      quantity: 0,
      percentage: 0
    });
    setNewPositionDisplay({
      price: "",
      quantity: "",
      percentage: ""
    });
    setShowNewPositionModal(true);
  };

  const handleSaveNewPosition = async () => {
    if (!selectedStrategy) {
      alert("Selecione uma estratégia primeiro!");
      return;
    }

    // Validação corrigida para aceitar quantidades negativas
    if (!newPositionData.ticker || newPositionData.price <= 0 || newPositionData.quantity === 0) {
      alert("Preencha todos os campos obrigatórios!");
      return;
    }

    try {
      setSavingPosition(true);
      
      const positionData: ReferencePosition = {
        strategy_id: selectedStrategy.id,
        ticker: newPositionData.ticker.toUpperCase(),
        price: newPositionData.price,
        quantity: newPositionData.quantity,
        percentage: newPositionData.percentage
      };

      await addDoc(collection(db, "CarteirasDeRefDLL"), positionData);
      
      // Recarregar posições
      await fetchReferencePositions(selectedStrategy.id);
      
      setShowNewPositionModal(false);
      setNewPositionData({
        ticker: "",
        price: 0,
        quantity: 0,
        percentage: 0
      });
      setNewPositionDisplay({
        price: "",
        quantity: "",
        percentage: ""
      });
      
    } catch (err: any) {
      setError(`Erro ao salvar posição: ${err.message}`);
      console.error("Erro ao salvar posição:", err);
    } finally {
      setSavingPosition(false);
    }
  };

  const handleDeletePosition = async (positionId: string) => {
    // Primeira confirmação
    if (!confirm("Tem certeza que deseja excluir esta posição?")) {
      return;
    }
    
    // Segunda confirmação
    if (!confirm("Esta ação não pode ser desfeita. Confirma a exclusão?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "CarteirasDeRefDLL", positionId));
      
      // Recarregar posições
      if (selectedStrategy) {
        await fetchReferencePositions(selectedStrategy.id);
      }
      
    } catch (err: any) {
      setError(`Erro ao excluir posição: ${err.message}`);
      console.error("Erro ao excluir posição:", err);
    }
  };

  const handleEditPosition = async (position: Position) => {
    try {
      // Buscar dados completos da posição no Firebase
      const positionRef = doc(db, "CarteirasDeRefDLL", position.id);
      const positionDoc = await getDoc(positionRef);
      
      if (positionDoc.exists()) {
        const positionData = positionDoc.data() as ReferencePosition;
        setEditingPosition({
          ...positionData,
          id: position.id
        });
        setEditingPositionDisplay({
          price: positionData.price.toString(),
          quantity: positionData.quantity.toString(),
          percentage: (positionData.percentage || 0).toString()
        });
        setShowEditPositionModal(true);
      } else {
        setError("Posição não encontrada");
      }
    } catch (err: any) {
      setError(`Erro ao carregar dados da posição: ${err.message}`);
      console.error("Erro ao carregar dados da posição:", err);
    }
  };

  const handleSaveEditPosition = async () => {
    if (!editingPosition || !editingPosition.id) {
      setError("Dados de edição inválidos");
      return;
    }

    // Validação básica
    if (!editingPosition.ticker.trim()) {
      setError("Ticker é obrigatório");
      return;
    }
    if (editingPosition.price <= 0) {
      setError("Preço deve ser maior que zero");
      return;
    }
    if (editingPosition.quantity === 0) {
      setError("Quantidade não pode ser zero");
      return;
    }

    try {
      setSavingEdit(true);
      
      // Atualizar documento no Firebase
      const positionRef = doc(db, "CarteirasDeRefDLL", editingPosition.id);
      await updateDoc(positionRef, {
        ticker: editingPosition.ticker,
        price: editingPosition.price,
        quantity: editingPosition.quantity,
        percentage: editingPosition.percentage
      });
      
      // Recarregar posições
      if (selectedStrategy) {
        await fetchReferencePositions(selectedStrategy.id);
      }
      
      setShowEditPositionModal(false);
      setEditingPosition(null);
      setEditingPositionDisplay({
        price: "",
        quantity: "",
        percentage: ""
      });
      
    } catch (err: any) {
      setError(`Erro ao atualizar posição: ${err.message}`);
      console.error("Erro ao atualizar posição:", err);
    } finally {
      setSavingEdit(false);
    }
  };

  // Função para buscar valor mínimo de investimento da estratégia
  const fetchMinInvestmentValue = async (strategyId: string) => {
    try {
      const strategyRef = doc(db, "strategies", strategyId);
      const strategyDoc = await getDoc(strategyRef);
      
      if (strategyDoc.exists()) {
        const data = strategyDoc.data();
        setMinInvestmentValue(data.minInvestmentValue || 0);
      }
    } catch (err: any) {
      console.error("Erro ao buscar valor mínimo de investimento:", err);
      setMinInvestmentValue(0);
    }
  };

  // Função para salvar valor mínimo de investimento
  const handleSaveMinInvestment = async () => {
    if (!selectedStrategy) {
      setError("Nenhuma estratégia selecionada");
      return;
    }

    if (minInvestmentValue < 0) {
      setError("Valor mínimo deve ser maior ou igual a zero");
      return;
    }

    try {
      setSavingMinInvestment(true);
      
      // Atualizar documento da estratégia no Firebase
      const strategyRef = doc(db, "strategies", selectedStrategy.id);
      await updateDoc(strategyRef, {
        minInvestmentValue: minInvestmentValue
      });
      
      setShowEditMinInvestmentModal(false);
      
    } catch (err: any) {
      setError(`Erro ao salvar valor mínimo: ${err.message}`);
      console.error("Erro ao salvar valor mínimo:", err);
    } finally {
      setSavingMinInvestment(false);
    }
  };

  // Função para expandir/recolher conta
  const toggleAccountExpansion = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
      // Carregar posições da conta se ainda não foram carregadas
      if (!accountPositions[accountId]) {
        // Verificar se há posições de referência antes de carregar
        if (positions.length > 0) {
        loadAccountPositions(accountId);
        } else {
          console.log('[toggleAccountExpansion] Aguardando carregamento das posições de referência...');
        }
      }
    }
    setExpandedAccounts(newExpanded);
  };

  // Função para obter percentual ideal diretamente da carteira de referência
  const getIdealPercentage = (ticker: string) => {
    if (!positions.length) return 0;
    
    // Encontrar posição de referência
    const refPosition = positions.find(p => p.ticker === ticker);
    if (!refPosition) return 0;
    
    // Retornar diretamente o percentual da carteira de referência
    return refPosition.percentage || 0;
  };

  // Formatação pt-BR para percentuais com 1 casa
  const formatPctBR1 = (n?: number) => {
    if (n === undefined || n === null || isNaN(Number(n))) return '-';
    return `${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  // Helpers de parsing/format para números com vírgula
  const parsePtBRDecimal = (input: string): number => {
    if (!input) return NaN;
    const normalized = input.replace(/\./g, '').replace(',', '.');
    const parsed = Number(normalized);
    return parsed;
  };
  const formatNumberPtBR = (n: number, fractionDigits = 1): string => {
    if (n === undefined || n === null || isNaN(Number(n))) return '';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
  };

  // ===== Ordenação por conta (tabela do sincronizador) =====
  const [accountSortState, setAccountSortState] = useState<Record<string, { key: 'ticker' | 'quantity' | 'price' | 'percentage' | 'idealPercentage' | 'difference'; direction: 'asc' | 'desc' }>>({});

  const handleSortClick = (accountId: string, key: 'ticker' | 'quantity' | 'price' | 'percentage' | 'idealPercentage' | 'difference') => {
    setAccountSortState(prev => {
      const current = prev[accountId];
      const nextDirection: 'asc' | 'desc' = current && current.key === key && current.direction === 'asc' ? 'desc' : 'asc';
      return { ...prev, [accountId]: { key, direction: nextDirection } };
    });
  };

  const sortAccountPositions = (accountId: string, list: any[]) => {
    const baseSorted = [...list].sort((a: any, b: any) => (a.ticker || '').toUpperCase().localeCompare((b.ticker || '').toUpperCase(), 'pt-BR'));
    const state = accountSortState[accountId];
    if (!state) return baseSorted;
    const dir = state.direction === 'asc' ? 1 : -1;
    return baseSorted.sort((a: any, b: any) => {
      const getVal = (p: any) => {
        switch (state.key) {
          case 'ticker': return (p.ticker || '').toUpperCase();
          case 'quantity': return Number(p.quantity) || 0;
          case 'price': return Number(p.price) || 0;
          case 'percentage': return Number(p.percentage) || 0;
          case 'idealPercentage': return Number(p.idealPercentage) || 0;
          case 'difference': return Math.abs((Number(p.percentage) || 0) - (Number(p.idealPercentage) || 0));
        }
      };
      const va = getVal(a);
      const vb = getVal(b);
      if (typeof va === 'string' && typeof vb === 'string') {
        return dir * va.localeCompare(vb, 'pt-BR');
      }
      return dir * ((va as number) - (vb as number));
    });
  };

  // Função para carregar posições reais de uma conta específica
  const loadAccountPositions = async (accountId: string): Promise<AccountPosition[]> => {
    try {
      setLoading(true);
      
      // Encontrar conta para obter AccountID real
      const account = filteredAccounts.find(acc => acc._id === accountId);
      if (!account) {
        throw new Error('Conta não encontrada');
      }
      
      // Usar o AccountID real em vez do ID do documento
      const realAccountId = account.AccountID;
      console.log(`[loadAccountPositions] Usando AccountID real: ${realAccountId} (document ID: ${accountId})`);
      
      // Buscar posições reais da API usando o AccountID real
      const response = await fetch(`/api/client-positions/${realAccountId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Erro ao buscar posições');
      }
      
      const clientInvestmentValue = account["Valor Investido Estrategia"] || 0;
      
      // Criar um mapa das posições reais do cliente
      const realPositionsMap = new Map();
      data.positions.forEach((pos: any) => {
        // Calcular percentage usando a fórmula: (Quantidade X preço) / Valor Investido na Estratégia
        const positionValue = pos.quantity * pos.avgPrice;
        const calculatedPercentage = clientInvestmentValue > 0 ? (positionValue / clientInvestmentValue) * 100 : 0;
        
        realPositionsMap.set(pos.ticker, {
          id: pos.id,
          quantity: pos.quantity,
          price: pos.avgPrice,
          avgBuyPrice: pos.avgBuyPrice || 0,      // NOVO
          avgSellPrice: pos.avgSellPrice || 0,    // NOVO
          totalBuyQty: pos.totalBuyQty || 0,      // NOVO
          totalSellQty: pos.totalSellQty || 0,    // NOVO
          percentage: calculatedPercentage
        });
      });
      
      // Verificar se há posições de referência
      if (positions.length === 0) {
        console.log(`[loadAccountPositions] Nenhuma posição de referência encontrada para a estratégia`);
        setAccountPositions(prev => ({
          ...prev,
          [accountId]: []
        }));
        return [];
      }
      
      // Criar lista completa baseada na carteira de referência
      const completePositions = positions.map(refPos => {
        const realPos = realPositionsMap.get(refPos.ticker);
        
        if (realPos) {
          // Cliente tem posição real para este ticker
          return {
            id: realPos.id,
            ticker: refPos.ticker,
            quantity: realPos.quantity,
            price: realPos.price,
            percentage: realPos.percentage,
            idealPercentage: getIdealPercentage(refPos.ticker)
          };
        } else {
          // Cliente não tem posição real para este ticker - mostrar como zerada
          return {
            id: `virtual_${refPos.ticker}_${accountId}`,
            ticker: refPos.ticker,
            quantity: 0,
            price: 0,
            avgBuyPrice: 0,      // NOVO
            avgSellPrice: 0,     // NOVO
            totalBuyQty: 0,      // NOVO
            totalSellQty: 0,     // NOVO
            percentage: 0,
            idealPercentage: getIdealPercentage(refPos.ticker)
          };
        }
      });
      
      // Adicionar posições do cliente que não constam na carteira de referência
      const referenceTickers = new Set(positions.map(pos => pos.ticker));
      const additionalPositions = data.positions
        .filter((pos: any) => !referenceTickers.has(pos.ticker))
        .map((pos: any) => {
          // Calcular percentage usando a fórmula: (Quantidade X preço) / Valor Investido na Estratégia
          const positionValue = pos.quantity * pos.avgPrice;
          const calculatedPercentage = clientInvestmentValue > 0 ? (positionValue / clientInvestmentValue) * 100 : 0;
          
          return {
            id: pos.id,
            ticker: pos.ticker,
            quantity: pos.quantity,
            price: pos.avgPrice,
            percentage: calculatedPercentage,
            idealPercentage: 0 // Não faz parte da carteira de referência
          };
        });
      
      // Combinar posições de referência com posições adicionais do cliente
      const allPositions = [...completePositions, ...additionalPositions];
      
      setAccountPositions(prev => ({
        ...prev,
        [accountId]: allPositions
      }));
      
      console.log(`[loadAccountPositions] Carregadas ${allPositions.length} posições para conta ${accountId} (${completePositions.length} da carteira de referência + ${additionalPositions.length} adicionais do cliente)`);
      
      return allPositions;
    } catch (error) {
      console.error(`[loadAccountPositions] Erro ao carregar posições para conta ${accountId}:`, error);
      setAccountPositions(prev => ({
        ...prev,
        [accountId]: []
      }));
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Função para carregar posições de todas as contas da estratégia
  const loadAllAccountPositions = async () => {
    if (!selectedStrategy || !filteredAccounts.length) {
      console.log('[loadAllAccountPositions] Nenhuma estratégia selecionada ou contas disponíveis');
      return {} as Record<string, AccountPosition[]>;
    }

    console.log(`[loadAllAccountPositions] Carregando posições para ${filteredAccounts.length} contas`);
    
    // Carregar posições de todas as contas em paralelo
    const loadPromises = filteredAccounts.map(account => loadAccountPositions(account._id));
    
    try {
      const results = await Promise.all(loadPromises);
      console.log('[loadAllAccountPositions] Todas as posições foram carregadas com sucesso');
      // Retornar um snapshot atual das posições por conta para uso imediato
      const snapshot: Record<string, AccountPosition[]> = {};
      filteredAccounts.forEach((acc, idx) => {
        snapshot[acc._id] = results[idx] || [];
      });
      return snapshot;
    } catch (error) {
      console.error('[loadAllAccountPositions] Erro ao carregar posições:', error);
      const snapshot: Record<string, AccountPosition[]> = {};
      filteredAccounts.forEach((acc) => {
        snapshot[acc._id] = accountPositions[acc._id] || [];
      });
      return snapshot;
    }
  };

  // Função para limpar estado do React e forçar recarregamento
  const clearReactStateAndReload = async () => {
    const confirmar = window.confirm(
      "Esta ação irá:\n\n" +
      "1. Limpar o estado do React (cache de posições)\n" +
      "2. Forçar recálculo das posições no backend\n" +
      "3. Recarregar todas as posições\n\n" +
      "Isso resolverá problemas de posições antigas aparecendo incorretamente.\n\n" +
      "Deseja continuar?"
    );
    if (!confirmar) return;

    try {
      console.log("=== LIMPANDO ESTADO DO REACT E RECARREGANDO ===");
      
      // 1. Limpar estados do React
      console.log("1. Limpando estados do React...");
      setAccountPositions({});
      setExpandedAccounts(new Set());
      
      // 2. Forçar recálculo das posições no backend para contas da estratégia
      if (selectedStrategy && filteredAccounts.length > 0) {
        console.log("2. Forçando recálculo das posições no backend...");
        
        for (const account of filteredAccounts) {
          try {
            console.log(`Recalculando posições para conta: ${account.AccountID}`);
            
            const response = await fetch(`http://localhost:8000/force_position_update/${account.AccountID}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                account_id: account.AccountID,
                force_recalculate: true
              })
            });
            
            if (response.ok) {
              console.log(`✅ Posições recalculadas para conta: ${account.AccountID}`);
            } else {
              console.log(`❌ Erro ao recalcular posições para conta: ${account.AccountID}`);
            }
            
            // Pequena pausa entre as chamadas
            await new Promise(resolve => setTimeout(resolve, 100));
            
          } catch (error) {
            console.error(`Erro ao recalcular posições para conta ${account.AccountID}:`, error);
          }
        }
      }
      
      // 3. Recarregar posições de referência
      console.log("3. Recarregando posições de referência...");
      await fetchReferencePositions(selectedStrategy!.id);
      
      // 4. Recarregar posições de todas as contas
      console.log("4. Recarregando posições de todas as contas...");
      await loadAllAccountPositions();
      
      console.log("=== LIMPEZA E RECARREGAMENTO CONCLUÍDO ===");
      
      alert("✅ Estado limpo e posições recarregadas com sucesso!");
      
    } catch (error) {
      console.error("Erro durante limpeza e recarregamento:", error);
      alert("❌ Erro durante a limpeza. Verifique o console para mais detalhes.");
    }
  };

  // Função para calcular dados reais de sincronização
  const calculateSyncAllData = (
    referencePositionsParam?: Position[],
    filteredAccountsParam?: Account[],
    accountPositionsSnapshotParam?: Record<string, AccountPosition[]>
  ): SyncAssetData[] => {
    const referencePositions = referencePositionsParam ?? positions;
    const filteredAccountsLocal = filteredAccountsParam ?? filteredAccounts;
    const accountPositionsSnapshot = accountPositionsSnapshotParam ?? accountPositions;

    if (!selectedStrategy || !referencePositions.length || !filteredAccountsLocal.length) {
      console.log('[calculateSyncAllData] Dados insuficientes para cálculo');
      return [];
    }

    console.log('[calculateSyncAllData] Iniciando cálculo de dados de sincronização');
    
    // Usar Map para agrupar por ticker + ação (resolver conflitos)
    const syncDataMap = new Map<string, SyncAssetData>();
    const accountsNeedingSync: any[] = [];

    // 1. Analisar ativos da carteira de referência
    referencePositions.forEach(referencePosition => {
      const ticker = referencePosition.ticker;
      const percentualIdeal = referencePosition.percentage || 0;
      const precoReferencia = referencePosition.price || 0;

      console.log(`[calculateSyncAllData] Analisando posição ${ticker}: percentual=${percentualIdeal}%, preço=${precoReferencia}`);

      if (precoReferencia <= 0) {
        console.log(`[calculateSyncAllData] Pular ${ticker}: preço inválido`);
        return; // Pular posições com preço inválido
      }

      // Verificar cada conta da estratégia
      filteredAccountsLocal.forEach(account => {
        const clientPositions = accountPositionsSnapshot[account._id];
        if (!clientPositions) {
          return; // Pular contas sem posições carregadas
        }

        const clientPosition = clientPositions.find(p => p.ticker === ticker);
        const percentualAtual = clientPosition?.percentage || 0;
        const diferenca = percentualIdeal - percentualAtual;

        // Só incluir se diferença > 0.5%
        if (Math.abs(diferenca) > 0.5) {
          const valorInvestido = account["Valor Investido Estrategia"] || 0;
          
          if (valorInvestido > 0) {
            // Novo: guardar alvo em valor (R$) para permitir re-cálculo por preço dinâmico no modal
            const targetValueBRL = Math.abs(diferenca) / 100 * valorInvestido;
            const quantidadeNecessaria = Math.round(targetValueBRL / precoReferencia);
            
            if (quantidadeNecessaria > 0) {
              console.log(`[calculateSyncAllData] ${ticker} para ${account["Nome Cliente"]}: ${diferenca > 0 ? 'COMPRAR' : 'VENDER'} ${quantidadeNecessaria} ações (diferença: ${diferenca.toFixed(2)}%)`);
              accountsNeedingSync.push({
                ticker,
                accountId: account._id,
                accountName: account["Nome Cliente"],
                quantity: quantidadeNecessaria,
                action: diferenca > 0 ? 'buy' : 'sell',
                difference: Math.abs(diferenca),
                precoReferencia,
                targetValueBRL
              });
            }
          }
        }
      });
    });

    // 2. Analisar ativos adicionais (posições de clientes que não estão na carteira de referência)
    console.log('[calculateSyncAllData] Iniciando análise de posições adicionais...');
    console.log('[calculateSyncAllData] Tickers na carteira de referência:', referencePositions.map(p => p.ticker));
    
    filteredAccountsLocal.forEach(account => {
      const clientPositions = accountPositionsSnapshot[account._id];
      if (!clientPositions) {
        console.log(`[calculateSyncAllData] Conta ${account["Nome Cliente"]} sem posições carregadas`);
        return;
      }

      console.log(`[calculateSyncAllData] Analisando ${clientPositions.length} posições da conta ${account["Nome Cliente"]}`);
      
      clientPositions.forEach(clientPosition => {
        // Verificar se o ativo não está na carteira de referência
        const isInReference = positions.some(ref => ref.ticker === clientPosition.ticker);
        
        console.log(`[calculateSyncAllData] ${account["Nome Cliente"]} - ${clientPosition.ticker}: quantidade=${clientPosition.quantity}, na_referencia=${isInReference}`);
        
        if (!isInReference && clientPosition.quantity !== 0) {
          // Determinar se é posição long ou short e a ação necessária
          const isShortPosition = clientPosition.quantity < 0;
          const action = isShortPosition ? 'buy' : 'sell'; // Comprar se short, vender se long
          const quantityToExecute = Math.abs(clientPosition.quantity); // Valor absoluto para execução
          
          console.log(`[calculateSyncAllData] ✅ ${account["Nome Cliente"]} - ${clientPosition.ticker} precisa ser zerada! (${isShortPosition ? 'SHORT' : 'LONG'})`);
          
          // Posição adicional que precisa ser zerada
          const valorInvestido = account["Valor Investido Estrategia"] || 0;
          const precoCliente = clientPosition.price || 0;
          
          if (valorInvestido > 0 && precoCliente > 0) {
            accountsNeedingSync.push({
              ticker: clientPosition.ticker,
              accountId: account._id,
              accountName: account["Nome Cliente"],
              quantity: quantityToExecute, // Valor absoluto
              action: action, // 'buy' para short, 'sell' para long
              difference: 100, // Diferença máxima (zerar completamente)
              precoReferencia: precoCliente
            });
            
            console.log(`[calculateSyncAllData] ✅ Adicionada ordem de ${action} para zerar ${clientPosition.ticker}: ${quantityToExecute} ações (${isShortPosition ? 'short' : 'long'})`);
          } else {
            console.log(`[calculateSyncAllData] ❌ ${clientPosition.ticker} ignorada: valorInvestido=${valorInvestido}, precoCliente=${precoCliente}`);
          }
        } else if (!isInReference && clientPosition.quantity === 0) {
          console.log(`[calculateSyncAllData] ⚠️ ${clientPosition.ticker} não está na referência mas quantidade=${clientPosition.quantity} (já zerada)`);
        } else if (isInReference) {
          console.log(`[calculateSyncAllData] ℹ️ ${clientPosition.ticker} está na referência (será tratada na seção 1)`);
        }
      });
    });

    // 3. Agrupar por ticker + ação (nova lógica para resolver conflitos)
    accountsNeedingSync.forEach(account => {
      const groupKey = `${account.ticker}-${account.action}`; // Ex: "TGAR11-buy", "TGAR11-sell"
      
      if (!syncDataMap.has(groupKey)) {
        syncDataMap.set(groupKey, {
          ticker: account.ticker,
          action: account.action,
          totalQuantity: 0,
          accounts: [],
          avgPrice: account.precoReferencia,
          totalValue: 0,
          hasConflicts: false
        });
      }
      
      const syncAsset = syncDataMap.get(groupKey)!;
      syncAsset.accounts.push({
        accountId: account.accountId,
        accountName: account.accountName,
        quantity: account.quantity,
        action: account.action,
        difference: account.difference,
        targetValueBRL: account.targetValueBRL
      });
      
      syncAsset.totalQuantity += account.quantity;
      syncAsset.totalValue += account.quantity * account.precoReferencia;
    });

    // 4. Detectar conflitos
    const tickerActions = new Map<string, Set<'buy' | 'sell'>>();
    
    syncDataMap.forEach((asset, groupKey) => {
      const [ticker, action] = groupKey.split('-');
      
      if (!tickerActions.has(ticker)) {
        tickerActions.set(ticker, new Set());
      }
      
      tickerActions.get(ticker)!.add(action as 'buy' | 'sell');
    });

    // Marcar conflitos
    syncDataMap.forEach((asset, groupKey) => {
      const [ticker] = groupKey.split('-');
      const actions = tickerActions.get(ticker);
      
      if (actions && actions.size > 1) {
        asset.hasConflicts = true;
        console.log(`[calculateSyncAllData] Ticker ${ticker} tem ações conflitantes:`, Array.from(actions));
      }
    });

    // 5. Converter para array e ordenar
    const syncData = Array.from(syncDataMap.values());
    
    // Ordenar por conflitos primeiro, depois por ticker
    syncData.sort((a, b) => {
      // Conflitos primeiro
      if (a.hasConflicts && !b.hasConflicts) return -1;
      if (!a.hasConflicts && b.hasConflicts) return 1;
      
      // Depois por ticker
      return a.ticker.localeCompare(b.ticker);
    });

    console.log(`[calculateSyncAllData] Calculados ${syncData.length} ativos para sincronização`);
    
    // Log de conflitos
    const conflicts = syncData.filter(asset => asset.hasConflicts);
    if (conflicts.length > 0) {
      console.log(`[calculateSyncAllData] Conflitos detectados em ${conflicts.length} ativos:`);
      conflicts.forEach(asset => {
        console.log(`  - ${asset.ticker}: ${asset.accounts.length} contas afetadas`);
      });
    }
    
    return syncData;
  };

  // Função para validar dados da ordem
  const validateOrderData = (asset: any, price: number, quantity: number, exchange: string): string | null => {
    if (!asset) {
      return "Ativo não selecionado";
    }
    
    if (price <= 0) {
      return "Preço deve ser maior que zero";
    }
    
    if (quantity <= 0) {
      return "Quantidade deve ser maior que zero";
    }
    
    if (!['B', 'F', 'C', 'E'].includes(exchange)) {
      return "Exchange inválida";
    }
    
    if (!asset.accounts || asset.accounts.length === 0) {
      return "Nenhuma conta afetada encontrada";
    }
    
    return null; // Dados válidos
  };

  // Função para calcular quantidades proporcionais por conta
  const calculateQuantitiesPerAccount = (asset: any, totalQuantity: number) => {
    const totalValueInvested = asset.accounts.reduce((sum: number, acc: any) => {
      const account = filteredAccounts.find(a => a._id === acc.accountId);
      return sum + (account?.["Valor Investido Estrategia"] || 0);
    }, 0);

    if (totalValueInvested <= 0) {
      // Se não há valor investido, distribuir igualmente
      const equalQuantity = Math.floor(totalQuantity / asset.accounts.length);
      return asset.accounts.map((acc: any) => ({
        accountId: acc.accountId,
        quantity: equalQuantity
      }));
    }

    return asset.accounts.map((acc: any) => {
      const account = filteredAccounts.find(a => a._id === acc.accountId);
      const valueInvested = account?.["Valor Investido Estrategia"] || 0;
      const proportion = valueInvested / totalValueInvested;
      return {
        accountId: acc.accountId,
        quantity: Math.round(totalQuantity * proportion)
      };
    });
  };

  // Função para buscar BrokerID de uma conta
  const getBrokerIdForAccount = async (accountId: string): Promise<number | null> => {
    try {
      const response = await fetch('http://localhost:8000/accounts');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const accountsData = await response.json();
      const accounts = accountsData.accounts || accountsData; // Compatibilidade com diferentes formatos
      
      if (!Array.isArray(accounts)) {
        console.error('[getBrokerIdForAccount] Resposta não é um array:', accountsData);
        return null;
      }
      
      const account = accounts.find((acc: any) => acc.AccountID === accountId);
      
      if (account) {
        return account.BrokerID;
      }
      
      console.warn(`[getBrokerIdForAccount] Conta ${accountId} não encontrada no DLL`);
      return null;
    } catch (error) {
      console.error(`[getBrokerIdForAccount] Erro ao buscar BrokerID para conta ${accountId}:`, error);
      return null;
    }
  };

  // Função para formatar resposta da ordem
  const formatOrderResponse = (response: any, accountName: string): string => {
    if (response.success) {
      return `✅ ${accountName}: Ordem enviada com sucesso`;
    } else {
      const errorCode = response.error_code || 'UNKNOWN';
      let errorMessage = response.error_message || 'Erro desconhecido';
      
      // Traduzir códigos de erro comuns
      switch (errorCode) {
        case '-2147483636':
          errorMessage = 'Ativo não encontrado na corretora';
          break;
        case '-2147483635':
          errorMessage = 'Saldo insuficiente';
          break;
        case '-2147483634':
          errorMessage = 'Quantidade inválida';
          break;
        default:
          errorMessage = `Erro ${errorCode}: ${errorMessage}`;
      }
      
      return `❌ ${accountName}: ${errorMessage}`;
    }
  };

  // Função para sincronizar todas as posições
  const handleSyncAll = async () => {
    if (!selectedStrategy) {
      alert("Selecione uma estratégia primeiro!");
      return;
    }
    
    console.log("[handleSyncAll] Iniciando sincronização de todas as posições");
    console.log("AccountPositions atual:", accountPositions);
    console.log("Total de posições:", Object.values(accountPositions).flat().length);

    // Garantir que as posições de referência da estratégia estejam carregadas antes de carregar posições das contas
    if (!positions.length) {
      await fetchReferencePositions(selectedStrategy.id);
    }

    // Carregar posições de todas as contas (agora com referência disponível)
    const accountPositionsSnapshot = await loadAllAccountPositions();
    
    // Calcular dados reais de sincronização usando snapshots estáveis
    const realSyncData = calculateSyncAllData([...positions], [...filteredAccounts], accountPositionsSnapshot);
    
    console.log("[handleSyncAll] Dados calculados:", realSyncData);
    
    if (realSyncData.length === 0) {
      alert("Nenhuma posição precisa de sincronização! Todas as posições estão dentro da tolerância de 0.5%.");
      return;
    }
    
    setSyncAllData(realSyncData);
    setShowSyncAllModal(true);
  };

  // Função para sincronizar posição
  const handleSyncPosition = (accountId: string, position: AccountPosition) => {
    // Calcular quantidade necessária para sincronização
    const account = filteredAccounts.find((acc: any) => acc._id === accountId);
    const valorInvestidoEstrategia = account?.["Valor Investido Estrategia"] || 0;
    const percentualAtual = position.percentage || 0;
    const percentualIdeal = position.idealPercentage || 0;
    const diferencaPercentual = percentualIdeal - percentualAtual;
    
    let quantidadeCalculada = 0;
    if (valorInvestidoEstrategia > 0 && Math.abs(diferencaPercentual) > 0.1) {
      const valorDiferenca = (Math.abs(diferencaPercentual) / 100) * valorInvestidoEstrategia;
      quantidadeCalculada = Math.round(valorDiferenca / (position.price || 1));
    }
    
    // Inicializar valores ajustados
    setAdjustedPrice(position.price || 0);
    setAdjustedQuantity(quantidadeCalculada);
    
    // Inicializar valores iceberg com valores padrão inteligentes
    const quantidadeFinal = quantidadeCalculada > 0 ? quantidadeCalculada : 0;
    if (quantidadeFinal > 0) {
      // Calcular tamanho do lote baseado na quantidade total
      let lotePadrao = 1;
      if (quantidadeFinal > 1000) {
        lotePadrao = Math.max(50, Math.floor(quantidadeFinal / 20)); // 5% da quantidade total
      } else if (quantidadeFinal > 100) {
        lotePadrao = Math.max(10, Math.floor(quantidadeFinal / 10)); // 10% da quantidade total
      } else {
        lotePadrao = Math.max(1, Math.floor(quantidadeFinal / 5)); // 20% da quantidade total
      }
      setIcebergLote(lotePadrao);
    } else {
      setIcebergLote(1);
    }
    
    // Resetar configurações TWAP
    setIcebergTwapEnabled(false);
    setIcebergTwapInterval(30);
    
    setSyncContext({ type: 'position', accountId: accountId, position: position });
    setShowOrderTypeModal(true);
  };

  // Função para calcular percentual de sincronização
  const calculateSyncPercentage = (accountId: string) => {
    const tolerancePctForPercent = 2; // Tolerância usada para considerar sincronizado no percentual (alinhado ao UI)
    try {
      console.log('[calculateSyncPercentage] Iniciando cálculo', { accountId });
    } catch (_) {}
    if (!positions.length || !accountPositions[accountId] || !selectedStrategy) {
      try {
        console.log('[calculateSyncPercentage] Dados insuficientes', {
          hasPositions: !!positions.length,
          hasAccountPositions: !!accountPositions[accountId],
          hasStrategy: !!selectedStrategy,
          availableAccountKeys: Object.keys(accountPositions || {})
        });
        // Se faltam posições da conta, tentar carregar on-demand
        if (selectedStrategy && positions.length && !accountPositions[accountId]) {
          console.log('[calculateSyncPercentage] Carregando posições on-demand para conta', accountId);
          loadAccountPositions(accountId);
        }
      } catch (_) {}
      return { percentage: 0, color: '#6b7280' };
    }
    
    const referencePositions = positions.filter(pos => pos.ticker !== 'LFTS11');
    const clientPositions = accountPositions[accountId].filter(cp => cp.ticker !== 'LFTS11');

    try {
      console.log('[calculateSyncPercentage] Tickers considerados (referência):', referencePositions.map(p => p.ticker));
      console.log('[calculateSyncPercentage] Tickers considerados (cliente):', clientPositions.map(cp => cp.ticker));
    } catch (_) {}
    
    // Encontrar a conta para obter o valor investido na estratégia
    const account = filteredAccounts.find(acc => acc._id === accountId);
    if (!account || !account["Valor Investido Estrategia"]) {
      return { percentage: 0, color: '#6b7280' };
    }
    
    let totalMatches = 0;
    let totalPositions = referencePositions.length;
    
    referencePositions.forEach(refPos => {
      const clientPos = clientPositions.find(cp => cp.ticker === refPos.ticker);
      if (clientPos) {
        // Comparar percentual real vs ideal
        const percentageDifference = Math.abs((clientPos.percentage || 0) - (clientPos.idealPercentage || 0));
        
        // Considerar sincronizado se diferença < tolerância
        if (percentageDifference < tolerancePctForPercent) {
          totalMatches++;
        }
        try {
          console.log('[calculateSyncPercentage] Diferença', {
            ticker: refPos.ticker,
            atual: clientPos.percentage || 0,
            ideal: clientPos.idealPercentage || 0,
            diff: percentageDifference,
            dentroDaTolerancia: percentageDifference < tolerancePctForPercent
          });
        } catch (_) {}
      }
    });
    
    const syncPercentage = totalPositions > 0 ? (totalMatches / totalPositions) * 100 : 0;
    try {
      console.log('[calculateSyncPercentage] Totais', { totalMatches, totalPositions, syncPercentage });
    } catch (_) {}
    
    // Definir cor baseada no percentual
    let color = '#dc2626'; // Vermelho (0-50%)
    if (syncPercentage >= 80) {
      color = '#16a34a'; // Verde (80-100%)
    } else if (syncPercentage >= 60) {
      color = '#ca8a04'; // Amarelo (60-79%)
    } else if (syncPercentage >= 50) {
      color = '#ea580c'; // Laranja (50-59%)
    }
    
    return { percentage: syncPercentage, color };
  };

  // Função principal para enviar ordem simples individual
  const sendIndividualSimpleOrder = async () => {
    if (!selectedAsset) {
      alert("Erro: Ativo não selecionado");
      return;
    }

    console.log('[sendIndividualSimpleOrder] Iniciando ordem simples individual');
    console.log('[sendIndividualSimpleOrder] Dados:', {
      ticker: selectedAsset.ticker,
      action: selectedAsset.action,
      price: individualPrice,
      quantity: individualQuantity,
      exchange: individualExchange
    });

    // Validar dados da ordem
    const validationError = validateOrderData(selectedAsset, individualPrice, individualQuantity, individualExchange);
    if (validationError) {
      alert(`Erro de validação: ${validationError}`);
      return;
    }

    // Confirmação antes do envio
    const confirmMessage = `
Confirmar Ordem Simples:

Ativo: ${selectedAsset.ticker}
Ação: ${selectedAsset.action === 'buy' ? 'COMPRA' : 'VENDA'}
Preço: R$ ${individualPrice.toFixed(2)}
Quantidade Total: ${individualQuantity.toLocaleString('pt-BR')} ações
Valor Total: R$ ${(individualPrice * individualQuantity).toLocaleString('pt-BR')}
Exchange: ${individualExchange}
Contas Afetadas: ${selectedAsset.accounts.length}

Deseja prosseguir?
    `.trim();

    if (!confirm(confirmMessage)) {
      console.log('[sendIndividualSimpleOrder] Usuário cancelou a operação');
      return;
    }

    // Iniciar processo de envio
    setIsSendingOrder(true);
    setOrderResults([]);

    try {
      // Calcular quantidades por conta
      // Usar quantidades dinâmicas por conta (calculadas a partir do targetValueBRL e do preço do modal)
      const quantitiesPerAccount = (selectedAsset.accounts || []).map((acc: any) => {
        const price = Number(individualPrice) || 0;
        const computedDyn = acc.dynamicQuantity ?? (acc.targetValueBRL && price > 0 ? Math.round(Number(acc.targetValueBRL) / price) : Number(acc.quantity || 0));
        return {
          accountId: acc.accountId,
          quantity: Math.max(0, Number(computedDyn || 0))
        };
      });
      console.log('[sendIndividualSimpleOrder] Quantidades por conta:', quantitiesPerAccount);

      const results: any[] = [];
      let successCount = 0;
      let errorCount = 0;
      // Gerar um master_batch_id único para TODAS as ordens deste envio simples
      const masterBatchId = uuidv4();

      // Enviar ordens para cada conta
      for (const accountData of quantitiesPerAccount) {
        if (accountData.quantity <= 0) {
          console.log(`[sendIndividualSimpleOrder] Pulando conta ${accountData.accountId} - quantidade zero`);
          continue;
        }

        try {
          // Buscar BrokerID da conta
          console.log(`[sendIndividualSimpleOrder] Buscando BrokerID para accountId: ${accountData.accountId}`);
          
          // Primeiro, buscar a conta no filteredAccounts para obter o AccountID real
          const account = filteredAccounts.find(acc => acc._id === accountData.accountId);
          if (!account) {
            console.error(`[sendIndividualSimpleOrder] Conta ${accountData.accountId} não encontrada no filteredAccounts`);
            const accountName = selectedAsset.accounts.find((acc: any) => acc.accountId === accountData.accountId)?.accountName || 'Conta Desconhecida';
            results.push({
              accountName,
              success: false,
              error_message: 'Conta não encontrada'
            });
            errorCount++;
            continue;
          }
          
          console.log(`[sendIndividualSimpleOrder] AccountID real: ${account.AccountID}`);
          const brokerId = await getBrokerIdForAccount(account.AccountID);
          
          if (!brokerId) {
            const accountName = selectedAsset.accounts.find((acc: any) => acc.accountId === accountData.accountId)?.accountName || 'Conta Desconhecida';
            results.push({
              accountName,
              success: false,
              error_message: 'BrokerID não encontrado'
            });
            errorCount++;
            continue;
          }

          // Preparar payload da ordem
          const orderPayload = {
            account_id: account.AccountID, // Usar AccountID real, não o _id
            broker_id: brokerId,
            ticker: selectedAsset.ticker,
            quantity: accountData.quantity,
            price: Math.round(individualPrice * 100) / 100, // Arredondar para 2 casas decimais
            side: selectedAsset.action,
            exchange: individualExchange,
            strategy_id: selectedStrategy?.id || 'individual-sync',
            master_batch_id: masterBatchId,
            master_base_qty: individualQuantity
          };

          console.log(`[sendIndividualSimpleOrder] Enviando ordem para conta ${accountData.accountId}:`, orderPayload);

          // Enviar ordem
          const response = await fetch('http://localhost:8000/order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderPayload)
          });

          const result = await response.json();
          console.log(`[sendIndividualSimpleOrder] Resposta da ordem para ${accountData.accountId}:`, result);

          const accountName = selectedAsset.accounts.find((acc: any) => acc.accountId === accountData.accountId)?.accountName || 'Conta Desconhecida';
          
          results.push({
            accountName,
            success: result.success || false,
            error_code: result.error_code,
            error_message: result.error_message || result.message
          });

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
          }

          // Pequena pausa entre ordens para não sobrecarregar
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`[sendIndividualSimpleOrder] Erro ao enviar ordem para conta ${accountData.accountId}:`, error);
          const accountName = selectedAsset.accounts.find((acc: any) => acc.accountId === accountData.accountId)?.accountName || 'Conta Desconhecida';
          results.push({
            accountName,
            success: false,
            error_message: 'Erro de conexão'
          });
          errorCount++;
        }
      }

      // Mostrar resultados
      setOrderResults(results);
      
      const resultMessage = `
Resultado da Ordem Simples:

✅ Sucessos: ${successCount}
❌ Erros: ${errorCount}
📊 Total: ${results.length}

${results.map(r => formatOrderResponse(r, r.accountName)).join('\n')}
      `.trim();

      if (successCount > 0) {
        alert(`Ordem enviada com sucesso!\n\n${resultMessage}`);
        
        // Recarregar posições após 3 segundos
        setTimeout(async () => {
          console.log('[sendIndividualSimpleOrder] Recarregando posições...');
          await loadAllAccountPositions();
        }, 3000);
      } else {
        alert(`Falha ao enviar ordens!\n\n${resultMessage}`);
      }

    } catch (error) {
      console.error('[sendIndividualSimpleOrder] Erro geral:', error);
      alert(`Erro ao processar ordens: ${error}`);
    } finally {
      setIsSendingOrder(false);
    }
  };

  // Função para validar dados da ordem iceberg
  const validateIcebergData = (lote: number, twapEnabled: boolean, twapInterval: number): string | null => {
    if (lote <= 0) {
      return "Tamanho do lote deve ser maior que zero";
    }
    
    if (twapEnabled) {
      if (twapInterval < 5 || twapInterval > 300) {
        return "Intervalo TWAP deve estar entre 5 e 300 segundos";
      }
    }
    
    return null;
  };

  // Função para calcular quantidades e lotes iceberg por conta
  const calculateIcebergQuantities = (asset: any, totalQuantity: number, loteSize: number) => {
    // Usar as quantidades específicas já calculadas para cada conta
    // em vez de redistribuir proporcionalmente
    const quantitiesPerAccount = asset.accounts.map((acc: any) => ({
      accountId: acc.accountId,
      quantity: acc.quantity // Usar quantidade específica já calculada
    }));
    
    return quantitiesPerAccount.map((acc: any) => {
      // Se a quantidade total for menor ou igual ao lote, usar 1 lote
      if (acc.quantity <= loteSize) {
        return {
          ...acc,
          adjustedLote: acc.quantity, // Lote = quantidade total
          totalLotes: 1
        };
      }
      
      // Calcular número real de lotes
      const totalLotes = Math.ceil(acc.quantity / loteSize);
      
      return {
        ...acc,
        adjustedLote: loteSize,
        totalLotes: totalLotes
      };
    });
  };

  // Função para calcular tempo estimado de execução iceberg
  const estimateIcebergTime = (totalLotes: number, twapEnabled: boolean, twapInterval: number): number => {
    if (!twapEnabled) {
      return 0; // Execução imediata
    }
    
    // Tempo estimado = total de lotes × intervalo TWAP
    return totalLotes * twapInterval;
  };

  // Função para formatar resposta da ordem iceberg
  const formatIcebergResponse = (response: any, accountName: string, totalLotes: number): string => {
    if (response.success) {
      return `✅ ${accountName}: Ordem iceberg enviada com sucesso (${totalLotes} lotes)`;
    } else {
      const errorCode = response.error_code || 'UNKNOWN';
      let errorMessage = response.error_message || 'Erro desconhecido';
      
      // Traduzir códigos de erro comuns
      switch (errorCode) {
        case '-2147483636':
          errorMessage = 'Ativo não encontrado na corretora';
          break;
        case '-2147483635':
          errorMessage = 'Saldo insuficiente';
          break;
        case '-2147483634':
          errorMessage = 'Quantidade inválida';
          break;
        default:
          errorMessage = `Erro ${errorCode}: ${errorMessage}`;
      }
      
      return `❌ ${accountName}: ${errorMessage}`;
    }
  };

  // Função para aguardar conclusão do iceberg
  const waitForIcebergCompletion = async (accountId: string, orderId: string): Promise<boolean> => {
    const maxWaitTime = 600 * 60 * 1000; // 600 minutos máximo
    const checkInterval = 5000; // Verificar a cada 5 segundos
    const startTime = Date.now();
    
    console.log(`[waitForIcebergCompletion] Iniciando monitoramento do iceberg ${orderId} para conta ${accountId}`);
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Verificar status do iceberg primeiro
        const statusResponse = await fetch(`http://localhost:8000/iceberg_status/${orderId}`);
        
        if (!statusResponse.ok) {
          console.warn(`[waitForIcebergCompletion] Erro HTTP ${statusResponse.status} ao verificar status`);
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          continue;
        }
        
        const status = await statusResponse.json();
        console.log(`[waitForIcebergCompletion] Status do iceberg ${orderId}:`, status);
        console.log(`[waitForIcebergCompletion] Status fields - completed: ${status.completed}, failed: ${status.failed}, status: ${status.status}`);
        
        // Atualizar progresso na interface
        if (status.progress) {
          const progressPercent = (status.progress.executed_lotes / status.progress.total_lotes) * 100;
          setIcebergStatus(prev => ({
            ...prev,
            [accountId]: {
              ...prev[accountId],
              progress: progressPercent,
              message: `Lote ${status.progress.executed_lotes}/${status.progress.total_lotes}`
            }
          }));
        }
        
        if (status.completed) {
          console.log(`[waitForIcebergCompletion] ✅ Iceberg ${orderId} REALMENTE CONCLUÍDO por campo 'completed' para conta ${accountId}`);
          setIcebergStatus(prev => ({
            ...prev,
            [accountId]: {
              ...prev[accountId],
              status: 'completed',
              progress: 100,
              message: 'Concluído com sucesso'
            }
          }));
          return true;
        }
        
        // Verificar se o progresso está 100% (apenas para log, não para conclusão)
        if (status.progress && status.progress.executed_lotes >= status.progress.total_lotes && status.progress.total_lotes > 0) {
          console.log(`[waitForIcebergCompletion] Progresso 100% atingido para iceberg ${orderId}, aguardando finalização no backend...`);
        }
        
        // Verificar se o status é 'completed' diretamente
        if (status.status === 'completed') {
          console.log(`[waitForIcebergCompletion] ✅ Iceberg ${orderId} REALMENTE CONCLUÍDO por status 'completed' para conta ${accountId}`);
          setIcebergStatus(prev => ({
            ...prev,
            [accountId]: {
              ...prev[accountId],
              status: 'completed',
              progress: 100,
              message: 'Concluído com sucesso'
            }
          }));
          return true;
        }
        
        if (status.failed || status.status === 'failed') {
          console.error(`[waitForIcebergCompletion] Iceberg ${orderId} falhou para conta ${accountId}:`, status.error_message);
          setIcebergStatus(prev => ({
            ...prev,
            [accountId]: {
              ...prev[accountId],
              status: 'failed',
              progress: 0,
              message: status.error_message || 'Falha na execução'
            }
          }));
          return false;
        }
        
        // Verificar se a execução foi cancelada pelo usuário (apenas se não foi concluída)
        if (!canCancelExecution) {
          console.log(`[waitForIcebergCompletion] Execução cancelada pelo usuário`);
          throw new Error('CANCELLED');
        }
        
        // Aguardar antes da próxima verificação
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        
      } catch (error) {
        console.error(`[waitForIcebergCompletion] Erro ao verificar status do iceberg ${orderId}:`, error);
        // Continuar tentando
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }
    
    console.warn(`[waitForIcebergCompletion] Timeout após ${maxWaitTime / 1000 / 60} minutos aguardando iceberg ${orderId}`);
    setIcebergStatus(prev => ({
      ...prev,
      [accountId]: {
        ...prev[accountId],
        status: 'timeout',
        progress: 0,
        message: 'Timeout - execução demorou muito'
      }
    }));
    return false;
  };

  // Função para cancelar execução do iceberg
  const cancelIcebergExecution = async () => {
    if (!currentExecutingAccount) {
      return;
    }
    
    // Confirmação antes de cancelar
    if (!confirm('Tem certeza que deseja cancelar a execução do iceberg atual? Esta ação não pode ser desfeita.')) {
      return;
    }
    
    const currentStatus = icebergStatus[currentExecutingAccount];
    if (currentStatus?.orderId) {
      try {
        console.log(`[cancelIcebergExecution] Cancelando iceberg ${currentStatus.orderId}`);
        const response = await fetch(`http://localhost:8000/cancel_iceberg/${currentStatus.orderId}`, {
          method: 'POST'
        });
        
        if (response.ok) {
          console.log(`[cancelIcebergExecution] Iceberg ${currentStatus.orderId} cancelado com sucesso`);
          setIcebergStatus(prev => ({
            ...prev,
            [currentExecutingAccount]: {
              ...prev[currentExecutingAccount],
              status: 'cancelled',
              message: 'Cancelado pelo usuário'
            }
          }));
        }
      } catch (error) {
        console.error(`[cancelIcebergExecution] Erro ao cancelar iceberg:`, error);
      }
    }
    
    setCanCancelExecution(false);
    setCurrentExecutingAccount(null);
  };

  // Função principal para enviar ordem iceberg individual
  const sendIndividualIcebergOrder = async () => {
    if (!selectedAsset) {
      alert("Erro: Ativo não selecionado");
      return;
    }

    console.log('[sendIndividualIcebergOrder] Iniciando ordem iceberg individual');
    console.log('[sendIndividualIcebergOrder] Dados:', {
      ticker: selectedAsset.ticker,
      action: selectedAsset.action,
      price: individualPrice,
      quantity: individualQuantity,
      exchange: individualExchange,
      lote: individualIcebergLote,
      twapEnabled: individualIcebergTwapEnabled,
      twapInterval: individualIcebergTwapInterval
    });

    // Validar dados da ordem
    const validationError = validateOrderData(selectedAsset, individualPrice, individualQuantity, individualExchange);
    if (validationError) {
      alert(`Erro de validação: ${validationError}`);
      return;
    }

    // Validar dados específicos do iceberg
    const icebergValidationError = validateIcebergData(individualIcebergLote, individualIcebergTwapEnabled, individualIcebergTwapInterval);
    if (icebergValidationError) {
      alert(`Erro de validação iceberg: ${icebergValidationError}`);
      return;
    }

          // Calcular quantidades e lotes por conta
      // Derivar quantidades dinâmicas atuais para iceberg
      const selectedWithDynamic = {
        ...selectedAsset,
        accounts: (selectedAsset.accounts || []).map((acc: any) => ({
          accountId: acc.accountId,
          quantity: (() => {
            const price = Number(individualPrice) || 0;
            const computedDyn = acc.dynamicQuantity ?? (acc.targetValueBRL && price > 0 ? Math.round(Number(acc.targetValueBRL) / price) : Number(acc.quantity || 0));
            return Math.max(0, Number(computedDyn || 0));
          })()
        }))
      };
      const icebergQuantities = calculateIcebergQuantities(selectedWithDynamic, individualQuantity, individualIcebergLote);
      console.log('[sendIndividualIcebergOrder] Quantidades iceberg por conta:', icebergQuantities);
      
      // Log detalhado das quantidades para debug
      console.log('[sendIndividualIcebergOrder] Detalhamento das quantidades:');
      selectedAsset.accounts.forEach((acc: any) => {
        const icebergData = icebergQuantities.find((iq: any) => iq.accountId === acc.accountId);
        console.log(`  - ${acc.accountName}: ${acc.quantity} ações → ${icebergData?.quantity || 0} ações (${icebergData?.totalLotes || 0} lotes)`);
      });

    // Calcular tempo estimado por conta e total
    const totalLotes = icebergQuantities.reduce((sum: number, acc: any) => sum + acc.totalLotes, 0);
    const estimatedTimePerAccount = estimateIcebergTime(totalLotes / selectedAsset.accounts.length, individualIcebergTwapEnabled, individualIcebergTwapInterval);
    const estimatedTotalTime = estimatedTimePerAccount * selectedAsset.accounts.length;

    // Confirmação antes do envio
    const confirmMessage = `
Confirmar Ordem Iceberg (Execução Sequencial):

Ativo: ${selectedAsset.ticker}
Ação: ${selectedAsset.action === 'buy' ? 'COMPRA' : 'VENDA'}
Preço: R$ ${individualPrice.toFixed(2)}
Quantidade Total: ${individualQuantity.toLocaleString('pt-BR')} ações
Valor Total: R$ ${(individualPrice * individualQuantity).toLocaleString('pt-BR')}
Exchange: ${individualExchange}

Configurações Iceberg:
• Tamanho do Lote: ${individualIcebergLote} ações
• Total de Lotes: ${totalLotes}
• TWAP: ${individualIcebergTwapEnabled ? 'ATIVO' : 'INATIVO'}
${individualIcebergTwapEnabled ? `• Intervalo: ${individualIcebergTwapInterval} segundos` : ''}
${individualIcebergTwapEnabled ? `• Tempo Estimado por Conta: ${Math.round(estimatedTimePerAccount / 60)} minutos` : ''}
• Execução: SEQUENCIAL (uma conta por vez)
• Tempo Total Estimado: ${Math.round(estimatedTotalTime / 60)} minutos

Contas Afetadas: ${selectedAsset.accounts.length}

Deseja prosseguir?
    `.trim();

    if (!confirm(confirmMessage)) {
      console.log('[sendIndividualIcebergOrder] Usuário cancelou a operação');
      return;
    }

    // Iniciar processo de envio sequencial
    console.log('[sendIndividualIcebergOrder] Iniciando processo de envio sequencial');
    setIsSendingIcebergOrder(true);
    setIcebergOrderResults([]);
    // Garantir que canCancelExecution começa como false
    setCanCancelExecution(false);

    // Inicializar status de todas as contas
    const initialStatus: Record<string, any> = {};
    icebergQuantities.forEach((accountData: any) => {
      initialStatus[accountData.accountId] = {
        status: 'waiting' as const,
        progress: 0,
        message: 'Aguardando execução...'
      };
    });
    setIcebergStatus(initialStatus);

    try {
      // Preparar payload master com todas as contas
      const masterPayload = {
        accounts: icebergQuantities.map((accountData: any) => {
          // Buscar AccountID real
          const account = filteredAccounts.find((acc: any) => acc._id === accountData.accountId);
          return {
            account_id: account?.AccountID || accountData.accountId,
            quantity: accountData.quantity,
            lote: accountData.adjustedLote
          };
        }).filter((acc: any) => acc.quantity > 0), // Filtrar contas com quantidade > 0
        ticker: selectedAsset.ticker,
        price: Math.round(individualPrice * 100) / 100, // Arredondar para 2 casas decimais
        side: selectedAsset.action,
        exchange: individualExchange,
        quantity_total: individualQuantity, // Adicionar quantidade total
        lote: individualIcebergLote, // Adicionar tamanho do lote
        twap_enabled: individualIcebergTwapEnabled,
        twap_interval: individualIcebergTwapInterval,
        strategy_id: selectedStrategy?.id || 'sync-iceberg-master',
        group_size: icebergGroupSize // Contas por onda (configurável pelo usuário)
      };

      console.log('[sendIndividualIcebergOrder] Enviando ordem iceberg master:', masterPayload);

      // Enviar ordem iceberg master
      const response = await fetch('http://localhost:8000/order_iceberg_master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(masterPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[sendIndividualIcebergOrder] Erro HTTP:', response.status, errorText);
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log('[sendIndividualIcebergOrder] Resposta da ordem iceberg master:', result);

      if (result.success && result.order_id) {
        console.log('[sendIndividualIcebergOrder] ✅ Ordem iceberg master iniciada com sucesso');
        
        // Atualizar status de todas as contas para "executando"
        icebergQuantities.forEach((accountData: any) => {
          setIcebergStatus(prev => ({
            ...prev,
            [accountData.accountId]: {
              ...prev[accountData.accountId],
              status: 'executing',
              orderId: result.order_id,
              progress: 0,
              message: 'Executando iceberg master...'
            }
          }));
        });

        // Ativar cancelamento
        setCanCancelExecution(true);
        setCurrentExecutingAccount('master');

        // Aguardar conclusão do iceberg master
        let completed = false;
        try {
          completed = await waitForIcebergCompletion('master', result.order_id);
        } catch (error) {
          console.error(`[sendIndividualIcebergOrder] Erro ao aguardar conclusão do iceberg master ${result.order_id}:`, error);
          completed = false;
        }

        if (completed) {
          console.log(`[sendIndividualIcebergOrder] ✅ Iceberg master ${result.order_id} concluído com sucesso`);
          
          // Preparar resultados para todas as contas
          const results = icebergQuantities.map((accountData: any) => {
            const accountName = selectedAsset.accounts.find((acc: any) => acc.accountId === accountData.accountId)?.accountName || 'Conta Desconhecida';
            return {
              accountName,
              success: true,
              totalLotes: accountData.totalLotes,
              message: `✅ ${accountName}: Ordem iceberg executada com sucesso (${accountData.totalLotes} lotes)`
            };
          });

          setIcebergOrderResults(results);
        } else {
          console.log(`[sendIndividualIcebergOrder] ❌ Iceberg master ${result.order_id} falhou`);
          
          const results = icebergQuantities.map((accountData: any) => {
            const accountName = selectedAsset.accounts.find((acc: any) => acc.accountId === accountData.accountId)?.accountName || 'Conta Desconhecida';
            return {
              accountName,
              success: false,
              totalLotes: accountData.totalLotes,
              message: `❌ ${accountName}: Falha na execução do iceberg master`
            };
          });

          setIcebergOrderResults(results);
        }
      } else {
        console.log('[sendIndividualIcebergOrder] ❌ Falha ao enviar ordem iceberg master');
        
        const results = icebergQuantities.map((accountData: any) => {
          const accountName = selectedAsset.accounts.find((acc: any) => acc.accountId === accountData.accountId)?.accountName || 'Conta Desconhecida';
          return {
            accountName,
            success: false,
            totalLotes: 0,
            message: `❌ ${accountName}: ${result.detail || 'Erro ao enviar ordem iceberg master'}`
          };
        });

        setIcebergOrderResults(results);
      }


      // Recarregar posições após 5 segundos (mais tempo para iceberg)
      setTimeout(async () => {
        console.log('[sendIndividualIcebergOrder] Recarregando posições...');
        await loadAllAccountPositions();
      }, 5000);

    } catch (error) {
      console.error('[sendIndividualIcebergOrder] Erro geral:', error);
      alert(`Erro ao processar ordens iceberg: ${error}`);
    } finally {
      setIsSendingIcebergOrder(false);
      setCanCancelExecution(false);
      setCurrentExecutingAccount(null);
    }
  };

  return (
    <div style={{ width: '90%', margin: "40px auto", padding: 8, background: "#222", borderRadius: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ color: "#fff", margin: 0, marginRight: 8 }}>Sincronização</h2>
      </div>

      {/* Primeira Seção - Carteira de Referência */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ 
          background: "#181818", 
          padding: 20, 
          borderRadius: 8, 
          marginBottom: 20 
        }}>
          <h3 style={{ color: "#fff", marginBottom: 16 }}>Carteira de Referência</h3>
          
          {/* Seletor de Estratégia */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ 
              display: 'block', 
              color: '#fff', 
              marginBottom: 8, 
              fontWeight: 'bold' 
            }}>
              Seletor de Estratégia:
            </label>
            <select
              value={selectedStrategy?.id || ""}
              onChange={(e) => {
                const strategy = strategies.find(s => s.id === e.target.value);
                setSelectedStrategy(strategy || null);
              }}
              style={{
                width: '100%',
                maxWidth: 400,
                padding: '10px 12px',
                background: '#333',
                color: '#fff',
                border: '1px solid #555',
                borderRadius: 6,
                fontSize: 14
              }}
            >
              <option value="">Selecione uma estratégia</option>
              {strategies.map((strategy) => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Nova Posição */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={handleNewPosition}
              disabled={!selectedStrategy}
              style={{
                padding: '10px 20px',
                background: selectedStrategy ? '#06b6d4' : '#555',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: selectedStrategy ? 'pointer' : 'not-allowed',
                fontSize: 14,
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <FiPlus size={16} />
              Nova Posição
            </button>
          </div>

          {/* Tabela de Posições */}
          {selectedStrategy && (
            <div>
              <h4 style={{ 
                color: "#fff", 
                marginBottom: 16, 
                fontSize: 18,
                fontWeight: 'bold'
              }}>
                Carteira de referência da estratégia {selectedStrategy.name}
              </h4>

              {/* Informações de Exposição */}
              {positions.length > 0 && (
                <div style={{
                  background: '#2a2a2a',
                  padding: '16px 20px',
                  borderRadius: 8,
                  marginBottom: 16,
                  border: '1px solid #444'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: 32,
                    flexWrap: 'wrap'
                  }}>
                    {/* Exposição Bruta */}
                    <div>
                      <span style={{
                        color: '#9ca3af',
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}>
                        Exposição Bruta:
                      </span>
                      <div style={{
                        color: '#fff',
                        fontSize: 16,
                        fontWeight: 'bold',
                        marginTop: 4
                      }}>
                        {positions.reduce((total, pos) => {
                          return total + (Math.abs(pos.quantity) * pos.price);
                        }, 0).toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </div>
                    </div>

                    {/* Posição Comprada */}
                    <div>
                      <span style={{
                        color: '#9ca3af',
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}>
                        Posição Comprada:
                      </span>
                      <div style={{
                        color: '#16a34a',
                        fontSize: 16,
                        fontWeight: 'bold',
                        marginTop: 4
                      }}>
                        {positions.reduce((total, pos) => {
                          return total + (pos.quantity > 0 ? pos.quantity * pos.price : 0);
                        }, 0).toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </div>
                    </div>

                    {/* Posição Vendida */}
                    <div>
                      <span style={{
                        color: '#9ca3af',
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}>
                        Posição Vendida:
                      </span>
                      <div style={{
                        color: '#dc2626',
                        fontSize: 16,
                        fontWeight: 'bold',
                        marginTop: 4
                      }}>
                        {positions.reduce((total, pos) => {
                          return total + (pos.quantity < 0 ? Math.abs(pos.quantity) * pos.price : 0);
                        }, 0).toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </div>
                    </div>

                    {/* Posição Líquida */}
                    <div style={{ display: 'flex', gap: 20 }}>
                      <div>
                        <span style={{
                          color: '#9ca3af',
                          fontSize: 14,
                          fontWeight: 'bold'
                        }}>
                          Posição Líquida:
                        </span>
                        <div style={{
                          color: (() => {
                            const posicaoLiquida = positions.reduce((total, pos) => {
                              return total + (pos.quantity * pos.price);
                            }, 0);
                            return posicaoLiquida >= 0 ? '#16a34a' : '#dc2626';
                          })(),
                          fontSize: 16,
                          fontWeight: 'bold',
                          marginTop: 4
                        }}>
                          {positions.reduce((total, pos) => {
                            return total + (pos.quantity * pos.price);
                          }, 0).toLocaleString('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          })}
                        </div>
                      </div>

                      {/* Posição Líquida em % */}
                      <div>
                        <span style={{
                          color: '#9ca3af',
                          fontSize: 14,
                          fontWeight: 'bold'
                        }}>
                          Posição Líquida em %:
                        </span>
                        <div style={{
                          color: (() => {
                            const percentualLiquido = positions.reduce((total, pos) => {
                              return total + (pos.percentage || 0);
                            }, 0);
                            return percentualLiquido >= 0 ? '#16a34a' : '#dc2626';
                          })(),
                          fontSize: 16,
                          fontWeight: 'bold',
                          marginTop: 4
                        }}>
                          {(() => {
                            const percentualLiquido = positions.reduce((total, pos) => {
                              return total + (pos.percentage || 0);
                            }, 0);
                            return `${percentualLiquido >= 0 ? '+' : ''}${percentualLiquido.toFixed(2)}%`;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Valor Mínimo para Investir */}
                    <div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8
                      }}>
                        <span style={{
                          color: '#9ca3af',
                          fontSize: 14,
                          fontWeight: 'bold'
                        }}>
                          Valor mínimo para investir:
                        </span>
                        <button
                          onClick={() => setShowEditMinInvestmentModal(true)}
                          style={{
                            padding: '4px',
                            background: '#3b82f6',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Editar valor mínimo"
                        >
                          <FiEdit3 size={12} />
                        </button>
                      </div>
                      <div style={{
                        color: '#06b6d4',
                        fontSize: 16,
                        fontWeight: 'bold',
                        marginTop: 4
                      }}>
                        {minInvestmentValue.toLocaleString('pt-BR', { 
                          style: 'currency', 
                          currency: 'BRL' 
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Explicação sobre Vendas à Descoberto */}
              {positions.some(pos => pos.quantity < 0) && (
                <div style={{
                  background: '#1a1a0a',
                  border: '1px solid #dc2626',
                  padding: '12px 16px',
                  borderRadius: 8,
                  marginBottom: 16
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8
                  }}>
                    <span style={{ color: '#dc2626', fontSize: '16px' }}>📉</span>
                    <span style={{ 
                      color: '#dc2626', 
                      fontSize: '14px', 
                      fontWeight: 'bold' 
                    }}>
                      Vendas à Descoberto Detectadas
                    </span>
                  </div>
                  <div style={{ 
                    color: '#9ca3af', 
                    fontSize: '12px',
                    lineHeight: '1.4'
                  }}>
                    Esta carteira contém posições vendidas (quantidades negativas). 
                    As vendas à descoberto representam apostas na queda do preço do ativo.
                  </div>
                </div>
              )}
              
              <div style={{ 
                background: '#222', 
                borderRadius: 8, 
                overflow: 'hidden',
                border: '1px solid #444'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#333' }}>
                      <th style={{ 
                        padding: '12px 16px', 
                        textAlign: 'left', 
                        color: '#fff',
                        borderBottom: '1px solid #555',
                        fontWeight: 'bold'
                      }}>
                        Posições
                      </th>
                      <th style={{ 
                        padding: '12px 16px', 
                        textAlign: 'right', 
                        color: '#fff',
                        borderBottom: '1px solid #555',
                        fontWeight: 'bold'
                      }}>
                        Preços
                      </th>
                      <th style={{ 
                        padding: '12px 16px', 
                        textAlign: 'right', 
                        color: '#fff',
                        borderBottom: '1px solid #555',
                        fontWeight: 'bold'
                      }}>
                        Quantidades
                      </th>
                      <th style={{ 
                        padding: '12px 16px', 
                        textAlign: 'right', 
                        color: '#fff',
                        borderBottom: '1px solid #555',
                        fontWeight: 'bold'
                      }}>
                        Tam. Pos. em %
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
                    {loading ? (
                      <tr>
                        <td colSpan={5} style={{ 
                          padding: '20px', 
                          textAlign: 'center', 
                          color: '#9ca3af' 
                        }}>
                          Carregando posições...
                        </td>
                      </tr>
                    ) : positions.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ 
                          padding: '20px', 
                          textAlign: 'center', 
                          color: '#9ca3af' 
                        }}>
                          Nenhuma posição encontrada para esta estratégia.
                        </td>
                      </tr>
                    ) : (
                      [...positions]
                        .sort((a:any,b:any)=> (a.ticker||'').toUpperCase().localeCompare((b.ticker||'').toUpperCase(),'pt-BR'))
                        .map((position) => (
                        <tr key={position.id} style={{ 
                          borderBottom: '1px solid #444',
                          background: position.quantity < 0 ? '#1a1a0a' : 'transparent'
                        }}>
                          <td style={{ 
                            padding: '12px 16px', 
                            color: position.quantity < 0 ? '#dc2626' : '#fff',
                            fontWeight: 'bold'
                          }}>
                            {position.ticker}
                            {position.quantity < 0 && (
                              <span style={{
                                background: '#dc2626',
                                color: '#fff',
                                padding: '2px 6px',
                                borderRadius: 3,
                                fontSize: '10px',
                                marginLeft: 8
                              }}>
                                VENDA
                              </span>
                            )}
                          </td>
                          <td style={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: '#fff'
                          }}>
                            {position.price.toLocaleString('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            })}
                          </td>
                          <td style={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: position.quantity < 0 ? '#dc2626' : '#fff',
                            fontWeight: position.quantity < 0 ? 'bold' : 'normal'
                          }}>
                            {position.quantity < 0 ? '-' : ''}{Math.abs(position.quantity).toLocaleString('pt-BR')}
                            {position.quantity < 0 && (
                              <span style={{ 
                                color: '#dc2626', 
                                fontSize: '10px',
                                marginLeft: 4
                              }}>
                                (VENDIDO)
                              </span>
                            )}
                          </td>
                          <td style={{ 
                            padding: '12px 16px', 
                            textAlign: 'right', 
                            color: '#fff'
                          }}>
                            {formatPctBR1(position.percentage)}
                          </td>
                          <td style={{ 
                            padding: '12px 16px', 
                            textAlign: 'center'
                          }}>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button
                                onClick={() => handleEditPosition(position)}
                                style={{
                                  padding: '6px',
                                  background: '#3b82f6',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Editar posição"
                              >
                                <FiEdit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeletePosition(position.id)}
                                style={{
                                  padding: '6px',
                                  background: '#dc2626',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                                title="Excluir posição"
                              >
                                <FiTrash2 size={14} />
                              </button>
                            </div>
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
      </div>

      {/* Segunda Seção - Sincronizador */}
      <div style={{ 
        background: "#181818", 
        padding: 20, 
        borderRadius: 8 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 16 
        }}>
          <h3 style={{ color: "#fff", margin: 0 }}>Sincronizador</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={clearReactStateAndReload}
              disabled={!selectedStrategy}
              style={{
                padding: '8px 16px',
                background: selectedStrategy ? '#3b82f6' : '#555',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: selectedStrategy ? 'pointer' : 'not-allowed',
                fontSize: 14,
                fontWeight: 'bold'
              }}
              title="Limpar estado do React e forçar recarregamento"
            >
              🔄 Limpar Cache
            </button>
          <button
            onClick={handleSyncAll}
            disabled={!selectedStrategy || filteredAccounts.length === 0}
            style={{
              padding: '8px 16px',
              background: selectedStrategy && filteredAccounts.length > 0 ? '#16a34a' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: selectedStrategy && filteredAccounts.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 'bold'
            }}
          >
            Sincronizar Todos
          </button>
          </div>
        </div>
        
        {loading ? (
          <div style={{ 
            background: '#222', 
            color: '#fff', 
            padding: 40, 
            borderRadius: 8, 
            textAlign: 'center' 
          }}>
            Carregando contas...
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div style={{ 
            background: '#222', 
            color: '#fff', 
            padding: 40, 
            borderRadius: 8, 
            textAlign: 'center' 
          }}>
            {selectedStrategy ? 
              `Nenhuma conta encontrada com alocação na estratégia ${selectedStrategy.name}.` : 
              'Selecione uma estratégia para ver as contas alocadas.'
            }
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredAccounts.map((account) => {
              const syncInfo = calculateSyncPercentage(account._id);
              return (
                <div key={account._id} style={{ 
                  background: '#222', 
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
                      borderBottom: expandedAccounts.has(account._id) ? '1px solid #555' : 'none'
                    }}
                    onClick={() => toggleAccountExpansion(account._id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {expandedAccounts.has(account._id) ? (
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
                          {account["Nome Cliente"]}
                        </h4>
                        <p style={{ 
                          color: '#9ca3af', 
                          margin: 0, 
                          fontSize: 14 
                        }}>
                          Conta: {account.AccountID} | Valor Investido na Estratégia: {account["Valor Investido Estrategia"]?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) || 'R$ 0,00'}
                        </p>
                        {/* Percentual de Sincronização */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginTop: 4
                        }}>
                          <span style={{
                            color: '#9ca3af',
                            fontSize: 12,
                            fontWeight: 'bold'
                          }}>
                            Sincronização:
                          </span>
                          <div style={{
                            background: '#1a1a1a',
                            borderRadius: 12,
                            padding: '2px 8px',
                            minWidth: 60,
                            textAlign: 'center'
                          }}>
                            <span style={{
                              color: syncInfo.color,
                              fontSize: 12,
                              fontWeight: 'bold'
                            }}>
                              {syncInfo.percentage.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de posições (expandida) */}
                  {expandedAccounts.has(account._id) && (
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
                                <button onClick={() => handleSortClick(account._id, 'ticker')} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer' }}>
                                  Ativo {accountSortState[account._id]?.key === 'ticker' ? (accountSortState[account._id]?.direction === 'asc' ? '▲' : '▼') : '↕'}
                                </button>
                              </th>
                              <th style={{ 
                                padding: '12px 16px', 
                                textAlign: 'right', 
                                color: '#fff',
                                borderBottom: '1px solid #555',
                                fontWeight: 'bold'
                              }}>
                                <button onClick={() => handleSortClick(account._id, 'quantity')} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer' }}>
                                  Quantidade {accountSortState[account._id]?.key === 'quantity' ? (accountSortState[account._id]?.direction === 'asc' ? '▲' : '▼') : '↕'}
                                </button>
                              </th>
                              <th style={{ 
                                padding: '12px 16px', 
                                textAlign: 'right', 
                                color: '#fff',
                                borderBottom: '1px solid #555',
                                fontWeight: 'bold'
                              }}>
                                <button onClick={() => handleSortClick(account._id, 'price')} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer' }}>
                                  Preço {accountSortState[account._id]?.key === 'price' ? (accountSortState[account._id]?.direction === 'asc' ? '▲' : '▼') : '↕'}
                                </button>
                              </th>
                              <th style={{ 
                                padding: '12px 16px', 
                                textAlign: 'right', 
                                color: '#fff',
                                borderBottom: '1px solid #555',
                                fontWeight: 'bold'
                              }}>
                                <button onClick={() => handleSortClick(account._id, 'percentage')} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer' }}>
                                  Tam. Pos. em % {accountSortState[account._id]?.key === 'percentage' ? (accountSortState[account._id]?.direction === 'asc' ? '▲' : '▼') : '↕'}
                                </button>
                              </th>
                              <th style={{ 
                                padding: '12px 16px', 
                                textAlign: 'right', 
                                color: '#fff',
                                borderBottom: '1px solid #555',
                                fontWeight: 'bold'
                              }}>
                                <button onClick={() => handleSortClick(account._id, 'idealPercentage')} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer' }}>
                                  % Ideal {accountSortState[account._id]?.key === 'idealPercentage' ? (accountSortState[account._id]?.direction === 'asc' ? '▲' : '▼') : '↕'}
                                </button>
                              </th>
                              <th style={{ 
                                padding: '12px 16px', 
                                textAlign: 'center', 
                                color: '#fff',
                                borderBottom: '1px solid #555',
                                fontWeight: 'bold'
                              }}>
                                <button onClick={() => handleSortClick(account._id, 'difference')} style={{ background: 'transparent', border: 0, color: '#fff', cursor: 'pointer' }}>
                                  Diferença {accountSortState[account._id]?.key === 'difference' ? (accountSortState[account._id]?.direction === 'asc' ? '▲' : '▼') : '↕'}
                                </button>
                              </th>
                              <th style={{ 
                                padding: '12px 16px', 
                                textAlign: 'center', 
                                color: '#fff',
                                borderBottom: '1px solid #555',
                                fontWeight: 'bold'
                              }}>
                                Sincronizar
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {!accountPositions[account._id] ? (
                              <tr>
                                <td colSpan={7} style={{ 
                                  padding: '20px', 
                                  textAlign: 'center', 
                                  color: '#9ca3af' 
                                }}>
                                  Carregando posições...
                                </td>
                              </tr>
                            ) : accountPositions[account._id].filter(p => p.ticker !== 'LFTS11').length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ 
                                  padding: '20px', 
                                  textAlign: 'center', 
                                  color: '#9ca3af' 
                                }}>
                                  {positions.length === 0 
                                    ? 'Nenhuma posição de referência definida para esta estratégia.' 
                                    : 'Nenhuma posição encontrada para esta conta.'
                                  }
                                </td>
                              </tr>
                    ) : (
                              sortAccountPositions(account._id, accountPositions[account._id].filter(p => p.ticker !== 'LFTS11')).map((position) => (
                                <tr key={position.id} style={{ borderBottom: '1px solid #444' }}>
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
                                    {position.quantity.toLocaleString('pt-BR')}
                                  </td>
                                  <td style={{ 
                                    padding: '12px 16px', 
                                    textAlign: 'right', 
                                    color: '#fff'
                                  }}>
                                    {position.price.toLocaleString('pt-BR', { 
                                      style: 'currency', 
                                      currency: 'BRL' 
                                    })}
                                  </td>
                                  <td style={{ 
                                    padding: '12px 16px', 
                                    textAlign: 'right', 
                                    color: '#fff'
                                  }}>
                                    {formatPctBR1(position.percentage)}
                                  </td>
                                  <td style={{ 
                                    padding: '12px 16px', 
                                    textAlign: 'right', 
                                    color: '#fff'
                                  }}>
                                    {formatPctBR1(position.idealPercentage)}
                                  </td>
                                  <td style={{ 
                                    padding: '12px 16px', 
                                    textAlign: 'center'
                                  }}>
                                    {/* Indicador visual de diferença */}
                                    <div style={{
                                      background: Math.abs((position.percentage || 0) - (position.idealPercentage || 0)) < 2 ? '#16a34a' : '#dc2626',
                                      color: '#fff',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      fontSize: 12,
                                      fontWeight: 'bold',
                                      marginBottom: 4
                                    }}>
                                      {formatPctBR1(Math.abs((position.percentage || 0) - (position.idealPercentage || 0)) as any)}
                                    </div>
                                  </td>
                                  <td style={{ 
                                    padding: '12px 16px', 
                                    textAlign: 'center'
                                  }}>
                                    <button
                                      onClick={() => handleSyncPosition(account._id, position)}
                                      disabled={Math.abs((position.percentage || 0) - (position.idealPercentage || 0)) < 2}
                                      style={{
                                        padding: '6px 12px',
                                        background: Math.abs((position.percentage || 0) - (position.idealPercentage || 0)) < 2 ? '#555' : '#06b6d4',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: 4,
                                        cursor: Math.abs((position.percentage || 0) - (position.idealPercentage || 0)) < 2 ? 'not-allowed' : 'pointer',
                                        fontSize: 12,
                                        fontWeight: 'bold'
                                      }}
                                    >
                                      {Math.abs((position.percentage || 0) - (position.idealPercentage || 0)) < 2 ? 'Sincronizado' : 'Sincronizar'}
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
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Nova Posição */}
      {showNewPositionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#181818',
            padding: 24,
            borderRadius: 8,
            width: '90%',
            maxWidth: 500,
            border: '1px solid #444'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20
            }}>
              <h3 style={{ color: '#fff', margin: 0 }}>Nova Posição</h3>
              <button
                onClick={() => setShowNewPositionModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                color: '#fff',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                Ticker:
              </label>
              <input
                type="text"
                value={newPositionData.ticker}
                onChange={(e) => setNewPositionData(prev => ({
                  ...prev,
                  ticker: e.target.value.toUpperCase()
                }))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder="Ex: PETR4"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                color: '#fff',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                Preço:
              </label>
              <input
                type="text"
                value={newPositionDisplay.price}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setNewPositionDisplay(prev => ({ ...prev, price: inputValue }));
                  
                  // Converter para number apenas quando necessário
                  const numericValue = parseFloat(inputValue) || 0;
                  setNewPositionData(prev => ({ ...prev, price: numericValue }));
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder="0.00"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                color: '#fff',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                Quantidade:
              </label>
              <input
                type="text"
                value={newPositionDisplay.quantity}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setNewPositionDisplay(prev => ({ ...prev, quantity: inputValue }));
                  
                  // Converter para number apenas quando necessário
                  const numericValue = parseInt(inputValue) || 0;
                  setNewPositionData(prev => ({ ...prev, quantity: numericValue }));
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder="0"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                color: '#fff',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                Percentual (%):
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={newPositionDisplay.percentage}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setNewPositionDisplay(prev => ({ ...prev, percentage: inputValue }));
                  const numericValue = parsePtBRDecimal(inputValue);
                  setNewPositionData(prev => ({ ...prev, percentage: isNaN(numericValue) ? 0 : numericValue }));
                }}
                onBlur={() => {
                  setNewPositionDisplay(prev => ({ ...prev, percentage: formatNumberPtBR(newPositionData.percentage, 1) }));
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder="0,0"
              />
            </div>

            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowNewPositionModal(false)}
                disabled={savingPosition}
                style={{
                  padding: '10px 20px',
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: savingPosition ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNewPosition}
                disabled={savingPosition}
                style={{
                  padding: '10px 20px',
                  background: savingPosition ? '#555' : '#06b6d4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: savingPosition ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                {savingPosition ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Posição */}
      {showEditPositionModal && editingPosition && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#181818',
            padding: 24,
            borderRadius: 8,
            width: '90%',
            maxWidth: 500,
            border: '1px solid #444'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20
            }}>
              <h3 style={{ color: '#fff', margin: 0 }}>Editar Posição</h3>
              <button
                onClick={() => {
                  setShowEditPositionModal(false);
                  setEditingPosition(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                color: '#fff',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                Ticker:
              </label>
              <input
                type="text"
                value={editingPosition.ticker}
                onChange={(e) => setEditingPosition(prev => prev ? {
                  ...prev,
                  ticker: e.target.value.toUpperCase()
                } : null)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder="Ex: PETR4"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                color: '#fff',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                Preço:
              </label>
              <input
                type="text"
                value={editingPositionDisplay.price}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setEditingPositionDisplay(prev => ({ ...prev, price: inputValue }));
                  
                  // Converter para number apenas quando necessário
                  const numericValue = parseFloat(inputValue) || 0;
                  setEditingPosition(prev => prev ? {
                    ...prev,
                    price: numericValue
                  } : null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder="0.00"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block',
                color: '#fff',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                Quantidade:
              </label>
              <input
                type="text"
                value={editingPositionDisplay.quantity}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setEditingPositionDisplay(prev => ({ ...prev, quantity: inputValue }));
                  
                  // Converter para number apenas quando necessário
                  const numericValue = parseInt(inputValue) || 0;
                  setEditingPosition(prev => prev ? {
                    ...prev,
                    quantity: numericValue
                  } : null);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder="0"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                color: '#fff',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                Percentual (%):
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={editingPositionDisplay.percentage}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  setEditingPositionDisplay(prev => ({ ...prev, percentage: inputValue }));
                  const numericValue = parsePtBRDecimal(inputValue);
                  setEditingPosition(prev => prev ? {
                    ...prev,
                    percentage: isNaN(numericValue) ? 0 : numericValue
                  } : null);
                }}
                onBlur={() => {
                  setEditingPositionDisplay(prev => ({ ...prev, percentage: formatNumberPtBR(editingPosition?.percentage || 0, 1) }));
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder="0,0"
              />
            </div>

            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowEditPositionModal(false);
                  setEditingPosition(null);
                  setEditingPositionDisplay({
                    price: "",
                    quantity: "",
                    percentage: ""
                  });
                }}
                disabled={savingEdit}
                style={{
                  padding: '10px 20px',
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditPosition}
                disabled={savingEdit}
                style={{
                  padding: '10px 20px',
                  background: savingEdit ? '#555' : '#06b6d4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: savingEdit ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Valor Mínimo de Investimento */}
      {showEditMinInvestmentModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#181818',
            padding: 24,
            borderRadius: 8,
            width: '90%',
            maxWidth: 400,
            border: '1px solid #444'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20
            }}>
              <h3 style={{ color: '#fff', margin: 0 }}>Editar Valor Mínimo de Investimento</h3>
              <button
                onClick={() => setShowEditMinInvestmentModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <FiX size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block',
                color: '#fff',
                marginBottom: 8,
                fontWeight: 'bold'
              }}>
                Valor Mínimo (R$):
              </label>
              <input
                type="number"
                step="0.01"
                value={minInvestmentValue}
                onChange={(e) => setMinInvestmentValue(parseFloat(e.target.value) || 0)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#333',
                  color: '#fff',
                  border: '1px solid #555',
                  borderRadius: 6,
                  fontSize: 14
                }}
                placeholder="0.00"
              />
            </div>

            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => setShowEditMinInvestmentModal(false)}
                disabled={savingMinInvestment}
                style={{
                  padding: '10px 20px',
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: savingMinInvestment ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMinInvestment}
                disabled={savingMinInvestment}
                style={{
                  padding: '10px 20px',
                  background: savingMinInvestment ? '#555' : '#06b6d4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: savingMinInvestment ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                {savingMinInvestment ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Seleção de Tipo de Ordem */}
      {showOrderTypeModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#181818',
            padding: 32,
            borderRadius: 12,
            width: '75%',
            maxWidth: 1200,
            maxHeight: '90vh',
            border: '1px solid #444',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24
            }}>
              <h3 style={{ color: '#fff', margin: 0, fontSize: 20 }}>
                Selecionar Tipo de Ordem
              </h3>
              <button
                onClick={() => {
                  setShowOrderTypeModal(false);
                  setSyncContext(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Informações do contexto */}
            <div style={{
              background: '#222',
              padding: 16,
              borderRadius: 8,
              marginBottom: 24,
              border: '1px solid #444'
            }}>
              <h4 style={{ color: '#06b6d4', margin: '0 0 12px 0', fontSize: 16 }}>
                {syncContext?.type === 'all' ? 'Sincronização Completa' : 'Sincronização de Posição'}
              </h4>
              {syncContext?.type === 'all' && (
                <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>
                  Sincronizar todas as posições de todas as contas da estratégia <strong>{selectedStrategy?.name}</strong>
                </p>
              )}
              {syncContext?.type === 'position' && syncContext?.position && (
                <div style={{ color: '#9ca3af', fontSize: 14 }}>
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>Ativo:</strong> {syncContext.position.ticker}
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>Conta:</strong> {filteredAccounts.find(acc => acc._id === syncContext.accountId)?.["Nome Cliente"]}
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>Posição Atual:</strong> {syncContext.position.quantity.toLocaleString('pt-BR')} @ {syncContext.position.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>% Atual:</strong> {formatPctBR1(syncContext.position.percentage)} | <strong>% Ideal:</strong> {formatPctBR1(syncContext.position.idealPercentage)}
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>Diferença:</strong> {formatPctBR1(Math.abs((syncContext.position.percentage || 0) - (syncContext.position.idealPercentage || 0)) as any)}
                  </p>
                  
                  {/* Cálculo da quantidade para sincronização */}
                  {(() => {
                    const account = filteredAccounts.find(acc => acc._id === syncContext.accountId);
                    const valorInvestidoEstrategia = account?.["Valor Investido Estrategia"] || 0;
                    const percentualAtual = syncContext.position.percentage || 0;
                    const percentualIdeal = syncContext.position.idealPercentage || 0;
                    const diferencaPercentual = percentualIdeal - percentualAtual;
                    
                    if (valorInvestidoEstrategia > 0 && Math.abs(diferencaPercentual) > 0.1) {
                      const valorDiferenca = (Math.abs(diferencaPercentual) / 100) * valorInvestidoEstrategia;
                      const quantidadeAjuste = adjustedQuantity > 0 ? adjustedQuantity : Math.round(valorDiferenca / (adjustedPrice || syncContext.position.price || 1));
                      const acao = diferencaPercentual > 0 ? 'COMPRAR' : 'VENDER';
                      const corAcao = diferencaPercentual > 0 ? '#16a34a' : '#dc2626';
                      const precoUsado = adjustedPrice > 0 ? adjustedPrice : (syncContext.position.price || 0);
                      
                      return (
                        <div style={{
                          background: '#1a1a1a',
                          padding: '12px',
                          borderRadius: '6px',
                          border: `1px solid ${corAcao}`,
                          marginTop: '8px'
                        }}>
                          <p style={{ 
                            margin: '0 0 8px 0', 
                            color: corAcao, 
                            fontWeight: 'bold',
                            fontSize: '15px'
                          }}>
                            📈 AÇÃO DE SINCRONIZAÇÃO
                          </p>
                          <p style={{ margin: '0 0 4px 0' }}>
                            <strong>Ação:</strong> <span style={{ color: corAcao, fontWeight: 'bold' }}>{acao}</span>
                          </p>
                          <p style={{ margin: '0 0 4px 0' }}>
                            <strong>Quantidade:</strong> {quantidadeAjuste.toLocaleString('pt-BR')} {syncContext.position.ticker}
                          </p>
                          <p style={{ margin: '0 0 4px 0' }}>
                            <strong>Valor Aproximado:</strong> {(quantidadeAjuste * precoUsado).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                            * Baseado no preço de R$ {precoUsado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por ação
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <div style={{
                        background: '#1a1a1a',
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid #6b7280',
                        marginTop: '8px'
                      }}>
                        <p style={{ 
                          margin: 0, 
                          color: '#6b7280', 
                          fontWeight: 'bold',
                          fontSize: '15px'
                        }}>
                          ✅ POSIÇÃO JÁ SINCRONIZADA
                        </p>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>
                          Diferença menor que 0.1% - nenhuma ação necessária
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Campos editáveis para ajuste de preço e quantidade */}
            {syncContext?.type === 'position' && syncContext?.position && (
              <div style={{
                background: '#222',
                padding: 20,
                borderRadius: 8,
                marginBottom: 24,
                border: '1px solid #444'
              }}>
                <h4 style={{ color: '#06b6d4', margin: '0 0 16px 0', fontSize: 16 }}>
                  ⚙️ Ajustar Parâmetros da Ordem
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Campo de Preço */}
                  <div>
                    <label style={{
                      display: 'block',
                      color: '#fff',
                      marginBottom: 8,
                      fontWeight: 'bold',
                      fontSize: 14
                    }}>
                      Preço por Ação (R$):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={adjustedPrice}
                      onChange={(e) => {
                        const newPrice = parseFloat(e.target.value) || 0;
                        setAdjustedPrice(newPrice);
                        
                        // Recalcular quantidade baseada no novo preço
                        if (syncContext.position && newPrice > 0) {
                          const account = filteredAccounts.find(acc => acc._id === syncContext.accountId);
                          const valorInvestidoEstrategia = account?.["Valor Investido Estrategia"] || 0;
                          const percentualAtual = syncContext.position.percentage || 0;
                          const percentualIdeal = syncContext.position.idealPercentage || 0;
                          const diferencaPercentual = percentualIdeal - percentualAtual;
                          
                          if (valorInvestidoEstrategia > 0 && Math.abs(diferencaPercentual) > 0.1) {
                            const valorDiferenca = (Math.abs(diferencaPercentual) / 100) * valorInvestidoEstrategia;
                            const novaQuantidade = Math.round(valorDiferenca / newPrice);
                            setAdjustedQuantity(novaQuantidade);
                          }
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#333',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}
                      placeholder="0.00"
                    />
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '12px', 
                      color: '#6b7280' 
                    }}>
                      Preço original: R$ {(syncContext.position.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </p>
                  </div>

                  {/* Campo de Quantidade */}
                  <div>
                    <label style={{
                      display: 'block',
                      color: '#fff',
                      marginBottom: 8,
                      fontWeight: 'bold',
                      fontSize: 14
                    }}>
                      Quantidade de Ações:
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={adjustedQuantity}
                      onChange={(e) => {
                        const newQuantity = parseInt(e.target.value) || 0;
                        setAdjustedQuantity(newQuantity);
                      }}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#333',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}
                      placeholder="0"
                    />
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '12px', 
                      color: '#6b7280' 
                    }}>
                      Quantidade calculada automaticamente
                    </p>
                  </div>
                </div>

                {/* Campo de Exchange */}
                <div style={{ marginTop: 16 }}>
                  <label style={{
                    display: 'block',
                    color: '#fff',
                    marginBottom: 8,
                    fontWeight: 'bold',
                    fontSize: 14
                  }}>
                    Exchange/Bolsa:
                  </label>
                  <select
                    value={selectedExchange}
                    onChange={(e) => setSelectedExchange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: '#333',
                      color: '#fff',
                      border: '1px solid #555',
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: 'bold'
                    }}
                  >
                    <option value="B">B3 (Ações)</option>
                    <option value="F">Futuros</option>
                    <option value="M">Câmbio</option>
                    <option value="E">ETF</option>
                  </select>
                  <p style={{ 
                    margin: '4px 0 0 0', 
                    fontSize: '12px', 
                    color: '#6b7280' 
                  }}>
                    Selecione a bolsa onde o ativo é negociado
                  </p>
                </div>

                {/* Resumo do valor total */}
                <div style={{
                  background: '#1a1a1a',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  marginTop: '16px',
                  border: '1px solid #444'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: '#9ca3af', fontSize: 14 }}>
                      <strong>Valor Total da Operação:</strong>
                    </span>
                    <span style={{ 
                      color: '#06b6d4', 
                      fontSize: '16px', 
                      fontWeight: 'bold' 
                    }}>
                      R$ {(adjustedPrice * adjustedQuantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Configurações Iceberg */}
            {syncContext?.type === 'position' && syncContext?.position && (
              <div style={{
                background: '#222',
                padding: 20,
                borderRadius: 8,
                marginBottom: 24,
                border: '1px solid #444'
              }}>
                <h4 style={{ color: '#06b6d4', margin: '0 0 16px 0', fontSize: 16 }}>
                  🧊 Configurações Iceberg
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  {/* Tamanho do Lote */}
                  <div>
                    <label style={{
                      display: 'block',
                      color: '#fff',
                      marginBottom: 8,
                      fontWeight: 'bold',
                      fontSize: 14
                    }}>
                      Tamanho do Lote:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={icebergLote}
                      onChange={(e) => setIcebergLote(parseInt(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#333',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}
                      placeholder="1"
                    />
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '12px', 
                      color: '#6b7280' 
                    }}>
                      Quantidade por lote de execução
                    </p>
                  </div>

                  {/* Campo Contas por Onda */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{
                      display: 'block',
                      color: '#fff',
                      marginBottom: 8,
                      fontWeight: 'bold',
                      fontSize: 14
                    }}>
                      Contas por Onda:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={icebergGroupSize}
                      onChange={(e) => setIcebergGroupSize(parseInt(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#333',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}
                      placeholder="1"
                    />
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '12px', 
                      color: '#6b7280' 
                    }}>
                      Número de contas que executarão simultaneamente em cada onda
                    </p>
                  </div>

                  {/* TWAP Checkbox */}
                  <div>
                    <label style={{
                      display: 'block',
                      color: '#fff',
                      marginBottom: 8,
                      fontWeight: 'bold',
                      fontSize: 14
                    }}>
                      Configuração TWAP:
                    </label>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px 16px',
                      background: '#333',
                      border: '1px solid #555',
                      borderRadius: 6
                    }}>
                      <input
                        type="checkbox"
                        id="icebergTwapEnabled"
                        checked={icebergTwapEnabled}
                        onChange={(e) => setIcebergTwapEnabled(e.target.checked)}
                        style={{ margin: 0 }}
                      />
                      <label htmlFor="icebergTwapEnabled" style={{ 
                        color: '#fff', 
                        fontSize: 14, 
                        margin: 0,
                        cursor: 'pointer'
                      }}>
                        Ligar TWAP
                      </label>
                    </div>
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '12px', 
                      color: '#6b7280' 
                    }}>
                      Time-Weighted Average Price
                    </p>
                  </div>
                </div>

                {/* Intervalo TWAP */}
                {icebergTwapEnabled && (
                  <div style={{ marginTop: 16 }}>
                    <label style={{
                      display: 'block',
                      color: '#fff',
                      marginBottom: 8,
                      fontWeight: 'bold',
                      fontSize: 14
                    }}>
                      Tempo entre Ordens (segundos):
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="3600"
                      value={icebergTwapInterval}
                      onChange={(e) => setIcebergTwapInterval(parseInt(e.target.value) || 30)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        background: '#333',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 'bold'
                      }}
                      placeholder="30"
                    />
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontSize: '12px', 
                      color: '#6b7280' 
                    }}>
                      Intervalo entre lotes (1-3600 segundos)
                    </p>
                  </div>
                )}

                {/* Resumo da Configuração Iceberg */}
                <div style={{
                  background: '#1a1a1a',
                  padding: '12px 16px',
                  borderRadius: '6px',
                  marginTop: '16px',
                  border: '1px solid #444'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: '#9ca3af', fontSize: 14 }}>
                      <strong>Resumo Iceberg:</strong>
                    </span>
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: 12 }}>
                    <p style={{ margin: '4px 0' }}>
                      • Total de lotes: {Math.ceil(adjustedQuantity / icebergLote)} lotes
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      • Tamanho do lote: {icebergLote.toLocaleString('pt-BR')} ações
                    </p>
                    <p style={{ margin: '4px 0' }}>
                      • Contas por onda: {icebergGroupSize} conta{icebergGroupSize > 1 ? 's' : ''}
                    </p>
                    {icebergTwapEnabled && (
                      <p style={{ margin: '4px 0' }}>
                        • TWAP: {icebergTwapInterval}s entre lotes
                      </p>
                    )}
                    {icebergTwapEnabled && (
                      <p style={{ margin: '4px 0', color: '#06b6d4' }}>
                        • Tempo estimado: {Math.ceil((Math.ceil(adjustedQuantity / icebergLote) - 1) * icebergTwapInterval / 60)} minutos
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Opções de tipo de ordem */}
            <div style={{ marginBottom: 32 }}>
              <h4 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: 16 }}>
                Escolha o tipo de ordem:
              </h4>
              
              <div style={{ display: 'grid', gap: 12 }}>
                {/* Ordem Simples */}
                <button
                  onClick={async () => {
                    if (!syncContext || !syncContext.position) {
                      alert('Erro: Dados de sincronização não encontrados');
                      return;
                    }

                    try {
                      // Determinar a ação (compra ou venda)
                      const percentualAtual = syncContext.position.percentage || 0;
                      const percentualIdeal = syncContext.position.idealPercentage || 0;
                      const diferencaPercentual = percentualIdeal - percentualAtual;
                      const side = diferencaPercentual > 0 ? 'buy' : 'sell';
                      
                      // Usar valores ajustados ou originais
                      const precoFinal = adjustedPrice > 0 ? adjustedPrice : syncContext.position.price;
                      const quantidadeFinal = adjustedQuantity > 0 ? adjustedQuantity : 0;
                      
                      if (quantidadeFinal <= 0) {
                        alert('Erro: Quantidade deve ser maior que zero');
                        return;
                      }

                      if (precoFinal <= 0) {
                        alert('Erro: Preço deve ser maior que zero');
                        return;
                      }

                      // Buscar dados da conta
                      const account = filteredAccounts.find(acc => acc._id === syncContext.accountId);
                      if (!account) {
                        alert('Erro: Conta não encontrada');
                        return;
                      }

                      // Buscar dados corretos da DLL (BrokerID correto)
                      let dllAccountData = null;
                      try {
                        const accountsResponse = await fetch('http://localhost:8000/accounts');
                        if (accountsResponse.ok) {
                          const accountsData = await accountsResponse.json();
                          dllAccountData = accountsData.accounts?.find((acc: any) => acc.AccountID === account.AccountID);
                        }
                      } catch (error) {
                        console.error('[SYNC] Erro ao buscar dados da DLL:', error);
                      }

                      if (!dllAccountData) {
                        alert(`Erro: Conta ${account.AccountID} não encontrada na DLL da Profit. Verifique se a conta está ativa.`);
                        return;
                      }

                      // Preparar payload da ordem
                      const orderPayload = {
                        account_id: account.AccountID,
                        broker_id: dllAccountData.BrokerID, // Usar BrokerID da DLL
                        ticker: syncContext.position.ticker,
                        quantity: quantidadeFinal,
                        price: Math.round(precoFinal * 100) / 100, // Arredondar para 2 casas decimais
                        side: side,
                        exchange: selectedExchange, // Usar o exchange selecionado
                        strategy_id: selectedStrategy?.id
                      };

                      console.log('[SYNC] Enviando ordem simples:', orderPayload);
                      console.log('[SYNC] Dados da DLL:', dllAccountData);

                      // Pop-up de confirmação antes do envio
                      const confirmMessage = `⚠️ CONFIRMAR ORDEM DE SINCRONIZAÇÃO

Detalhes da Ordem:
• Ação: ${side === 'buy' ? 'COMPRA' : 'VENDA'}
• Ativo: ${syncContext.position.ticker}
• Quantidade: ${quantidadeFinal.toLocaleString('pt-BR')} ações
• Preço: R$ ${precoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
• Valor Total: R$ ${(quantidadeFinal * precoFinal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
• Exchange: ${selectedExchange === 'B' ? 'B3 (Ações)' : selectedExchange === 'F' ? 'Futuros' : selectedExchange === 'M' ? 'Câmbio' : 'ETF'}
• Conta: ${account["Nome Cliente"]} (${account.AccountID})

Deseja realmente enviar esta ordem?`;

                      const userConfirmed = confirm(confirmMessage);
                      if (!userConfirmed) {
                        console.log('[SYNC] Ordem cancelada pelo usuário');
                        return;
                      }

                      // Enviar ordem para o backend
                      const response = await fetch('http://localhost:8000/order', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(orderPayload),
                      });

                      const result = await response.json();

                      if (response.ok && result.success) {
                        alert(`✅ Ordem enviada com sucesso!\n\nDetalhes:\n- Ação: ${side === 'buy' ? 'COMPRA' : 'VENDA'}\n- Ativo: ${syncContext.position.ticker}\n- Quantidade: ${quantidadeFinal.toLocaleString('pt-BR')}\n- Preço: R$ ${precoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n- Valor Total: R$ ${(quantidadeFinal * precoFinal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n${result.log || ''}`);
                        
                        // Fechar modal
                        setShowOrderTypeModal(false);
                        setSyncContext(null);
                        
                        // Recarregar posições da conta após alguns segundos
                        setTimeout(() => {
                          if (syncContext.accountId) {
                            loadAccountPositions(syncContext.accountId);
                          }
                        }, 3000);
                      } else {
                        const errorMessage = result.detail || result.log || 'Erro desconhecido';
                        let userFriendlyMessage = errorMessage;
                        
                        // Traduzir códigos de erro específicos da DLL
                        if (errorMessage.includes('-2147483636')) {
                          userFriendlyMessage = `❌ Ativo não encontrado na corretora!\n\nO ativo ${syncContext.position.ticker} não foi encontrado na corretora ${account.BrokerID}.\n\nPossíveis causas:\n- Ativo não disponível nesta corretora\n- Código do ativo incorreto\n- Exchange incorreto\n- Ativo fora do horário de negociação`;
                        } else if (errorMessage.includes('-2147483638')) {
                          userFriendlyMessage = `❌ Licença não permite roteamento!\n\nSua licença da Profit não permite envio de ordens (apenas dados de mercado).`;
                        } else if (errorMessage.includes('-2147483646')) {
                          userFriendlyMessage = `❌ DLL não inicializada!\n\nA DLL da Profit não foi inicializada corretamente.`;
                        } else if (errorMessage.includes('-2147483643')) {
                          userFriendlyMessage = `❌ Login não encontrado!\n\nNenhum login ativo foi encontrado na DLL da Profit.`;
                        }
                        
                        alert(`❌ Erro ao enviar ordem:\n\n${userFriendlyMessage}\n\nCódigo de erro: ${result.success === false ? 'DLL Error' : 'HTTP Error'}`);
                      }
                    } catch (error) {
                      console.error('[SYNC] Erro ao enviar ordem:', error);
                      alert(`❌ Erro de conexão:\n\n${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: '#333',
                    border: '1px solid #555',
                    borderRadius: 8,
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    width: '100%',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#444';
                    e.currentTarget.style.borderColor = '#06b6d4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#333';
                    e.currentTarget.style.borderColor = '#555';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Ordem Simples</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      Envio direto da ordem completa de uma vez
                    </div>
                  </div>
                  <div style={{ 
                    background: '#06b6d4', 
                    color: '#fff', 
                    padding: '4px 8px', 
                    borderRadius: 4, 
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}>
                    RÁPIDO
                  </div>
                </button>

                {/* Ordem Iceberg */}
                <button
                  onClick={async () => {
                    if (!syncContext || !syncContext.position) {
                      alert('Erro: Dados de sincronização não encontrados');
                      return;
                    }

                    try {
                      // Validações específicas do Iceberg
                      if (icebergLote <= 0) {
                        alert('Erro: Tamanho do lote deve ser maior que zero');
                        return;
                      }

                      if (icebergTwapEnabled && (icebergTwapInterval < 1 || icebergTwapInterval > 3600)) {
                        alert('Erro: Tempo entre ordens deve estar entre 1 e 3600 segundos');
                        return;
                      }

                      // Determinar a ação (compra ou venda)
                      const percentualAtual = syncContext.position.percentage || 0;
                      const percentualIdeal = syncContext.position.idealPercentage || 0;
                      const diferencaPercentual = percentualIdeal - percentualAtual;
                      const side = diferencaPercentual > 0 ? 'buy' : 'sell';
                      
                      // Usar valores ajustados ou originais
                      const precoFinal = adjustedPrice > 0 ? adjustedPrice : syncContext.position.price;
                      const quantidadeFinal = adjustedQuantity > 0 ? adjustedQuantity : 0;
                      
                      if (quantidadeFinal <= 0) {
                        alert('Erro: Quantidade deve ser maior que zero');
                        return;
                      }

                      if (precoFinal <= 0) {
                        alert('Erro: Preço deve ser maior que zero');
                        return;
                      }

                      // Buscar dados da conta
                      const account = filteredAccounts.find(acc => acc._id === syncContext.accountId);
                      if (!account) {
                        alert('Erro: Conta não encontrada');
                        return;
                      }

                      // Buscar dados corretos da DLL (BrokerID correto)
                      let dllAccountData = null;
                      try {
                        const accountsResponse = await fetch('http://localhost:8000/accounts');
                        if (accountsResponse.ok) {
                          const accountsData = await accountsResponse.json();
                          dllAccountData = accountsData.accounts?.find((acc: any) => acc.AccountID === account.AccountID);
                        }
                      } catch (error) {
                        console.error('[SYNC] Erro ao buscar dados da DLL:', error);
                      }

                      if (!dllAccountData) {
                        alert(`Erro: Conta ${account.AccountID} não encontrada na DLL da Profit. Verifique se a conta está ativa.`);
                        return;
                      }

                      // Preparar payload da ordem iceberg
                      const orderPayload = {
                        account_id: account.AccountID,
                        broker_id: dllAccountData.BrokerID,
                        ticker: syncContext.position.ticker,
                        quantity_total: quantidadeFinal,
                        lote: icebergLote,
                        price: Math.round(precoFinal * 100) / 100,
                        side: side,
                        exchange: selectedExchange,
                        twap_enabled: icebergTwapEnabled,
                        twap_interval: icebergTwapEnabled ? icebergTwapInterval : null,
                        strategy_id: selectedStrategy?.id
                      };

                      console.log('[SYNC] Enviando ordem iceberg:', orderPayload);
                      console.log('[SYNC] Dados da DLL:', dllAccountData);

                      // Pop-up de confirmação antes do envio
                      const totalLotes = Math.ceil(quantidadeFinal / icebergLote);
                      const tempoEstimado = icebergTwapEnabled ? Math.ceil((totalLotes - 1) * icebergTwapInterval / 60) : 0;
                      
                      const confirmMessage = `⚠️ CONFIRMAR ORDEM ICEBERG

Detalhes da Ordem:
• Ação: ${side === 'buy' ? 'COMPRA' : 'VENDA'}
• Ativo: ${syncContext.position.ticker}
• Quantidade Total: ${quantidadeFinal.toLocaleString('pt-BR')} ações
• Tamanho do Lote: ${icebergLote.toLocaleString('pt-BR')} ações
• Total de Lotes: ${totalLotes} lotes
• Contas por Onda: ${icebergGroupSize} conta${icebergGroupSize > 1 ? 's' : ''}
• Preço: R$ ${precoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
• Exchange: ${selectedExchange === 'B' ? 'B3 (Ações)' : selectedExchange === 'F' ? 'Futuros' : selectedExchange === 'M' ? 'Câmbio' : 'ETF'}
• Conta: ${account["Nome Cliente"]} (${account.AccountID})
${icebergTwapEnabled ? `• TWAP: Ativo (${icebergTwapInterval}s entre lotes)
• Tempo Estimado: ${tempoEstimado} minutos` : '• TWAP: Desativado'}

Deseja realmente enviar esta ordem iceberg?`;

                      const userConfirmed = confirm(confirmMessage);
                      if (!userConfirmed) {
                        console.log('[SYNC] Ordem iceberg cancelada pelo usuário');
                        return;
                      }

                      // Enviar ordem iceberg para o backend
                      const response = await fetch('http://localhost:8000/order_iceberg', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(orderPayload),
                      });

                      const result = await response.json();

                      if (response.ok && result.success) {
                        alert(`✅ Ordem Iceberg Iniciada!

ID da Ordem: ${result.iceberg_id}
Status: Em execução
Progresso: 0/${quantidadeFinal.toLocaleString('pt-BR')} ações
${icebergTwapEnabled ? `Próximo lote: Em ${icebergTwapInterval} segundos` : 'Execução: Imediata'}

A ordem será executada automaticamente em lotes.
${result.log || ''}`);
                        
                        // Fechar modal
                        setShowOrderTypeModal(false);
                        setSyncContext(null);
                        
                        // Recarregar posições da conta após alguns segundos
                        setTimeout(() => {
                          if (syncContext.accountId) {
                            loadAccountPositions(syncContext.accountId);
                          }
                        }, 3000);
                      } else {
                        const errorMessage = result.detail || result.log || 'Erro desconhecido';
                        let userFriendlyMessage = errorMessage;
                        
                        // Traduzir códigos de erro específicos da DLL
                        if (errorMessage.includes('-2147483636')) {
                          userFriendlyMessage = `❌ Ativo não encontrado na corretora!\n\nO ativo ${syncContext.position.ticker} não foi encontrado na corretora ${dllAccountData.BrokerID}.\n\nPossíveis causas:\n- Ativo não disponível nesta corretora\n- Código do ativo incorreto\n- Exchange incorreto\n- Ativo fora do horário de negociação`;
                        } else if (errorMessage.includes('-2147483638')) {
                          userFriendlyMessage = `❌ Licença não permite roteamento!\n\nSua licença da Profit não permite envio de ordens (apenas dados de mercado).`;
                        } else if (errorMessage.includes('-2147483646')) {
                          userFriendlyMessage = `❌ DLL não inicializada!\n\nA DLL da Profit não foi inicializada corretamente.`;
                        } else if (errorMessage.includes('-2147483643')) {
                          userFriendlyMessage = `❌ Login não encontrado!\n\nNenhum login ativo foi encontrado na DLL da Profit.`;
                        }
                        
                        alert(`❌ Erro ao enviar ordem iceberg:\n\n${userFriendlyMessage}\n\nCódigo de erro: ${result.success === false ? 'DLL Error' : 'HTTP Error'}`);
                      }
                    } catch (error) {
                      console.error('[SYNC] Erro ao enviar ordem iceberg:', error);
                      alert(`❌ Erro de conexão:\n\n${error instanceof Error ? error.message : 'Erro desconhecido'}`);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: '#333',
                    border: '1px solid #555',
                    borderRadius: 8,
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    width: '100%',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#444';
                    e.currentTarget.style.borderColor = '#06b6d4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#333';
                    e.currentTarget.style.borderColor = '#555';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Ordem Iceberg</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      Divisão em lotes menores para reduzir impacto no mercado
                    </div>
                  </div>
                  <div style={{ 
                    background: '#ca8a04', 
                    color: '#fff', 
                    padding: '4px 8px', 
                    borderRadius: 4, 
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}>
                    MODERADO
                  </div>
                </button>

                {/* TWAP */}
                <button
                  onClick={() => {
                    // TODO: Implementar TWAP
                    alert('TWAP - Funcionalidade será implementada em breve');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: '#333',
                    border: '1px solid #555',
                    borderRadius: 8,
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    width: '100%',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#444';
                    e.currentTarget.style.borderColor = '#06b6d4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#333';
                    e.currentTarget.style.borderColor = '#555';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>TWAP (Time-Weighted Average Price)</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      Execução distribuída ao longo do tempo com intervalos fixos
                    </div>
                  </div>
                  <div style={{ 
                    background: '#ea580c', 
                    color: '#fff', 
                    padding: '4px 8px', 
                    borderRadius: 4, 
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}>
                    LENTO
                  </div>
                </button>

                {/* VWAP */}
                <button
                  onClick={() => {
                    // TODO: Implementar VWAP
                    alert('VWAP - Funcionalidade será implementada em breve');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    background: '#333',
                    border: '1px solid #555',
                    borderRadius: 8,
                    color: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    width: '100%',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#444';
                    e.currentTarget.style.borderColor = '#06b6d4';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#333';
                    e.currentTarget.style.borderColor = '#555';
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: 4 }}>VWAP (Volume-Weighted Average Price)</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>
                      Execução baseada no volume de negociação do mercado
                    </div>
                  </div>
                  <div style={{ 
                    background: '#dc2626', 
                    color: '#fff', 
                    padding: '4px 8px', 
                    borderRadius: 4, 
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}>
                    AVANÇADO
                  </div>
                </button>
              </div>
            </div>

            {/* Botões de ação */}
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowOrderTypeModal(false);
                  setSyncContext(null);
                }}
                style={{
                  padding: '12px 24px',
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mensagem de Erro */}
      {error && (
        <div style={{ 
          background: '#7f1d1d', 
          color: '#fff', 
          padding: 12, 
          borderRadius: 6, 
          marginTop: 16 
        }}>
          {error}
        </div>
      )}

      {/* Modal de Sincronização de Todos os Ativos */}
      {showSyncAllModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#181818',
            padding: 32,
            borderRadius: 12,
            width: '85%',
            maxWidth: 1400,
            maxHeight: '90vh',
            border: '1px solid #444',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24
            }}>
              <h3 style={{ color: '#fff', margin: 0, fontSize: 20 }}>
                🔄 Sincronização Completa - Estratégia: {selectedStrategy?.name}
              </h3>
              <button
                onClick={() => {
                  setShowSyncAllModal(false);
                  setSyncAllData([]);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Resumo Geral */}
            <div style={{
              background: '#222',
              padding: 20,
              borderRadius: 8,
              marginBottom: 24,
              border: '1px solid #444'
            }}>
              <h4 style={{ color: '#06b6d4', margin: '0 0 16px 0', fontSize: 16 }}>
                📊 Resumo da Sincronização
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                    {syncAllData.filter(item => item.ticker !== 'LFTS11').length}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Ativos para Sincronizar
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#16a34a', fontSize: '24px', fontWeight: 'bold' }}>
                    {syncAllData.filter(item => item.ticker !== 'LFTS11' && item.action === 'buy').length}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Compras Necessárias
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#dc2626', fontSize: '24px', fontWeight: 'bold' }}>
                    {syncAllData.filter(item => item.ticker !== 'LFTS11' && item.action === 'sell').length}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Vendas Necessárias
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#f59e0b', fontSize: '24px', fontWeight: 'bold' }}>
                    {syncAllData.filter(item => item.ticker !== 'LFTS11' && item.hasConflicts).length}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Conflitos Detectados
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#06b6d4', fontSize: '24px', fontWeight: 'bold' }}>
                    R$ {syncAllData.filter(item => item.ticker !== 'LFTS11').reduce((total, item) => total + item.totalValue, 0).toLocaleString('pt-BR')}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Valor Total
                  </div>
                </div>
              </div>
            </div>

            {/* Resumo de Conflitos */}
            {(() => {
              const conflicts = syncAllData.filter(asset => asset.ticker !== 'LFTS11' && asset.hasConflicts);
              const conflictTickers = [...new Set(conflicts.map(c => c.ticker))];
              
              if (conflictTickers.length > 0) {
                return (
                  <div style={{
                    background: '#1a1a0a',
                    border: '1px solid #f59e0b',
                    padding: '16px 20px',
                    borderRadius: 8,
                    marginBottom: 24
                  }}>
                    <h4 style={{ color: '#f59e0b', margin: '0 0 12px 0', fontSize: 16 }}>
                      ⚠️ Conflitos Detectados ({conflictTickers.length})
                    </h4>
                    <div style={{ color: '#f59e0b', fontSize: '14px', marginBottom: 8 }}>
                      Os seguintes ativos têm ações conflitantes: <strong>{conflictTickers.join(', ')}</strong>
                    </div>
                    <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                      As operações serão executadas separadamente por tipo (compra/compra, venda/venda).
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Lista de Ativos */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: 16 }}>
                📋 Ativos Não Sincronizados
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {syncAllData.filter(asset => asset.ticker !== 'LFTS11').map((asset, index) => (
                  <div key={index} style={{
                    background: '#222',
                    borderRadius: 8,
                    border: '1px solid #444',
                    overflow: 'hidden'
                  }}>
                    {/* Cabeçalho do Ativo */}
                    <div style={{
                      padding: '16px 20px',
                      background: asset.hasConflicts ? '#1a1a0a' : (asset.action === 'buy' ? '#1a3a1a' : '#3a1a1a'),
                      borderBottom: '1px solid #444',
                      borderLeft: asset.hasConflicts ? '4px solid #f59e0b' : 'none'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            background: asset.action === 'buy' ? '#16a34a' : '#dc2626',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: '12px',
                            fontWeight: 'bold'
                          }}>
                            {asset.action === 'buy' ? 'COMPRAR' : 'VENDER'}
                          </div>
                          <h5 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
                            {asset.ticker}
                          </h5>
                          {asset.hasConflicts && (
                            <span style={{
                              background: '#f59e0b',
                              color: '#000',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }}>
                              ⚠️ CONFLITO
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                            {asset.totalQuantity.toLocaleString('pt-BR')} ações
                          </div>
                          <div style={{ color: '#9ca3af', fontSize: '14px' }}>
                            R$ {asset.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Tooltip de explicação para conflitos */}
                      {asset.hasConflicts && (
                        <div style={{
                          background: '#1a1a0a',
                          border: '1px solid #f59e0b',
                          padding: '8px 12px',
                          borderRadius: 4,
                          marginTop: 8,
                          fontSize: '12px',
                          color: '#f59e0b'
                        }}>
                          ⚠️ <strong>Conflito detectado:</strong> Este ativo tem contas que precisam comprar e outras que precisam vender. 
                          As ações serão executadas separadamente por tipo de operação.
                        </div>
                      )}
                    </div>

                    {/* Detalhes das Contas */}
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ marginBottom: 12 }}>
                        <h6 style={{ color: '#9ca3af', margin: '0 0 8px 0', fontSize: '14px' }}>
                          Contas Afetadas:
                        </h6>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {asset.accounts.map((account: any, accIndex: number) => (
                          <div key={accIndex} style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 12px',
                            background: '#1a1a1a',
                            borderRadius: 6,
                            border: '1px solid #333'
                          }}>
                            <div>
                              <div style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
                                {account.accountName}
                              </div>
                              <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                                Conta: {account.accountId}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ 
                                color: account.action === 'buy' ? '#16a34a' : '#dc2626', 
                                fontSize: '14px', 
                                fontWeight: 'bold' 
                              }}>
                                {(() => {
                                  const price = Number(individualPrice) || 0;
                                  const dyn = account.dynamicQuantity ?? (account.targetValueBRL && price > 0
                                    ? Math.round(Number(account.targetValueBRL) / price)
                                    : Number(account.quantity || 0));
                                  const qty = Math.max(0, Number(dyn || 0));
                                  return `${account.action === 'buy' ? '+' : '-'}${qty.toLocaleString('pt-BR')} ações`;
                                })()}
                              </div>
                              <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                                Diferença: {formatPctBR1(account.difference as any)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Botão de Sincronizar Ativo */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: 16,
                        paddingTop: 16,
                        borderTop: '1px solid #444'
                      }}>
                        <button
                          onClick={() => {
                            setSelectedAsset(asset);
                            setIndividualPrice(asset.avgPrice);
                            setIndividualQuantity(asset.totalQuantity);
                            setIndividualOrderType('simple');
                            setIndividualExchange('B');
                            
                            // Calcular tamanho do lote padrão para iceberg
                            let lotePadrao = 1;
                            if (asset.totalQuantity > 1000) {
                              lotePadrao = Math.max(50, Math.floor(asset.totalQuantity / 20));
                            } else if (asset.totalQuantity > 100) {
                              lotePadrao = Math.max(10, Math.floor(asset.totalQuantity / 10));
                            } else {
                              lotePadrao = Math.max(1, Math.floor(asset.totalQuantity / 5));
                            }
                            setIndividualIcebergLote(lotePadrao);
                            setIndividualIcebergTwapEnabled(false);
                            setIndividualIcebergTwapInterval(30);
                            
                            setShowIndividualSyncModal(true);
                          }}
                          style={{
                            padding: '10px 20px',
                            background: asset.action === 'buy' ? '#16a34a' : '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                        >
                          🔄 Sincronizar {asset.ticker}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Botões de Ação */}
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              paddingTop: 16,
              borderTop: '1px solid #444'
            }}>
              <button
                onClick={() => {
                  setShowSyncAllModal(false);
                  setSyncAllData([]);
                }}
                style={{
                  padding: '12px 24px',
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  alert('Funcionalidade será implementada!\n\nSincronizando TODOS os ativos de uma vez:\n• 4 ativos\n• R$ 373.870,00 total\n• 8.400 ações\n• 3 contas afetadas');
                }}
                style={{
                  padding: '12px 24px',
                  background: '#06b6d4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                🚀 Sincronizar Todos os Ativos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Sincronização Individual de Ativos */}
      {showIndividualSyncModal && selectedAsset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: '#181818',
            padding: 32,
            borderRadius: 12,
            width: '80%',
            maxWidth: 1000,
            maxHeight: '90vh',
            border: '1px solid #444',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24
            }}>
              <h3 style={{ color: '#fff', margin: 0, fontSize: 20 }}>
                🔄 Sincronizar {selectedAsset.ticker} - {selectedAsset.action === 'buy' ? 'COMPRA' : 'VENDA'}
              </h3>
              <button
                onClick={() => {
                  setShowIndividualSyncModal(false);
                  setSelectedAsset(null);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  padding: 4
                }}
              >
                <FiX size={24} />
              </button>
            </div>

            {/* Resumo do Ativo */}
            <div style={{
              background: '#222',
              padding: 20,
              borderRadius: 8,
              marginBottom: 24,
              border: '1px solid #444'
            }}>
              <h4 style={{ color: '#06b6d4', margin: '0 0 16px 0', fontSize: 16 }}>
                📊 Resumo da Sincronização
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
                    {selectedAsset.totalQuantity.toLocaleString('pt-BR')}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Ações Totais
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#06b6d4', fontSize: '20px', fontWeight: 'bold' }}>
                    R$ {selectedAsset.totalValue.toLocaleString('pt-BR')}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Valor Total
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#fff', fontSize: '20px', fontWeight: 'bold' }}>
                    {selectedAsset.accounts.length}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                    Contas Afetadas
                  </div>
                </div>
              </div>
            </div>

            {/* Seleção do Tipo de Ordem */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: 16 }}>
                🎯 Tipo de Ordem
              </h4>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setIndividualOrderType('simple')}
                  style={{
                    padding: '12px 24px',
                    background: individualOrderType === 'simple' ? '#06b6d4' : '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 'bold',
                    flex: 1
                  }}
                >
                  📈 Ordem Simples
                </button>
                <button
                  onClick={() => setIndividualOrderType('iceberg')}
                  style={{
                    padding: '12px 24px',
                    background: individualOrderType === 'iceberg' ? '#06b6d4' : '#333',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 'bold',
                    flex: 1
                  }}
                >
                  🧊 Ordem Iceberg
                </button>
              </div>
            </div>

            {/* Parâmetros da Ordem */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: 16 }}>
                ⚙️ Parâmetros da Ordem
              </h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {/* Preço por Ação */}
                <div>
                  <label style={{ color: '#fff', fontSize: '14px', marginBottom: 8, display: 'block' }}>
                    Preço por Ação (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={individualPrice}
                    onChange={(e) => setIndividualPrice(parseFloat(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#333',
                      border: '1px solid #555',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* Quantidade */}
                <div>
                  <label style={{ color: '#fff', fontSize: '14px', marginBottom: 8, display: 'block' }}>
                    Quantidade
                  </label>
                  <input
                    type="number"
                    value={individualQuantity}
                    onChange={(e) => setIndividualQuantity(parseInt(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#333',
                      border: '1px solid #555',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  />
                </div>

                {/* Exchange */}
                <div>
                  <label style={{ color: '#fff', fontSize: '14px', marginBottom: 8, display: 'block' }}>
                    Exchange
                  </label>
                  <select
                    value={individualExchange}
                    onChange={(e) => setIndividualExchange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: '#333',
                      border: '1px solid #555',
                      borderRadius: 6,
                      color: '#fff',
                      fontSize: '14px'
                    }}
                  >
                    <option value="B">B3</option>
                    <option value="F">Futuros</option>
                    <option value="C">Câmbio</option>
                    <option value="E">ETF</option>
                  </select>
                </div>

                {/* Valor Total Calculado */}
                <div>
                  <label style={{ color: '#fff', fontSize: '14px', marginBottom: 8, display: 'block' }}>
                    Valor Total (R$)
                  </label>
                  <div style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#444',
                    border: '1px solid #555',
                    borderRadius: 6,
                    color: '#06b6d4',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                    {(individualPrice * individualQuantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>
              </div>
            </div>

            {/* Configurações Iceberg (condicional) */}
            {individualOrderType === 'iceberg' && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: 16 }}>
                  🧊 Configurações Iceberg
                </h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                  {/* Tamanho do Lote */}
                  <div>
                    <label style={{ color: '#fff', fontSize: '14px', marginBottom: 8, display: 'block' }}>
                      Tamanho do Lote (iceberg)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={individualIcebergLote}
                      onChange={(e) => setIndividualIcebergLote(parseInt(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#333',
                        border: '1px solid #555',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  {/* Contas por Onda */}
                  <div>
                    <label style={{ color: '#fff', fontSize: '14px', marginBottom: 8, display: 'block' }}>
                      Contas por Onda
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={icebergGroupSize}
                      onChange={(e) => setIcebergGroupSize(parseInt(e.target.value) || 1)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#333',
                        border: '1px solid #555',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: '14px'
                      }}
                    />
                    <div style={{ 
                      color: '#9ca3af', 
                      fontSize: '12px', 
                      marginTop: 4,
                      fontStyle: 'italic'
                    }}>
                      Número de contas que executarão simultaneamente
                    </div>
                  </div>

                  {/* Ligar TWAP */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="checkbox"
                      checked={individualIcebergTwapEnabled}
                      onChange={(e) => setIndividualIcebergTwapEnabled(e.target.checked)}
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: '#06b6d4'
                      }}
                    />
                    <label style={{ color: '#fff', fontSize: '14px' }}>
                      Ligar TWAP
                    </label>
                  </div>
                </div>

                {/* Tempo entre Ordens (condicional) */}
                {individualIcebergTwapEnabled && (
                  <div style={{ marginTop: 16 }}>
                    <label style={{ color: '#fff', fontSize: '14px', marginBottom: 8, display: 'block' }}>
                      Tempo entre Ordens (segundos)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="300"
                      value={individualIcebergTwapInterval}
                      onChange={(e) => setIndividualIcebergTwapInterval(parseInt(e.target.value) || 30)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        background: '#333',
                        border: '1px solid #555',
                        borderRadius: 6,
                        color: '#fff',
                        fontSize: '14px'
                      }}
                    />
                  </div>
                )}

                {/* Resumo Iceberg */}
                <div style={{
                  background: '#1a1a1a',
                  padding: 16,
                  borderRadius: 8,
                  marginTop: 16,
                  border: '1px solid #444'
                }}>
                  <h5 style={{ color: '#06b6d4', margin: '0 0 12px 0', fontSize: '14px' }}>
                    📋 Resumo Iceberg
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>Total de Lotes</div>
                      <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                        {Math.ceil(individualQuantity / individualIcebergLote)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>Tamanho do Lote</div>
                      <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                        {individualIcebergLote}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>Contas por Onda</div>
                      <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                        {icebergGroupSize}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>TWAP</div>
                      <div style={{ color: individualIcebergTwapEnabled ? '#16a34a' : '#dc2626', fontSize: '16px', fontWeight: 'bold' }}>
                        {individualIcebergTwapEnabled ? 'ATIVO' : 'INATIVO'}
                      </div>
                    </div>
                  </div>
                  {individualIcebergTwapEnabled && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #444' }}>
                      <div style={{ color: '#9ca3af', fontSize: '12px' }}>Tempo Estimado</div>
                      <div style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>
                        {Math.ceil(individualQuantity / individualIcebergLote) * individualIcebergTwapInterval} segundos
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lista de Contas Afetadas */}
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ color: '#fff', margin: '0 0 16px 0', fontSize: 16 }}>
                👥 Contas Afetadas
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedAsset.accounts.map((account: any, index: number) => {
                  const accountStatus = icebergStatus[account.accountId];
                  const isExecuting = accountStatus?.status === 'executing';
                  const isCompleted = accountStatus?.status === 'completed';
                  const isFailed = accountStatus?.status === 'failed';
                  const isWaiting = accountStatus?.status === 'waiting';
                  
                  return (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      background: isExecuting ? '#1a3a1a' : isCompleted ? '#1a3a1a' : isFailed ? '#3a1a1a' : '#1a1a1a',
                      borderRadius: 6,
                      border: isExecuting ? '1px solid #16a34a' : isCompleted ? '1px solid #16a34a' : isFailed ? '1px solid #dc2626' : '1px solid #333'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ 
                          color: '#fff', 
                          fontSize: '14px', 
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8
                        }}>
                          {isExecuting && '🔄'}
                          {isCompleted && '✅'}
                          {isFailed && '❌'}
                          {isWaiting && '⏳'}
                          {account.accountName}
                          {currentExecutingAccount === account.accountId && (
                            <span style={{ 
                              color: '#000', 
                              fontSize: '12px',
                              background: '#06b6d4',
                              padding: '2px 6px',
                              borderRadius: 4
                            }}>
                              EXECUTANDO
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                          Conta: {account.accountId}
                        </div>
                        {accountStatus && (
                          <div style={{ 
                            color: accountStatus.status === 'executing' ? '#06b6d4' : 
                                   accountStatus.status === 'completed' ? '#16a34a' : 
                                   accountStatus.status === 'failed' ? '#dc2626' : '#9ca3af', 
                            fontSize: '12px',
                            marginTop: 4
                          }}>
                            {accountStatus.message}
                          </div>
                        )}
                        {accountStatus?.status === 'executing' && accountStatus.progress > 0 && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{
                              width: '100%',
                              height: 4,
                              background: '#333',
                              borderRadius: 2,
                              overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${accountStatus.progress}%`,
                                height: '100%',
                                background: '#06b6d4',
                                transition: 'width 0.3s ease'
                              }} />
                            </div>
                            <div style={{ 
                              color: '#9ca3af', 
                              fontSize: '10px', 
                              marginTop: 2 
                            }}>
                              {Math.round(accountStatus.progress)}%
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ 
                          color: account.action === 'buy' ? '#16a34a' : '#dc2626', 
                          fontSize: '14px', 
                          fontWeight: 'bold' 
                        }}>
                          {(() => {
                            const price = Number(individualPrice) || 0;
                            const dyn = account.dynamicQuantity ?? (account.targetValueBRL && price > 0
                              ? Math.round(Number(account.targetValueBRL) / price)
                              : Number(account.quantity || 0));
                            const qty = Math.max(0, Number(dyn || 0));
                            return `${account.action === 'buy' ? '+' : '-'}${qty.toLocaleString('pt-BR')} ações`;
                          })()}
                        </div>
                        <div style={{ color: '#9ca3af', fontSize: '12px' }}>
                          Diferença: {formatPctBR1(account.difference as any)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status de Execução */}
            {currentExecutingAccount && (
              <div style={{
                background: '#1a1a0a',
                border: '1px solid #dc2626',
                padding: '12px 16px',
                borderRadius: 6,
                marginBottom: 16
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <span style={{ color: '#dc2626', fontSize: '16px' }}>⚡</span>
                  <span style={{ 
                    color: '#dc2626', 
                    fontSize: '14px', 
                    fontWeight: 'bold' 
                  }}>
                    Executando Iceberg
                  </span>
                </div>
                <div style={{ 
                  color: '#9ca3af', 
                  fontSize: '12px',
                  marginTop: 4
                }}>
                  Conta atual: {selectedAsset.accounts.find((acc: any) => acc.accountId === currentExecutingAccount)?.accountName || 'Desconhecida'}
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
              paddingTop: 16,
              borderTop: '1px solid #444'
            }}>
              {canCancelExecution && currentExecutingAccount && (
                <button
                  onClick={cancelIcebergExecution}
                  style={{
                    padding: '12px 24px',
                    background: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 'bold'
                  }}
                  title="Cancelar a execução do iceberg atual"
                >
                  🛑 Cancelar Iceberg Atual
                </button>
              )}
              <button
                onClick={() => {
                  setShowIndividualSyncModal(false);
                  setSelectedAsset(null);
                  setCanCancelExecution(false);
                  setCurrentExecutingAccount(null);
                  setIcebergStatus({});
                }}
                style={{
                  padding: '12px 24px',
                  background: '#555',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold'
                }}
              >
                Fechar
              </button>
              <button
                onClick={individualOrderType === 'simple' ? sendIndividualSimpleOrder : sendIndividualIcebergOrder}
                disabled={isSendingOrder || isSendingIcebergOrder}
                style={{
                  padding: '12px 24px',
                  background: selectedAsset.action === 'buy' ? '#16a34a' : '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                              >
                  {isSendingOrder || isSendingIcebergOrder ? '⏳ Enviando...' : `🚀 ${individualOrderType === 'simple' ? 'Enviar Ordem Simples' : 'Enviar Ordem Iceberg'}`}
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 