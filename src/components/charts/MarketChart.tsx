"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  ISeriesApi,
  Time,
  CandlestickSeries,
  CandlestickSeriesPartialOptions,
  LogicalRange,
  LineSeries,
  LineSeriesPartialOptions,
} from "lightweight-charts";
import { Candle } from "@/hooks/useRealtimeCandles";
import { formatTime, formatFullDateTime } from "@/lib/timezone";

interface Props {
  candles: Candle[];
  onRangeChange?: (range: LogicalRange | null) => void;
  syncRange?: LogicalRange | null;
  bollingerEnabled?: boolean;
  bollingerParams?: {
    period: number;
    deviation: number;
    type: 'SMA' | 'EMA';
  };
}

export default function MarketChart({ candles, onRangeChange, syncRange, bollingerEnabled, bollingerParams }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const bollingerSeriesRef = useRef<{
    upper: ISeriesApi<"Line", Time> | null;
    middle: ISeriesApi<"Line", Time> | null;
    lower: ISeriesApi<"Line", Time> | null;
  }>({ upper: null, middle: null, lower: null });

  useEffect(() => {
    if (!containerRef.current) return;
    if (!chartRef.current) {
      const two = (v: number) => v.toString().padStart(2, "0");

      chartRef.current = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 400,
        layout: {
          background: { color: "#1f2937" },
          textColor: "#cbd5e1",
        },
        grid: {
          vertLines: { color: "#334155" },
          horzLines: { color: "#334155" },
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          tickMarkFormatter: (ts: number) => formatTime(ts as number),
        },
      });
      seriesRef.current = chartRef.current.addSeries(
        CandlestickSeries,
        {
          upColor: "#22c55e",
          downColor: "#ef4444",
          borderVisible: false,
          wickUpColor: "#22c55e",
          wickDownColor: "#ef4444",
        } as CandlestickSeriesPartialOptions
      );

      // Exibe horário (HH:MM) junto com a data no label do crosshair
      chartRef.current.applyOptions({
        localization: {
          timeFormatter: (timestamp: number) => formatFullDateTime(timestamp as number),
        },
      });

      // subscribe to range change
      if (onRangeChange) {
        chartRef.current.timeScale().subscribeVisibleLogicalRangeChange((newRange) => {
          onRangeChange(newRange);
        });
      }
    }
  }, []);

  // update data
  useEffect(() => {
    if (!seriesRef.current) return;
    const formatted = candles.map((c) => ({
      time: (c.t / 1000) as Time,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    }));
    seriesRef.current.setData(formatted);
    // Calculate and update Bollinger Bands if enabled
    if (bollingerEnabled && bollingerParams && candles.length >= bollingerParams.period) {
      const { period, deviation, type } = bollingerParams;
      const closes = candles.map(c => c.c);
      const middle = type === 'SMA' ? calculateSMA(closes, period) : calculateRollingEMA(closes, period);
      const upper = [];
      const lower = [];
      for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
          upper.push(NaN);
          lower.push(NaN);
          continue;
        }
        const slice = closes.slice(i - period + 1, i + 1);
        const avg = middle[i];
        const stdDev = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / period);
        upper.push(avg + deviation * stdDev);
        lower.push(avg - deviation * stdDev);
      }
      const upperData = upper.map((val, idx) => ({ time: (candles[idx].t / 1000) as Time, value: val })).filter(d => !isNaN(d.value));
      const middleData = middle.map((val, idx) => ({ time: (candles[idx].t / 1000) as Time, value: val })).filter(d => !isNaN(d.value));
      const lowerData = lower.map((val, idx) => ({ time: (candles[idx].t / 1000) as Time, value: val })).filter(d => !isNaN(d.value));
      if (upperData.length > 0) {
        if (!bollingerSeriesRef.current.upper) {
          bollingerSeriesRef.current.upper = chartRef.current!.addSeries(LineSeries, { color: "#f97316", lineWidth: 1 } as LineSeriesPartialOptions);
        }
        bollingerSeriesRef.current.upper.setData(upperData);
      }
      if (middleData.length > 0) {
        if (!bollingerSeriesRef.current.middle) {
          bollingerSeriesRef.current.middle = chartRef.current!.addSeries(LineSeries, { color: "#3b82f6", lineWidth: 1 } as LineSeriesPartialOptions);
        }
        bollingerSeriesRef.current.middle.setData(middleData);
      }
      if (lowerData.length > 0) {
        if (!bollingerSeriesRef.current.lower) {
          bollingerSeriesRef.current.lower = chartRef.current!.addSeries(LineSeries, { color: "#f97316", lineWidth: 1 } as LineSeriesPartialOptions);
        }
        bollingerSeriesRef.current.lower.setData(lowerData);
      }
    } else {
      // Remove series if disabled or insufficient data
      if (bollingerSeriesRef.current.upper) {
        chartRef.current!.removeSeries(bollingerSeriesRef.current.upper);
        bollingerSeriesRef.current.upper = null;
      }
      if (bollingerSeriesRef.current.middle) {
        chartRef.current!.removeSeries(bollingerSeriesRef.current.middle);
        bollingerSeriesRef.current.middle = null;
      }
      if (bollingerSeriesRef.current.lower) {
        chartRef.current!.removeSeries(bollingerSeriesRef.current.lower);
        bollingerSeriesRef.current.lower = null;
      }
    }
  }, [candles, bollingerEnabled, bollingerParams]);

  // apply external sync range
  useEffect(() => {
    if (!chartRef.current || !syncRange) return;
    chartRef.current.timeScale().setVisibleLogicalRange(syncRange);
  }, [syncRange]);

  return <div ref={containerRef} className="w-full" />;
}

function calculateSMA(closes: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    sma.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return sma;
}
function calculateRollingEMA(closes: number[], period: number): number[] {
  const ema: number[] = [];
  const k = 2 / (period + 1);
  // First EMA is simple average
  if (closes.length < period) return ema.fill(NaN, 0, closes.length);
  let prevEma = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(...Array(period - 1).fill(NaN));
  ema.push(prevEma);
  for (let i = period; i < closes.length; i++) {
    prevEma = closes[i] * k + prevEma * (1 - k);
    ema.push(prevEma);
  }
  return ema;
} 