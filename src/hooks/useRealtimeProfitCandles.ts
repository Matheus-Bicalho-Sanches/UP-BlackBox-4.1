"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export interface ProfitCandle {
  t: number; // timestamp em ms
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  vf?: number; // volume financeiro
}

interface CandleUpdate {
  type: string;
  symbol: string;
  exchange: string;
  timeframe: string;
  data: {
    symbol: string;
    exchange: string;
    timestamp: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    volumeFinancial: number;
    tickCount: number;
    isClosed: boolean;
  };
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3002";

export function useRealtimeProfitCandles(
  symbol: string | null,
  exchange: string = "B",
  timeframe: string = "1m"
) {
  const [candles, setCandles] = useState<ProfitCandle[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  // Carrega histórico inicial
  const loadHistory = useCallback(async () => {
    if (!symbol) return;

    try {
      const response = await fetch(
        `/api/candles?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}&timeframe=${encodeURIComponent(timeframe)}&limit=200`
      );

      if (!response.ok) {
        throw new Error("Falha ao carregar histórico");
      }

      const data = await response.json();
      const normalized: ProfitCandle[] = data.map((c: any) => ({
        t: Number(c.t),
        o: Number(c.o),
        h: Number(c.h),
        l: Number(c.l),
        c: Number(c.c),
        v: Number(c.v ?? 0),
        vf: c.vf != null ? Number(c.vf) : 0,
      }));

      setCandles(normalized);
    } catch (err: any) {
      console.error("Erro ao carregar histórico:", err);
      setError(err.message);
    }
  }, [symbol, exchange, timeframe]);

  // Conecta ao WebSocket
  const connect = useCallback(() => {
    if (!symbol || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket conectado");
        setIsConnected(true);
        setError(null);
        reconnectAttempts.current = 0;

        // Subscribe no símbolo
        ws.send(
          JSON.stringify({
            type: "subscribe",
            symbol,
            exchange,
            timeframe,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "candle") {
            const update = message as CandleUpdate;
            
            // Converte timestamp ISO para ms
            const timestamp = new Date(update.data.timestamp).getTime();

            setCandles((prev) => {
              const updated = [...prev];
              const index = updated.findIndex((c) => c.t === timestamp);

              const candle: ProfitCandle = {
                t: timestamp,
                o: update.data.open,
                h: update.data.high,
                l: update.data.low,
                c: update.data.close,
                v: update.data.volume,
                vf: update.data.volumeFinancial,
              };

              if (index >= 0) {
                // Atualiza candle existente
                updated[index] = candle;
              } else {
                // Adiciona novo candle
                updated.push(candle);
                // Mantém apenas os últimos 500 candles
                if (updated.length > 500) {
                  updated.shift();
                }
              }

              // Ordena por timestamp
              updated.sort((a, b) => a.t - b.t);

              return updated;
            });
          } else if (message.type === "pong") {
            // Resposta ao ping
          } else if (message.type === "error") {
            console.error("Erro do WebSocket:", message.message);
            setError(message.message);
          }
        } catch (err) {
          console.error("Erro ao processar mensagem WebSocket:", err);
        }
      };

      ws.onerror = (err) => {
        console.error("Erro no WebSocket:", err);
        setError("Erro na conexão WebSocket");
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log("WebSocket desconectado");
        setIsConnected(false);

        // Tenta reconectar
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Tentando reconectar (tentativa ${reconnectAttempts.current})...`);
            connect();
          }, delay);
        } else {
          setError("Não foi possível reconectar ao WebSocket");
        }
      };
    } catch (err: any) {
      console.error("Erro ao conectar WebSocket:", err);
      setError(err.message);
      setIsConnected(false);
    }
  }, [symbol, exchange, timeframe]);

  // Desconecta
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      // Unsubscribe antes de fechar
      if (symbol) {
        wsRef.current.send(
          JSON.stringify({
            type: "unsubscribe",
            symbol,
            exchange,
            timeframe,
          })
        );
      }

      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, [symbol, exchange, timeframe]);

  // Efeito principal
  useEffect(() => {
    if (!symbol) {
      setCandles([]);
      disconnect();
      return;
    }

    // Carrega histórico
    loadHistory();

    // Conecta ao WebSocket
    connect();

    // Ping periódico para manter conexão
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000); // A cada 30 segundos

    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, [symbol, exchange, timeframe, loadHistory, connect, disconnect]);

  return {
    candles,
    isConnected,
    error,
    reconnect: connect,
  };
}

