"use client";
import React, { useState } from "react";

// Mapeamento dos nomes das colunas para o padrão do sistema
const COLUMN_MAP: Record<string, string> = {
  "Data": "date",
  "Abertura": "open",
  "Máxima": "high",
  "Mínima": "low",
  "Fechamento": "close",
  "Média Móvel A [200]": "sma_200",
  "Média Móvel E [9]": "ema_9",
  "Média Móvel E [20]": "ema_20",
  "Média Móvel E [50]": "ema_50",
  "Bandas de Bollinger A [20]": "bbands_20",
  // Adicione outros mapeamentos se necessário
};

// Ordem e nomes das colunas padrão do sistema
const CSV_COLUMNS = [
  "ticker",
  "date",
  "open",
  "high",
  "low",
  "close",
  "volume",
  "adjustedClose",
];

function parseNumber(value: string) {
  // Troca vírgula por ponto e remove espaços
  const v = value.replace(/\./g, '').replace(/,/g, '.').replace(/\s/g, '');
  return v === '' ? '' : v;
}

function parseDate(value: string) {
  // Se vier só a data, adiciona ' 10:00'
  const trimmed = value.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed + ' 10:00';
  }
  return trimmed;
}

function convertToCSV(rows: any[], columns: string[]) {
  const header = columns.join(',');
  const data = rows.map(row =>
    columns.map(col => row[col] ?? '').join(',')
  );
  return [header, ...data].join('\n');
}

export default function ImportProfitPage() {
  const [ticker, setTicker] = useState("");
  const [rawData, setRawData] = useState("");
  const [fileName, setFileName] = useState("");
  const [feedback, setFeedback] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  function handlePreview() {
    setFeedback("");
    if (!ticker.trim()) {
      setFeedback("Por favor, informe o nome do ativo/ticker.");
      return;
    }
    if (!rawData.trim()) {
      setFeedback("Por favor, cole os dados da base.");
      return;
    }
    const lines = rawData.trim().split(/\r?\n/);
    if (lines.length < 2) {
      setFeedback("Dados insuficientes para processar.");
      return;
    }
    const headers = lines[0].split(/\t|;/).map(h => h.trim());
    const preview = lines.slice(1, 6).map(line => {
      const cols = line.split(/\t|;/);
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h] = cols[i] || "";
      });
      return obj;
    });
    setParsedPreview(preview);
    setFeedback("");
  }

  async function handleImport() {
    setFeedback("");
    setProcessing(true);
    try {
      if (!ticker.trim()) {
        setFeedback("Por favor, informe o nome do ativo/ticker.");
        setProcessing(false);
        return;
      }
      if (!rawData.trim()) {
        setFeedback("Por favor, cole os dados da base.");
        setProcessing(false);
        return;
      }
      if (!fileName.trim()) {
        setFeedback("Por favor, informe o nome do arquivo.");
        setProcessing(false);
        return;
      }
      // Parse lines
      const lines = rawData.trim().split(/\r?\n/);
      const headers = lines[0].split(/\t|;/).map(h => h.trim());
      // Mapear colunas para o padrão do sistema
      const mappedHeaders = headers.map(h => COLUMN_MAP[h] || h);
      // Processar linhas
      const rows = lines.slice(1).map(line => {
        const cols = line.split(/\t|;/);
        const obj: any = {};
        headers.forEach((h, i) => {
          const mapped = COLUMN_MAP[h] || h;
          if (mapped === "date") {
            obj[mapped] = parseDate(cols[i] || "");
          } else if (["open","high","low","close","sma_200","ema_9","ema_20","ema_50","bbands_20"].includes(mapped)) {
            obj[mapped] = parseNumber(cols[i] || "");
          } else {
            obj[mapped] = (cols[i] || "");
          }
        });
        obj["ticker"] = ticker.trim();
        // Garantir que todos os campos do CSV existam
        CSV_COLUMNS.forEach(col => {
          if (!(col in obj) || obj[col] === "") {
            if (col === "volume" || col === "adjustedClose") {
              obj[col] = "0";
            } else {
              obj[col] = "";
            }
          }
        });
        return obj;
      });
      // Gerar CSV na ordem correta
      const csv = convertToCSV(rows, CSV_COLUMNS);
      // Criar arquivo Blob
      const blob = new Blob([csv], { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", blob, fileName.endsWith('.csv') ? fileName : fileName + ".csv");
      // Enviar para o backend
      const res = await fetch("http://localhost:8003/api/upload-csv", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erro ao enviar arquivo para o backend.");
      }
      setFeedback("✅ Base importada e salva com sucesso!");
      setRawData("");
      setFileName("");
      setParsedPreview([]);
    } catch (err: any) {
      setFeedback("❌ " + (err.message || "Erro desconhecido ao importar base."));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="bg-gray-900 min-h-screen rounded-lg shadow p-8 text-white">
      <h1 className="text-2xl font-bold mb-4">Import Profit</h1>
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Nome do ativo/ticker:</label>
        <input
          type="text"
          className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Ex: IBOV, PETR4, etc."
          value={ticker}
          onChange={e => setTicker(e.target.value)}
        />
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Nome do arquivo para salvar:</label>
        <input
          type="text"
          className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Ex: IBOV_2024.csv"
          value={fileName}
          onChange={e => setFileName(e.target.value)}
        />
      </div>
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Cole aqui os dados da base (copie do Excel ou similar):</label>
        <textarea
          className="w-full h-48 border border-gray-300 rounded px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          placeholder="Cole aqui a tabela..."
          value={rawData}
          onChange={e => setRawData(e.target.value)}
        />
      </div>
      <div className="flex gap-4 mb-4">
        <button
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded font-semibold"
          onClick={handlePreview}
          disabled={processing}
        >
          Visualizar dados colados
        </button>
        <button
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded font-semibold"
          onClick={handleImport}
          disabled={processing}
        >
          {processing ? "Importando..." : "Importar e Salvar"}
        </button>
      </div>
      {feedback && <div className={feedback.startsWith("✅") ? "text-green-400 mb-4" : "text-red-400 mb-4"}>{feedback}</div>}
      {parsedPreview.length > 0 && (
        <div className="bg-gray-800 rounded p-4 mt-4">
          <div className="font-semibold mb-2">Prévia dos dados colados:</div>
          <table className="min-w-full text-sm">
            <thead>
              <tr>
                {Object.keys(parsedPreview[0]).map((h) => (
                  <th key={h} className="px-2 py-1 text-cyan-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsedPreview.map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="px-2 py-1 border-b border-gray-700">{String(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 