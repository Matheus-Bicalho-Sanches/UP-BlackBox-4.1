"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Tipos para os dados da API real
interface RobotPattern {
  id?: number;
  symbol: string;
  exchange: string;
  pattern_type: string;
  confidence_score: number;
  agent_id: number;
  first_seen: string;
  last_seen: string;
  total_volume: number;
  total_trades: number;
  avg_trade_size: number;
  frequency_minutes: number;
  price_aggression: number;
  status: string;
}

interface RobotActivity {
  symbol: string;
  price: number;
  volume: number;
  timestamp: string;
  buy_agent: number | null;
  sell_agent: number | null;
  exchange: string;
}

// Configuração da API
const API_BASE_URL = 'http://localhost:8002';

// Lista completa de ativos do dll_launcher.py em ordem alfabética
const mockSymbols = [
  'TODOS',  // Sempre primeiro
  'ABEV3',
  'AFHI11',
  'B3SA3',
  'BBDC4',
  'BBAS3',
  'BBSE3',
  'BODB11',
  'BPAC11',
  'BRBI11',
  'BRFS3',
  'CACR11',
  'CAML3',
  'CDII11',
  'CSUD3',
  'FGAA11',
  'HGLG11',
  'HGRE11',
  'ITUB4',
  'KDIF11',
  'LVBI11',
  'MGLU3',
  'MRFG3',
  'PFRM3',
  'PETR4',
  'PETZ3',
  'PGMN3',
  'PORD11',
  'PSSA3',
  'RAIZ4',
  'RADL3',
  'RDOR3',
  'RENT3',
  'RURA11',
  'SAPR4',
  'SIMH3',
  'SLCE3',
  'SOJA3',
  'TIMS3',
  'URPR11',
  'VALE3',
  'VGIA11',
  'VGIR11',
  'VIVT3',
  'WEGE3',
  'XPML11',
  'YDUQ3'
];

const mockExchanges = ['B3', 'BMF'];

export default function MotionTrackerPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('TODOS');
  const [selectedExchange, setSelectedExchange] = useState('B3');
  const [robotPatterns, setRobotPatterns] = useState<RobotPattern[]>([]);
  const [robotActivity, setRobotActivity] = useState<RobotActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Função para buscar padrões de robôs da API
  const fetchRobotPatterns = async (symbol?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = symbol && symbol !== 'TODOS' 
        ? `${API_BASE_URL}/robots/patterns?symbol=${symbol}`
        : `${API_BASE_URL}/robots/patterns`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setRobotPatterns(data.patterns || []);
      } else {
        throw new Error(data.message || 'Erro desconhecido');
      }
    } catch (err) {
      console.error('Erro ao buscar padrões:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setRobotPatterns([]);
    } finally {
      setLoading(false);
    }
  };

  // Função para buscar atividade de robôs da API
  const fetchRobotActivity = async (symbol?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const url = symbol && symbol !== 'TODOS' 
        ? `${API_BASE_URL}/robots/activity?symbol=${symbol}&hours=24`
        : `${API_BASE_URL}/robots/activity?hours=24`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        setRobotActivity(data.trades || []);
      } else {
        throw new Error(data.message || 'Erro desconhecido');
      }
    } catch (err) {
      console.error('Erro ao buscar atividade:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setRobotActivity([]);
    } finally {
      setLoading(false);
    }
  };

  // Carrega dados quando o símbolo muda
  useEffect(() => {
    if (selectedSymbol === 'TODOS') {
      fetchRobotPatterns();
      fetchRobotActivity();
    } else {
      fetchRobotPatterns(selectedSymbol);
      fetchRobotActivity(selectedSymbol);
    }
  }, [selectedSymbol]);

  // Carrega dados iniciais
  useEffect(() => {
    fetchRobotPatterns();
    fetchRobotActivity();
  }, []);

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

      {/* Indicadores de Status */}
      {error && (
        <div className="bg-red-900/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg">
          <strong>Erro:</strong> {error}
          <Button 
            onClick={() => {
              setError(null);
              fetchRobotPatterns();
              fetchRobotActivity();
            }}
            className="ml-3 bg-red-600 hover:bg-red-700"
            size="sm"
          >
            Tentar Novamente
          </Button>
        </div>
      )}

      {/* Resumo dos Robôs Detectados */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Robôs Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {loading ? '...' : robotPatterns.filter(p => p.status === 'active' && (selectedSymbol === 'TODOS' || p.symbol === selectedSymbol)).length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Volume Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {loading ? '...' : formatVolume(robotPatterns.filter(p => selectedSymbol === 'TODOS' || p.symbol === selectedSymbol).reduce((sum, p) => sum + p.total_volume, 0))}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Trades Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-400">
              {loading ? '...' : robotPatterns.filter(p => selectedSymbol === 'TODOS' || p.symbol === selectedSymbol).reduce((sum, p) => sum + p.total_trades, 0)}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-800 border-gray-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-300">Confiança Média</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {loading ? '...' : (robotPatterns.filter(p => selectedSymbol === 'TODOS' || p.symbol === selectedSymbol).reduce((sum, p) => sum + p.confidence_score, 0) / Math.max(robotPatterns.filter(p => selectedSymbol === 'TODOS' || p.symbol === selectedSymbol).length, 1) * 100).toFixed(0)}%
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
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Carregando padrões de robôs...</div>
                </div>
              ) : robotPatterns.length === 0 ? (
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
                  
                  {robotPatterns
                    .filter(pattern => selectedSymbol === 'TODOS' || pattern.symbol === selectedSymbol)
                    .map(pattern => (
                    <div key={pattern.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
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
                            Agente: {pattern.agent_id}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">
                            {(pattern.confidence_score * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-gray-400">Confiança</div>
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

        <TabsContent value="activity" className="space-y-4">
          <Card className="bg-gray-800 border-gray-600">
            <CardHeader>
              <CardTitle className="text-white">
                Atividade em Tempo Real - {selectedSymbol === 'TODOS' ? 'Todos os Ativos' : selectedSymbol}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Carregando atividade...</div>
                </div>
              ) : robotActivity.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400">Nenhuma atividade detectada</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {robotActivity.map((trade, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-700 p-3 rounded-lg border border-gray-600">
                      <div className="flex items-center space-x-4">
                        <div className={`w-3 h-3 rounded-full ${trade.buy_agent ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <div>
                          <div className="text-white font-medium">
                            {trade.buy_agent ? 'COMPRA' : 'VENDA'}
                          </div>
                          <div className="text-gray-400 text-sm">
                            {selectedSymbol === 'TODOS' && (
                              <span className="mr-2 text-cyan-400">{trade.symbol}</span>
                            )}
                            Agente: {trade.buy_agent || trade.sell_agent}
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
    </div>
  );
}


