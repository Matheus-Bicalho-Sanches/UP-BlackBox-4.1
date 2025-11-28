"use client";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { FiEye, FiDownload } from "react-icons/fi";
import { db } from '@/config/firebase';
import { collection, getDocs } from 'firebase/firestore';

type EquityPoint = { data: string; valor: number };

function calcularRetornoMovel(data: { data: string; valor: number }[], window: number = 100) {
  if (!data || data.length === 0) return [];
  const result = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window) {
      result.push({ data: data[i].data, valor: null });
      continue;
    }
    const v0 = data[i - window]?.valor;
    const v1 = data[i]?.valor;
    if (v0 != null && v1 != null && v0 !== 0) {
      // Retorno percentual no período
      const ret = (v1 / v0 - 1) * 100;
      result.push({ data: data[i].data, valor: ret });
    } else {
      result.push({ data: data[i].data, valor: null });
    }
  }
  return result;
}

function formatParamLabel(key: string): string {
  const map: Record<string, string> = {
    x: 'X',
    y: 'Y',
    w: 'W',
    modo: 'Modo',
    stop_loss: 'Stop Loss',
    take_profit: 'Take Profit',
    sair_na_media: 'Sair na média',
    cooldown_t: 'T (Cooldown)',
    t: 'T (Cooldown)',
    distancia_minima_d: 'D (Distância Mínima)',
    d: 'D (Distância Mínima)',
    horario_entrada_inicio: 'Horário Entrada Início',
    horario_inicio: 'Horário Entrada Início',
    horario_entrada_fim: 'Horário Entrada Fim',
    horario_fim: 'Horário Entrada Fim',
  };
  return map[key] || key;
}

function formatNumberDisplay(n: number): string {
  const fixed = Number(n.toFixed(6));
  return Number.isInteger(fixed) ? String(fixed) : String(Number(fixed.toFixed(4)));
}

function formatParamValue(key: string, value: any): string {
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number') {
    const percentKeys = new Set(['x', 'stop_loss', 'take_profit']);
    let v = value;
    if (percentKeys.has(key) && Math.abs(v) <= 1) v = v * 100;
    return formatNumberDisplay(v);
  }
  if (typeof value === 'string' && key === 'modo') {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  return String(value);
}

export default function BacktestDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [backtest, setBacktest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showStrategyInfo, setShowStrategyInfo] = useState(false);
  const [estrategiaInfo, setEstrategiaInfo] = useState<any>(null);
  const [windowSize, setWindowSize] = useState(100);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const [tradesPage, setTradesPage] = useState(1);
  const TRADES_PER_PAGE = 100;

  useEffect(() => {
    async function fetchBacktest() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`http://localhost:8003/api/backtest/${id}`);
        if (!res.ok) throw new Error("Erro ao buscar backtest");
        const data = await res.json();
        // Se houver detalhes_url, buscar os dados grandes do Storage
        if (data.detalhes_url) {
          try {
            const detalhesRes = await fetch(data.detalhes_url);
            if (detalhesRes.ok) {
              const detalhes = await detalhesRes.json();
              // Preencher os campos grandes
              data.trades = detalhes.trades;
              data.equity_curve_estrategia = detalhes.equity_curve_estrategia;
              data.equity_curve_ativo = detalhes.equity_curve_ativo;
              data.drawdown_estrategia = detalhes.drawdown_estrategia;
              data.drawdown_ativo = detalhes.drawdown_ativo;
            }
          } catch (e) {
            console.error('Erro ao buscar detalhes do Storage:', e);
          }
        }
        setBacktest(data);
      } catch (err: any) {
        setError(err.message || "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    fetchBacktest();
  }, [id]);

  async function handleShowStrategyInfo() {
    if (!backtest?.estrategia) return;
    // Busca a estratégia pelo nome exato
    const snapshot = await getDocs(collection(db, "estrategias"));
    type EstrategiaDoc = { id: string; nome?: string; [key: string]: any };
    const docs: EstrategiaDoc[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const found = docs.find(e => (e.nome || '').toLowerCase() === backtest.estrategia.toLowerCase());
    setEstrategiaInfo(found || null);
    setShowStrategyInfo(true);
  }

  async function handleExportPDF() {
    if (!exportRef.current) return;
    try {
      setExporting(true);
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const element = exportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      const safeName = `Backtest_${backtest?.estrategia || ''}_${backtest?.base_dados || ''}`
        .replace(/\s+/g, "_")
        .replace(/[^a-zA-Z0-9_\-\.]/g, "")
        .slice(0, 120) || "Backtest";
      pdf.save(`${safeName}.pdf`);
    } catch (e) {
      console.error("Erro ao exportar PDF:", e);
      alert("Não foi possível exportar o PDF. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    setTradesPage(1);
  }, [backtest?.trades]);

  const sortedTrades = useMemo(() => {
    if (!backtest?.trades || !Array.isArray(backtest.trades)) return [];
    const toTime = (s: any) => {
      const d = new Date(s);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    return [...backtest.trades].sort((a: any, b: any) => toTime(b.entrada_data) - toTime(a.entrada_data));
  }, [backtest?.trades]);

  const totalTradePages = Math.ceil((sortedTrades?.length || 0) / TRADES_PER_PAGE) || 1;
  const paginatedTrades = useMemo(() => {
    const start = (tradesPage - 1) * TRADES_PER_PAGE;
    const end = start + TRADES_PER_PAGE;
    return sortedTrades.slice(start, end);
  }, [sortedTrades, tradesPage]);

  return (
    <div className="bg-gray-900 min-h-screen rounded-lg shadow p-8 text-white">
      {loading ? (
        <div className="text-cyan-400">Carregando backtest...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : !backtest ? (
        <div className="text-gray-400">Backtest não encontrado.</div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-4">
            <h1 className="text-2xl font-bold">Backtest: {backtest.estrategia} - {backtest.base_dados}</h1>
            <button
              className="text-cyan-400 hover:text-cyan-300 focus:outline-none"
              title="Ver detalhes da estratégia"
              onClick={handleShowStrategyInfo}
            >
              <FiEye size={26} />
            </button>
            <button
              className="text-cyan-400 hover:text-cyan-300 focus:outline-none"
              title="Exportar PDF"
              onClick={handleExportPDF}
              disabled={exporting}
            >
              <FiDownload size={26} />
            </button>
          </div>
          <div ref={exportRef}>
          {/* Parâmetros e Estatísticas em duas colunas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            {/* Parâmetros */}
            <div>
              <div className="mb-4">
                <span className="font-semibold">Parâmetros:</span>
                {backtest.parametros && Object.keys(backtest.parametros).length > 0 ? (
                  <ul className="ml-4 mt-1 text-sm text-cyan-300">
                    {Object.entries(backtest.parametros).map(([key, value]) => (
                      <li key={key}>
                        {formatParamLabel(key)} = {formatParamValue(key, value)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="ml-4 mt-1 text-sm text-cyan-300">-</div>
                )}
              </div>
            </div>
            {/* Estatísticas */}
            <div>
              <span className="font-semibold">Estatísticas:</span>
              <ul className="ml-4 mt-1 text-sm text-cyan-300">
                <li>
                  Retorno médio por trade: {backtest.metrics?.retorno_por_trade_percent != null && typeof backtest.metrics.retorno_por_trade_percent === 'number'
                    ? backtest.metrics.retorno_por_trade_percent.toFixed(3) + '%'
                    : backtest.metrics?.retorno_por_trade != null && typeof backtest.metrics.retorno_por_trade === 'number'
                      ? (backtest.metrics.retorno_por_trade * 100).toFixed(3) + '%'
                      : '-'}
                </li>
                <li>
                  Mediana de retorno por trade: {Array.isArray(backtest.trades) && backtest.trades.length > 0
                    ? (() => {
                        const rets = backtest.trades
                          .map((t: any) => typeof t.entrada_preco === 'number' && typeof t.saida_preco === 'number'
                            ? (t.saida_preco - t.entrada_preco) / t.entrada_preco
                            : null)
                          .filter((v: number | null) => v != null);
                        if (rets.length === 0) return '-';
                        const sorted = rets.sort((a: number, b: number) => a - b);
                        const mid = Math.floor(sorted.length / 2);
                        const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
                        return (median * 100).toFixed(3) + '%';
                      })()
                    : backtest.metrics?.retorno_mediano_por_trade != null
                      ? (backtest.metrics.retorno_mediano_por_trade * 100).toFixed(3) + '%'
                      : '-'}
                </li>
                <li>
                  Quantidade de trades feitos: {Array.isArray(backtest.trades) ? backtest.trades.length : (backtest.metrics?.n_operacoes ?? '-')}
                </li>
                <li>
                  Tempo posicionado: {backtest.tempo_posicionado != null && backtest.total_linhas != null
                    ? ((backtest.tempo_posicionado / backtest.total_linhas) * 100).toFixed(2) + '%'
                    : '-'}
                </li>
                <li>
                  % de trades vencedores: {backtest.metrics?.pct_vencedores != null ? backtest.metrics.pct_vencedores.toFixed(2) + '%' : '-'}
                </li>
                <li>
                  Ganho médio dos trades vencedores: {backtest.metrics?.ganho_medio_vencedores != null ? (backtest.metrics.ganho_medio_vencedores * 100).toFixed(2) + '%' : '-'}
                </li>
                <li>
                  Tempo posicionado médio dos trades vencedores: {backtest.metrics?.tempo_medio_vencedores != null ? backtest.metrics.tempo_medio_vencedores.toFixed(2) : '-'}
                </li>
                <li>
                  Perda média dos trades perdedores: {backtest.metrics?.perda_medio_perdedores != null ? (backtest.metrics.perda_medio_perdedores * 100).toFixed(2) + '%' : '-'}
                </li>
                <li>
                  Tempo posicionado médio dos trades perdedores: {backtest.metrics?.tempo_medio_perdedores != null ? backtest.metrics.tempo_medio_perdedores.toFixed(2) : '-'}
                </li>
                <li>
                  Drawdown máximo: {backtest.metrics?.max_drawdown_estrategia != null ? (backtest.metrics.max_drawdown_estrategia * 100).toFixed(2) + '%' : '-'}
                </li>
              </ul>
            </div>
          </div>
          <div className="mb-6">
            <span className="font-semibold">Data:</span> {backtest.criadoEm ? new Date(backtest.criadoEm).toLocaleString("pt-BR") : "-"}
          </div>
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Equity Curve</h2>
            <div className="bg-gray-800 rounded-lg p-4">
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={
                    backtest.equity_curve_estrategia && backtest.equity_curve_ativo
                      ? backtest.equity_curve_estrategia.map((item: EquityPoint, idx: number) => ({
                          data: item.data,
                          valor_estrategia: item.valor,
                          valor_ativo: backtest.equity_curve_ativo[idx]?.valor ?? null,
                        }))
                      : backtest.equity_curve || backtest.equity_curve_estrategia || []
                  }
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="data" tick={{ fill: '#ccc', fontSize: 12 }} minTickGap={30} />
                  <YAxis tick={{ fill: '#ccc', fontSize: 12 }} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={{ background: '#222', border: 'none', color: '#fff' }} />
                  {backtest.equity_curve_estrategia && (
                    <Line type="monotone" dataKey="valor_estrategia" name="Estratégia" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  )}
                  {backtest.equity_curve_ativo && (
                    <Line type="monotone" dataKey="valor_ativo" name="Ativo (Buy & Hold)" stroke="#aaa" strokeWidth={2} dot={false} />
                  )}
                  {!backtest.equity_curve_estrategia && (
                    <Line type="monotone" dataKey="valor" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Gráfico de Retorno Móvel */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Retorno Móvel ({windowSize} períodos)</h2>
            <div className="mb-4 flex items-center gap-2">
              <label htmlFor="windowSize" className="text-sm text-gray-300">Janela móvel:</label>
              <input
                id="windowSize"
                type="number"
                min={1}
                max={backtest?.equity_curve_estrategia?.length || 1000}
                value={windowSize}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v > 0) setWindowSize(v);
                }}
                className="w-24 px-2 py-1 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <span className="text-xs text-gray-400">(número de períodos)</span>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart
                  data={(() => {
                    const rollingEstrat = calcularRetornoMovel(backtest.equity_curve_estrategia, windowSize);
                    const rollingAtivo = backtest.equity_curve_ativo ? calcularRetornoMovel(backtest.equity_curve_ativo, windowSize) : null;
                    return rollingEstrat.map((item, idx) => ({
                      data: item.data,
                      retorno_estrategia: item.valor,
                      retorno_ativo: rollingAtivo ? rollingAtivo[idx]?.valor : null,
                    }));
                  })()}
                  margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                  <XAxis dataKey="data" tick={{ fill: '#ccc', fontSize: 12 }} minTickGap={30} />
                  <YAxis tick={{ fill: '#ccc', fontSize: 12 }} domain={["auto", "auto"]} unit="%" />
                  <Tooltip contentStyle={{ background: '#222', border: 'none', color: '#fff' }} formatter={(v) => v != null && !isNaN(Number(v)) ? Number(v).toFixed(2) + '%' : '-'} />
                  <Legend />
                  <Line type="monotone" dataKey="retorno_estrategia" name="Estratégia" stroke="#06b6d4" strokeWidth={2} dot={false} />
                  {backtest.equity_curve_ativo && (
                    <Line type="monotone" dataKey="retorno_ativo" name="Ativo (Buy & Hold)" stroke="#aaa" strokeWidth={2} dot={false} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Gráfico de Drawdown */}
          {(backtest.drawdown_estrategia || backtest.drawdown_ativo) && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-2">Drawdown ao longo do tempo</h2>
              <div className="bg-gray-800 rounded-lg p-4">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart
                    data={
                      backtest.drawdown_estrategia && backtest.drawdown_ativo
                        ? backtest.drawdown_estrategia.map((item: EquityPoint, idx: number) => ({
                            data: item.data,
                            drawdown_estrategia: item.valor,
                            drawdown_ativo: backtest.drawdown_ativo[idx]?.valor ?? null,
                          }))
                        : backtest.drawdown_estrategia || backtest.drawdown_ativo || []
                    }
                    margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="data" tick={{ fill: '#ccc', fontSize: 12 }} minTickGap={30} />
                    <YAxis tickFormatter={v => (typeof v === 'number' ? (v * 100).toFixed(1) + '%' : '-')} tick={{ fill: '#ccc', fontSize: 12 }} domain={[(dataMin: number) => Math.min(dataMin, -1), 0]} />
                    <Tooltip contentStyle={{ background: '#222', border: 'none', color: '#fff' }} formatter={v => (typeof v === 'number' ? (v * 100).toFixed(2) + '%' : '-')} />
                    {backtest.drawdown_estrategia && (
                      <Line type="monotone" dataKey="drawdown_estrategia" name="Drawdown Estratégia" stroke="#06b6d4" strokeWidth={2} dot={false} />
                    )}
                    {backtest.drawdown_ativo && (
                      <Line type="monotone" dataKey="drawdown_ativo" name="Drawdown Ativo" stroke="#aaa" strokeWidth={2} dot={false} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {/* Tabela de trades realizados */}
          {sortedTrades && Array.isArray(sortedTrades) && sortedTrades.length > 0 && (
            <div className="mt-10">
              <h2 className="text-xl font-semibold mb-2">Histórico de Trades Realizados</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-800 rounded-lg">
                  <thead>
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Entrada</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Preço Entrada</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Saída</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Preço Saída</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Retorno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTrades.map((trade: any, idx: number) => (
                      <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/30">
                        <td className="px-6 py-4 whitespace-nowrap">{trade.entrada_data}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{trade.entrada_preco}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{trade.saida_data}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{trade.saida_preco}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {typeof trade.entrada_preco === 'number' && typeof trade.saida_preco === 'number'
                            ? (((trade.saida_preco - trade.entrada_preco) / trade.entrada_preco) * 100).toFixed(2) + '%'
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-center items-center gap-4 mt-4">
                <button
                  className="px-3 py-1 rounded bg-cyan-600 text-white font-semibold disabled:opacity-50"
                  onClick={() => setTradesPage((prev) => Math.max(prev - 1, 1))}
                  disabled={tradesPage === 1}
                >
                  Anterior
                </button>
                <span className="text-white">
                  Página {tradesPage} de {totalTradePages}
                </span>
                <button
                  className="px-3 py-1 rounded bg-cyan-600 text-white font-semibold disabled:opacity-50"
                  onClick={() => setTradesPage((prev) => Math.min(prev + 1, totalTradePages))}
                  disabled={tradesPage === totalTradePages}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
          </div>
          {/* Pop-up de detalhes da estratégia */}
          {showStrategyInfo && estrategiaInfo && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
              <div className="bg-white text-gray-900 rounded-lg shadow-lg w-full max-w-8xl w-[1500px] h-[70vh] flex flex-col p-12 relative overflow-y-auto">
                <button
                  className="absolute top-4 right-6 text-gray-500 hover:text-gray-800 text-3xl"
                  onClick={() => setShowStrategyInfo(false)}
                  aria-label="Fechar"
                >
                  ×
                </button>
                <h2 className="text-3xl font-bold mb-8">Mais informações da estratégia</h2>
                <div className="space-y-8 flex-1">
                  <div className="flex flex-col md:flex-row gap-8 w-full">
                    {/* Coluna 1 */}
                    <div className="flex-1 space-y-8">
                      <div>
                        <span className="font-semibold">Descrição:</span>
                        <textarea
                          className="mt-2 w-full text-gray-700 bg-gray-100 rounded p-3 min-h-[100px]"
                          value={estrategiaInfo.descricao || ''}
                          readOnly
                        />
                      </div>
                      <div>
                        <span className="font-semibold">Variáveis necessárias para backtest:</span>
                        <textarea
                          className="mt-2 w-full text-gray-700 bg-gray-100 rounded p-3 min-h-[120px]"
                          value={estrategiaInfo.variaveis || ''}
                          readOnly
                        />
                      </div>
                    </div>
                    {/* Coluna 2 */}
                    <div className="flex-1 space-y-8">
                      <div>
                        <span className="font-semibold">Estudos/resultados:</span>
                        <textarea
                          className="mt-2 w-full text-gray-700 bg-gray-100 rounded p-3 min-h-[100px] whitespace-pre-line"
                          value={estrategiaInfo.resultados || ''}
                          readOnly
                        />
                      </div>
                      <div>
                        <span className="font-semibold">Outras observações:</span>
                        <textarea
                          className="mt-2 w-full text-gray-700 bg-gray-100 rounded p-3 min-h-[80px] whitespace-pre-line"
                          value={estrategiaInfo.observacoes || ''}
                          readOnly
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 