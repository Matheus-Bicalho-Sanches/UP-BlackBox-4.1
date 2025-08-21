"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tipos para os dados fictícios
interface RobotPattern {
  id: string;
  symbol: string;
  patternType: 'TWAP' | 'VWAP' | 'UNKNOWN';
  confidenceScore: number;
  agentId: number;
  firstSeen: string;
  lastSeen: string;
  totalVolume: number;
  totalTrades: number;
  avgTradeSize: number;
  frequencyMinutes: number;
  priceAggression: number;
  status: 'active' | 'inactive' | 'suspicious';
}

interface RobotTrade {
  id: string;
  robotPatternId: string;
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  tradeType: 'buy' | 'sell';
  agentId: number;
}

// Dados fictícios para demonstração
const mockSymbols = ['TODOS', 'PETR4', 'VALE3', 'ITUB4', 'BBDC4', 'ABEV3', 'WEGE3', 'RENT3', 'LREN3'];
const mockExchanges = ['B3', 'BMF'];

const mockRobotPatterns: RobotPattern[] = [
  {
    id: '1',
    symbol: 'PETR4',
    patternType: 'TWAP',
    confidenceScore: 0.89,
    agentId: 1001,
    firstSeen: '2025-08-21T14:00:00Z',
    lastSeen: '2025-08-21T16:30:00Z',
    totalVolume: 1500000,
    totalTrades: 45,
    avgTradeSize: 33333,
    frequencyMinutes: 3,
    priceAggression: 0.02,
    status: 'active'
  },
  {
    id: '2',
    symbol: 'PETR4',
    patternType: 'VWAP',
    confidenceScore: 0.76,
    agentId: 1002,
    firstSeen: '2025-08-21T14:15:00Z',
    lastSeen: '2025-08-21T16:45:00Z',
    totalVolume: 2200000,
    totalTrades: 38,
    avgTradeSize: 57895,
    frequencyMinutes: 4,
    priceAggression: 0.015,
    status: 'active'
  },
  {
    id: '3',
    symbol: 'VALE3',
    patternType: 'UNKNOWN',
    confidenceScore: 0.45,
    agentId: 2001,
    firstSeen: '2025-08-21T15:00:00Z',
    lastSeen: '2025-08-21T16:00:00Z',
    totalVolume: 800000,
    totalTrades: 12,
    avgTradeSize: 66667,
    frequencyMinutes: 5,
    priceAggression: 0.08,
    status: 'suspicious'
  },
  {
    id: '4',
    symbol: 'ITUB4',
    patternType: 'TWAP',
    confidenceScore: 0.92,
    agentId: 3001,
    firstSeen: '2025-08-21T13:30:00Z',
    lastSeen: '2025-08-21T16:30:00Z',
    totalVolume: 3200000,
    totalTrades: 64,
    avgTradeSize: 50000,
    frequencyMinutes: 3,
    priceAggression: 0.01,
    status: 'active'
  }
];

const mockRobotTrades: RobotTrade[] = [
  {
    id: '1',
    robotPatternId: '1',
    symbol: 'PETR4',
    price: 32.45,
    volume: 30000,
    timestamp: '2025-08-21T16:30:00Z',
    tradeType: 'buy',
    agentId: 1001
  },
  {
    id: '2',
    robotPatternId: '1',
    symbol: 'PETR4',
    price: 32.47,
    volume: 35000,
    timestamp: '2025-08-21T16:33:00Z',
    tradeType: 'buy',
    agentId: 1001
  },
  {
    id: '3',
    robotPatternId: '2',
    symbol: 'PETR4',
    price: 32.50,
    volume: 50000,
    timestamp: '2025-08-21T16:35:00Z',
    tradeType: 'sell',
    agentId: 1002
  }
];

export default function MotionTrackerPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('TODOS');
  const [selectedExchange, setSelectedExchange] = useState('B3');
  const [robotPatterns, setRobotPatterns] = useState<RobotPattern[]>([]);
  const [robotTrades, setRobotTrades] = useState<RobotTrade[]>([]);

  // Filtra dados baseado na seleção
  useEffect(() => {
    let filteredPatterns: RobotPattern[];
    let filteredTrades: RobotTrade[];
    
    if (selectedSymbol === 'TODOS') {
      // Mostra todos os dados consolidados
      filteredPatterns = mockRobotPatterns;
      filteredTrades = mockRobotTrades;
    } else {
      // Filtra por símbolo específico
      filteredPatterns = mockRobotPatterns.filter(
        pattern => pattern.symbol === selectedSymbol
      );
      filteredTrades = mockRobotTrades.filter(
        trade => trade.symbol === selectedSymbol
      );
    }
    
    setRobotPatterns(filteredPatterns);
    setRobotTrades(filteredTrades);
  }, [selectedSymbol]);

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

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl text-white font-semibold">Motion Tracker</h2>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-gray-300 text-sm">Ativo:</span>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="w-32 bg-gray-800 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-600">
                {mockSymbols.map(symbol => (
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
          

        </div>
      </div>

      {/* Resumo dos Robôs Detectados */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Robôs Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {robotPatterns.filter(p => p.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Volume Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {formatVolume(robotPatterns.reduce((sum, p) => sum + p.totalVolume, 0))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Trades Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {robotPatterns.reduce((sum, p) => sum + p.totalTrades, 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Confiança Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {(robotPatterns.reduce((sum, p) => sum + p.confidenceScore, 0) / Math.max(robotPatterns.length, 1) * 100).toFixed(0)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abas Principais */}
      <Tabs defaultValue="patterns" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-gray-800 border-gray-600">
          <TabsTrigger value="patterns" className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
            Padrões Detectados
          </TabsTrigger>
          <TabsTrigger value="activity" className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
            Atividade em Tempo Real
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-gray-300 data-[state=active]:bg-gray-700 data-[state=active]:text-white">
            Análise Avançada
          </TabsTrigger>
        </TabsList>

        <TabsContent value="patterns" className="space-y-4">
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white">
                Robôs Detectados - {selectedSymbol === 'TODOS' ? 'Todos os Ativos' : selectedSymbol}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {robotPatterns.map(pattern => (
                  <div key={pattern.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <Badge className={getPatternTypeColor(pattern.patternType)}>
                          {pattern.patternType}
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
                          Agente: {pattern.agentId}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">
                          {(pattern.confidenceScore * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-400">Confiança</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400">Volume Total</div>
                        <div className="text-white font-medium">{formatVolume(pattern.totalVolume)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Total Trades</div>
                        <div className="text-white font-medium">{pattern.totalTrades}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Tamanho Médio</div>
                        <div className="text-white font-medium">{formatVolume(pattern.avgTradeSize)}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Frequência</div>
                        <div className="text-white font-medium">{pattern.frequencyMinutes} min</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-gray-600">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Primeira execução: {formatDate(pattern.firstSeen)}</span>
                        <span>Última execução: {formatDate(pattern.lastSeen)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white">
                Atividade em Tempo Real - {selectedSymbol === 'TODOS' ? 'Todos os Ativos' : selectedSymbol}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {robotTrades.map(trade => (
                  <div key={trade.id} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg border border-gray-600">
                    <div className="flex items-center space-x-4">
                      <div className={`w-3 h-3 rounded-full ${trade.tradeType === 'buy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <div>
                        <div className="text-white font-medium">
                          {trade.tradeType === 'buy' ? 'COMPRA' : 'VENDA'}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {selectedSymbol === 'TODOS' && (
                            <span className="mr-2 text-cyan-400">{trade.symbol}</span>
                          )}
                          Agente: {trade.agentId}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-white font-medium">
                        R$ {trade.price.toFixed(2)}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {formatVolume(trade.volume)}
                      </div>
                    </div>
                    
                    <div className="text-gray-400 text-sm">
                      {formatTime(trade.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
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
                      const count = robotPatterns.filter(p => p.patternType === type).length;
                      const percentage = robotPatterns.length > 0 ? (count / robotPatterns.length * 100) : 0;
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
                        {formatVolume(robotPatterns.length > 0 ? 
                          robotPatterns.reduce((sum, p) => sum + p.totalVolume, 0) / robotPatterns.length : 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Frequência Média</span>
                      <span className="text-white font-medium">
                        {robotPatterns.length > 0 ? 
                          (robotPatterns.reduce((sum, p) => sum + p.frequencyMinutes, 0) / robotPatterns.length).toFixed(1) : 0} min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Confiança Média</span>
                      <span className="text-white font-medium">
                        {robotPatterns.length > 0 ? 
                          (robotPatterns.reduce((sum, p) => sum + p.confidenceScore, 0) / robotPatterns.length * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
