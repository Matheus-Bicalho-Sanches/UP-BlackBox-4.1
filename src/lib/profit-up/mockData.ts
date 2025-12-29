import { Candle } from "@/hooks/useRealtimeCandles";

export interface Asset {
  code: string;
  period: string;
  variation: number;
  lastPrice: number;
  volume: number;
  trades: number;
  max: number;
  min: number;
  open: number;
  close: number;
}

export interface OrderBookEntry {
  buyOffers: number;
  buyQuantity: number;
  price: number;
  sellQuantity: number;
  sellOffers: number;
}

export interface Trade {
  timestamp: string;
  buyer: string;
  price: number;
  quantity: number;
  seller: string;
  aggressor: "Comprador" | "Vendedor" | "RLP";
}

export interface BrokerPosition {
  broker: string;
  percentage: number;
  financialVolume: number;
  quantityVolume: number;
  averagePrice: number;
  balanceHistory: Array<{ time: string; balance: number }>;
}

const BROKERS = ["XP", "BTG", "Genial", "Merrill", "Morgan", "UBS", "Ideal", "BGC Liquidez", "Toro", "Itau"];
const ASSETS = ["WING26", "DI1F33", "VALE3", "IFIX", "MCCI11", "PSSA3", "IBOV"];

// Gerar candles fictícios
export function generateMockCandles(
  asset: string,
  timeframe: string,
  count: number = 200
): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  
  // Base price varia por ativo
  const basePrice: Record<string, number> = {
    WING26: 163.0,
    DI1F33: 12.5,
    VALE3: 65.0,
    IFIX: 2800.0,
    MCCI11: 95.0,
    PSSA3: 8.5,
    IBOV: 125000.0,
  };
  
  const base = basePrice[asset] || 100.0;
  let currentPrice = base;
  
  // Intervalo em ms baseado no timeframe
  const intervalMap: Record<string, number> = {
    "1m": 60 * 1000,
    "5m": 5 * 60 * 1000,
    "60m": 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
  };
  const interval = intervalMap[timeframe] || 60 * 1000;
  
  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * interval;
    
    // Variação de preço aleatória mas realista
    const change = (Math.random() - 0.5) * 0.02; // ±1%
    currentPrice = currentPrice * (1 + change);
    
    const open = i === 0 ? base : candles[i - 1].c;
    const close = currentPrice;
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = Math.floor(Math.random() * 10000 + 1000);
    const financialVolume = volume * close;
    
    candles.push({
      t: timestamp,
      o: Number(open.toFixed(2)),
      h: Number(high.toFixed(2)),
      l: Number(low.toFixed(2)),
      c: Number(close.toFixed(2)),
      v: volume,
      vf: Number(financialVolume.toFixed(2)),
    });
  }
  
  return candles;
}

// Gerar book de ofertas
export function generateMockOrderBook(asset: string, lastPrice: number): OrderBookEntry[] {
  const book: OrderBookEntry[] = [];
  const spread = lastPrice * 0.0001; // 0.01% de spread
  
  // Gerar ofertas de compra (preços abaixo do último)
  for (let i = 10; i >= 1; i--) {
    const price = lastPrice - (spread * i);
    const quantity = Math.floor(Math.random() * 5000 + 100);
    const offers = Math.floor(Math.random() * 20 + 1);
    
    book.push({
      price: Number(price.toFixed(3)),
      buyQuantity: quantity,
      buyOffers: offers,
      sellQuantity: 0,
      sellOffers: 0,
    });
  }
  
  // Melhor oferta de compra e venda (spread)
  book.push({
    price: Number(lastPrice.toFixed(3)),
    buyQuantity: Math.floor(Math.random() * 200 + 50),
    buyOffers: Math.floor(Math.random() * 15 + 1),
    sellQuantity: Math.floor(Math.random() * 200 + 50),
    sellOffers: Math.floor(Math.random() * 15 + 1),
  });
  
  // Gerar ofertas de venda (preços acima do último)
  for (let i = 1; i <= 10; i++) {
    const price = lastPrice + (spread * i);
    const quantity = Math.floor(Math.random() * 5000 + 100);
    const offers = Math.floor(Math.random() * 20 + 1);
    
    book.push({
      price: Number(price.toFixed(3)),
      buyQuantity: 0,
      buyOffers: 0,
      sellQuantity: quantity,
      sellOffers: offers,
    });
  }
  
  return book;
}

// Gerar histórico de negócios
export function generateMockTrades(asset: string, count: number = 50): Trade[] {
  const trades: Trade[] = [];
  const now = Date.now();
  const basePrice: Record<string, number> = {
    WING26: 163.0,
    DI1F33: 12.5,
    VALE3: 65.0,
    IFIX: 2800.0,
    MCCI11: 95.0,
    PSSA3: 8.5,
    IBOV: 125000.0,
  };
  
  const lastPrice = basePrice[asset] || 100.0;
  
  for (let i = 0; i < count; i++) {
    const timestamp = new Date(now - (count - i) * 1000);
    const hours = timestamp.getHours().toString().padStart(2, "0");
    const minutes = timestamp.getMinutes().toString().padStart(2, "0");
    const seconds = timestamp.getSeconds().toString().padStart(2, "0");
    const ms = timestamp.getMilliseconds().toString().padStart(3, "0");
    
    const buyer = BROKERS[Math.floor(Math.random() * BROKERS.length)];
    const seller = BROKERS[Math.floor(Math.random() * BROKERS.length)];
    const price = lastPrice + (Math.random() - 0.5) * 0.1;
    const quantity = Math.floor(Math.random() * 20 + 1);
    const aggressor = Math.random() > 0.5 
      ? (Math.random() > 0.7 ? "RLP" : "Comprador")
      : "Vendedor";
    
    trades.push({
      timestamp: `${hours}:${minutes}:${seconds}.${ms}`,
      buyer,
      price: Number(price.toFixed(3)),
      quantity,
      seller,
      aggressor: aggressor as "Comprador" | "Vendedor" | "RLP",
    });
  }
  
  return trades.reverse(); // Mais recentes primeiro
}

// Gerar dados de posição por corretora
export function generateMockBrokerPositions(asset: string): BrokerPosition[] {
  const positions: BrokerPosition[] = [];
  const basePrice: Record<string, number> = {
    WING26: 163.0,
    DI1F33: 12.5,
    VALE3: 65.0,
    IFIX: 2800.0,
    MCCI11: 95.0,
    PSSA3: 8.5,
    IBOV: 125000.0,
  };
  
  const lastPrice = basePrice[asset] || 100.0;
  
  // Gerar horários do dia (09:00 até 18:00)
  const timePoints: string[] = [];
  for (let h = 9; h <= 18; h++) {
    for (let m = 0; m < 60; m += 5) {
      timePoints.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }
  
  BROKERS.forEach((broker, index) => {
    const percentage = Math.random() * 15 + 2; // 2-17%
    const quantityVolume = Math.floor(Math.random() * 20000 + 5000);
    const financialVolume = quantityVolume * lastPrice;
    const averagePrice = lastPrice + (Math.random() - 0.5) * 0.5;
    
    // Gerar histórico de saldo com tendência única por corretora
    const initialBalance = (Math.random() - 0.5) * 30000;
    const trend = (Math.random() - 0.5) * 2; // Tendência por minuto
    const balanceHistory = timePoints.map((time, i) => {
      const balance = initialBalance + (trend * i) + (Math.random() - 0.5) * 5000;
      return { time, balance: Math.round(balance) };
    });
    
    positions.push({
      broker,
      percentage: Number(percentage.toFixed(2)),
      financialVolume: Number(financialVolume.toFixed(2)),
      quantityVolume,
      averagePrice: Number(averagePrice.toFixed(3)),
      balanceHistory,
    });
  });
  
  // Ordenar por porcentagem (maior primeiro)
  return positions.sort((a, b) => b.percentage - a.percentage);
}

// Gerar informações de ativos
export function generateMockAssets(): Asset[] {
  const basePrices: Record<string, number> = {
    WING26: 163.0,
    DI1F33: 12.5,
    VALE3: 65.0,
    IFIX: 2800.0,
    MCCI11: 95.0,
    PSSA3: 8.5,
    IBOV: 125000.0,
  };
  
  const periods = ["1min", "5Min", "60min", "1D"];
  
  return ASSETS.flatMap((code) => {
    const basePrice = basePrices[code];
    return periods.map((period) => {
      const variation = (Math.random() - 0.5) * 2; // -1% a +1%
      const lastPrice = basePrice * (1 + variation / 100);
      
      return {
        code,
        period,
        variation: Number(variation.toFixed(2)),
        lastPrice: Number(lastPrice.toFixed(2)),
        volume: Math.random() * 500 + 100,
        trades: Math.floor(Math.random() * 1000000 + 100000),
        max: lastPrice * 1.02,
        min: lastPrice * 0.98,
        open: lastPrice * (1 + (Math.random() - 0.5) * 0.01),
        close: lastPrice,
      };
    });
  });
}

