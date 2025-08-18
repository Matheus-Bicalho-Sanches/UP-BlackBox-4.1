"use client";
import { Candle } from "@/hooks/useRealtimeCandles";

// Uniformiza a fonte live: usa diretamente a base proveniente do Firestore,
// que já agrega histórico + candle corrente (via doc current/1m) em useRealtimeCandles.
export function useLiveCurrentCandle(
  ticker: string,
  base: Candle[] = [],
  timeframe: string = "1m"
) {
  return base;
}