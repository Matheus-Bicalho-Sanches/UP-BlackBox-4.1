"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface Tick {
  t: string;
  ts: number;
  p: number;
  q: number;
  v: number;
  id: number;
}

export default function RequestTicksPage() {
  const [ticker, setTicker] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Tick[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!ticker || !startDate || !endDate) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);
    setError(null);
    setData([]);

    try {
      // Formatar datas para dd/MM/yyyy se vierem do input type="date" (yyyy-MM-dd)
      const formatDate = (d: string) => {
        const [y, m, d_] = d.split("-");
        return `${d_}/${m}/${y}`;
      };

      const startFormatted = formatDate(startDate);
      const endFormatted = formatDate(endDate);

      // URL do backend (dispatcher)
      // Ajuste conforme seu ambiente: se estiver rodando local, pode ser localhost:8001
      // Se estiver em prod, use a variável de ambiente pública
      const API_URL = process.env.NEXT_PUBLIC_PROFIT_FEED_URL || "http://localhost:8001";

      const res = await fetch(`${API_URL}/history/ticks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: ticker.toUpperCase(),
          start: startFormatted,
          end: endFormatted,
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro na requisição: ${res.statusText}`);
      }

      const json = await res.json();
      if (json.error) {
        throw new Error(json.error);
      }

      setData(json.ticks || []);
      if ((json.ticks || []).length === 0) {
        setError("Nenhum dado encontrado para o período.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao buscar dados");
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = `${ticker}_${startDate}_${endDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadCSV = () => {
    if (!data.length) return;
    
    // Headers
    const headers = ["Timestamp", "Date", "Price", "Quantity", "Volume", "TradeID"];
    const rows = data.map(t => [
      t.ts,
      t.t,
      t.p,
      t.q,
      t.v,
      t.id
    ].join(","));
    
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = `${ticker}_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Requisitar Ticks (DLL)</h1>
      
      <Card className="bg-gray-800 border-gray-700 text-gray-100">
        <CardHeader>
          <CardTitle>Parâmetros de Extração</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Ticker</label>
              <Input 
                value={ticker} 
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="Ex: WINZ24" 
                className="bg-gray-900 border-gray-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Início</label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-gray-900 border-gray-600 text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data Fim</label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-gray-900 border-gray-600 text-white"
              />
            </div>
            <div>
              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extraindo...
                  </>
                ) : (
                  "Extrair Ticks"
                )}
              </Button>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-200 rounded">
              {error}
            </div>
          )}
        </CardContent>
      </Card>

      {data.length > 0 && (
        <Card className="bg-gray-800 border-gray-700 text-gray-100">
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-lg">Total de ticks: <span className="font-bold text-cyan-400">{data.length}</span></p>
                <p className="text-sm text-gray-400">
                  Primeiro: {data[0]?.t} | Último: {data[data.length-1]?.t}
                </p>
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={downloadJSON} className="border-gray-600 text-gray-200 hover:bg-gray-700 hover:text-white">
                  Download JSON
                </Button>
                <Button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white">
                  Download CSV
                </Button>
              </div>
            </div>

            <div className="mt-6 border border-gray-700 rounded overflow-hidden">
              <div className="bg-gray-900 p-2 border-b border-gray-700 grid grid-cols-6 font-mono text-xs text-gray-400 font-bold">
                <div>DATA/HORA</div>
                <div>PREÇO</div>
                <div>QTD</div>
                <div>VOL</div>
                <div>TS</div>
                <div>ID</div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {data.slice(0, 100).map((tick, i) => (
                  <div key={i} className="bg-gray-800 p-2 border-b border-gray-700/50 grid grid-cols-6 font-mono text-xs text-gray-300 hover:bg-gray-700/50">
                    <div>{tick.t.split("T")[1]?.slice(0,12) || tick.t}</div>
                    <div>{tick.p}</div>
                    <div>{tick.q}</div>
                    <div>{tick.v}</div>
                    <div className="truncate" title={String(tick.ts)}>{tick.ts.toFixed(3)}</div>
                    <div>{tick.id}</div>
                  </div>
                ))}
                {data.length > 100 && (
                  <div className="p-2 text-center text-xs text-gray-500 italic">
                    ... e mais {data.length - 100} ticks ...
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}



