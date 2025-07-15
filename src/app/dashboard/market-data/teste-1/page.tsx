"use client";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import MarketChart from "@/components/charts/MarketChart";
import VolumeChart from "@/components/charts/VolumeChart";
import { useRealtimeCandles } from "@/hooks/useRealtimeCandles";
import { useLiveCurrentCandle } from "@/hooks/useLiveCurrentCandle";
import { db } from "@/config/firebase";
import { collection, getDocs } from "firebase/firestore";
import { LogicalRange } from "lightweight-charts";
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

export default function Teste1Page() {
  const [input, setInput] = useState("");
  const [exchange, setExchange] = useState<"B" | "F">("B");
  const [tracking, setTracking] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<string>("1m");
  const [subscribed, setSubscribed] = useState<string[]>([]);
  const baseCandles = useRealtimeCandles(tracking ?? "", timeframe);
  const merged = useLiveCurrentCandle(tracking ?? "", baseCandles, timeframe);
  const [bollingerEnabled, setBollingerEnabled] = useState(false);
  const [bollingerParams, setBollingerParams] = useState<{ period: number; deviation: number; type: 'SMA' | 'EMA' }>({ period: 20, deviation: 2, type: 'SMA' });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [tempParams, setTempParams] = useState<{ period: number; deviation: number; type: 'SMA' | 'EMA' }>(bollingerParams);
  const handleSaveParams = () => {
    setBollingerParams(tempParams);
    setIsDialogOpen(false);
  };

  // Aggregation helper
  const aggregateCandles = (data: any[], tf: string) => {
    if (tf === "1m") return data;
    const map: Record<string, any> = {};
    const result: any[] = [];
    const tfMap: Record<string, number> = { "5m":5, "15m":15, "60m":60 };
    if (tf in tfMap) {
      const size = tfMap[tf];
      data.forEach(c=>{
        const date = new Date(c.t);
        // key by epoch minute group
        const minutes = Math.floor(date.getUTCMinutes() / size)*size;
        const keyDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), minutes));
        const key = keyDate.getTime();
        const bucket = map[key] ||= { t:key, o:c.o, h:c.h, l:c.l, c:c.c, v:0, vf:0 };
        bucket.h = Math.max(bucket.h, c.h);
        bucket.l = Math.min(bucket.l, c.l);
        bucket.c = c.c;
        bucket.v += c.v;
        if(c.vf) bucket.vf = (bucket.vf||0)+c.vf;
      });
    } else if (tf === "1d" || tf === "1w") {
      data.forEach(c=>{
        const d = new Date(c.t);
        let key:string;
        if (tf === "1d") {
          key = d.toISOString().slice(0,10);
        } else {
          const y = d.getUTCFullYear();
          const firstJan = new Date(Date.UTC(y,0,1));
          const week = Math.floor(((d.getTime()-firstJan.getTime())/86400000 + firstJan.getUTCDay()+1)/7);
          key = `${y}-W${week}`;
        }
        const bucket = map[key] ||= { t:c.t, o:c.o, h:c.h, l:c.l, c:c.c, v:0, vf:0 };
        bucket.h = Math.max(bucket.h, c.h);
        bucket.l = Math.min(bucket.l, c.l);
        bucket.c = c.c;
        bucket.v += c.v;
        if(c.vf) bucket.vf = (bucket.vf||0)+c.vf;
      });
      // convert key order to date order
      return Object.values(map).sort((a:any,b:any)=>a.t-b.t);
    }
    return Object.values(map).sort((a:any,b:any)=>a.t-b.t);
  };

  const candles = useMemo(() => {
    const agg = aggregateCandles(merged, timeframe);
    // Remove candles sem negociação (volume = 0 ou volume financeiro = 0)
    return agg.filter((c:any) => {
      const noVolume = (c.v ?? 0) === 0 && (c.vf ?? 0) === 0;
      const noPriceMove = c.o === c.c && c.h === c.l;
      return !(noVolume || noPriceMove);
    });
  }, [merged, timeframe]);

  const [range, setRange] = useState<LogicalRange | null>(null);

  // Ao mudar o timeframe ou o ativo acompanhado, limpamos o range salvo
  // para que o gráfico use o range padrão para o novo conjunto de dados.
  useEffect(() => {
    setRange(null);
  }, [timeframe, tracking]);

  // Load persisted subs once
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, "activeSubscriptions"));
        const list = snap.docs.map((d) => d.id);
        setSubscribed(list);
        if (list.length > 0 && !tracking) {
          setTracking(list[0]);
        }
      } catch (err) {
        console.error("Falha ao carregar activeSubscriptions", err);
      }
    })();
  }, []);

  const handleTrack = async () => {
    if (!input) return;
    const ticker = input.toUpperCase();
    try {
      await fetch("/api/market/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, exchange }),
      });
      setTracking(ticker);
      setSubscribed((prev) => (prev.includes(ticker) ? prev : [...prev, ticker]));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUnsubscribe = async (ticker: string) => {
    try {
      await fetch("/api/market/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSubscribed((prev) => prev.filter((t) => t !== ticker));
      if (tracking === ticker) {
        setTracking((prev) => {
          const rest = subscribed.filter((t) => t !== ticker);
          return rest.length > 0 ? rest[0] : null;
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div>
          <label className="block text-gray-300 mb-1">Tempo gráfico</label>
          <select
            value={timeframe}
            onChange={(e)=>setTimeframe(e.target.value)}
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
      <div className="flex space-x-4 items-end">
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
        <Button onClick={handleTrack}>Acompanhar</Button>
      </div>
      {subscribed.length > 0 && (
        <div className="bg-gray-800 p-4 rounded">
          <h3 className="text-gray-300 mb-2">Ativos acompanhados</h3>
          {/* Ordena alfabeticamente antes de renderizar */}
          <ul className="space-y-2">
            {[...subscribed].sort((a, b) => a.localeCompare(b)).map((t) => (
              <li key={t} className="flex items-center space-x-4">
                <button
                  onClick={() => setTracking(t)}
                  className={`uppercase font-mono text-sm ${
                    tracking === t ? "text-yellow-400" : "text-blue-400 hover:underline"
                  }`}
                >
                  {t}
                </button>
                <Button variant="destructive" size="sm" onClick={() => handleUnsubscribe(t)}>
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