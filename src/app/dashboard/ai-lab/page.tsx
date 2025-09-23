'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Experiment = {
  id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  model: 'lightgbm' | 'tcn' | 'gru' | 'ssm' | 'transformer'
  symbolList: string[]
  dtSeconds: number
  eventBarType: 'trades' | 'volume' | 'dollar'
  eventBarSize: number
  costBps: number
  createdAt: string
  hoursBack?: number
  labelHorizon?: number
}

type MetricPoint = { step: number; value: number; name: string; ts: string }
type ImportanceItem = { feature: string; importance: number }
type Operation = {
  symbol: string
  entry_timestamp: string
  entry_price: number
  exit_timestamp: string
  exit_price: number
  result: number
  entry_prob: number
  position: 'LONG' | 'SHORT'
}

type BacktestResponse = {
  points: { i: number; p: number }[]
  metrics: { 
    cum_pnl: number; 
    sharpe: number; 
    hit_rate: number; 
    max_drawdown: number; 
    cost_bps: number;
    signal_counts?: { long: number; short: number; neutral: number };
    total_bars?: number;
    operations_count?: number;
  }
  operations: Operation[]
}

type OOSResponse = {
  test_symbols: string[]
  test_hours_back: number
  points: { i: number; p: number }[]
  metrics: { 
    cum_pnl: number; 
    sharpe: number; 
    hit_rate: number; 
    max_drawdown: number; 
    cost_bps: number; 
    test_bars: number;
    signal_counts?: { long: number; short: number; neutral: number };
    operations_count?: number;
  }
  operations: Operation[]
}

export default function AILabPage() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_ML_API_BASE_URL || 'http://localhost:8010'
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [liveMetrics, setLiveMetrics] = useState<MetricPoint[]>([])
  const [importance, setImportance] = useState<ImportanceItem[]>([])
  const [bt, setBt] = useState<BacktestResponse | null>(null)
  const [btForm, setBtForm] = useState({ long: 0.55, short: 0.45, costBps: 5 })
  const [btLoading, setBtLoading] = useState(false)

  // Limpa resultados de backtest quando parâmetros mudam
  const handleBtFormChange = (updates: Partial<typeof btForm>) => {
    setBtForm(prev => ({ ...prev, ...updates }))
    setBt(null) // Limpa resultado anterior
  }
  const [oos, setOos] = useState<OOSResponse | null>(null)
  const [oosForm, setOosForm] = useState({ testSymbols: 'ITUB4,BBDC4', testHours: 24, long: 0.55, short: 0.45, costBps: 5 })
  const [oosLoading, setOosLoading] = useState(false)

  // Limpa resultados OOS quando parâmetros mudam
  const handleOosFormChange = (updates: Partial<typeof oosForm>) => {
    setOosForm(prev => ({ ...prev, ...updates }))
    setOos(null) // Limpa resultado anterior
  }

  // Form state (MVP)
  const [form, setForm] = useState({
    model: 'lightgbm' as Experiment['model'],
    symbols: 'ABEV3,PETR4,VALE3',
    dtSeconds: 10,
    eventBarType: 'trades' as Experiment['eventBarType'],
    eventBarSize: 200,
    costBps: 3,
    hoursBack: 72,
    labelHorizon: 5,
  })

  // Stubs de fetch (substituir pelos endpoints reais quando disponíveis)
  async function fetchExperiments() {
    try {
      const res = await fetch(`${API_BASE_URL}/ml/experiments`)
      if (!res.ok) return [] as Experiment[]
      return (await res.json()) as Experiment[]
    } catch {
      return [] as Experiment[]
    }
  }

  async function createExperiment(payload: Omit<Experiment, 'id' | 'status' | 'createdAt'>) {
    const res = await fetch(`${API_BASE_URL}/ml/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { ok: false }
    return await res.json()
  }

  async function runBacktest(expId: string) {
    setBtLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/ml/backtests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentId: expId,
          longThreshold: btForm.long,
          shortThreshold: btForm.short,
          costBps: btForm.costBps,
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as BacktestResponse
      setBt(data)
    } finally {
      setBtLoading(false)
    }
  }

  async function runOOSValidation(expId: string) {
    setOosLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/ml/oos-validation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experimentId: expId,
          testSymbols: oosForm.testSymbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean),
          testHoursBack: oosForm.testHours,
          longThreshold: oosForm.long,
          shortThreshold: oosForm.short,
          costBps: oosForm.costBps,
        }),
      })
      if (!res.ok) return
      const data = (await res.json()) as OOSResponse
      setOos(data)
    } finally {
      setOosLoading(false)
    }
  }

  function downloadOperationsExcel(operations: Operation[], filename: string) {
    // Cria CSV (Excel pode abrir CSV)
    const headers = ['Ativo', 'Timestamp Entrada', 'Preço Entrada', 'Timestamp Saída', 'Preço Saída', 'Resultado', 'Probabilidade', 'Posição']
    const csvContent = [
      headers.join(','),
      ...operations.map(op => [
        op.symbol,
        op.entry_timestamp,
        op.entry_price.toFixed(4),
        op.exit_timestamp,
        op.exit_price.toFixed(4),
        op.result.toFixed(4),
        op.entry_prob.toFixed(4),
        op.position
      ].join(','))
    ].join('\n')

    // Cria e baixa arquivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${filename}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function fetchLiveMetrics(expId: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/ml/experiments/${expId}/metrics`)
      if (!res.ok) return [] as MetricPoint[]
      return (await res.json()) as MetricPoint[]
    } catch {
      return [] as MetricPoint[]
    }
  }

  async function fetchImportance(expId: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/ml/experiments/${expId}/importance`)
      if (!res.ok) return [] as ImportanceItem[]
      return (await res.json()) as ImportanceItem[]
    } catch {
      return [] as ImportanceItem[]
    }
  }

  useEffect(() => {
    let mounted = true
    fetchExperiments().then((data) => mounted && setExperiments(data))
    return () => {
      mounted = false
    }
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = {
        model: form.model,
        symbolList: form.symbols.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
        dtSeconds: form.dtSeconds,
        eventBarType: form.eventBarType,
        eventBarSize: form.eventBarSize,
        costBps: form.costBps,
        hoursBack: form.hoursBack,
        labelHorizon: form.labelHorizon,
      } as Omit<Experiment, 'id' | 'status' | 'createdAt'>
      const res = await createExperiment(payload)
      if (res?.ok) {
        const list = await fetchExperiments()
        setExperiments(list)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedExperiments = useMemo(
    () => experiments.filter((e) => selectedExpIds.includes(e.id)),
    [experiments, selectedExpIds]
  )

  // Atualiza métricas a cada 2s do primeiro experimento selecionado
  useEffect(() => {
    let timer: any
    async function loop() {
      if (selectedExperiments[0]) {
        const points = await fetchLiveMetrics(selectedExperiments[0].id)
        setLiveMetrics(points)
        const imp = await fetchImportance(selectedExperiments[0].id)
        setImportance(imp)
      } else {
        setLiveMetrics([])
        setImportance([])
      }
      timer = setTimeout(loop, 2000)
    }
    loop()
    return () => clearTimeout(timer)
  }, [selectedExperiments])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">AI Lab</h1>
      </div>

      {/* 1) Controle de Experimentos */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-white font-semibold mb-3">Controle de Experimentos</h2>
        <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={onSubmit}>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Modelo</label>
            <select
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value as Experiment['model'] }))}
            >
              <option value="lightgbm">LightGBM</option>
              <option value="tcn">TCN</option>
              <option value="gru">GRU</option>
              <option value="ssm">SSM</option>
              <option value="transformer">Transformer</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Símbolos (CSV)</label>
            <input
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
              value={form.symbols}
              onChange={(e) => setForm((f) => ({ ...f, symbols: e.target.value }))}
              placeholder="ABEV3,PETR4,VALE3"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-gray-300 text-sm mb-1">Δt (s)</label>
              <input
                type="number"
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
                value={form.dtSeconds}
                onChange={(e) => setForm((f) => ({ ...f, dtSeconds: Number(e.target.value) }))}
                min={1}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">Barra</label>
              <select
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
                value={form.eventBarType}
                onChange={(e) => setForm((f) => ({ ...f, eventBarType: e.target.value as Experiment['eventBarType'] }))}
              >
                <option value="trades">Trades</option>
                <option value="volume">Volume</option>
                <option value="dollar">Dollar</option>
              </select>
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">Tamanho</label>
              <input
                type="number"
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
                value={form.eventBarSize}
                onChange={(e) => setForm((f) => ({ ...f, eventBarSize: Number(e.target.value) }))}
                min={10}
              />
            </div>
          </div>
          <div>
            <label className="block text-gray-300 text-sm mb-1">Custo (bps)</label>
            <input
              type="number"
              className="w-full bg-gray-700 text-white rounded px-3 py-2"
              value={form.costBps}
              onChange={(e) => setForm((f) => ({ ...f, costBps: Number(e.target.value) }))}
              min={0}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 text-sm mb-1">Janela (horas)</label>
              <input
                type="number"
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
                value={form.hoursBack}
                onChange={(e) => setForm((f) => ({ ...f, hoursBack: Number(e.target.value) }))}
                min={6}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm mb-1">Horizon (labels)</label>
              <input
                type="number"
                className="w-full bg-gray-700 text-white rounded px-3 py-2"
                value={form.labelHorizon}
                onChange={(e) => setForm((f) => ({ ...f, labelHorizon: Number(e.target.value) }))}
                min={1}
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="px-4 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Iniciando…' : 'Iniciar Treino'}
            </button>
          </div>
        </form>
      </section>

      {/* 2) Experimentos recentes */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-white font-semibold mb-3">Experimentos Recentes</h2>
        {experiments.length === 0 ? (
          <div className="text-gray-400 text-sm">Nenhum experimento encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-gray-200">
              <thead className="text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">Selecionar</th>
                  <th className="px-3 py-2 text-left">ID</th>
                  <th className="px-3 py-2 text-left">Modelo</th>
                  <th className="px-3 py-2 text-left">Símbolos</th>
                  <th className="px-3 py-2 text-left">Δt</th>
                  <th className="px-3 py-2 text-left">Barra</th>
                  <th className="px-3 py-2 text-left">Tamanho</th>
                  <th className="px-3 py-2 text-left">Custo (bps)</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Criado</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((e) => (
                  <tr key={e.id} className="border-t border-gray-700">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="accent-cyan-600"
                        checked={selectedExpIds.includes(e.id)}
                        onChange={(ev) =>
                          setSelectedExpIds((old) =>
                            ev.target.checked ? [...old, e.id] : old.filter((x) => x !== e.id)
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">{e.id}</td>
                    <td className="px-3 py-2 uppercase">{e.model}</td>
                    <td className="px-3 py-2 truncate max-w-[260px]" title={e.symbolList.join(', ')}>
                      {e.symbolList.join(', ')}
                    </td>
                    <td className="px-3 py-2">{e.dtSeconds}s</td>
                    <td className="px-3 py-2">{e.eventBarType}</td>
                    <td className="px-3 py-2">{e.eventBarSize}</td>
                    <td className="px-3 py-2">{e.costBps}</td>
                    <td className="px-3 py-2">
                      <span className={
                        e.status === 'running' ? 'text-yellow-400' : e.status === 'completed' ? 'text-green-400' : e.status === 'failed' ? 'text-red-400' : 'text-gray-300'
                      }>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{e.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3) Comparador de Experimentos */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-white font-semibold mb-3">Comparador de Experimentos</h2>
        {selectedExperiments.length < 1 ? (
          <div className="text-gray-400 text-sm">Selecione 1–3 experimentos para comparar.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedExperiments.map((e) => (
              <div key={e.id} className="bg-gray-900 rounded p-3">
                <div className="text-gray-300 text-sm mb-2">{e.id} – {e.model.toUpperCase()}</div>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>Δt: {e.dtSeconds}s</li>
                  <li>Barra: {e.eventBarType} / {e.eventBarSize}</li>
                  <li>Custo: {e.costBps} bps</li>
                  <li>Símbolos: {e.symbolList.slice(0, 6).join(', ')}{e.symbolList.length > 6 ? '…' : ''}</li>
                </ul>
                {selectedExperiments[0]?.id === e.id && (
                  <div className="mt-3">
                    <div className="text-gray-300 text-xs mb-1">Métrica (logloss – MVP)</div>
                    <div className="h-24 bg-gray-800 rounded p-2 overflow-y-auto">
                      {liveMetrics.length === 0 ? (
                        <div className="text-gray-500 text-xs">Sem pontos ainda…</div>
                      ) : (
                        <ul className="text-gray-400 text-[11px] space-y-0.5">
                          {liveMetrics.slice(-20).map((p, index) => (
                            <li key={`${p.step}-${p.name}-${index}`}>step {p.step}: {p.value.toFixed(4)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="text-gray-300 text-xs mb-1 mt-3">Feature Importance</div>
                    <div className="h-40 bg-gray-800 rounded p-2 overflow-y-auto">
                      {importance.length === 0 ? (
                        <div className="text-gray-500 text-xs">Sem dados…</div>
                      ) : (
                        <ul className="text-gray-400 text-[11px] space-y-0.5">
                          {importance.slice(0, 20).map((it, index) => (
                            <li key={`${it.feature}-${index}`} className="flex items-center gap-2">
                              <span className="w-32 truncate" title={it.feature}>{it.feature}</span>
                              <div className="flex-1 bg-gray-700 rounded h-2">
                                <div className="bg-cyan-600 h-2 rounded" style={{ width: `${Math.min(100, (it.importance || 0) / (importance[0]?.importance || 1) * 100)}%` }} />
                              </div>
                              <span>{(it.importance).toFixed(1)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4) Backtest & Validação OOS */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-white font-semibold mb-3">Backtest & Validação OOS</h2>
        {selectedExperiments.length === 0 ? (
          <div className="text-gray-400 text-sm">Selecione 1 experimento para backtest.</div>
        ) : (
          <div className="space-y-6">
            {/* Backtest In-Sample */}
            <div>
              <h3 className="text-gray-300 text-sm mb-2">Backtest In-Sample (mesmos dados do treino)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">Long ≥</label>
                      <input type="number" step="0.01" min={0.5} max={1} className="w-full bg-gray-700 text-white rounded px-3 py-2" value={btForm.long} onChange={(e)=>handleBtFormChange({long:Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">Short ≤</label>
                      <input type="number" step="0.01" min={0} max={0.5} className="w-full bg-gray-700 text-white rounded px-3 py-2" value={btForm.short} onChange={(e)=>handleBtFormChange({short:Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">Custo (bps)</label>
                      <input type="number" min={0} className="w-full bg-gray-700 text-white rounded px-3 py-2" value={btForm.costBps} onChange={(e)=>handleBtFormChange({costBps:Number(e.target.value)})} />
                    </div>
                  </div>
                  <button className="mt-3 px-4 py-2 rounded bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-50" disabled={btLoading} onClick={()=>runBacktest(selectedExperiments[0].id)}>
                    {btLoading ? 'Rodando…' : 'Rodar Backtest'}
                  </button>
                  {bt && (
                    <div className="mt-3 space-y-3">
                      <ul className="text-gray-300 text-sm space-y-1">
                        <li>PnL acumulado: {bt.metrics.cum_pnl.toFixed(4)}</li>
                        <li>Sharpe: {bt.metrics.sharpe.toFixed(2)}</li>
                        <li>Hit rate: {(bt.metrics.hit_rate*100).toFixed(1)}%</li>
                        <li>Max DD: {bt.metrics.max_drawdown.toFixed(4)}</li>
                        <li>Operações: {bt.operations?.length || 0}</li>
                        {bt.metrics.signal_counts && (
                          <>
                            <li className="text-gray-400 text-xs">Sinais: Long {bt.metrics.signal_counts.long}, Short {bt.metrics.signal_counts.short}, Neutro {bt.metrics.signal_counts.neutral}</li>
                            <li className="text-gray-400 text-xs">Barras: {bt.metrics.total_bars}</li>
                            <li className="text-gray-400 text-xs">Pontos: {bt.points.length}</li>
                          </>
                        )}
                      </ul>
                      {bt.operations && bt.operations.length > 0 && (
                        <button 
                          className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-500 text-sm"
                          onClick={() => downloadOperationsExcel(bt.operations, `backtest_${selectedExperiments[0].id}`)}
                        >
                          📊 Baixar Operações (Excel)
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <div className="text-gray-300 text-xs mb-1">Curva de Capital (In-Sample)</div>
                  <div className="h-48 bg-gray-900 rounded p-2 overflow-y-auto">
                    {!bt || bt.points.length === 0 ? (
                      <div className="text-gray-500 text-xs">Sem dados…</div>
                    ) : (
                      <svg viewBox={`0 0 400 160`} className="w-full h-full">
                        {(() => {
                          const xs = bt.points.map(p=>p.i)
                          const ys = bt.points.map(p=>p.p)
                          const xMin = Math.min(...xs), xMax = Math.max(...xs)
                          const yMin = Math.min(...ys), yMax = Math.max(...ys)
                          const xw = Math.max(1, xMax - xMin)
                          const yh = Math.max(1e-9, yMax - yMin)
                          const pts = bt.points.map(p=>{
                            const x = 10 + (p.i - xMin) / xw * 380
                            const y = 150 - (p.p - yMin) / yh * 140
                            return `${x},${y}`
                          }).join(' ')
                          return <polyline fill="none" stroke="#06b6d4" strokeWidth="2" points={pts} />
                        })()}
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Validação OOS */}
            <div>
              <h3 className="text-gray-300 text-sm mb-2">Validação Out-of-Sample (teste em ativos/período diferentes)</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">Símbolos de Teste (CSV)</label>
                      <input type="text" className="w-full bg-gray-700 text-white rounded px-3 py-2" value={oosForm.testSymbols} onChange={(e)=>handleOosFormChange({testSymbols:e.target.value})} placeholder="ITUB4,BBDC4" />
                    </div>
                    <div>
                      <label className="block text-gray-300 text-sm mb-1">Janela de Teste (horas)</label>
                      <input type="number" min={6} className="w-full bg-gray-700 text-white rounded px-3 py-2" value={oosForm.testHours} onChange={(e)=>handleOosFormChange({testHours:Number(e.target.value)})} />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">Long ≥</label>
                        <input type="number" step="0.01" min={0.5} max={1} className="w-full bg-gray-700 text-white rounded px-3 py-2" value={oosForm.long} onChange={(e)=>handleOosFormChange({long:Number(e.target.value)})} />
                      </div>
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">Short ≤</label>
                        <input type="number" step="0.01" min={0} max={0.5} className="w-full bg-gray-700 text-white rounded px-3 py-2" value={oosForm.short} onChange={(e)=>handleOosFormChange({short:Number(e.target.value)})} />
                      </div>
                      <div>
                        <label className="block text-gray-300 text-sm mb-1">Custo (bps)</label>
                        <input type="number" min={0} className="w-full bg-gray-700 text-white rounded px-3 py-2" value={oosForm.costBps} onChange={(e)=>handleOosFormChange({costBps:Number(e.target.value)})} />
                      </div>
                    </div>
                  </div>
                  <button className="mt-3 px-4 py-2 rounded bg-green-600 text-white hover:bg-green-500 disabled:opacity-50" disabled={oosLoading} onClick={()=>runOOSValidation(selectedExperiments[0].id)}>
                    {oosLoading ? 'Rodando…' : 'Rodar Validação OOS'}
                  </button>
                  {oos && (
                    <div className="mt-3 space-y-3">
                      <ul className="text-gray-300 text-sm space-y-1">
                        <li>Teste: {oos.test_symbols.join(', ')} ({oos.test_hours_back}h)</li>
                        <li>Barras: {oos.metrics.test_bars}</li>
                        <li>PnL OOS: {oos.metrics.cum_pnl.toFixed(4)}</li>
                        <li>Sharpe OOS: {oos.metrics.sharpe.toFixed(2)}</li>
                        <li>Hit rate OOS: {(oos.metrics.hit_rate*100).toFixed(1)}%</li>
                        <li>Max DD OOS: {oos.metrics.max_drawdown.toFixed(4)}</li>
                        <li>Operações: {oos.operations?.length || 0}</li>
                        {oos.metrics.signal_counts && (
                          <>
                            <li className="text-gray-400 text-xs">Sinais: Long {oos.metrics.signal_counts.long}, Short {oos.metrics.signal_counts.short}, Neutro {oos.metrics.signal_counts.neutral}</li>
                          </>
                        )}
                      </ul>
                      {oos.operations && oos.operations.length > 0 && (
                        <button 
                          className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-500 text-sm"
                          onClick={() => downloadOperationsExcel(oos.operations, `oos_${selectedExperiments[0].id}`)}
                        >
                          📊 Baixar Operações (Excel)
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <div className="text-gray-300 text-xs mb-1">Curva de Capital (Out-of-Sample)</div>
                  <div className="h-48 bg-gray-900 rounded p-2 overflow-y-auto">
                    {!oos || oos.points.length === 0 ? (
                      <div className="text-gray-500 text-xs">Sem dados…</div>
                    ) : (
                      <svg viewBox={`0 0 400 160`} className="w-full h-full">
                        {(() => {
                          const xs = oos.points.map(p=>p.i)
                          const ys = oos.points.map(p=>p.p)
                          const xMin = Math.min(...xs), xMax = Math.max(...xs)
                          const yMin = Math.min(...ys), yMax = Math.max(...ys)
                          const xw = Math.max(1, xMax - xMin)
                          const yh = Math.max(1e-9, yMax - yMin)
                          const pts = oos.points.map(p=>{
                            const x = 10 + (p.i - xMin) / xw * 380
                            const y = 150 - (p.p - yMin) / yh * 140
                            return `${x},${y}`
                          }).join(' ')
                          return <polyline fill="none" stroke="#10b981" strokeWidth="2" points={pts} />
                        })()}
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 5) Saúde dos Dados e Latência (placeholder) */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-white font-semibold mb-3">Saúde dos Dados & Latência</h2>
        <div className="text-gray-400 text-sm">Resumo do pipeline de event bars e métricas de latência (em breve).</div>
      </section>
    </div>
  )
}


