"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiTrendingUp, FiTrendingDown, FiActivity, FiRefreshCw } from "react-icons/fi";
import { db } from "@/config/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useRealtimeCandles } from "@/hooks/useRealtimeCandles";
import { useLiveCurrentCandle } from "@/hooks/useLiveCurrentCandle";

interface QuantStrategy {
  id: string;
  nome: string;
  status: boolean;
  carteiraBlackBox: string;
  tamanhoPosition: number;
}

interface TradingSignal {
  id: string;
  strategyId: string;
  strategyName: string;
  ticker: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  price: number;
  timestamp: number;
  reason: string;
  positionSize: number;
}

interface MarketData {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: number;
}

// Simulação de sinais para demonstração
const generateMockSignal = (strategy: QuantStrategy, marketData: MarketData[]): TradingSignal | null => {
  if (!strategy.status) return null;
  
  const availableTickers = marketData.filter(data => data.price > 0);
  if (availableTickers.length === 0) return null;
  
  const randomTicker = availableTickers[Math.floor(Math.random() * availableTickers.length)];
  const signals = ['BUY', 'SELL', 'HOLD'] as const;
  const randomSignal = signals[Math.floor(Math.random() * signals.length)];
  
  // Simular diferentes razões baseadas no nome da estratégia
  const reasons = {
    'BUY': [
      'Bollinger Bands: Preço tocou banda inferior',
      'MACD: Cruzamento bullish detectado',
      'RSI: Condição de sobrevenda (RSI < 30)',
      'Volume: Aumento significativo de volume',
      'Suporte: Preço próximo ao suporte técnico'
    ],
    'SELL': [
      'Bollinger Bands: Preço tocou banda superior',
      'MACD: Cruzamento bearish detectado',
      'RSI: Condição de sobrecompra (RSI > 70)',
      'Resistência: Preço próximo à resistência técnica',
      'Stop Loss: Proteção ativada'
    ],
    'HOLD': [
      'Lateralização: Mercado sem tendência clara',
      'Volatilidade baixa: Aguardando confirmação',
      'Próximo ao preço justo calculado',
      'Condições técnicas neutras'
    ]
  };
  
  const confidence = Math.random() * 40 + 60; // 60-100%
  const reason = reasons[randomSignal][Math.floor(Math.random() * reasons[randomSignal].length)];
  
  return {
    id: `${strategy.id}-${randomTicker.ticker}-${Date.now()}`,
    strategyId: strategy.id,
    strategyName: strategy.nome,
    ticker: randomTicker.ticker,
    signal: randomSignal,
    confidence: Math.round(confidence),
    price: randomTicker.price,
    timestamp: Date.now(),
    reason,
    positionSize: strategy.tamanhoPosition,
  };
};

function SignalCard({ signal }: { signal: TradingSignal }) {
  const signalColors = {
    BUY: "bg-green-600 text-white",
    SELL: "bg-red-600 text-white", 
    HOLD: "bg-yellow-600 text-white"
  };

  const signalIcons = {
    BUY: <FiTrendingUp size={16} />,
    SELL: <FiTrendingDown size={16} />,
    HOLD: <FiActivity size={16} />
  };

  const timeAgo = Math.floor((Date.now() - signal.timestamp) / 1000);
  const timeDisplay = timeAgo < 60 ? `${timeAgo}s` : `${Math.floor(timeAgo / 60)}m`;

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">
            {signal.ticker}
          </CardTitle>
          <Badge className={signalColors[signal.signal]}>
            <span className="flex items-center gap-1">
              {signalIcons[signal.signal]}
              {signal.signal}
            </span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Estratégia:</span>
            <p className="text-white font-medium">{signal.strategyName}</p>
          </div>
          <div>
            <span className="text-gray-400">Preço:</span>
            <p className="text-white font-medium">R$ {signal.price.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-gray-400">Confiança:</span>
            <p className="text-white font-medium">{signal.confidence}%</p>
          </div>
          <div>
            <span className="text-gray-400">Tamanho:</span>
            <p className="text-white font-medium">{signal.positionSize.toFixed(1)}%</p>
          </div>
        </div>
        
        <div>
          <span className="text-gray-400 text-sm">Razão:</span>
          <p className="text-white text-sm mt-1">{signal.reason}</p>
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>há {timeDisplay}</span>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${
              signal.confidence > 80 ? 'bg-green-500' : 
              signal.confidence > 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <span>{signal.confidence > 80 ? 'Alta' : signal.confidence > 60 ? 'Média' : 'Baixa'}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MarketOverview({ marketData }: { marketData: MarketData[] }) {
  const totalTickers = marketData.length;
  const gainers = marketData.filter(data => data.changePercent > 0).length;
  const losers = marketData.filter(data => data.changePercent < 0).length;
  const neutral = totalTickers - gainers - losers;

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">Visão Geral do Mercado</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{totalTickers}</div>
            <div className="text-sm text-gray-400">Total Ativos</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{gainers}</div>
            <div className="text-sm text-gray-400">Em Alta</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{losers}</div>
            <div className="text-sm text-gray-400">Em Baixa</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-500">{neutral}</div>
            <div className="text-sm text-gray-400">Neutros</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonitorSinaisPage() {
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [signals, setSignals] = useState<TradingSignal[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [subscribedTickers, setSubscribedTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Carregar estratégias ativas
  useEffect(() => {
    loadStrategies();
  }, []);

  // Carregar tickers subscritos
  useEffect(() => {
    loadSubscribedTickers();
  }, []);

  // Gerar sinais baseados nas estratégias e dados de mercado
  useEffect(() => {
    if (strategies.length > 0 && marketData.length > 0) {
      generateSignals();
    }
  }, [strategies, marketData]);

  // Auto-refresh dos sinais
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      if (strategies.length > 0 && marketData.length > 0) {
        generateSignals();
        setLastUpdate(new Date());
      }
    }, 10000); // Atualizar a cada 10 segundos

    return () => clearInterval(interval);
  }, [autoRefresh, strategies, marketData]);

  const loadStrategies = async () => {
    try {
      const snapshot = await getDocs(
        query(collection(db, "quantStrategies"), where("status", "==", true))
      );
      const activeStrategies: QuantStrategy[] = [];
      snapshot.forEach((doc) => {
        activeStrategies.push({ id: doc.id, ...doc.data() } as QuantStrategy);
      });
      setStrategies(activeStrategies);
    } catch (error) {
      console.error("Erro ao carregar estratégias:", error);
    }
  };

  const loadSubscribedTickers = async () => {
    try {
      const snapshot = await getDocs(collection(db, "activeSubscriptions"));
      const tickers: string[] = [];
      snapshot.forEach((doc) => {
        tickers.push(doc.id);
      });
      setSubscribedTickers(tickers);
    } catch (error) {
      console.error("Erro ao carregar tickers:", error);
    }
  };

  // Simular dados de mercado baseados nos tickers subscritos
  useEffect(() => {
    if (subscribedTickers.length > 0) {
      const mockMarketData: MarketData[] = subscribedTickers.map(ticker => {
        const basePrice = Math.random() * 100 + 10; // 10-110
        const change = (Math.random() - 0.5) * 4; // -2 a +2
        const changePercent = (change / basePrice) * 100;
        
        return {
          ticker,
          price: basePrice,
          change,
          changePercent,
          volume: Math.floor(Math.random() * 1000000),
          timestamp: Date.now(),
        };
      });
      
      setMarketData(mockMarketData);
      setLoading(false);
    }
  }, [subscribedTickers]);

  const generateSignals = () => {
    const newSignals: TradingSignal[] = [];
    
    strategies.forEach(strategy => {
      // Gerar 1-3 sinais por estratégia ativa
      const signalCount = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < signalCount; i++) {
        const signal = generateMockSignal(strategy, marketData);
        if (signal) {
          newSignals.push(signal);
        }
      }
    });
    
    // Manter apenas os 50 sinais mais recentes
    setSignals(prev => [...newSignals, ...prev].slice(0, 50));
  };

  const handleManualRefresh = () => {
    if (strategies.length > 0 && marketData.length > 0) {
      generateSignals();
      setLastUpdate(new Date());
    }
  };

  const clearSignals = () => {
    setSignals([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Carregando monitor de sinais...</div>
      </div>
    );
  }

  const buySignals = signals.filter(s => s.signal === 'BUY');
  const sellSignals = signals.filter(s => s.signal === 'SELL');
  const holdSignals = signals.filter(s => s.signal === 'HOLD');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Monitor de Sinais</h1>
          <p className="text-gray-400">
            Sinais gerados por {strategies.length} estratégia(s) ativa(s) • 
            Última atualização: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            Auto-refresh {autoRefresh ? "ON" : "OFF"}
          </Button>
          <Button onClick={handleManualRefresh} size="sm" className="flex items-center gap-2">
            <FiRefreshCw size={16} />
            Atualizar
          </Button>
          <Button onClick={clearSignals} variant="outline" size="sm">
            Limpar
          </Button>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MarketOverview marketData={marketData} />
        
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-500 flex items-center gap-2">
              <FiTrendingUp size={20} />
              Sinais de Compra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{buySignals.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-500 flex items-center gap-2">
              <FiTrendingDown size={20} />
              Sinais de Venda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{sellSignals.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-yellow-500 flex items-center gap-2">
              <FiActivity size={20} />
              Sinais de Manter
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{holdSignals.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Sinais */}
      {signals.length === 0 ? (
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FiActivity size={48} className="text-gray-500 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Nenhum sinal gerado</h3>
            <p className="text-gray-400 text-center mb-4">
              {strategies.length === 0 
                ? "Nenhuma estratégia ativa encontrada. Ative estratégias na aba 'Estratégias Quant'."
                : "Aguardando geração de sinais..."
              }
            </p>
            {strategies.length > 0 && (
              <Button onClick={handleManualRefresh} className="flex items-center gap-2">
                <FiRefreshCw size={16} />
                Gerar Sinais
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {signals.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
} 