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
  height?: number;
}

export default function ProfitCandlestickChart({ 
  candles, 
  onRangeChange, 
  syncRange,
  height = 500 
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick", Time> | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!chartRef.current) {
      chartRef.current = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: height,
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
        rightPriceScale: {
          borderColor: "#334155",
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

      chartRef.current.applyOptions({
        localization: {
          timeFormatter: (timestamp: number) => formatFullDateTime(timestamp as number),
        },
      });

      if (onRangeChange) {
        chartRef.current.timeScale().subscribeVisibleLogicalRangeChange((newRange) => {
          onRangeChange(newRange);
        });
      }
    }

    // Handle resize
    const handleResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update data
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
  }, [candles]);

  // Apply external sync range
  useEffect(() => {
    if (!chartRef.current || !syncRange) return;
    chartRef.current.timeScale().setVisibleLogicalRange(syncRange);
  }, [syncRange]);

  return <div ref={containerRef} className="w-full" />;
}

