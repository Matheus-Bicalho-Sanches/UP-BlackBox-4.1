"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tipos para os dados da API real
interface RobotPattern {
  id: string;
  symbol: string;
  exchange: string;
  pattern_type: string;
  robot_type: string;  // ✅ NOVO: Tipo do robô
  confidence_score: number;
  agent_id: number;
  signature_key?: string;
  signature_volume?: number;
  signature_direction?: string;
  signature_interval_seconds?: number;
  pattern_id?: number;
  first_seen: string;
  last_seen: string;
  total_volume: number;
  total_trades: number;
  avg_trade_size: number;
  frequency_minutes: number;
  price_aggression: number;
  status: string;
  market_volume_percentage?: number;  // ✅ NOVO: Volume em % do mercado
}

interface RobotStatusChange {
  id: string;
  symbol: string;
  agent_id: number;
  agent_name?: string;  // ✅ NOVO: Nome da corretora
  robot_type: string;  // ✅ NOVO: Tipo do robô
  old_status: string;
  new_status: string;
  timestamp: string;
  pattern_type: string;
  confidence_score: number;
  total_volume: number;
  total_trades: number;
  market_volume_percentage?: number;  // ✅ NOVO: Volume em % do mercado
  signature_key?: string;
  signature_volume?: number;
  signature_direction?: string;
  signature_interval_seconds?: number;
  pattern_id?: number;
}

// ✅ NOVO: Interface para mudanças de tipo de robô
interface RobotTypeChange {
  id: string;
  symbol: string;
  agent_id: number;
  agent_name: string;
  old_type: string;
  new_type: string;
  old_volume_percentage: number;
  new_volume_percentage: number;
  timestamp: string;
  confidence_score: number;
  total_volume: number;
  total_trades: number;
  change_type: string;
  pattern_type: string;
}

// ✅ NOVO: Interface unificada para todas as mudanças
interface RobotChange {
  id: string;
  symbol: string;
  agent_id: number;
  agent_name?: string;
  robot_type?: string;
  timestamp: string;
  confidence_score: number;
  total_volume: number;
  total_trades: number;
  pattern_type: string;
  change_category: 'status' | 'type';
  signature_key?: string;
  signature_volume?: number;
  signature_direction?: string;
  signature_interval_seconds?: number;
  pattern_id?: number;
  
  // Campos específicos para mudanças de status
  old_status?: string;
  new_status?: string;
  market_volume_percentage?: number;
  
  // Campos específicos para mudanças de tipo
  old_type?: string;
  new_type?: string;
  old_volume_percentage?: number;
  new_volume_percentage?: number;
  change_type?: string;
}

// ✅ NOVO: Interface para trades de robôs
interface RobotTrade {
  id: number;
  symbol: string;
  agent_id: number;
  timestamp: string;
  price: number;
  volume: number;
  side: string;
  pattern_id: number;
  created_at: string;
  signature_key?: string;
}

// Configuração da API
const API_BASE_URL = 'http://localhost:8002';
const WEBSOCKET_URL = 'ws://localhost:8002/ws/robot-status';

// Mapeamento de códigos de agente para nomes de corretoras
const AGENT_MAPPING: { [key: number]: string } = {
  3: "XP",
  4: "Alfa",
  8: "UBS",
  9: "Deutsche",
  10: "Spinelli",
  13: "Merril",
  15: "Guide",
  16: "JP Morgan",
  21: "Votorantim",
  23: "Necton",
  27: "Santander",
  39: "Agora",
  40: "Morgan",
  45: "Credit",
  58: "Socopa",
  59: "Safra",
  63: "NovInvest",
  72: "Bradesco",
  74: "Coinvalores",
  77: "Citigroup",
  83: "Master",
  85: "BTG",
  88: "CM Capital",
  90: "NuInvest",
  92: "Elliot",
  93: "Nova Futura",
  106: "Mercantil",
  107: "Terra",
  114: "Itau",
  115: "Commcor",
  120: "Genial",
  122: "BGC",
  127: "Tullet",
  129: "Planner",
  131: "Fator",
  147: "Ativa",
  172: "Banrisul",
  174: "Elite",
  177: "Solidus",
  186: "Geral",
  187: "Sita",
  190: "Warren",
  191: "Senso",
  206: "Banco JP",
  226: "Amaril",
  227: "Gradual",
  234: "Codepe",
  238: "Goldman",
  251: "BNP",
  254: "BB",
  262: "Mirae",
  298: "Citibank",
  304: "Safra",
  308: "Clear",
  346: "Daycoval",
  370: "Traderace",
  386: "Rico",
  688: "ABN",
  735: "ICAP",
  746: "LEV",
  833: "Credit",
  1026: "BTG",
  1081: "Banco Seguro",
  1089: "RB Capital",
  1099: "Inter",
  1130: "StoneX",
  1618: "Ideal",
  1850: "Sicredi",
  1855: "Vitreo",
  1953: "Sicoob",
  1982: "Modal",
  2028: "Itau",
  2659: "BB",
  3701: "Órama",
  4015: "Galapagos",
  4090: "Toro",
  6003: "C6",
  7029: "PicPay",
  7035: "Paginvest",
  7078: "Scotiabank",
  811675: "TC BR"
};

// Função para obter o nome da corretora
const getAgentName = (agentId: number): string => {
  return AGENT_MAPPING[agentId] || `Agente ${agentId}`;
};

// Lista de ativos vinda da configuração compartilhada

const mockExchanges = ['B3', 'BMF'];

// 🤖 Tipos de robôs disponíveis
const robotTypes = ['Robô Tipo 0', 'Robô Tipo 1', 'Robô Tipo 2', 'Robô Tipo 3', 'TWAP à Mercado'];

export default function MotionTrackerPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('TODOS');
  const [selectedExchange, setSelectedExchange] = useState('B3');
  const [robotPatterns, setRobotPatterns] = useState<RobotPattern[]>([]);
  const [robotStatusChanges, setRobotStatusChanges] = useState<RobotStatusChange[]>([]);
  const [allRobotChanges, setAllRobotChanges] = useState<RobotChange[]>([]);  // ✅ NOVO: Estado unificado
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ NOVO: Estado para WebSocket
  const [websocketConnected, setWebsocketConnected] = useState(false);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);

  // 🚀 NOVO: Estado para lazy loading das abas
  const [activeTab, setActiveTab] = useState('startstop');
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set()); // Será carregada explicitamente abaixo
  const [tabLoading, setTabLoading] = useState<Record<string, boolean>>({
    startstop: false,
    patterns: false,
    analytics: false
  });

  // ✅ NOVO: Estado para modal de trades
  const [tradesModalOpen, setTradesModalOpen] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState<Partial<RobotPattern> | null>(null);
  const [robotTrades, setRobotTrades] = useState<RobotTrade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [tradesMeta, setTradesMeta] = useState<{
    count: number;
    firstTimestamp: string | null;
    lastTimestamp: string | null;
    patternId: number | null;
  } | null>(null);

  // 🔎 Filtro de status para a aba Padrões Detectados
const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

  // 🤖 NOVO: Filtro por tipos de robôs (seleção múltipla)
  const [selectedRobotTypes, setSelectedRobotTypes] = useState<string[]>(['Robô Tipo 0', 'Robô Tipo 1', 'Robô Tipo 2', 'Robô Tipo 3', 'TWAP à Mercado']);

  // 🔄 Controle de atualização silenciosa (debounce)
  const lastPatternsFetchRef = useRef<number>(0);
  const debounceMs = 3000;
  const prevActiveKeysRef = useRef<Set<string>>(new Set());

  const [symbolOptions, setSymbolOptions] = useState<string[]>(["TODOS"]);

  useEffect(() => {
    const fetchDefaultSymbols = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/shared/default-symbols`);
        if (!res.ok) {
          throw new Error(`Erro ao carregar símbolos (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (data && Array.isArray(data.symbols)) {
          setSymbolOptions(["TODOS", ...data.symbols]);
        }
      } catch (err) {
        console.error('Erro ao carregar lista de símbolos padrão:', err);
        setSymbolOptions(["TODOS"]);
      }
    };

    fetchDefaultSymbols();
  }, []);

  // Atualiza padrões e detecta ativações para exibir notificação (fallback caso WS não envie)
  const setPatternsWithStartDetection = (patterns: RobotPattern[]) => {
    setRobotPatterns(patterns);
    try {
      // Monta conjunto de robôs ativos (chave: SYMBOL_AGENT)
      const newActive = new Set<string>();
      for (const p of patterns) {
        if (p && p.status === 'active' && p.symbol && typeof p.agent_id !== 'undefined') {
          const key = `${p.symbol}_${p.agent_id}_${p.signature_key || ''}`;
          newActive.add(key);
        }
      }
      // Na primeira carga, apenas sincroniza sem notificar
      if (prevActiveKeysRef.current.size === 0) {
        prevActiveKeysRef.current = newActive;
        return;
      }
      // Detecta novos ativos (reativações/inícios)
      const started: string[] = [];
      newActive.forEach((key) => {
        if (!prevActiveKeysRef.current.has(key)) started.push(key);
      });
      if (started.length > 0) {
        // Exibe no máximo 3 notificações individuais para evitar spam
        const maxNotifs = 3;
        for (let i = 0; i < Math.min(started.length, maxNotifs); i++) {
          const parts = started[i].split('_');
          const sym = parts[0];
          const agentId = Number(parts[1]);
          const signatureKey = parts.slice(2).join('_');
          showNotification(`🟢 Robô ${getAgentName(agentId)} (${signatureKey || 'assinatura desconhecida'}) iniciou em ${sym}`);
        }
        // Se houver mais, mostra um resumo
        if (started.length > maxNotifs) {
          showNotification(`🟢 +${started.length - maxNotifs} robôs iniciaram/reativaram`);
        }

        // ➕ Também injeta itens sintéticos no histórico Start/Stop (fallback caso WS não traga o evento)
        setRobotStatusChanges(prev => {
          const nowIso = new Date().toISOString();
          const newItems = [] as any[];
          for (const key of started) {
          const parts = key.split('_');
          const sym = parts[0];
          const agentId = Number(parts[1]);
          const signatureKey = parts.slice(2).join('_');
          const pat = patterns.find((p: RobotPattern) => p.symbol === sym && p.agent_id === agentId && (p.signature_key || '') === signatureKey);
            if (!pat) continue;
            const itemId = `${sym}_${agentId}_${Date.now()}`;
            const exists = prev.some(ch => ch.id === itemId);
            if (!exists) {
              newItems.push({
                id: itemId,
                symbol: sym,
                agent_id: agentId,
                agent_name: getAgentName(agentId),
                old_status: 'inactive',
                new_status: 'active',
                timestamp: nowIso,
                pattern_type: pat.pattern_type || 'TWAP',
                confidence_score: pat.confidence_score || 0,
                total_volume: pat.total_volume || 0,
                total_trades: pat.total_trades || 0,
                market_volume_percentage: pat.market_volume_percentage,
              signature_key: signatureKey,
              signature_volume: pat.signature_volume,
              signature_direction: pat.signature_direction,
              signature_interval_seconds: pat.signature_interval_seconds,
              });
            }
          }
          if (newItems.length === 0) return prev;
          const updated = [...newItems, ...prev];
          return updated.slice(0, 50);
        });
      }
      // Atualiza baseline
      prevActiveKeysRef.current = newActive;
    } catch (e) {
      // silencioso
    }
  };

  // Função para buscar padrões de robôs da API
  const fetchRobotPatterns = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedSymbol && selectedSymbol !== 'TODOS') {
        params.set('symbol', selectedSymbol.toUpperCase());
      }
      const response = await fetch(`${API_BASE_URL}/robots/patterns${params.toString() ? `?${params.toString()}` : ''}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // ✅ NOVO: Debug para entender o formato dos dados
      console.log('Dados recebidos da API /robots/patterns:', data);
      
      // ✅ NOVO: Verificação de segurança para garantir que é um array
      if (Array.isArray(data)) {
        setPatternsWithStartDetection(data);
      } else if (data && Array.isArray(data.patterns)) {
        // Se a API retorna { patterns: [...] }
        setPatternsWithStartDetection(data.patterns);
      } else if (data && data.success && Array.isArray(data.data)) {
        // Se a API retorna { success: true, data: [...] }
        setPatternsWithStartDetection(data.data);
      } else {
        console.warn('Formato inesperado dos dados:', data);
        setRobotPatterns([]);
      }
      
    } catch (error) {
      console.error('Erro ao buscar padrões de robôs:', error);
      setError('Erro ao carregar padrões de robôs');
      setRobotPatterns([]); // ✅ NOVO: Garante que sempre seja um array
    } finally {
      setLoading(false);
    }
  };

  // Versão silenciosa: atualiza os padrões sem mudar o estado global de loading
  const refreshRobotPatterns = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedSymbol && selectedSymbol !== 'TODOS') {
        params.set('symbol', selectedSymbol.toUpperCase());
      }
      const response = await fetch(`${API_BASE_URL}/robots/patterns${params.toString() ? `?${params.toString()}` : ''}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setPatternsWithStartDetection(data);
      } else if (data && Array.isArray(data.patterns)) {
        setPatternsWithStartDetection(data.patterns);
      } else if (data && data.success && Array.isArray(data.data)) {
        setPatternsWithStartDetection(data.data);
      }
    } catch (error) {
      // Evita poluir a UI; apenas loga
      console.warn('Refresh silencioso falhou:', error);
    }
  };

  // ✅ NOVO: Função para buscar todas as mudanças (status + tipo)
  const fetchAllRobotChanges = async (symbol?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.set('hours', '24');
      if (symbol && symbol !== 'TODOS') {
        params.set('symbol', symbol.toUpperCase());
      }

      const url = `${API_BASE_URL}/robots/all-changes?${params.toString()}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('Dados recebidos da API /robots/all-changes:', data);
      
      if (Array.isArray(data)) {
        setAllRobotChanges(data.slice(0, 50));
      } else if (data && Array.isArray(data.changes)) {
        setAllRobotChanges(data.changes.slice(0, 50));
      } else if (data && data.success && Array.isArray(data.data)) {
        setAllRobotChanges(data.data.slice(0, 50));
      } else {
        console.warn('Formato inesperado dos dados de mudanças:', data);
        setAllRobotChanges([]);
      }
      
    } catch (err) {
      console.error('Erro ao buscar mudanças dos robôs:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setAllRobotChanges([]);
    } finally {
      setLoading(false);
    }
  };

  // Função para buscar mudanças de status dos robôs
  const fetchRobotStatusChanges = async (symbol?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.set('hours', '24');
      if (symbol && symbol !== 'TODOS') {
        params.set('symbol', symbol.toUpperCase());
      }
      
      const url = `${API_BASE_URL}/robots/status-changes?${params.toString()}`;
      console.log(`🔍 Buscando mudanças de status: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Erro HTTP ${response.status}:`, errorText);
        throw new Error(`Erro na API: ${response.status} - ${errorText || 'Servidor indisponível'}`);
      }
      
      const data = await response.json();
      
      // ✅ NOVO: Debug para entender o formato dos dados
      console.log('Dados recebidos da API /robots/status-changes:', data);
      
      // ✅ NOVO: Verificação de segurança para garantir que é um array
      if (Array.isArray(data)) {
        // ✅ Limita aos 50 mais recentes
        setRobotStatusChanges(data.slice(0, 50));
      } else if (data && Array.isArray(data.status_changes)) {
        // Se a API retorna { status_changes: [...] }
        setRobotStatusChanges(data.status_changes.slice(0, 50));
      } else if (data && data.success && Array.isArray(data.data)) {
        // Se a API retorna { success: true, data: [...] }
        setRobotStatusChanges(data.data.slice(0, 50));
      } else {
        console.warn('Formato inesperado dos dados de status:', data);
        setRobotStatusChanges([]);
      }
      
    } catch (err) {
      console.error('Erro ao buscar mudanças de status:', err);
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('Servidor de API não está disponível (localhost:8002). Verifique se o servidor está rodando.');
      } else {
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      }
      setRobotStatusChanges([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ NOVO: Funções para WebSocket
  const connectWebSocket = () => {
    try {
      const ws = new WebSocket(WEBSOCKET_URL);
      
      ws.onopen = () => {
        console.log('WebSocket conectado');
        setWebsocketConnected(true);
        setWebsocket(ws);
        
        // Inicia ping/pong para manter conexão ativa
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          } else {
            clearInterval(pingInterval);
          }
        }, 30000); // Ping a cada 30 segundos
        
        // Armazena o intervalo para limpeza
        (ws as any).pingInterval = pingInterval;
      };
      
      ws.onmessage = (event) => {
        try {
          // ✅ NOVO: Ignora mensagens de ping/pong
          if (event.data === 'pong') {
            return; // Ignora resposta de ping
          }
          
          const message = JSON.parse(event.data);
          
          if (message.type === 'status_change') {
            console.log('Nova mudança de status recebida:', message.data);
            
            // ✅ NOVO: Notificação visual para novos robôs
            const newChange = message.data;
            if (newChange.new_status === 'active') {
              // Mostra notificação para robôs que iniciaram
              showNotification(`🟢 Robô ${newChange.agent_name || getAgentName(newChange.agent_id)} iniciou em ${newChange.symbol}`);
            } else if (newChange.new_status === 'inactive') {
              // Mostra notificação para robôs que pararam
              showNotification(`🔴 Robô ${newChange.agent_name || getAgentName(newChange.agent_id)} parou em ${newChange.symbol}`);
            }
            
            // Adiciona a nova mudança no topo da lista unificada
            setAllRobotChanges(prevChanges => {
              const changeWithCategory = {
                ...newChange,
                change_category: 'status' as const,
                signature_key: newChange.signature_key,
                signature_volume: newChange.signature_volume,
                signature_direction: newChange.signature_direction,
                signature_interval_seconds: newChange.signature_interval_seconds,
                pattern_id: newChange.pattern_id,
              };
              const exists = prevChanges.find(change => change.id === newChange.id);
              if (!exists) {
                const updated = [changeWithCategory, ...prevChanges];
                return updated.slice(0, 50);
              }
              return prevChanges;
            });

            // 🔄 Atualiza cards do topo após mudanças de status (com debounce)
            const now = Date.now();
            if (now - lastPatternsFetchRef.current > debounceMs) {
              lastPatternsFetchRef.current = now;
              refreshRobotPatterns();
            }
          } else if (message.type === 'type_change') {
            console.log('Nova mudança de tipo recebida:', message.data);
            
            // ✅ NOVO: Notificação visual para mudanças de tipo
            const typeChange = message.data;
            showNotification(`🔄 Robô ${typeChange.agent_name} em ${typeChange.symbol} mudou de ${typeChange.old_type} para ${typeChange.new_type}`);
            
            // Adiciona a mudança de tipo na lista unificada
            setAllRobotChanges(prevChanges => {
              const changeWithCategory = {
                ...typeChange,
                change_category: 'type' as const,
                signature_key: typeChange.signature_key,
                signature_volume: typeChange.signature_volume,
                signature_direction: typeChange.signature_direction,
                signature_interval_seconds: typeChange.signature_interval_seconds,
                pattern_id: typeChange.pattern_id,
              };
              const exists = prevChanges.find(change => change.id === typeChange.id);
              if (!exists) {
                const updated = [changeWithCategory, ...prevChanges];
                return updated.slice(0, 50);
              }
              return prevChanges;
            });

            // Atualiza padrões para refletir novo tipo
            refreshRobotPatterns();
          }
        } catch (error) {
          // ✅ NOVO: Ignora erros de parsing para mensagens não-JSON (como "pong")
          if (event.data !== 'pong') {
            console.error('Erro ao processar mensagem WebSocket:', error);
          }
        }
      };
      
      ws.onclose = () => {
        console.log('WebSocket desconectado');
        setWebsocketConnected(false);
        setWebsocket(null);
        
        // Reconecta após 5 segundos
        setTimeout(() => {
          if (!websocketConnected) {
            connectWebSocket();
          }
        }, 5000);
      };
      
      ws.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        setWebsocketConnected(false);
      };
      
    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
      setWebsocketConnected(false);
    }
  };
  
  // ✅ NOVO: Função para mostrar notificações
  const showNotification = (message: string) => {
    // Cria uma notificação temporária no canto superior direito
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transform transition-all duration-300 translate-x-full';
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Anima a entrada
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove após 5 segundos
    setTimeout(() => {
      notification.style.transform = 'translateX(full)';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 5000);
  };

  // ✅ NOVO: Função para buscar trades de um robô específico
  const fetchRobotTrades = async (symbol: string, agentId: number, opts?: { marketTwapOnly?: boolean }) => {
    try {
      setTradesLoading(true);
      setError(null);

      const params = new URLSearchParams({ limit: '500' });
      if (opts?.marketTwapOnly) {
        params.set('pattern_type', 'MARKET_TWAP');
      }
      const response = await fetch(`${API_BASE_URL}/robots/${symbol}/${agentId}/trades?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();
      if (data && Array.isArray(data.trades)) {
        setRobotTrades(data.trades);
        setTradesMeta({
          count: typeof data.count === 'number' ? data.count : data.trades.length,
          firstTimestamp: data.first_seen ?? data.trades[data.trades.length - 1]?.timestamp ?? null,
          lastTimestamp: data.last_seen ?? data.trades[0]?.timestamp ?? null,
          patternId: typeof data.pattern_id === 'number' ? data.pattern_id : null,
        });
      } else if (Array.isArray(data)) {
        setRobotTrades(data);
        setTradesMeta({
          count: data.length,
          firstTimestamp: data[data.length - 1]?.timestamp ?? null,
          lastTimestamp: data[0]?.timestamp ?? null,
          patternId: null,
        });
      } else {
        console.warn('Formato inesperado dos dados de trades:', data);
        setRobotTrades([]);
        setTradesMeta(null);
      }

    } catch (err) {
      console.error('Erro ao buscar trades do robô:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setRobotTrades([]);
      setTradesMeta(null);
    } finally {
      setTradesLoading(false);
    }
  };

  // ✅ NOVO: Função para abrir modal de trades
  const openTradesModal = async (robot: RobotPattern) => {
    setSelectedRobot(robot);
    setTradesModalOpen(true);
    const marketTwapOnly = robot.robot_type === 'TWAP à Mercado';
    // calcula período do dia atual para exibir no modal
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    setTradesMeta({
      count: 0,
      firstTimestamp: start.toISOString(),
      lastTimestamp: end.toISOString(),
      patternId: robot.pattern_id ?? null,
    });
    await fetchRobotTrades(robot.symbol, robot.agent_id, { marketTwapOnly });
  };

  // ✅ NOVO: Abrir modal de trades a partir do item de Start/Stop
  const openTradesModalFromChange = async (change: RobotChange) => {
    setSelectedRobot({ symbol: change.symbol, agent_id: change.agent_id } as unknown as RobotPattern);
    setTradesModalOpen(true);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    setTradesMeta({
      count: 0,
      firstTimestamp: start.toISOString(),
      lastTimestamp: end.toISOString(),
      patternId: change.pattern_id ?? null,
    });
    await fetchRobotTrades(change.symbol, change.agent_id, { marketTwapOnly: true });
  };
  
  const disconnectWebSocket = () => {
    if (websocket) {
      // Limpa o intervalo de ping
      if ((websocket as any).pingInterval) {
        clearInterval((websocket as any).pingInterval);
      }
      websocket.close();
      setWebsocket(null);
      setWebsocketConnected(false);
    }
  };

  // 🚀 NOVO: Carrega dados apenas da aba ativa (lazy loading)
  useEffect(() => {
    // Só carrega dados se a aba ainda não foi carregada
    if (!loadedTabs.has(activeTab)) {
      loadTabData(activeTab);
    }
  }, [activeTab, loadedTabs]);

  // 🚀 NOVO: Carregamento inicial da aba Start/Stop + padrões (para os cards)
  useEffect(() => {
    (async () => {
      await loadTabData('startstop');
    })();
  }, []); // Executa apenas uma vez ao montar

  // 🚀 NOVO: Função para carregar dados de uma aba específica
  const loadTabData = async (tabName: string) => {
    if (loadedTabs.has(tabName)) {
      console.log(`⏭️ Aba ${tabName} já carregada, pulando...`);
      return; // Aba já foi carregada
    }

    console.log(`🔨 Iniciando carregamento da aba: ${tabName}`);
    setTabLoading(prev => ({ ...prev, [tabName]: true }));

    try {
      switch (tabName) {
        case 'startstop':
          console.log(`📊 Carregando dados para Start/Stop...`);
          // Precisamos dos patterns para preencher os cards do topo
          await fetchAllRobotChanges(selectedSymbol === 'TODOS' ? undefined : selectedSymbol);  // ✅ NOVO: Usa endpoint unificado
          await fetchRobotPatterns();
          break;
        case 'patterns':
          console.log(`📊 Carregando dados para Patterns...`);
          await fetchRobotPatterns();
          break;
        case 'analytics':
          console.log(`📊 Analytics não precisa de dados específicos`);
          break;
      }

      // Marca a aba como carregada
      setLoadedTabs(prev => {
        const newSet = new Set([...prev, tabName]);
        console.log(`✅ Aba ${tabName} carregada com sucesso!`);
        console.log(`📊 Total de abas carregadas:`, Array.from(newSet));
        return newSet;
      });
    } catch (error) {
      console.error(`❌ Erro ao carregar dados da aba ${tabName}:`, error);
    } finally {
      setTabLoading(prev => ({ ...prev, [tabName]: false }));
      console.log(`🏁 Carregamento da aba ${tabName} finalizado`);
    }
  };

  // 🚀 NOVO: Função para lidar com mudança de aba
  const handleTabChange = (value: string) => {
    console.log(`🔄 Mudando para aba: ${value}`);
    console.log(`📊 Abas já carregadas:`, Array.from(loadedTabs));
    
    setActiveTab(value);
    
    // Se a aba ainda não foi carregada, carrega os dados
    if (!loadedTabs.has(value)) {
      console.log(`🚀 Carregando dados da aba: ${value}`);
      loadTabData(value);
    } else {
      console.log(`✅ Aba ${value} já carregada, usando cache`);
    }
  };

  // Carrega dados quando o símbolo muda (apenas para abas já carregadas)
  useEffect(() => {
    // Recarrega apenas as abas que já foram carregadas
    loadedTabs.forEach(tabName => {
      if (tabName === 'startstop') {
        fetchRobotStatusChanges(selectedSymbol === 'TODOS' ? undefined : selectedSymbol);
      } else if (tabName === 'patterns') {
        fetchRobotPatterns();
      }
    });
  }, [selectedSymbol, loadedTabs]);

  // ✅ NOVO: Conecta ao WebSocket quando o componente monta
  useEffect(() => {
    connectWebSocket();
    
    // Limpa conexão quando o componente desmonta
    return () => {
      disconnectWebSocket();
    };
  }, []); // Executa apenas uma vez ao montar

  // 🔁 Fallback de atualização periódica a cada 5s (para manter os cards atualizados)
  useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === 'startstop' || activeTab === 'patterns') {
        refreshRobotPatterns();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-gray-500';
      case 'suspicious': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getPatternTypeColor = (type: string) => {
    switch (type) {
      case 'TWAP': return 'bg-blue-500';
      case 'VWAP': return 'bg-purple-500';
      case 'UNKNOWN': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  // 🤖 NOVO: Função para cores dos tipos de robôs
  const getRobotTypeColor = (robotType: string) => {
    switch (robotType) {
      case 'Robô Tipo 0': return 'bg-gray-600';   // Cinza para volume muito baixo (0-1%)
      case 'Robô Tipo 1': return 'bg-green-600';  // Verde para baixo volume (1-5%)
      case 'Robô Tipo 2': return 'bg-yellow-600'; // Amarelo para médio volume (5-10%)
      case 'Robô Tipo 3': return 'bg-red-600';    // Vermelho para alto volume (> 10%)
      case 'TWAP à Mercado': return 'bg-cyan-600'; // Ciano para TWAP à Mercado
      default: return 'bg-blue-600';
    }
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (timestamp?: string | null) => {
    if (!timestamp) return '—';
    const dateValue = new Date(timestamp);
    if (Number.isNaN(dateValue.getTime())) return '—';
    return dateValue.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 🤖 NOVO: Função para alternar tipos de robôs selecionados
  const toggleRobotType = (robotType: string) => {
    setSelectedRobotTypes(prev => {
      if (prev.includes(robotType)) {
        // Remove o tipo se já estiver selecionado
        return prev.filter(type => type !== robotType);
      } else {
        // Adiciona o tipo se não estiver selecionado
        return [...prev, robotType];
      }
    });
  };

  // 🤖 NOVO: Função para selecionar/deselecionar todos os tipos
  const toggleAllRobotTypes = () => {
    if (selectedRobotTypes.length === robotTypes.length) {
      // Se todos estão selecionados, deseleciona todos
      setSelectedRobotTypes([]);
    } else {
      // Se nem todos estão selecionados, seleciona todos
      setSelectedRobotTypes([...robotTypes]);
    }
  };

  // Função para filtrar padrões por símbolo, status e tipo de robô
const isRobotCurrentlyActive = (symbol: string, agentId: number, signatureKey?: string) => {
  return robotPatterns.some(p =>
    p.symbol === symbol &&
    p.agent_id === agentId &&
    (signatureKey ? (p.signature_key || '') === signatureKey : true) &&
    p.status === 'active'
  );
};

const getFilteredPatterns = () => {
  if (!Array.isArray(robotPatterns)) return [];
  return robotPatterns.filter(p => 
    (selectedSymbol === 'TODOS' || p.symbol === selectedSymbol) &&
    (statusFilter === 'all' || p.status === statusFilter) &&
    (p.robot_type ? selectedRobotTypes.includes(p.robot_type) : selectedRobotTypes.includes('Robô Tipo 1'))
  );
};

  // Função auxiliar: apenas por símbolo (usada nos cards de resumo)
  const getSymbolTypeFilteredPatterns = () => {
    if (!Array.isArray(robotPatterns)) return [];
    return robotPatterns.filter(p =>
      (selectedSymbol === 'TODOS' || p.symbol === selectedSymbol) &&
      (p.robot_type ? selectedRobotTypes.includes(p.robot_type) : selectedRobotTypes.includes('Robô Tipo 1'))
    );
  };

  const getSymbolFilteredPatterns = () => {
    if (!Array.isArray(robotPatterns)) return [];
    return robotPatterns.filter(p =>
      (selectedSymbol === 'TODOS' || p.symbol === selectedSymbol) &&
      (statusFilter === 'all' || p.status === statusFilter)
    );
  };

  // Função para obter estatísticas filtradas
  const getFilteredStats = () => {
    const filtered = getSymbolFilteredPatterns();
    return {
      activeCount: filtered.filter(p => p.status === 'active').length,
      totalVolume: filtered.reduce((sum, p) => sum + p.total_volume, 0),
      totalTrades: filtered.reduce((sum, p) => sum + p.total_trades, 0),
      avgConfidence: filtered.length > 0 ?
        filtered.reduce((sum, p) => sum + p.confidence_score, 0) / filtered.length : 0
    };
  };

  const handleTotalRobotsClick = () => {
    setStatusFilter('all');
  };

  const handleActiveRobotsClick = () => {
    setStatusFilter('active');
  };

  const filteredPatterns = getFilteredPatterns();
  const symbolTypeFilteredPatterns = getSymbolTypeFilteredPatterns();
  const totalRobotsCount = symbolTypeFilteredPatterns.length;
  const activeRobotsCount = symbolTypeFilteredPatterns.filter(p => p.status === 'active').length;
  const filteredStartStopChanges = allRobotChanges
    .filter(change => selectedSymbol === 'TODOS' || change.symbol === selectedSymbol)
    .filter(change => {
      const robotType = change.robot_type || change.new_type || change.old_type;
      let typeMatch = true;
      if (robotType) {
        typeMatch = selectedRobotTypes.includes(robotType);
        if (!typeMatch && !robotTypes.includes(robotType)) {
          typeMatch = selectedRobotTypes.includes('Robô Tipo 0');
        }
      } else {
        typeMatch = selectedRobotTypes.includes('Robô Tipo 1');
      }
      if (!typeMatch) return false;

      if (statusFilter === 'all') return true;
      const activeNow = isRobotCurrentlyActive(change.symbol, change.agent_id, change.signature_key);
      if (statusFilter === 'active') return activeNow;
      if (statusFilter === 'inactive') return !activeNow;
      return true;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl text-white font-semibold">Motion Tracker</h2>
          {/* 🚀 NOVO: Indicador de performance */}
          <div className="text-sm text-gray-400 mt-1">
            🚀 Lazy Loading Ativo - Abas carregadas: {loadedTabs.size}/3
          </div>
        </div>
        <div className="flex items-center space-x-4">
          {/* ✅ NOVO: Indicador de status do WebSocket */}
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${websocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">
              {websocketConnected ? 'Tempo Real' : 'Desconectado'}
            </span>
          </div>
          
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-32 bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              {symbolOptions.map(symbol => (
                <SelectItem key={symbol} value={symbol} className="text-white hover:bg-gray-700">
                  {symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-gray-300 text-sm">Mercado:</span>
          <Select value={selectedExchange} onValueChange={setSelectedExchange}>
            <SelectTrigger className="w-20 bg-gray-800 border-gray-600 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              {mockExchanges.map(exchange => (
                <SelectItem key={exchange} value={exchange} className="text-white hover:bg-gray-700">
                  {exchange}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 🤖 NOVO: Filtro por Tipos de Robôs */}
        <div className="flex items-center space-x-2">
          <span className="text-gray-300 text-sm">Tipos:</span>
          <div className="relative">
            <Button
              onClick={toggleAllRobotTypes}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 text-sm border border-gray-600"
              size="sm"
            >
              {selectedRobotTypes.length === robotTypes.length ? '✓ Todos' : 
               selectedRobotTypes.length === 0 ? 'Nenhum' : 
               `${selectedRobotTypes.length} tipos`}
            </Button>
          </div>
        </div>
      </div>

      {/* 🤖 NOVO: Checkboxes para seleção individual de tipos */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-800/50 p-3 rounded-lg border border-gray-600">
        <span className="text-gray-300 text-sm font-medium">Filtrar por tipos:</span>
        {robotTypes.map(robotType => (
          <label key={robotType} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedRobotTypes.includes(robotType)}
              onChange={() => toggleRobotType(robotType)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <Badge className={`${getRobotTypeColor(robotType)} text-white text-xs`}>
              {robotType}
            </Badge>
          </label>
        ))}
        <div className="text-xs text-gray-400 ml-auto">
          {selectedRobotTypes.length} de {robotTypes.length} selecionados
        </div>
      </div>

      {/* Indicadores de Status */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
          <strong>Erro:</strong> {error}
          <Button 
            onClick={() => {
              setError(null);
              fetchRobotPatterns();
              fetchRobotStatusChanges();
            }}
            className="ml-3 bg-red-600 hover:bg-red-700"
            size="sm"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Resumo dos Robôs Detectados */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className={`bg-gray-800 border ${statusFilter === 'all' ? 'border-blue-500' : 'border-gray-600'} cursor-pointer transition`} onClick={handleTotalRobotsClick}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Total de Robôs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {loading ? '...' : totalRobotsCount}
            </div>
          </CardContent>
        </Card>
        <Card className={`bg-gray-800 border ${statusFilter === 'active' ? 'border-green-500' : 'border-gray-600'} cursor-pointer transition`} onClick={handleActiveRobotsClick}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Robôs Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {loading ? '...' : activeRobotsCount}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Volume Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {loading ? '...' : formatVolume(getFilteredStats().totalVolume)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Total de Trades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {loading ? '...' : getFilteredStats().totalTrades}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-600">
          <CardHeader>
            <CardTitle className="text-white">Confiança Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {loading ? '...' : `${(getFilteredStats().avgConfidence * 100).toFixed(0)}%`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abas Principais */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800 border-gray-600">
          <TabsTrigger value="startstop" className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
            Start/Stop
            {tabLoading.startstop && <span className="ml-2">⏳</span>}
            {loadedTabs.has('startstop') && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setLoadedTabs(prev => new Set([...prev].filter(tab => tab !== 'startstop')));
                }}
                className="ml-2 text-xs text-gray-500 hover:text-gray-300"
                title="Recarregar aba"
              >
                🔄
              </button>
            )}
          </TabsTrigger>
          <TabsTrigger value="patterns" className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
            Padrões Detectados
            {tabLoading.patterns && <span className="ml-2">⏳</span>}
            {loadedTabs.has('patterns') && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setLoadedTabs(prev => new Set([...prev].filter(tab => tab !== 'patterns')));
                }}
                className="ml-2 text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                title="Recarregar aba"
              >
                🔄
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
            Análise Avançada
            {tabLoading.analytics && <span className="ml-2">⏳</span>}
            {loadedTabs.has('analytics') && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  setLoadedTabs(prev => new Set([...prev].filter(tab => tab !== 'analytics')));
                }}
                className="ml-2 text-xs text-gray-500 hover:text-gray-300 cursor-pointer"
                title="Recarregar aba"
              >
                🔄
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="startstop" className="space-y-4">
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white">
                Histórico Start/Stop - {selectedSymbol === 'TODOS' ? 'Todos os Ativos' : selectedSymbol}
              </CardTitle>
              <CardDescription className="text-gray-400">
                Robôs que começaram ou pararam de rodar (mais recentes primeiro)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tabLoading.startstop ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Carregando histórico de mudanças...</div>
                </div>
              ) : filteredStartStopChanges.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Nenhuma mudança detectada</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Filtro visual adicional para símbolo específico */}
                  {selectedSymbol !== 'TODOS' && (
                    <div className="bg-blue-900/20 border border-blue-500 text-blue-300 px-3 py-2 rounded-lg text-sm">
                      🔍 Filtrado para mostrar apenas mudanças de <strong>{selectedSymbol}</strong>
                    </div>
                  )}
                  
                  {/* 🤖 NOVO: Filtro visual para tipos de robôs */}
                   {selectedRobotTypes.length < robotTypes.length && (
                     <div className="bg-purple-900/20 border border-purple-500 text-purple-300 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                       <span>🤖 Filtrando por tipos:</span>
                       {selectedRobotTypes.map(type => (
                         <Badge key={type} className={`${getRobotTypeColor(type)} text-white text-xs`}>
                           {type}
                         </Badge>
                       ))}
                       <span className="text-xs text-purple-400 ml-2">
                         ({selectedRobotTypes.length} de {robotTypes.length} tipos selecionados)
                       </span>
                     </div>
                   )}
                  
                  {/* 📊 NOVO: Contador de resultados */}
                  <div className="text-xs text-gray-400 text-center py-2">
                    Exibindo {filteredStartStopChanges.slice(0, 50).length} de {filteredStartStopChanges.length} mudanças
                  </div>
                  
                  {filteredStartStopChanges.slice(0, 50).map((change, index) => (
                    <div key={change.id || index} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                      {change.change_category === 'status' ? (
                        // ✅ Card de mudança de status (existente)
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <Badge className={`${getRobotTypeColor(change.robot_type || 'Robô Tipo 0')} text-white`}>
                                {change.robot_type || 'Robô Tipo 0'}
                              </Badge>
                              <Badge className={change.new_status === 'active' ? 'bg-green-600' : 'bg-red-600'}>
                                {change.new_status === 'active' ? '🟢 INICIADO' : '🔴 PARADO'}
                              </Badge>
                              <Badge className="bg-gray-600 text-white">
                                {change.symbol}
                              </Badge>
                              <span className="text-gray-300 text-sm">
                                Corretora: {change.agent_name || getAgentName(change.agent_id)}
                              </span>
                              <span className="text-gray-400 text-sm">
                                {change.pattern_type}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-white">
                                {(change.confidence_score * 100).toFixed(0)}%
                              </div>
                              <div className="text-xs text-gray-400">Confiança</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        // ✅ NOVO: Card de mudança de tipo
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <Badge className="bg-purple-600 text-white">
                                🔄 ATUALIZAÇÃO
                              </Badge>
                              <Badge className={`${getRobotTypeColor(change.old_type || 'Robô Tipo 1')} text-white`}>
                                {change.old_type}
                              </Badge>
                              <span className="text-gray-300 text-sm">→</span>
                              <Badge className={`${getRobotTypeColor(change.new_type || 'Robô Tipo 1')} text-white`}>
                                {change.new_type}
                              </Badge>
                              <Badge className="bg-gray-600 text-white">
                                {change.symbol}
                              </Badge>
                              <span className="text-gray-300 text-sm">
                                Corretora: {change.agent_name || getAgentName(change.agent_id)}
                              </span>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-white">
                                {change.new_volume_percentage?.toFixed(2)}%
                              </div>
                              <div className="text-xs text-gray-400">Volume Atual</div>
                            </div>
                          </div>
                        </>
                      )}
                      
                      {change.change_category === 'status' ? (
                        // ✅ Detalhes para mudança de status
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <div className="text-gray-400">Status Anterior</div>
                              <div className="text-white font-medium">
                                {change.old_status === 'active' ? '🟢 Ativo' : 
                                 change.old_status === 'inactive' ? '🔴 Inativo' : '🟡 Suspeito'}
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-400">Volume Total</div>
                              <div className="text-white font-medium">{formatVolume(change.total_volume)}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Total Trades</div>
                              <div className="text-white font-medium">{change.total_trades}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Volume %</div>
                              <div className="text-white font-medium">
                                {change.market_volume_percentage ? 
                                  `${change.market_volume_percentage.toFixed(2)}%` : 
                                  'N/A'
                                }
                              </div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <div className="text-gray-400">Tipo do Robô</div>
                              <div className="text-white font-medium">{change.robot_type || 'Robô Tipo 1'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Timestamp</div>
                              <div className="text-white font-medium">{formatTime(change.timestamp)}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-gray-400">Tipo de Padrão</div>
                              <div className="text-white font-medium">{change.pattern_type}</div>
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-600">
                            {change.new_status === 'active' ? 
                              `🟢 Robô ${change.agent_name || getAgentName(change.agent_id)} iniciou operação em ${change.symbol}` :
                              `🔴 Robô ${change.agent_name || getAgentName(change.agent_id)} parou operação em ${change.symbol}`
                            }
                          </div>
                        </>
                      ) : (
                        // ✅ NOVO: Detalhes para mudança de tipo
                        <>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                            <div>
                              <div className="text-gray-400">Volume Anterior</div>
                              <div className="text-white font-medium">{change.old_volume_percentage?.toFixed(2)}%</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Volume Atual</div>
                              <div className="text-white font-medium">{change.new_volume_percentage?.toFixed(2)}%</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Variação</div>
                              <div className={`font-medium ${(change.new_volume_percentage || 0) > (change.old_volume_percentage || 0) ? 'text-green-400' : 'text-red-400'}`}>
                                {(change.new_volume_percentage || 0) > (change.old_volume_percentage || 0) ? '+' : ''}
                                {((change.new_volume_percentage || 0) - (change.old_volume_percentage || 0)).toFixed(2)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-gray-400">Timestamp</div>
                              <div className="text-white font-medium">{formatTime(change.timestamp)}</div>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-sm mb-3">
                            <div>
                              <div className="text-gray-400">Total Trades</div>
                              <div className="text-white font-medium">{change.total_trades}</div>
                            </div>
                            <div>
                              <div className="text-gray-400">Volume Total</div>
                              <div className="text-white font-medium">{formatVolume(change.total_volume)}</div>
                            </div>
                          </div>
                          
                          <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-600">
                            🔄 Robô {change.agent_name || getAgentName(change.agent_id)} em {change.symbol} mudou de {change.old_type} para {change.new_type}
                          </div>
                        </>
                      )}

                      {/* ✅ NOVO: Botão para listar operações também no Start/Stop */}
                      <div className="mt-3 flex justify-end">
                        <Button
                          onClick={() => openTradesModalFromChange(change)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs"
                          size="sm"
                        >
                          📊 Listar Operações
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <CardTitle className="text-white">
                Robôs Detectados - {selectedSymbol === 'TODOS' ? 'Todos os Ativos' : selectedSymbol}
              </CardTitle>
              {/* Filtro por status */}
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-sm">Status:</span>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
                  <SelectTrigger className="w-36 bg-gray-800 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white hover:bg-gray-700">Todos</SelectItem>
                    <SelectItem value="active" className="text-white hover:bg-gray-700">Ativos</SelectItem>
                    <SelectItem value="inactive" className="text-white hover:bg-gray-700">Inativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {tabLoading.patterns ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Carregando padrões de robôs...</div>
                </div>
              ) : (Array.isArray(robotPatterns) && robotPatterns.length === 0) ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Nenhum padrão de robô detectado</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Filtro visual adicional para símbolo específico */}
                  {selectedSymbol !== 'TODOS' && (
                    <div className="bg-blue-900/20 border border-blue-500 text-blue-300 px-3 py-2 rounded-lg text-sm">
                      🔍 Filtrado para mostrar apenas padrões de <strong>{selectedSymbol}</strong>
                    </div>
                  )}
                  {/* Filtro visual adicional para status específico */}
                  {statusFilter !== 'all' && (
                    <div className="bg-yellow-900/20 border border-yellow-500 text-yellow-300 px-3 py-2 rounded-lg text-sm">
                      🔎 Filtrado por status: <strong>{statusFilter === 'active' ? 'Ativos' : 'Inativos'}</strong>
                    </div>
                  )}
                  
                  {/* 🤖 NOVO: Filtro visual para tipos de robôs */}
                  {selectedRobotTypes.length < robotTypes.length && (
                    <div className="bg-purple-900/20 border border-purple-500 text-purple-300 px-3 py-2 rounded-lg text-sm">
                      🤖 Mostrando apenas: {selectedRobotTypes.map(type => (
                        <Badge key={type} className={`${getRobotTypeColor(type)} text-white text-xs ml-1`}>
                          {type}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {getFilteredPatterns().map(pattern => (
                    <div key={pattern.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <Badge className={`${getRobotTypeColor(pattern.robot_type)} text-white`}>
                            {pattern.robot_type}
                          </Badge>
                          <Badge className={getPatternTypeColor(pattern.pattern_type)}>
                            {pattern.pattern_type}
                          </Badge>
                          <Badge className={getStatusColor(pattern.status)}>
                            {pattern.status === 'active' ? 'Ativo' : 
                             pattern.status === 'inactive' ? 'Inativo' : 'Suspeito'}
                          </Badge>
                          {selectedSymbol === 'TODOS' && (
                            <Badge className="bg-gray-600 text-white">
                              {pattern.symbol}
                            </Badge>
                          )}
                          <span className="text-gray-300 text-sm">
                            Corretora: {getAgentName(pattern.agent_id)}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-white">
                              {(pattern.confidence_score * 100).toFixed(0)}%
                            </div>
                            <div className="text-xs text-gray-400">Confiança</div>
                          </div>
                          {/* ✅ NOVO: Dropdown para listar operações */}
                          <div className="relative">
                            <Button
                              onClick={() => openTradesModal(pattern)}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-xs"
                              size="sm"
                            >
                              📊 Listar Operações
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-gray-400">Volume Total</div>
                          <div className="text-white font-medium">{formatVolume(pattern.total_volume)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Total Trades</div>
                          <div className="text-white font-medium">{pattern.total_trades}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Tamanho Médio</div>
                          <div className="text-white font-medium">{formatVolume(pattern.avg_trade_size)}</div>
                        </div>
                        <div>
                          <div className="text-gray-400">Frequência</div>
                          <div className="text-white font-medium">{pattern.frequency_minutes} min</div>
                        </div>
                      </div>
                      
                      {/* ✅ NOVO: Volume em % do mercado */}
                      {pattern.market_volume_percentage !== undefined && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-sm">Volume em % do mercado:</span>
                            <span className="text-white font-semibold text-lg">
                              {pattern.market_volume_percentage.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      )}
                      
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Primeira execução: {formatDate(pattern.first_seen)}</span>
                          <span>Última execução: {formatDate(pattern.last_seen)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white">
                Análise Avançada - {selectedSymbol === 'TODOS' ? 'Todos os Ativos' : selectedSymbol}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-lg text-gray-300 font-medium">Distribuição por Tipo</h4>
                  <div className="space-y-2">
                    {['TWAP', 'VWAP', 'UNKNOWN'].map(type => {
                      const filteredPatterns = robotPatterns.filter(p => selectedSymbol === 'TODOS' || p.symbol === selectedSymbol);
                      const count = filteredPatterns.filter(p => p.pattern_type === type).length;
                      const percentage = filteredPatterns.length > 0 ? (count / filteredPatterns.length * 100) : 0;
                      return (
                        <div key={type} className="flex items-center justify-between">
                          <span className="text-gray-300">{type}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-24 bg-gray-700 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${type === 'TWAP' ? 'bg-blue-500' : type === 'VWAP' ? 'bg-purple-500' : 'bg-orange-500'}`}
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-white text-sm w-12">{percentage.toFixed(0)}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h4 className="text-lg text-gray-300 font-medium">Métricas de Performance</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Volume Médio por Robô</span>
                      <span className="text-white font-medium">
                        {(() => {
                          const filteredPatterns = robotPatterns.filter(p => selectedSymbol === 'TODOS' || p.symbol === selectedSymbol);
                          return formatVolume(filteredPatterns.length > 0 ? 
                            filteredPatterns.reduce((sum, p) => sum + p.total_volume, 0) / filteredPatterns.length : 0);
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Frequência Média</span>
                      <span className="text-white font-medium">
                        {(() => {
                          const filteredPatterns = robotPatterns.filter(p => selectedSymbol === 'TODOS' || p.symbol === selectedSymbol);
                          return filteredPatterns.length > 0 ? 
                            (filteredPatterns.reduce((sum, p) => sum + p.frequency_minutes, 0) / filteredPatterns.length).toFixed(1) : 0;
                        })()} min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Confiança Média</span>
                      <span className="text-white font-medium">
                        {(() => {
                          const filteredPatterns = robotPatterns.filter(p => selectedSymbol === 'TODOS' || p.symbol === selectedSymbol);
                          return filteredPatterns.length > 0 ? 
                            (filteredPatterns.reduce((sum, p) => sum + p.confidence_score, 0) / filteredPatterns.length * 100).toFixed(0) : 0;
                        })()}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ✅ NOVO: Modal para exibir trades de um robô específico */}
      {tradesModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">
                Operações do Robô {selectedRobot?.agent_id} ({getAgentName(selectedRobot?.agent_id || 0)}) em {selectedRobot?.symbol}
              </h3>
              <Button
                onClick={() => setTradesModalOpen(false)}
                className="bg-gray-600 hover:bg-gray-700 text-white"
                size="sm"
              >
                ✕ Fechar
              </Button>
            </div>
            
            <div className="mb-4 text-sm text-gray-400">
              <p>
                {tradesMeta ? (
                  <>
                    Total de operações: {tradesMeta.count}
                    {tradesMeta.patternId && (
                      <> • Pattern ID: {tradesMeta.patternId}</>
                    )}
                    <> • Período: {formatDate(tradesMeta.firstTimestamp)} → {formatDate(tradesMeta.lastTimestamp)}</>
                  </>
                ) : (
                  <>Operações carregadas: {robotTrades.length}</>
                )}
              </p>
            </div>
            
            {tradesLoading ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Carregando operações...</div>
              </div>
            ) : robotTrades.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400">Nenhuma operação encontrada para este robô</div>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[60vh]">
                <div className="grid gap-3">
                  {robotTrades.map((trade) => (
                    <div key={trade.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <Badge className={trade.side === 'buy' ? 'bg-green-600' : 'bg-red-600'}>
                            {trade.side === 'buy' ? '🟢 COMPRA' : '🔴 VENDA'}
                          </Badge>
                          <span className="text-white font-medium">
                            {trade.volume.toLocaleString()} ações
                          </span>
                          <span className="text-gray-300">
                            R$ {trade.price.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-gray-400">
                            {formatTime(trade.timestamp)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(trade.timestamp)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-400">
                        <span>Volume: {formatVolume(trade.volume)}</span>
                        <span className="mx-2">•</span>
                        <span>Valor: R$ {formatVolume(trade.volume * trade.price)}</span>
                        <span className="mx-2">•</span>
                        <span>Pattern ID: {trade.pattern_id}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


