"use client";

import { useState, useEffect } from "react";
import { db } from "@/config/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Subscription {
  id: string;
  ticker: string;
  exchange: string;
  updatedAt?: any;
}

export default function AcompanhamentoPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [ticker, setTicker] = useState("");
  const [exchange, setExchange] = useState<"B" | "F">("B");

  // Carregar subscriptions em tempo real
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
            updatedAt: data.updatedAt,
          });
        });
        setSubscriptions(subs);
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao carregar subscriptions:", err);
        setError("Erro ao carregar lista de ativos");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleAdd = async () => {
    if (!ticker.trim()) {
      setError("Por favor, informe o ticker");
      return;
    }

    const tickerUpper = ticker.trim().toUpperCase();
    setAdding(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/market/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: tickerUpper, exchange }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao adicionar ativo");
      }

      setSuccess(`Ativo ${tickerUpper} adicionado com sucesso!`);
      setTicker("");
      setExchange("B");
    } catch (err: any) {
      setError(err.message || "Erro ao adicionar ativo");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (tickerToRemove: string) => {
    if (!confirm(`Deseja realmente remover o ativo ${tickerToRemove}?`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/market/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: tickerToRemove }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao remover ativo");
      }

      setSuccess(`Ativo ${tickerToRemove} removido com sucesso!`);
    } catch (err: any) {
      setError(err.message || "Erro ao remover ativo");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 p-6 rounded-lg">
        <h1 className="text-2xl font-bold text-white mb-6">Acompanhamento de Ativos</h1>

        {/* Mensagens de feedback */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded text-red-300">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-500 rounded text-green-300">
            {success}
          </div>
        )}

        {/* Formulário de adição */}
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <h2 className="text-lg font-semibold text-white mb-4">Adicionar Novo Ativo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="ticker" className="text-gray-300 mb-2 block">
                Ticker
              </Label>
              <Input
                id="ticker"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="Ex: WING26"
                className="bg-gray-800 text-white border-gray-600"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleAdd();
                  }
                }}
              />
            </div>
            <div>
              <Label htmlFor="exchange" className="text-gray-300 mb-2 block">
                Exchange
              </Label>
              <Select value={exchange} onValueChange={(value) => setExchange(value as "B" | "F")}>
                <SelectTrigger className="bg-gray-800 text-white border-gray-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="B">B3 (Ações)</SelectItem>
                  <SelectItem value="F">BMF (Futuros)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleAdd}
                disabled={adding || !ticker.trim()}
                className="w-full bg-cyan-600 hover:bg-cyan-700"
              >
                {adding ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </div>
        </div>

        {/* Lista de ativos */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">
            Ativos Acompanhados ({subscriptions.length})
          </h2>
          {loading ? (
            <div className="text-gray-400 text-center py-8">Carregando...</div>
          ) : subscriptions.length === 0 ? (
            <div className="text-gray-400 text-center py-8">
              Nenhum ativo acompanhado. Adicione um ativo acima.
            </div>
          ) : (
            <div className="bg-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-300 font-semibold">Ticker</th>
                    <th className="px-4 py-3 text-left text-gray-300 font-semibold">Exchange</th>
                    <th className="px-4 py-3 text-right text-gray-300 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr
                      key={sub.id}
                      className="border-t border-gray-600 hover:bg-gray-600/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-white font-mono">{sub.ticker}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {sub.exchange === "B" ? "B3 (Ações)" : "BMF (Futuros)"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemove(sub.ticker)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remover
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

