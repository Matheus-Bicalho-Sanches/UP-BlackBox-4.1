"use client";
import { useEffect, useState } from "react";
import { Candle } from "@/hooks/useRealtimeCandles";

export function useLiveCurrentCandle(
  ticker: string,
  base: Candle[] = [],
  timeframe: string = "1m"
) {
  // Mantém a ordem de hooks estável em todas as execuções
  const [live, setLive] = useState<Candle | null>(null);

  // Faz o fetch do candle corrente para qualquer timeframe, pois usaremos 1m como base
  useEffect(() => {
    if (!ticker) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/market/current?ticker=${ticker}`);
        if (!res.ok) return;
        const data = (await res.json()) as Candle;
        setLive(data);
      } catch (err) {
        console.error("fetchLive", err);
      }
    };

    // Faz a primeira chamada imediatamente e depois a cada 2 s
    fetchLive();
    timer = setInterval(fetchLive, 2000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [ticker, timeframe]);

  // Combina o candle "ao vivo" com a base, independente do timeframe
  const mergeCandles = () => {
    if (!live) return base;

    const idx = base.findIndex((c) => c.t === live.t);
    if (idx >= 0) {
      const out = [...base];
      out[idx] = live;
      return out;
    }
    return [...base, live];
  };

  return mergeCandles();
} 