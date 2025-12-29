"use client";

import { useEffect, useRef } from "react";
import { Trade } from "@/lib/profit-up/mockData";

interface TradeHistoryProps {
  trades: Trade[];
  asset: string;
  lastPrice: number;
  variation: number;
}

export default function TradeHistory({
  trades,
  asset,
  lastPrice,
  variation,
}: TradeHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new trades arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [trades]);

  const buyVolume = trades.filter((t) => t.aggressor === "Comprador").reduce((sum, t) => sum + t.quantity, 0);
  const sellVolume = trades.filter((t) => t.aggressor === "Vendedor").reduce((sum, t) => sum + t.quantity, 0);
  const totalVolume = buyVolume + sellVolume;
  const buyPercentage = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;

  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-white">{asset}</h3>
          <span className={`text-sm font-mono ${variation >= 0 ? "text-green-400" : "text-red-400"}`}>
            {variation >= 0 ? "+" : ""}
            {variation.toFixed(2)}%
          </span>
        </div>
        <div className="text-sm text-gray-300">
          <div>Último: <span className="font-mono text-white">{lastPrice.toFixed(3)}</span></div>
        </div>
        
        {/* Volume Distribution Bar */}
        <div className="mt-3 h-2 bg-gray-700 rounded overflow-hidden flex">
          <div
            className="bg-green-500"
            style={{ width: `${buyPercentage}%` }}
          />
          <div
            className="bg-red-500"
            style={{ width: `${100 - buyPercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>({buyVolume.toLocaleString()}) {buyPercentage.toFixed(0)}%</span>
          <span>({sellVolume.toLocaleString()}) {(100 - buyPercentage).toFixed(0)}%</span>
        </div>
      </div>

      {/* Trade Table */}
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <table className="w-full text-xs font-mono">
          <thead className="sticky top-0 bg-gray-900">
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left p-2">Data</th>
              <th className="text-left p-2">Compradora</th>
              <th className="text-right p-2">Valor</th>
              <th className="text-right p-2">Quantidade</th>
              <th className="text-left p-2">Vendedora</th>
              <th className="text-center p-2">Agressor</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, idx) => {
              const aggressorColor =
                trade.aggressor === "Comprador"
                  ? "bg-green-900/30 text-green-300"
                  : trade.aggressor === "Vendedor"
                  ? "bg-red-900/30 text-red-300"
                  : "bg-gray-700/30 text-gray-300";

              return (
                <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="p-2 text-gray-400">{trade.timestamp}</td>
                  <td className="p-2 text-blue-300">{trade.buyer}</td>
                  <td className="p-2 text-right text-white">{trade.price.toFixed(3)}</td>
                  <td className="p-2 text-right text-white">{trade.quantity}</td>
                  <td className="p-2 text-red-300">{trade.seller}</td>
                  <td className={`p-2 text-center ${aggressorColor} rounded`}>
                    {trade.aggressor}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

