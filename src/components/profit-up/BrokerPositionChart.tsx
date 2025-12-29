"use client";

import { useEffect, useRef } from "react";
import { createChart, ISeriesApi, Time, LineSeries, LineSeriesPartialOptions } from "lightweight-charts";
import { BrokerPosition } from "@/lib/profit-up/mockData";

interface BrokerPositionChartProps {
  positions: BrokerPosition[];
  asset: string;
}

const BROKER_COLORS: Record<string, string> = {
  XP: "#fbbf24", // yellow
  BTG: "#ef4444", // red
  Genial: "#a855f7", // purple
  Merrill: "#f97316", // orange
  Morgan: "#22c55e", // green
  UBS: "#3b82f6", // blue
  Ideal: "#06b6d4", // cyan
  "BGC Liquidez": "#8b5cf6",
  Toro: "#ec4899",
  Itau: "#14b8a6",
};

export default function BrokerPositionChart({ positions, asset }: BrokerPositionChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<"Line", Time>>>(new Map());

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = createChart(chartRef.current, {
        width: chartRef.current.clientWidth,
        height: 300,
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
        },
        rightPriceScale: {
          borderColor: "#334155",
        },
      });

      // Create series for each broker
      positions.forEach((position) => {
        const color = BROKER_COLORS[position.broker] || "#cbd5e1";
        const series = chartInstanceRef.current!.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          title: position.broker,
        } as LineSeriesPartialOptions);
        seriesRefs.current.set(position.broker, series);
      });
    }

    // Update data
    positions.forEach((position) => {
      const series = seriesRefs.current.get(position.broker);
      if (series) {
        const data = position.balanceHistory.map((point) => {
          // Convert time string (HH:MM) to timestamp
          const [hours, minutes] = point.time.split(":").map(Number);
          const today = new Date();
          today.setHours(hours, minutes, 0, 0);
          return {
            time: (today.getTime() / 1000) as Time,
            value: point.balance,
          };
        });
        series.setData(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (chartInstanceRef.current && chartRef.current) {
        chartInstanceRef.current.applyOptions({ width: chartRef.current.clientWidth });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [positions]);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-bold text-white mb-4">Saldo (Qtd) - {asset}</h3>
      <div className="grid grid-cols-3 gap-4">
        {/* Chart */}
        <div className="col-span-2">
          <div ref={chartRef} className="w-full" />
        </div>

        {/* Statistics Table */}
        <div className="col-span-1">
          <div className="bg-gray-900 rounded p-3">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Estatísticas por Corretora</h4>
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-5 gap-2 text-gray-400 font-semibold border-b border-gray-700 pb-1">
                <div>Corretora</div>
                <div className="text-right">%</div>
                <div className="text-right">Vol. Fin.</div>
                <div className="text-right">Vol. Qtd</div>
                <div className="text-right">Média</div>
              </div>
              {positions.slice(0, 10).map((position, idx) => {
                const color = BROKER_COLORS[position.broker] || "#cbd5e1";
                return (
                  <div
                    key={idx}
                    className="grid grid-cols-5 gap-2 text-gray-300 border-b border-gray-700/50 pb-1"
                  >
                    <div className="flex items-center space-x-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span>{position.broker}</span>
                    </div>
                    <div className="text-right font-mono">{position.percentage.toFixed(2)}%</div>
                    <div className="text-right font-mono">
                      {(position.financialVolume / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-right font-mono">{position.quantityVolume.toLocaleString()}</div>
                    <div className="text-right font-mono">{position.averagePrice.toFixed(3)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

