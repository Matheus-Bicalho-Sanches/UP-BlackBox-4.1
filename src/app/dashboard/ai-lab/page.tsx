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
}

type MetricPoint = { step: number; value: number; name: string; ts: string }

export default function AILabPage() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_ML_API_BASE_URL || 'http://localhost:8010'
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [liveMetrics, setLiveMetrics] = useState<MetricPoint[]>([])

  // Form state (MVP)
  const [form, setForm] = useState({
    model: 'lightgbm' as Experiment['model'],
    symbols: 'ABEV3,PETR4,VALE3',
    dtSeconds: 10,
    eventBarType: 'trades' as Experiment['eventBarType'],
    eventBarSize: 200,
    costBps: 3,
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

  async function fetchLiveMetrics(expId: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/ml/experiments/${expId}/metrics`)
      if (!res.ok) return [] as MetricPoint[]
      return (await res.json()) as MetricPoint[]
    } catch {
      return [] as MetricPoint[]
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
      } else {
        setLiveMetrics([])
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
                          {liveMetrics.slice(-20).map((p) => (
                            <li key={p.step}>step {p.step}: {p.value.toFixed(4)}</li>
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

      {/* 4) Backtest (placeholder) */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-white font-semibold mb-3">Backtest</h2>
        <div className="text-gray-400 text-sm">Configure e execute um backtest após o treino (em breve).</div>
      </section>

      {/* 5) Saúde dos Dados e Latência (placeholder) */}
      <section className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-white font-semibold mb-3">Saúde dos Dados & Latência</h2>
        <div className="text-gray-400 text-sm">Resumo do pipeline de event bars e métricas de latência (em breve).</div>
      </section>
    </div>
  )
}


