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
  const [storageInfo, setStorageInfo] = useState<{
    url: string | null;
    path: string | null;
    size: number | null;
    format: string | null;
    saved: boolean;
    count: number;
    hasMore: boolean;
  } | null>(null);

  const handleSearch = async () => {
    if (!ticker || !startDate || !endDate) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);
    setError(null);
    setData([]);
    setStorageInfo(null);

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

      console.log("🔍 Iniciando requisição de ticks...");
      console.log("📍 URL:", `${API_URL}/history/ticks`);
      console.log("📋 Parâmetros:", { ticker: ticker.toUpperCase(), start: startFormatted, end: endFormatted });

      // Criar AbortController para timeout
      // Calcula timeout dinamicamente: 1 minuto por dia, mínimo 2 minutos, máximo 10 minutos
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const dynamicTimeout = Math.min(Math.max(daysDiff * 60, 120), 600) * 1000; // Entre 2min e 10min
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.log(`⏱️ Timeout após ${dynamicTimeout / 1000} segundos`);
      }, dynamicTimeout);

      let res: Response;
      try {
        res = await fetch(`${API_URL}/history/ticks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticker: ticker.toUpperCase(),
            start: startFormatted,
            end: endFormatted,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      console.log("✅ Resposta recebida:", res.status, res.statusText);

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Erro na resposta:", errorText);
        throw new Error(`Erro na requisição (${res.status}): ${res.statusText}`);
      }

      const json = await res.json();
      console.log("📦 Dados recebidos:", json.count, "ticks");

      if (json.error) {
        throw new Error(json.error);
      }

      const ticks = json.ticks || [];
      setData(ticks);
      
      // Capturar informações do Storage
      setStorageInfo({
        url: json.storage_url || null,
        path: json.storage_path || null,
        size: json.file_size || null,
        format: json.file_format || null,
        saved: json.saved || false,
        count: json.count || ticks.length,
        hasMore: json.has_more || false,
      });
      
      if (ticks.length === 0) {
        setError("Nenhum dado encontrado para o período.");
      } else if (ticks.length < 50) {
        // Aviso se vierem poucos ticks (pode indicar período sem dados ou fora do histórico)
        const startDateObj = new Date(startDate);
        const endDateObj = new Date(endDate);
        const daysDiff = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const ticksPerDay = (ticks.length / daysDiff).toFixed(1);
        
        if (Number(ticksPerDay) < 10) {
          setError(`⚠️ Poucos ticks coletados: ${ticks.length} para ${daysDiff} dia(s) (média: ${ticksPerDay} ticks/dia). Isso pode indicar:\n- Período sem negociação (fins de semana/feriados)\n- Datas fora do histórico disponível (últimos 90 dias)\n- Problemas na conexão com a DLL\n\nTente datas mais recentes ou verifique se há dados disponíveis para o período.`);
        }
      }
    } catch (err: any) {
      console.error("❌ Erro capturado:", err);
      if (err.name === 'AbortError') {
        const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const timeoutMinutes = Math.min(Math.max(daysDiff, 2), 10);
        setError(`Timeout: A requisição demorou mais de ${timeoutMinutes} minuto(s). Para períodos maiores, os dados podem demorar mais. Tente um período menor ou aguarde mais tempo.`);
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        setError(`Erro de conexão: Não foi possível conectar ao backend em ${process.env.NEXT_PUBLIC_PROFIT_FEED_URL || "http://localhost:8001"}. Verifique se o dispatcher está rodando.`);
      } else {
        setError(err.message || "Erro ao buscar dados");
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticker}_${startDate}_${endDate}.json`;
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
    a.href = url;
    a.download = `${ticker}_${startDate}_${endDate}.csv`;
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
                <p className="text-lg">
                  Total de ticks: <span className="font-bold text-cyan-400">{storageInfo?.count || data.length}</span>
                  {storageInfo?.hasMore && (
                    <span className="text-sm text-yellow-400 ml-2">(mostrando preview de {data.length})</span>
                  )}
                </p>
                <p className="text-sm text-gray-400">
                  Primeiro: {data[0]?.t} | Último: {data[data.length-1]?.t}
                </p>
                {storageInfo?.saved && storageInfo.url && (
                  <div className="mt-2 p-2 bg-green-900/30 border border-green-700 rounded text-sm">
                    <p className="text-green-400">✅ Dados salvos no Firebase Storage</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Tamanho: {storageInfo.size ? `${(storageInfo.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'} | 
                      Formato: {storageInfo.format || 'N/A'}
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex gap-3 flex-wrap">
                {storageInfo?.url && (
                  <Button 
                    onClick={() => window.open(storageInfo.url!, '_blank')}
                    className="bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    📥 Baixar do Storage
                  </Button>
                )}
                <Button variant="outline" onClick={downloadJSON} className="border-gray-600 text-gray-200 hover:bg-gray-700 hover:text-white">
                  Download JSON (Preview)
                </Button>
                <Button onClick={downloadCSV} className="bg-green-600 hover:bg-green-700 text-white">
                  Download CSV (Preview)
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
                {data.slice(0, 50).map((tick, i) => (
                  <div key={i} className="bg-gray-800 p-2 border-b border-gray-700/50 grid grid-cols-6 font-mono text-xs text-gray-300 hover:bg-gray-700/50">
                    <div>{tick.t.split("T")[1]?.slice(0,12) || tick.t}</div>
                    <div>{tick.p}</div>
                    <div>{tick.q}</div>
                    <div>{tick.v}</div>
                    <div className="truncate" title={String(tick.ts)}>{tick.ts.toFixed(3)}</div>
                    <div>{tick.id}</div>
                  </div>
                ))}
                {(storageInfo?.hasMore || data.length > 50) && (
                  <div className="p-2 text-center text-xs text-gray-500 italic bg-gray-900/50 border-t border-gray-700">
                    {storageInfo?.saved && storageInfo.url ? (
                      <>
                        Mostrando apenas os primeiros 50 ticks de {storageInfo.count} coletados. 
                        {" "}Use o botão "📥 Baixar do Storage" para baixar todos os {storageInfo.count} ticks completos.
                      </>
                    ) : (
                      <>
                        Mostrando apenas os primeiros 50 ticks de {data.length} coletados. 
                        {" "}Use "Download JSON" ou "Download CSV" para baixar todos os dados.
                      </>
                    )}
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



