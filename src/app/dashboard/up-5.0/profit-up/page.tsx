"use client";

import { useState, useMemo, useEffect } from "react";
import AssetTabs from "@/components/profit-up/AssetTabs";
import ProfitCandlestickChart from "@/components/profit-up/ProfitCandlestickChart";
import ProfitVolumeChart from "@/components/profit-up/ProfitVolumeChart";
import OrderBook from "@/components/profit-up/OrderBook";
import TradeHistory from "@/components/profit-up/TradeHistory";
import BrokerPositionChart from "@/components/profit-up/BrokerPositionChart";
import {
  generateMockOrderBook,
  generateMockTrades,
  generateMockBrokerPositions,
  Asset,
} from "@/lib/profit-up/mockData";
import { useRealtimeProfitCandles } from "@/hooks/useRealtimeProfitCandles";
import { LogicalRange } from "lightweight-charts";
import { db } from "@/config/firebase";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { formatPrice, formatPercentage } from "@/lib/profit-up/formatNumber";

interface Subscription {
  id: string;
  ticker: string;
  exchange: string;
}

export default function ProfitUpPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("1min");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<string>("B");
  const [range, setRange] = useState<LogicalRange | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  // Carregar subscriptions do Firestore
  useEffect(() => {
    const q = query(
      collection(db, "activeSubscriptions"),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const subs: Subscription[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          subs.push({
            id: doc.id,
            ticker: data.ticker || doc.id,
            exchange: data.exchange || "B",
          });
        });
        setSubscriptions(subs);
        setLoading(false);

        // Seleciona o primeiro asset se não houver seleção
        if (!selectedTicker && subs.length > 0) {
          setSelectedTicker(subs[0].ticker);
          setSelectedExchange(subs[0].exchange);
        }
      },
      (err) => {
        console.error("Erro ao carregar subscriptions:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedTicker]);

  // Mapear período para timeframe
  const timeframeMap: Record<string, string> = {
    "1min": "1m",
    "5Min": "5m",
    "60min": "60m",
    "1D": "1d",
  };
  const timeframe = timeframeMap[selectedPeriod] || "1m";

  // Usar hook de candles em tempo real
  const { candles, isConnected, error: candlesError } = useRealtimeProfitCandles(
    selectedTicker,
    selectedExchange,
    timeframe
  );

  // Converter subscriptions para formato Asset
  const allAssets = useMemo(() => {
    return subscriptions.map((sub) => {
      // Encontrar último candle para obter dados atuais
      const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
      
      return {
        code: sub.ticker,
        exchange: sub.exchange,
        period: selectedPeriod,
        lastPrice: lastCandle?.c || 0,
        open: lastCandle?.o || 0,
        max: lastCandle?.h || 0,
        min: lastCandle?.l || 0,
        close: lastCandle?.c || 0,
        variation: lastCandle
          ? ((lastCandle.c - lastCandle.o) / lastCandle.o) * 100
          : 0,
        volume: lastCandle?.v || 0,
        trades: 0, // TODO: implementar contagem de trades
      } as Asset;
    });
  }, [subscriptions, candles, selectedPeriod]);

  // Asset ativo
  const activeAsset = useMemo(() => {
    if (!selectedTicker) return null;
    return allAssets.find((a) => a.code === selectedTicker) || null;
  }, [selectedTicker, allAssets]);

  // Filtrar assets por período (todos os assets aparecem em todos os períodos)
  const filteredAssets = allAssets;

  // Dados mockados temporários (serão substituídos por dados reais depois)
  const orderBook = useMemo(() => {
    if (!activeAsset) return [];
    return generateMockOrderBook(activeAsset.code, activeAsset.lastPrice);
  }, [activeAsset]);

  const trades = useMemo(() => {
    if (!activeAsset) return [];
    return generateMockTrades(activeAsset.code, 100);
  }, [activeAsset]);

  const brokerPositions = useMemo(() => {
    if (!activeAsset) return [];
    return generateMockBrokerPositions(activeAsset.code);
  }, [activeAsset]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Carregando ativos...</div>
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-gray-400 mb-2">Nenhum ativo subscrito</div>
          <div className="text-sm text-gray-500">
            Adicione ativos na aba "Acompanhamento"
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Bar - Asset Tabs and Period Selector */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <AssetTabs
            assets={filteredAssets}
            activeAsset={activeAsset}
            onAssetSelect={(asset) => {
              setSelectedTicker(asset.code);
              setSelectedExchange(asset.exchange);
              setRange(null); // Reset range when changing asset
            }}
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-gray-300 text-sm">Período:</label>
          <select
            value={selectedPeriod}
            onChange={(e) => {
              setSelectedPeriod(e.target.value);
              setRange(null);
            }}
            className="px-4 py-2 rounded bg-gray-800 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="1min">1 Min</option>
            <option value="5Min">5 Min</option>
            <option value="60min">60 Min</option>
            <option value="1D">1 Dia</option>
          </select>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-4">
        {/* Left Column - Charts */}
        <div className="col-span-7 space-y-4">
          {/* Candlestick Chart */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="mb-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">
                  {activeAsset?.code} {selectedPeriod}
                </h2>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
                  <span className="text-xs text-gray-400">
                    {isConnected ? "Conectado" : "Desconectado"}
                  </span>
                </div>
              </div>
              {candlesError && (
                <div className="text-xs text-red-400 mt-1">{candlesError}</div>
              )}
              <div className="text-sm text-gray-300 space-y-1 mt-2">
                <div className="flex space-x-4">
                  <span>
                    Abr: <span className="font-mono text-white">{activeAsset ? formatPrice(activeAsset.open) : "0,00"}</span>
                  </span>
                  <span>
                    Máx: <span className="font-mono text-white">{activeAsset ? formatPrice(activeAsset.max) : "0,00"}</span>
                  </span>
                  <span>
                    Mín: <span className="font-mono text-white">{activeAsset ? formatPrice(activeAsset.min) : "0,00"}</span>
                  </span>
                  <span>
                    Fch: <span className="font-mono text-white">{activeAsset ? formatPrice(activeAsset.close) : "0,00"}</span>
                  </span>
                </div>
                <div className="flex space-x-4 text-xs">
                  <span>
                    V: <span className={`font-mono ${activeAsset && activeAsset.variation >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {activeAsset && activeAsset.variation >= 0 ? "+" : ""}
                      {activeAsset ? formatPercentage(activeAsset.variation) : "0,00%"}
                    </span>
                  </span>
                  <span>
                    A: <span className="font-mono text-white">{activeAsset ? formatPrice(activeAsset.lastPrice) : "0,00"}</span>
                  </span>
                </div>
              </div>
            </div>
            <ProfitCandlestickChart
              candles={candles}
              onRangeChange={setRange}
              syncRange={range}
              height={400}
            />
          </div>

          {/* Volume Chart */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-gray-300">Volume Financeiro</h3>
              <div className="text-xs text-gray-400 mt-1">
                {candles.reduce((sum, c) => sum + (c.vf || 0), 0).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                  minimumFractionDigits: 2,
                })}
              </div>
            </div>
            <ProfitVolumeChart candles={candles} syncRange={range} />
          </div>
        </div>

        {/* Right Column - Order Book and Trade History */}
        <div className="col-span-5 space-y-4">
          {/* Order Book */}
          <div className="h-[500px]">
            <OrderBook
              book={orderBook}
              asset={activeAsset?.code || ""}
              lastPrice={activeAsset?.lastPrice || 0}
              variation={activeAsset?.variation || 0}
              volume={activeAsset?.volume || 0}
              trades={activeAsset?.trades || 0}
            />
          </div>

          {/* Trade History */}
          <div className="h-[500px]">
            <TradeHistory
              trades={trades}
              asset={activeAsset?.code || ""}
              lastPrice={activeAsset?.lastPrice || 0}
              variation={activeAsset?.variation || 0}
            />
          </div>
        </div>
      </div>

      {/* Bottom Section - Broker Positions */}
      <BrokerPositionChart
        positions={brokerPositions}
        asset={activeAsset?.code || ""}
      />
    </div>
  );
}
