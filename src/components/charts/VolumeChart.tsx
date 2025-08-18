"use client";
import { useEffect, useRef } from "react";
import {
  createChart,
  ISeriesApi,
  Time,
  HistogramSeries,
  HistogramSeriesPartialOptions,
  LogicalRange,
} from "lightweight-charts";
import { Candle } from "@/hooks/useRealtimeCandles";
import { formatTime } from "@/lib/timezone";

interface Props {
  candles: Candle[];
  syncRange?: LogicalRange | null;
}

export default function VolumeChart({ candles, syncRange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<ISeriesApi<"Histogram", Time> | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (!chartRef.current) {
      const two = (v: number) => v.toString().padStart(2, "0");

      chartRef.current = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 120,
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
        HistogramSeries,
        {
          color: "#3b82f6",
          priceFormat: { type: "volume" },
        } as HistogramSeriesPartialOptions
      );
    }
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    const formatted = candles.map((c) => ({
      time: (c.t / 1000) as Time,
      value: c.vf ?? 0,
    }));
    seriesRef.current.setData(formatted);
  }, [candles]);

  // apply external range
  useEffect(() => {
    if (!chartRef.current || !syncRange) return;
    chartRef.current.timeScale().setVisibleLogicalRange(syncRange);
  }, [syncRange]);

  return <div ref={containerRef} className="w-full" />;
} 