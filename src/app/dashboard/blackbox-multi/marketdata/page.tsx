"use client";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/config/firebase";
import { collection, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import MarketChart from "@/components/charts/MarketChart";
import VolumeChart from "@/components/charts/VolumeChart";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogicalRange } from "lightweight-charts";
import type { Candle } from "@/hooks/useRealtimeCandles";

export default function BlackBoxMultiMarketDataPage() {
  const [input, setInput] = useState("");
  const [exchange, setExchange] = useState<"B" | "F">("B");
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [range, setRange] = useState<LogicalRange | null>(null);
  const [bollingerEnabled, setBollingerEnabled] = useState(false);
  const [bollingerParams, setBollingerParams] = useState<{ period: number; deviation: number; type: 'SMA' | 'EMA' }>({ period: 20, deviation: 2, type: 'SMA' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempParams, setTempParams] = useState<{ period: number; deviation: number; type: 'SMA' | 'EMA' }>(bollingerParams);
  const [candles, setCandles] = useState<Candle[]>([]);

  const handleSaveParams = () => {
    setBollingerParams(tempParams);
    setIsDialogOpen(false);
  };

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "activeSubscriptions"));
        const list = snap.docs.map((d) => d.id).sort((a, b) => a.localeCompare(b));
        setSubscribed(list);
        if (list.length > 0 && !tracking) setTracking(list[0]);
      } catch (err) {
        console.error(err);
        setError("Falha ao carregar assinaturas ativas");
      }
    })();
  }, []);

  useEffect(() => {
    setRange(null);
  }, [timeframe, tracking]);

  // Fetch histórico do backend com refresh periódico (sem live)
  useEffect(() => {
    if (!tracking) return;
    let timer: NodeJS.Timeout | null = null;

    const fetchCandles = async () => {
      try {
        const limitMap: Record<string, number> = { "1m": 600, "5m": 1000, "15m": 1500, "60m": 2000, "1d": 2000, "1w": 2000 };
        const limit = limitMap[timeframe] || 600;
        const url = `/api/candles?symbol=${encodeURIComponent(tracking)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`;
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) throw new Error("candles_fetch_failed");
        const rows = (await resp.json()) as any[];
        const normalized: Candle[] = rows.map((r) => ({
          t: Number(r.t),
          o: Number(r.o),
          h: Number(r.h),
          l: Number(r.l),
          c: Number(r.c),
          v: Number(r.v ?? 0),
          vf: r.vf != null ? Number(r.vf) : 0,
        }));
        // filtra candles vazios
        const filtered = normalized.filter((c) => {
          const noVolume = (c.v ?? 0) === 0 && (c.vf ?? 0) === 0;
          const noPriceMove = c.o === c.c && c.h === c.l;
          return !(noVolume || noPriceMove);
        });
        setCandles(filtered);
      } catch (e) {
        console.error(e);
        setError("Falha ao carregar candles");
      }
    };

    fetchCandles();
    timer = setInterval(fetchCandles, 7000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [tracking, timeframe]);

  const handleSubscribe = async () => {
    const ticker = input.trim().toUpperCase();
    if (!ticker) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/market/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, exchange }),
      });
      if (!resp.ok) throw new Error("subscribe_failed");
      setSubscribed((prev) => {
        const updated = prev.includes(ticker) ? prev : [...prev, ticker].sort((a, b) => a.localeCompare(b));
        if (!tracking) setTracking(updated[0] ?? ticker);
        return updated;
      });
      setInput("");
    } catch (e: any) {
      setError("Falha ao assinar ativo");
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch("/api/market/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      if (!resp.ok) throw new Error("unsubscribe_failed");
      setSubscribed((prev) => {
        const updated = prev.filter((t) => t !== ticker);
        if (tracking === ticker) {
          const next = [...updated].sort((a, b) => a.localeCompare(b))[0] ?? null;
          setTracking(next);
        }
        return updated;
      });
    } catch (e: any) {
      setError("Falha ao remover assinatura");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl text-white font-semibold">MarketData</h2>
      <div className="flex items-center space-x-4">
        <div>
          <label className="block text-gray-300 mb-1">Tempo gráfico</label>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 rounded bg-gray-800 text-white focus:outline-none"
          >
            <option value="1m">1 minuto</option>
            <option value="5m">5 minutos</option>
            <option value="15m">15 minutos</option>
            <option value="60m">60 minutos</option>
            <option value="1d">Diário</option>
            <option value="1w">Semanal</option>
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="bollinger"
            checked={bollingerEnabled}
            onCheckedChange={(checked) => setBollingerEnabled(!!checked)}
            className="border border-white"
          />
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Label htmlFor="bollinger" className="text-gray-300 cursor-pointer">
                Bollinger
              </Label>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Configurações de Bollinger Bands</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="period" className="text-right">
                    Período
                  </Label>
                  <Input
                    id="period"
                    type="number"
                    value={tempParams.period}
                    onChange={(e) => setTempParams({ ...tempParams, period: Number(e.target.value) })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="deviation" className="text-right">
                    Desvio Padrão
                  </Label>
                  <Input
                    id="deviation"
                    type="number"
                    value={tempParams.deviation}
                    onChange={(e) => setTempParams({ ...tempParams, deviation: Number(e.target.value) })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="type" className="text-right">
                    Tipo de Média
                  </Label>
                  <Select
                    value={tempParams.type}
                    onValueChange={(value) => setTempParams({ ...tempParams, type: value as 'SMA' | 'EMA' })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SMA">Aritmética (SMA)</SelectItem>
                      <SelectItem value="EMA">Exponencial (EMA)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSaveParams}>Salvar</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {tracking && (
        <div className="space-y-2">
          <div className="text-gray-400 text-sm font-medium uppercase">{tracking}</div>
          <div className="bg-gray-800 p-4 rounded">
            <MarketChart
              candles={candles}
              onRangeChange={setRange}
              syncRange={range}
              bollingerEnabled={bollingerEnabled}
              bollingerParams={bollingerParams}
            />
          </div>
          <hr className="border-gray-700" />
          <div className="text-gray-400 text-sm font-medium">Volume financeiro</div>
          <div className="bg-gray-800 p-4 rounded">
            <VolumeChart candles={candles} syncRange={range} />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-gray-300 mb-1">Código do ativo</label>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="px-4 py-2 rounded bg-gray-800 text-white focus:outline-none"
            placeholder="PETR4"
          />
        </div>
        <div>
          <label className="block text-gray-300 mb-1">Mercado</label>
          <select
            value={exchange}
            onChange={(e) => setExchange(e.target.value as "B" | "F")}
            className="px-4 py-2 rounded bg-gray-800 text-white focus:outline-none"
          >
            <option value="B">Ações (B3)</option>
            <option value="F">Futuros (BMF)</option>
          </select>
        </div>
        <Button onClick={handleSubscribe} disabled={loading}>Acompanhar</Button>
        {error && <div className="text-red-500 text-sm">{error}</div>}
      </div>

      {subscribed.length > 0 && (
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-gray-300 mb-2">Ativos acompanhados</h3>
          <ul className="space-y-2">
            {subscribed.map((t) => (
              <li key={t} className="flex items-center space-x-4">
                <button
                  onClick={() => setTracking(t)}
                  className={`uppercase font-mono text-sm ${
                    tracking === t ? "text-yellow-400" : "text-blue-400 hover:underline"
                  }`}
                >
                  {t}
                </button>
                <Button variant="destructive" size="sm" onClick={() => handleUnsubscribe(t)} disabled={loading}>
                  Excluir
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


