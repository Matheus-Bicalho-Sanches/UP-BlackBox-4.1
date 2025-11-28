"use client";
import React, { useState, useEffect } from "react";
import { db } from '@/config/firebase';
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import Link from "next/link";
import { FiLock, FiUnlock } from 'react-icons/fi';

// Dados fictícios para exibição inicial
const mockBacktests = [
  { id: 1, base: "PETR4_1y_1d.csv", estrategia: "Cruzamento de Médias", data: "2024-06-20", retornoPorTrade: "0,8%", tempoMedio: "5d", nTrades: 120 },
  { id: 2, base: "IBOV_6mo_1d.csv", estrategia: "Retorno à Média", data: "2024-06-21", retornoPorTrade: "0,5%", tempoMedio: "3d", nTrades: 80 },
];

// Dados fictícios para o modal
const mockBases = [
  { id: 1, nome: "PETR4_1y_1d.csv" },
  { id: 2, nome: "IBOV_6mo_1d.csv" },
];
const mockEstrategias = [
  { id: 1, nome: "Cruzamento de Médias" },
  { id: 2, nome: "Retorno à Média" },
];

export default function BacktestPage() {
  const [showModal, setShowModal] = useState(false);
  const [selectedBases, setSelectedBases] = useState<string[]>([]);
  const [selectedEstrategia, setSelectedEstrategia] = useState<string>("");
  const [baseSearchTerm, setBaseSearchTerm] = useState("");
  const [estrategiaSearchTerm, setEstrategiaSearchTerm] = useState("");
  const [backtests, setBacktests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [estrategias, setEstrategias] = useState<{ id: string; nome: string }[]>([]);
  const [estrategiasLoading, setEstrategiasLoading] = useState(true);
  const [estrategiasError, setEstrategiasError] = useState("");
  const [bases, setBases] = useState<any[]>([]);
  const [basesLoading, setBasesLoading] = useState(true);
  const [basesError, setBasesError] = useState("");
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState("");
  const [runSuccess, setRunSuccess] = useState("");
  const [paramX, setParamX] = useState("1");
  const [paramY, setParamY] = useState(5);
  const [paramStopLoss, setParamStopLoss] = useState("-5");
  const [paramTakeProfit, setParamTakeProfit] = useState(8);
  const [paramW, setParamW] = useState<number | null>(null);
  const [paramDiaSemana, setParamDiaSemana] = useState<number | "">("");
  const [selectedBacktests, setSelectedBacktests] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [paramModo, setParamModo] = useState<'topo' | 'fundo'>('topo');
  const [paramSairEmZ, setParamSairEmZ] = useState(false);
  const [paramZSaida, setParamZSaida] = useState<number>(0);
  const [paramZSomenteFechamento, setParamZSomenteFechamento] = useState<boolean>(true);
  const [paramCooldownT, setParamCooldownT] = useState<number>(0);
  const [paramDistanciaMinimaD, setParamDistanciaMinimaD] = useState<number>(0);
  const [paramHorarioEntradaInicio, setParamHorarioEntradaInicio] = useState<string>("");
  const [paramHorarioEntradaFim, setParamHorarioEntradaFim] = useState<string>("");

  async function fetchBacktests() {
    setLoading(true);
    setError("");
    try {
      const q = query(collection(db, 'backtests'), orderBy('criadoEm', 'desc'));
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBacktests(docs);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBacktests();
  }, []);

  useEffect(() => {
    async function fetchEstrategias() {
      setEstrategiasLoading(true);
      setEstrategiasError("");
      try {
        const snapshot = await getDocs(collection(db, "estrategias"));
        const docs = snapshot.docs.map(doc => ({ id: doc.id, nome: doc.data().nome }));
        setEstrategias(docs);
      } catch (err: any) {
        setEstrategiasError(err.message || "Erro desconhecido ao buscar estratégias");
      } finally {
        setEstrategiasLoading(false);
      }
    }
    fetchEstrategias();
  }, []);

  useEffect(() => {
    async function fetchBases() {
      setBasesLoading(true);
      setBasesError("");
      try {
        const res = await fetch("http://localhost:8003/api/bases");
        if (!res.ok) throw new Error("Erro ao buscar bases de dados");
        const data = await res.json();
        setBases(data);
      } catch (err: any) {
        setBasesError(err.message || "Erro desconhecido");
      } finally {
        setBasesLoading(false);
      }
    }
    fetchBases();
  }, []);

  // Filtrar opções
  const filteredBases = bases
    .filter(base => base.nome.toLowerCase().includes(baseSearchTerm.toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  const filteredEstrategias = estrategias.filter(est => est.nome.toLowerCase().includes(estrategiaSearchTerm.toLowerCase()));

  // Paginação e filtros agora usam backtests reais
  let filteredBacktests = backtests; // (implementar filtros se desejar)
  let backtestsOrdenados = [...filteredBacktests];
  // (implementar ordenação se desejar)
  const totalPages = Math.ceil(backtestsOrdenados.length / 50);
  const paginatedBacktests = backtestsOrdenados.slice((currentPage - 1) * 50, currentPage * 50);

  async function handleRunBacktest(e: React.FormEvent) {
    e.preventDefault();
    setRunError("");
    setRunSuccess("");
    setRunLoading(true);
    // Validação dos parâmetros numéricos
    let numX = Number(paramX);
    let numY = Number(paramY);
    let numStopLoss = Number(paramStopLoss);
    let numTakeProfit = Number(paramTakeProfit);
    let numW = paramW !== null && paramW !== undefined ? Number(paramW) : undefined;
    if (
      isNaN(numX) ||
      isNaN(numY) ||
      isNaN(numStopLoss) ||
      isNaN(numTakeProfit) ||
      (paramW !== null && paramW !== undefined && isNaN(numW as number))
    ) {
      setRunError("Preencha todos os parâmetros numéricos corretamente. Não use letras ou símbolos inválidos.");
      setRunLoading(false);
      return;
    }
    let total = selectedBases.length;
    let ok = 0, fail = 0;
    for (const base of selectedBases) {
      if (!selectedEstrategia) continue;
      let body: any = { base, estrategia: selectedEstrategia };
      if (selectedEstrategia.toLowerCase() === "buyifstockupxpercentage") {
        body.parametros = {
          x: numX / 100,
          y: numY,
          stop_loss: -Math.abs(numStopLoss) / 100,
          take_profit: Math.abs(numTakeProfit) / 100
        };
      } else if (selectedEstrategia.toLowerCase().replace(/[_-]/g, '') === "vendeaberturacomprafechamento") {
        if (paramDiaSemana !== "" && paramDiaSemana !== null && paramDiaSemana !== undefined) {
          body.parametros = { dia_semana: Number(paramDiaSemana) };
        }
      } else if (selectedEstrategia.toLowerCase() === "buysequenciadealtaouqueda") {
        body.parametros = {
          x: numX,
          y: numY,
          stop_loss: numStopLoss / 100,
          take_profit: numTakeProfit / 100,
        };
      } else if (selectedEstrategia.toLowerCase() === "operandomomentum") {
        body.parametros = {
          x: numX / 100,
          y: numY,
          w: numW ?? 5,
          stop_loss: numStopLoss / 100,
          take_profit: numTakeProfit / 100,
        };
        if (paramDiaSemana !== "" && paramDiaSemana !== null && paramDiaSemana !== undefined) {
          body.parametros.dia_semana = Number(paramDiaSemana);
        }
      } else if (selectedEstrategia.toLowerCase() === "operandotoposefundos") {
        body.parametros = {
          modo: paramModo,
          x: numX / 100,
          y: numY,
          w: numW ?? 10,
          stop_loss: numStopLoss / 100,
          take_profit: numTakeProfit / 100,
        };
      } else if (selectedEstrategia.toLowerCase() === "voltaamediabollinger") {
        // Validação: Z deve ser menor que Y (permite Z negativo)
        if (paramSairEmZ && !(paramZSaida < numY)) {
          setRunError("O valor de Z deve ser menor que Y. Valores negativos são permitidos.");
          setRunLoading(false);
          return;
        }
        body.parametros = {
          x: numX,
          y: numY,
          w: numW ?? 10,
          stop_loss: numStopLoss / 100,
          take_profit: numTakeProfit / 100,
          sair_em_z: paramSairEmZ,
          z_saida: paramSairEmZ ? Number(paramZSaida) : 0,
          z_somente_fechamento: paramZSomenteFechamento,
          cooldown_t: paramCooldownT,
          distancia_minima_d: paramDistanciaMinimaD,
          horario_entrada_inicio: paramHorarioEntradaInicio || undefined,
          horario_entrada_fim: paramHorarioEntradaFim || undefined,
        };
      } else if (selectedEstrategia.toLowerCase() === "precocruzamedia") {
        body.parametros = {
          param1: numX,
          param2: numY,
          stop_loss: numStopLoss / 100,
          take_profit: numTakeProfit / 100,
        };
      }
      try {
        const res = await fetch("http://localhost:8003/api/run-backtest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Erro ao rodar backtest");
        ok++;
      } catch (err) {
        fail++;
      }
    }
    setShowModal(false);
    await fetchBacktests();
    if (ok > 0 && fail === 0) setRunSuccess(`Todos os ${ok} backtests rodaram com sucesso!`);
    else if (ok > 0 && fail > 0) setRunSuccess(`${ok} backtest(s) rodaram com sucesso, ${fail} falharam.`);
    else setRunError("Nenhum backtest foi executado com sucesso.");
    setRunLoading(false);
  }

  async function handleDeleteSelected() {
    if (selectedBacktests.length === 0) return;
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedBacktests.length} backtest(s)?`)) return;
    setDeleting(true);
    try {
      for (const id of selectedBacktests) {
        await fetch(`http://localhost:8003/api/backtest/${id}`, { method: 'DELETE' });
      }
      setSelectedBacktests([]);
      await fetchBacktests();
    } catch (err) {
      alert('Erro ao excluir backtests.');
    } finally {
      setDeleting(false);
    }
  }

  function handleReutilizarBacktest(backtest: any) {
    // Selecionar base de dados
    if (backtest.base_dados) {
      setSelectedBases([backtest.base_dados]);
    }
    
    // Selecionar estratégia
    if (backtest.estrategia) {
      setSelectedEstrategia(backtest.estrategia);
    }
    
    // Mapear parâmetros conforme a estratégia
    if (backtest.parametros) {
      const params = backtest.parametros;
      const estrategiaLower = backtest.estrategia?.toLowerCase() || '';
      
      if (estrategiaLower === 'voltaamediabollinger') {
        setParamX(String(params.x || 1));
        setParamY(params.y || 5);
        setParamW(params.w ?? null);
        setParamStopLoss(String((params.stop_loss || -0.05) * 100));
        setParamTakeProfit((params.take_profit || 0.10) * 100);
        setParamSairEmZ(params.sair_em_z || false);
        setParamZSaida(params.z_saida || 0);
        setParamZSomenteFechamento(params.z_somente_fechamento ?? true);
        setParamCooldownT(params.cooldown_t || 0);
        setParamDistanciaMinimaD(params.distancia_minima_d || 0);
        setParamHorarioEntradaInicio(params.horario_entrada_inicio || '');
        setParamHorarioEntradaFim(params.horario_entrada_fim || '');
      } else if (estrategiaLower === 'buyifstockupxpercentage') {
        setParamX(String((params.x || 0.03) * 100));
        setParamY(params.y || 5);
        setParamStopLoss(String((params.stop_loss || -0.05) * 100));
        setParamTakeProfit((params.take_profit || 0.08) * 100);
      } else if (estrategiaLower.replace(/[_-]/g, '') === 'vendeaberturacomprafechamento') {
        setParamDiaSemana(params.dia_semana !== undefined && params.dia_semana !== null ? params.dia_semana : '');
      } else if (estrategiaLower === 'buysequenciadealtaouqueda') {
        setParamX(String(params.x || 3));
        setParamY(params.y || 5);
        setParamStopLoss(String((params.stop_loss || -0.05) * 100));
        setParamTakeProfit((params.take_profit || 0.08) * 100);
      } else if (estrategiaLower === 'operandomomentum') {
        setParamX(String((params.x || 0.05) * 100));
        setParamY(params.y || 5);
        setParamW(params.w ?? 5);
        setParamStopLoss(String((params.stop_loss || -0.05) * 100));
        setParamTakeProfit((params.take_profit || 0.08) * 100);
        setParamDiaSemana(params.dia_semana !== undefined && params.dia_semana !== null ? params.dia_semana : '');
      } else if (estrategiaLower === 'operandotoposefundos') {
        setParamModo(params.modo || 'topo');
        setParamX(String((params.x || 0.10) * 100));
        setParamY(params.y || 60);
        setParamW(params.w ?? 10);
        setParamStopLoss(String((params.stop_loss || -0.05) * 100));
        setParamTakeProfit((params.take_profit || 0.10) * 100);
      } else if (estrategiaLower === 'precocruzamedia') {
        setParamX(String(params.param1 || 3));
        setParamY(params.param2 || 5);
        setParamStopLoss(String((params.stop_loss || -0.05) * 100));
        setParamTakeProfit((params.take_profit || 0.08) * 100);
      }
    }
    
    // Abrir modal
    setShowModal(true);
  }

  return (
    <div className="bg-gray-900 min-h-screen rounded-lg shadow p-8 text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Backtests</h1>
        <button
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded shadow font-semibold"
          onClick={() => setShowModal(true)}
        >
          Novo backtest
        </button>
      </div>
      {/* Modal de novo backtest */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto p-10 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl"
              onClick={() => setShowModal(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-6">Novo Backtest</h2>
            <form className="space-y-0" onSubmit={handleRunBacktest}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Coluna 1: Bases de dados e metade dos parâmetros */}
                <div>
                  <label className="block text-sm font-medium mb-1">Bases de dados</label>
                  <input
                    type="text"
                    placeholder="Buscar base de dados..."
                    className="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={baseSearchTerm}
                    onChange={e => setBaseSearchTerm(e.target.value)}
                  />
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded bg-gray-50">
                    {basesLoading ? (
                      <div className="p-2 text-gray-500 text-sm">Carregando bases...</div>
                    ) : basesError ? (
                      <div className="p-2 text-red-500 text-sm">{basesError}</div>
                    ) : filteredBases.length === 0 ? (
                      <div className="p-2 text-gray-500 text-sm">Nenhuma base encontrada</div>
                    ) : (
                      filteredBases.map(base => (
                        <label key={base.id} className="flex items-center px-3 py-2 hover:bg-cyan-50 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mr-2 accent-cyan-600"
                            checked={selectedBases.includes(base.nome)}
                            onChange={e => {
                              setSelectedBases(prev =>
                                e.target.checked
                                  ? [...prev, base.nome]
                                  : prev.filter(n => n !== base.nome)
                              );
                            }}
                          />
                          {base.nome}
                        </label>
                      ))
                    )}
                  </div>
                  {selectedBases.length > 0 && (
                    <div className="mt-2 text-xs text-cyan-700">Selecionadas: {selectedBases.join(", ")}</div>
                  )}
                </div>
                {/* Coluna 2: Estratégias e metade dos parâmetros */}
                <div>
                  <label className="block text-sm font-medium mb-1">Estratégias</label>
                  <input
                    type="text"
                    placeholder="Buscar estratégia..."
                    className="w-full border border-gray-300 rounded px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    value={estrategiaSearchTerm}
                    onChange={e => setEstrategiaSearchTerm(e.target.value)}
                  />
                  <div className="max-h-32 overflow-y-auto border border-gray-200 rounded bg-gray-50">
                    {estrategiasLoading ? (
                      <div className="p-2 text-gray-500 text-sm">Carregando estratégias...</div>
                    ) : estrategiasError ? (
                      <div className="p-2 text-red-500 text-sm">{estrategiasError}</div>
                    ) : filteredEstrategias.length === 0 ? (
                      <div className="p-2 text-gray-500 text-sm">Nenhuma estratégia encontrada</div>
                    ) : (
                      filteredEstrategias.map(est => (
                        <label key={est.id} className="flex items-center px-3 py-2 hover:bg-cyan-50 cursor-pointer">
                          <input
                            type="radio"
                            className="mr-2 accent-cyan-600"
                            checked={selectedEstrategia === est.nome}
                            onChange={() => setSelectedEstrategia(est.nome)}
                          />
                          {est.nome}
                        </label>
                      ))
                    )}
                  </div>
                  {selectedEstrategia && (
                    <div className="mt-2 text-xs text-cyan-700">Selecionada: {selectedEstrategia}</div>
                  )}
                </div>
              </div>
              {/* Inputs de parâmetros para Buyifstockupxpercentage */}
              {selectedEstrategia && selectedEstrategia.toLowerCase().replace(/[_-]/g, '') === "vendeaberturacomprafechamento" && (
                <div className="grid grid-cols-2 gap-4 mt-8 mb-4 bg-cyan-50 p-4 rounded">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Dia da semana (opcional)</label>
                    <select
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      value={paramDiaSemana}
                      onChange={e => {
                        const v = e.target.value;
                        setParamDiaSemana(v === '' ? '' : Number(v));
                      }}
                    >
                      <option value="">Todos os dias</option>
                      <option value={0}>Segunda-feira</option>
                      <option value={1}>Terça-feira</option>
                      <option value={2}>Quarta-feira</option>
                      <option value={3}>Quinta-feira</option>
                      <option value={4}>Sexta-feira</option>
                    </select>
                    <span className="text-xs text-gray-700 block mt-1">
                      Se selecionado, a operação só ocorrerá quando a entrada for nesse dia da semana.
                    </span>
                  </div>
                </div>
              )}
              {/* Inputs de parâmetros para Buyifstockupxpercentage */}
              {selectedEstrategia && selectedEstrategia.toLowerCase() === "buyifstockupxpercentage" && (
                <div className="grid grid-cols-2 gap-4 mt-8 mb-4 bg-cyan-50 p-4 rounded">
                  <div>
                    <label className="block text-sm font-medium mb-1">X (% de variação em 1 dia)</label>
                    <input type="number" value={paramX} onChange={e => setParamX(e.target.value)} min="-100" className="w-full border border-gray-300 rounded px-3 py-2" step="0.01" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Percentual de alta (positivo) ou queda (negativo) em 1 dia para gerar o sinal de compra.<br />
                      <b>Exemplo:</b> X = 5 &rarr; compra se subir 5% ou mais. X = -3 &rarr; compra se cair 3% ou mais.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Y (períodos de hold)</label>
                    <input type="number" value={paramY} onChange={e => setParamY(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Quantidade máxima de dias que a posição ficará aberta, caso não atinja stop ou gain.<br />
                      <b>Exemplo:</b> Y = 5 &rarr; vende no 5º dia após a compra, se não sair antes por stop ou gain.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Stop Loss (%)</label>
                    <input type="text" value={paramStopLoss} onChange={e => setParamStopLoss(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de perda para encerrar a operação.<br />
                      <b>Exemplo:</b> -5 &rarr; encerra a operação se cair 5% após a compra.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Take Profit (%)</label>
                    <input type="number" value={paramTakeProfit} onChange={e => setParamTakeProfit(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de ganho para encerrar a operação.<br />
                      <b>Exemplo:</b> 8 &rarr; encerra a operação se subir 8% após a compra.
                    </span>
                  </div>
                </div>
              )}
              {/* Inputs de parâmetros para Buysequenciadealtaouqueda */}
              {selectedEstrategia && selectedEstrategia.toLowerCase() === "buysequenciadealtaouqueda" && (
                <div className="grid grid-cols-2 gap-4 mt-8 mb-4 bg-cyan-50 p-4 rounded">
                  <div>
                    <label className="block text-sm font-medium mb-1">X (nº de altas/quedas consecutivas)</label>
                    <input type="number" value={paramX} onChange={e => setParamX(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Número de dias seguidos de alta (positivo) ou queda (negativo) necessários para gerar o sinal de compra.<br />
                      <b>Exemplo:</b> X = 3 &rarr; compra após 3 altas seguidas. X = -2 &rarr; compra após 2 quedas seguidas.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Y (períodos de hold)</label>
                    <input type="number" value={paramY} onChange={e => setParamY(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Quantidade máxima de dias que a posição ficará aberta, caso não atinja stop ou gain.<br />
                      <b>Exemplo:</b> Y = 5 &rarr; vende no 5º dia após a compra, se não sair antes por stop ou gain.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Stop Loss (%)</label>
                    <input type="text" value={paramStopLoss} onChange={e => setParamStopLoss(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de perda para encerrar a operação.<br />
                      <b>Exemplo:</b> -5 &rarr; encerra a operação se cair 5% após a compra.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Take Profit (%)</label>
                    <input type="number" value={paramTakeProfit} onChange={e => setParamTakeProfit(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de ganho para encerrar a operação.<br />
                      <b>Exemplo:</b> 8 &rarr; encerra a operação se subir 8% após a compra.
                    </span>
                  </div>
                </div>
              )}
              {/* Inputs para Operandomomentum */}
              {selectedEstrategia && selectedEstrategia.toLowerCase() === "operandomomentum" && (
                <div className="grid grid-cols-2 gap-4 mt-8 mb-4 bg-cyan-50 p-4 rounded">
                  <div>
                    <label className="block text-sm font-medium mb-1">X (% de variação nos últimos Y períodos)</label>
                    <input type="number" value={paramX} onChange={e => setParamX(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" step="0.01" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Percentual de alta (positivo) ou queda (negativo) nos últimos Y períodos para gerar o sinal de compra.<br />
                      <b>Exemplo:</b> X = 5 &rarr; compra se subir 5% ou mais. X = -3 &rarr; compra se cair 3% ou mais.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Y (períodos para cálculo do movimento)</label>
                    <input type="number" value={paramY} onChange={e => setParamY(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Quantidade de períodos (dias) para calcular a variação percentual.<br />
                      <b>Exemplo:</b> Y = 5 &rarr; considera a variação dos últimos 5 dias.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">W (períodos de hold máximo)</label>
                    <input type="number" value={paramW ?? 5} onChange={e => setParamW(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Quantidade máxima de períodos (dias) que a posição ficará aberta, caso não atinja stop ou gain.<br />
                      <b>Exemplo:</b> W = 5 &rarr; vende no 5º dia após a compra, se não sair antes por stop ou gain.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Stop Loss (%)</label>
                    <input type="text" value={paramStopLoss} onChange={e => setParamStopLoss(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de perda para encerrar a operação.<br />
                      <b>Exemplo:</b> -5 &rarr; encerra a operação se cair 5% após a compra.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Take Profit (%)</label>
                    <input type="number" value={paramTakeProfit} onChange={e => setParamTakeProfit(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de ganho para encerrar a operação.<br />
                      <b>Exemplo:</b> 8 &rarr; encerra a operação se subir 8% após a compra.
                    </span>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Dia da semana (opcional)</label>
                    <select
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      value={paramDiaSemana}
                      onChange={e => {
                        const v = e.target.value;
                        setParamDiaSemana(v === '' ? '' : Number(v));
                      }}
                    >
                      <option value="">Todos os dias</option>
                      <option value={0}>Segunda-feira</option>
                      <option value={1}>Terça-feira</option>
                      <option value={2}>Quarta-feira</option>
                      <option value={3}>Quinta-feira</option>
                      <option value={4}>Sexta-feira</option>
                    </select>
                    <span className="text-xs text-gray-700 block mt-1">
                      Se selecionado, a operação só ocorrerá quando a entrada for nesse dia da semana.
                    </span>
                  </div>
                </div>
              )}
              {/* Inputs para Operandotoposefundos */}
              {selectedEstrategia && selectedEstrategia.toLowerCase() === "operandotoposefundos" && (
                <div className="grid grid-cols-2 gap-4 mt-8 mb-4 bg-cyan-50 p-4 rounded">
                  <div>
                    <label className="block text-sm font-medium mb-1">Modo</label>
                    <select value={paramModo} onChange={e => setParamModo(e.target.value as 'topo' | 'fundo')} className="w-full border border-gray-300 rounded px-3 py-2">
                      <option value="topo">Topo</option>
                      <option value="fundo">Fundo</option>
                    </select>
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Escolha se a estratégia irá operar topos (compra quando cair X% do topo) ou fundos (compra quando subir X% do fundo).
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">X (% em relação ao topo/fundo)</label>
                    <input type="number" value={paramX} onChange={e => setParamX(e.target.value)} min="0" className="w-full border border-gray-300 rounded px-3 py-2" step="0.01" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Percentual de distância do topo/fundo para acionar a compra.<br />
                      <b>Exemplo:</b> X = 10 &rarr; compra se cair 10% do topo (ou subir 10% do fundo).
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Y (janela topo/fundo)</label>
                    <input type="number" value={paramY} onChange={e => setParamY(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Quantidade de períodos para buscar o topo/fundo mais recente.<br />
                      <b>Exemplo:</b> Y = 60 &rarr; considera o topo/fundo dos últimos 60 períodos.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">W (tempo máximo da operação)</label>
                    <input type="number" value={paramW ?? 10} onChange={e => setParamW(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Quantidade máxima de períodos que a operação pode durar.<br />
                      <b>Exemplo:</b> W = 10 &rarr; encerra a operação após 10 períodos, se não sair antes por stop ou gain.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Stop Loss (%)</label>
                    <input type="text" value={paramStopLoss} onChange={e => setParamStopLoss(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de perda para encerrar a operação.<br />
                      <b>Exemplo:</b> -5 &rarr; encerra a operação se cair 5% após a compra.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Take Profit (%)</label>
                    <input type="number" value={paramTakeProfit} onChange={e => setParamTakeProfit(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de ganho para encerrar a operação.<br />
                      <b>Exemplo:</b> 10 &rarr; encerra a operação se subir 10% após a compra.
                    </span>
                  </div>
                </div>
              )}
              {/* Inputs para Voltaamediabollinger */}
              {selectedEstrategia && selectedEstrategia.toLowerCase() === "voltaamediabollinger" && (
                <div className="grid grid-cols-2 gap-4 mt-8 mb-4 bg-cyan-50 p-4 rounded">
                  <div>
                    <label className="block text-sm font-medium mb-1">X (períodos da média móvel)</label>
                    <input type="number" value={paramX} onChange={e => setParamX(e.target.value)} min="1" className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Quantidade de períodos para o cálculo da média móvel de Bollinger.<br />
                      <b>Exemplo:</b> X = 20 &rarr; usa média móvel de 20 períodos.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Y (desvio padrão)</label>
                    <input type="number" value={paramY} onChange={e => setParamY(Number(e.target.value))} min="0.1" step="0.1" className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Desvio padrão multiplicador para as bandas de Bollinger.<br />
                      <b>Exemplo:</b> Y = 2 &rarr; banda inferior = média - 2 * desvio padrão.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">W (tempo máximo da operação)</label>
                    <input type="number" value={paramW ?? 10} onChange={e => setParamW(Number(e.target.value))} min="1" className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Quantidade máxima de períodos que a operação pode durar.<br />
                      <b>Exemplo:</b> W = 10 &rarr; encerra a operação após 10 períodos, se não sair antes por stop ou gain.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">T (tempo de cooldown após stop loss)</label>
                    <input type="number" value={paramCooldownT} onChange={e => setParamCooldownT(Number(e.target.value))} min="0" className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Após uma saída por stop loss, a estratégia não abrirá novas operações por T períodos.<br />
                      <b>Exemplo:</b> T = 5 &rarr; após um stop loss, aguarda 5 períodos antes de permitir nova entrada.<br />
                      <b>Nota:</b> Valor 0 desabilita o cooldown (comportamento padrão).
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">D (distância mínima da média, %)</label>
                    <input type="number" value={paramDistanciaMinimaD} onChange={e => setParamDistanciaMinimaD(Number(e.target.value))} min="0" step="0.1" className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Exige que a distância entre o preço de entrada e a média seja pelo menos D% antes de permitir a entrada.<br />
                      <b>Exemplo:</b> D = 2 &rarr; só entra se a distância entre preço de entrada e média for ≥ 2%.<br />
                      <b>Nota:</b> Valor 0 desabilita o filtro (comportamento padrão). Cálculo: distância = (média - preço de entrada) / média × 100%.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Horário de entrada (início)</label>
                    <input type="time" value={paramHorarioEntradaInicio} onChange={e => setParamHorarioEntradaInicio(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Define o horário inicial da janela permitida para entradas.<br />
                      <b>Exemplo:</b> 09:00 &rarr; permite entradas a partir das 09:00.<br />
                      <b>Nota:</b> Deixe vazio para desabilitar o filtro. Ambos os campos (início e fim) devem ser preenchidos para o filtro funcionar.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Horário de entrada (fim)</label>
                    <input type="time" value={paramHorarioEntradaFim} onChange={e => setParamHorarioEntradaFim(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Define o horário final da janela permitida para entradas.<br />
                      <b>Exemplo:</b> 17:00 &rarr; permite entradas até as 17:00.<br />
                      <b>Nota:</b> Deixe vazio para desabilitar o filtro. Ambos os campos (início e fim) devem ser preenchidos para o filtro funcionar.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Stop Loss (%)</label>
                    <input type="text" value={paramStopLoss} onChange={e => setParamStopLoss(e.target.value)} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de perda para encerrar a operação.<br />
                      <b>Exemplo:</b> -5 &rarr; encerra a operação se cair 5% após a compra.
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Take Profit (%)</label>
                    <input type="number" value={paramTakeProfit} onChange={e => setParamTakeProfit(Number(e.target.value))} className="w-full border border-gray-300 rounded px-3 py-2" />
                    <span className="text-xs text-gray-700 block mt-1">
                      <b>O que é?</b> Limite de ganho para encerrar a operação.<br />
                      <b>Exemplo:</b> 10 &rarr; encerra a operação se subir 10% após a compra.
                    </span>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paramSairEmZ}
                        onChange={e => setParamSairEmZ(e.target.checked)}
                        className="accent-cyan-600"
                      />
                      <span className="text-sm font-medium">Sair a Z desvios padrão</span>
                    </label>
                    <span className="text-xs text-gray-700 block mt-1 ml-6">
                      Quando habilitado, encerra a operação quando o preço atinge a linha: média - Z*desvio padrão. Z=0 equivale a sair na média.
                    </span>
                  </div>
                  <div className="col-span-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={paramZSomenteFechamento}
                        onChange={e => setParamZSomenteFechamento(e.target.checked)}
                        className="accent-cyan-600"
                      />
                      <span className="text-sm font-medium">Sair somente no fechamento do candle</span>
                    </label>
                    <span className="text-xs text-gray-700 block mt-1 ml-6">
                      Desmarque para permitir saída intrabar por Z em todos os candles (se o preço tocar a linha alvo durante o candle).
                    </span>
                  </div>
                  {paramSairEmZ && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium mb-1">Desvio padrão para saída (Z)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={paramZSaida}
                        onChange={e => setParamZSaida(Number(e.target.value))}
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      />
                      <span className="text-xs text-gray-700 block mt-1">
                        Z deve ser &lt; Y. Valores negativos são permitidos (Z negativo ⇒ média + |Z| × desvio).
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* Mensagens de erro/sucesso e botões centralizados */}
              {runError && <div className="text-red-500 text-sm mt-4">{runError}</div>}
              {runSuccess && <div className="text-green-600 text-sm mt-4">{runSuccess}</div>}
              <div className="pt-8 flex justify-center gap-4">
                <button
                  type="button"
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded font-semibold"
                  onClick={() => setShowModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded font-semibold"
                  disabled={selectedBases.length === 0 || !selectedEstrategia || runLoading}
                >
                  {runLoading ? "Rodando..." : "Rodar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Tabela de backtests executados */}
      <div className="overflow-x-auto mt-8">
        {loading ? (
          <div className="text-gray-300">Carregando backtests...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <button
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
                onClick={handleDeleteSelected}
                disabled={selectedBacktests.length === 0 || deleting}
              >
                {deleting ? 'Excluindo...' : `Excluir selecionados (${selectedBacktests.length})`}
              </button>
            </div>
            <table className="min-w-full bg-gray-800 rounded-lg">
              <thead>
                <tr>
                  <th className="px-2 py-3"></th>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="accent-cyan-600"
                      checked={selectedBacktests.length === paginatedBacktests.length && paginatedBacktests.length > 0}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedBacktests(paginatedBacktests.filter(bt => !bt.locked).map(bt => bt.id));
                        } else {
                          setSelectedBacktests([]);
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Base de dados</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Estratégia</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Retorno por trade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tempo médio por trade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nº Trades</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBacktests.map((bt) => {
                  // Formatar data para dd-mm-yy
                  let dataFormatada = '';
                  if (bt.criadoEm) {
                    const d = bt.criadoEm.toDate ? bt.criadoEm.toDate() : new Date(bt.criadoEm);
                    dataFormatada = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getFullYear()).slice(2)}`;
                  }
                  return (
                    <tr key={bt.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                      <td className="px-2 py-4 text-center">
                        <button
                          title={bt.locked ? 'Desbloquear backtest' : 'Bloquear backtest'}
                          onClick={async (e) => {
                            e.preventDefault();
                            await fetch(`http://localhost:8003/api/backtest/${bt.id}/lock`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ locked: !bt.locked })
                            });
                            setBacktests(prev => prev.map(b => b.id === bt.id ? { ...b, locked: !bt.locked } : b));
                          }}
                          className="text-xl focus:outline-none"
                        >
                          {bt.locked ? <FiLock className="text-red-500" /> : <FiUnlock className="text-cyan-400 hover:text-cyan-600" />}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          className="accent-cyan-600"
                          checked={selectedBacktests.includes(bt.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedBacktests(prev => [...prev, bt.id]);
                            } else {
                              setSelectedBacktests(prev => prev.filter(id => id !== bt.id));
                            }
                          }}
                          disabled={bt.locked}
                          title={bt.locked ? 'Backtest bloqueado. Desbloqueie para selecionar.' : ''}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{bt.base_dados || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{bt.estrategia || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">{dataFormatada}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bt.metrics?.retorno_por_trade_percent != null
                          ? bt.metrics.retorno_por_trade_percent.toFixed(3) + '%'
                          : bt.metrics?.retorno_por_trade != null
                            ? (bt.metrics.retorno_por_trade * 100).toFixed(3) + '%'
                            : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bt.metrics?.tempo_medio_vencedores != null
                          ? bt.metrics.tempo_medio_vencedores.toFixed(2) 
                          : bt.metrics?.tempo_medio_por_trade != null
                            ? bt.metrics.tempo_medio_por_trade.toFixed(2) 
                            : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{bt.metrics?.n_operacoes ?? '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex gap-2">
                          <Link href={`/dashboard/backtests/backtest/${bt.id}`} legacyBehavior>
                            <a className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-1 rounded text-sm font-semibold" target="_blank" rel="noopener noreferrer">
                              Ver Backtest
                            </a>
                          </Link>
                          <button
                            onClick={() => handleReutilizarBacktest(bt)}
                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-semibold"
                          >
                            Reutilizar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Paginação */}
            <div className="flex justify-center items-center gap-4 mt-4">
              <button
                className="px-3 py-1 rounded bg-cyan-600 text-white font-semibold disabled:opacity-50"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </button>
              <span className="text-white">
                Página {currentPage} de {totalPages}
              </span>
              <button
                className="px-3 py-1 rounded bg-cyan-600 text-white font-semibold disabled:opacity-50"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 