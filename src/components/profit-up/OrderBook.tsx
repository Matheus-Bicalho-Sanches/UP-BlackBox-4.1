"use client";

import { OrderBookEntry } from "@/lib/profit-up/mockData";

interface OrderBookProps {
  book: OrderBookEntry[];
  asset: string;
  lastPrice: number;
  variation: number;
  volume: number;
  trades: number;
}

export default function OrderBook({
  book,
  asset,
  lastPrice,
  variation,
  volume,
  trades,
}: OrderBookProps) {
  // Separar compras e vendas
  // Compras em ordem decrescente (melhor bid primeiro)
  const buyOrders = book.filter((o) => o.buyQuantity > 0).sort((a, b) => b.price - a.price);
  // Vendas em ordem crescente (melhor ask primeiro)
  const sellOrders = book.filter((o) => o.sellQuantity > 0).sort((a, b) => a.price - b.price);
  
  const totalBuyVolume = buyOrders.reduce((sum, o) => sum + o.buyQuantity, 0);
  const totalSellVolume = sellOrders.reduce((sum, o) => sum + o.sellQuantity, 0);
  const totalVolume = totalBuyVolume + totalSellVolume;
  const buyPercentage = totalVolume > 0 ? (totalBuyVolume / totalVolume) * 100 : 50;
  
  // Determinar quantas linhas mostrar (máximo entre compras e vendas)
  const maxRows = Math.max(buyOrders.length, sellOrders.length);

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
        <div className="text-sm text-gray-300 space-y-1">
          <div>Último: <span className="font-mono text-white">{lastPrice.toFixed(3)}</span></div>
          <div className="flex space-x-4 text-xs">
            <span>Volume: <span className="font-mono">{volume.toFixed(2)}B</span></span>
            <span>Negócios: <span className="font-mono">{trades.toLocaleString()}</span></span>
          </div>
        </div>
        
        {/* Volume Distribution Bar */}
        <div className="mt-3 h-2 bg-gray-700 rounded overflow-hidden flex">
          <div
            className="bg-blue-500"
            style={{ width: `${buyPercentage}%` }}
          />
          <div
            className="bg-red-500"
            style={{ width: `${100 - buyPercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>({totalBuyVolume.toLocaleString()}) {buyPercentage.toFixed(0)}%</span>
          <span>({totalSellVolume.toLocaleString()}) {(100 - buyPercentage).toFixed(0)}%</span>
        </div>
      </div>

      {/* Order Book Table */}
      <div className="flex-1 overflow-hidden">
        <div className="grid grid-cols-2 gap-2 text-xs font-mono h-full overflow-y-auto">
          {/* Header */}
          <div className="text-gray-400 font-semibold">Compra</div>
          <div className="text-gray-400 font-semibold text-right">Venda</div>

          {/* Orders - lado a lado */}
          {Array.from({ length: maxRows }).map((_, idx) => {
            const buyOrder = buyOrders[idx];
            const sellOrder = sellOrders[idx];
            
            return (
              <div key={idx} className="contents">
                {/* Compra */}
                <div className={`px-2 py-1 rounded ${
                  idx === 0 
                    ? "bg-blue-600 text-white font-bold" 
                    : "bg-blue-900/30 text-blue-300"
                }`}>
                  {buyOrder ? (
                    <div>
                      <div className="font-semibold">{buyOrder.price.toFixed(3)}</div>
                      <div className="text-xs opacity-75">
                        {buyOrder.buyOffers} ofert / {buyOrder.buyQuantity.toLocaleString()}
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-600">-</div>
                  )}
                </div>
                
                {/* Venda */}
                <div className={`px-2 py-1 rounded text-right ${
                  idx === 0 
                    ? "bg-red-600 text-white font-bold" 
                    : "bg-red-900/30 text-red-300"
                }`}>
                  {sellOrder ? (
                    <div>
                      <div className="font-semibold">{sellOrder.price.toFixed(3)}</div>
                      <div className="text-xs opacity-75">
                        {sellOrder.sellQuantity.toLocaleString()} / {sellOrder.sellOffers} ofert
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-600">-</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

