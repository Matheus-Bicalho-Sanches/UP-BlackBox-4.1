"use client";
import { useEffect, useState } from "react";
import { db } from "@/config/firebase";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";

export interface Candle {
  t: number; // unix ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vf?: number; // volume financeiro
}

export function useRealtimeCandles(ticker: string, timeframe: string = "1m") {
  const [data, setData] = useState<Candle[]>([]);

  useEffect(() => {
    if (!ticker) return;

    // Sempre buscamos do candles_1m e agregamos no client-side para timeframes maiores
    const histRef = collection(db, "marketDataDLL", ticker, `candles_1m`);

    // Limite dinâmico baseado no timeframe para carregar histórico suficiente
    const limitMap: Record<string, number> = {
      "1m": 200,
      "5m": 1000,  // ~5 horas de 1m
      "15m": 3000, // ~2 dias
      "60m": 5000, // ~2 semanas
      "1d": 10000, // ~1 mês (assumindo ~390 1m/dia)
      "1w": 20000, // ~2 meses
    };
    const histLimit = limitMap[timeframe] || 200;

    const q = query(histRef, orderBy("t", "desc"), limit(histLimit));

    let unsubLive: (() => void) | null = null;

    getDocs(q).then((snap) => {
      const hist = snap.docs.map((d) => d.data() as Candle);
      // Ordenamos ascending após fetch (pois query foi descendente para pegar mais recentes)
      hist.sort((a, b) => a.t - b.t);
      setData(hist);
    });

    // Sempre ouvimos o documento de candle corrente de 1 minuto para ter dados em tempo real
    {
      const currentDoc = doc(db, "marketDataDLL", ticker, "current", "1m");
      unsubLive = onSnapshot(currentDoc, (d) => {
        const cur = d.data() as Candle;
        if (!cur) return;
        setData((prev) => {
          const out = [...prev];
          const idx = out.findIndex((c) => c.t === cur.t);
          if (idx >= 0) {
            out[idx] = cur;
          } else {
            out.push(cur);
            if (out.length > 200) out.shift();
          }
          return [...out];
        });
      });
    }

    return () => {
      unsubLive && unsubLive();
    };
  }, [ticker, timeframe]);

  return data;
} 