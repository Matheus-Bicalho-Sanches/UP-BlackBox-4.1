"use client";
import React, { useState, useEffect, useRef } from "react";
import { FiTrash2, FiDownload, FiEye, FiLock, FiUnlock } from "react-icons/fi";

export default function BaseDeDadosPage() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [showBrapiModal, setShowBrapiModal] = useState(false);
  const [bases, setBases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [brapiForm, setBrapiForm] = useState({
    tickers: '',
    range: '6mo',
    interval: '1d',
    tipo: 'stock',
  });
  const [brapiLoading, setBrapiLoading] = useState(false);
  const [brapiError, setBrapiError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [brapiFeedback, setBrapiFeedback] = useState<{ ticker: string, status: 'ok' | 'erro', msg: string }[]>([]);
  const [orderAlpha, setOrderAlpha] = useState(false);
  const [orderRecent, setOrderRecent] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const basesPerPage = 50;
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBases, setSelectedBases] = useState<string[]>([]);

  useEffect(() => {
    fetchBases();
  }, []);

  async function fetchBases() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8003/api/bases");
      if (!res.ok) throw new Error("Erro ao buscar bases de dados");
      const data = await res.json();
      setBases(data);
    } catch (err: any) {
      setError(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError("");
    setSuccessMsg("");
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setUploadError("Por favor, selecione um arquivo CSV.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("http://localhost:8003/api/upload-csv", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Erro ao fazer upload do arquivo");
      setSuccessMsg("Upload realizado com sucesso!");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchBases();
    } catch (err: any) {
      setUploadError("Erro ao fazer upload: " + (err.message || err));
    } finally {
      setUploading(false);
    }
  }

  function handleBrapiChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setBrapiForm({ ...brapiForm, [e.target.name]: e.target.value });
  }

  async function handleBrapiFetch() {
    setBrapiError("");
    setBrapiLoading(true);
    setBrapiFeedback([]);
    const tickers = brapiForm.tickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean);
    for (const ticker of tickers) {
      try {
        const res = await fetch("http://localhost:8003/api/brapi-csv", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...brapiForm, tickers: ticker }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Erro desconhecido");
        setBrapiFeedback(prev => [...prev, { ticker, status: 'ok', msg: 'Arquivo salvo com sucesso!' }]);
      } catch (err: any) {
        setBrapiFeedback(prev => [...prev, { ticker, status: 'erro', msg: err.message || 'Erro desconhecido' }]);
      }
    }
    setBrapiLoading(false);
    setShowBrapiModal(false);
    setSuccessMsg('Processo finalizado. Veja o resultado de cada ticker abaixo.');
    await fetchBases();
  }

  async function handleDelete(base: any) {
    if (!window.confirm(`Tem certeza que deseja excluir a base "${base.nome}"?`)) return;
    setDeletingId(base.id);
    setUploadError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`http://localhost:8003/api/base/${base.id}?storagePath=${encodeURIComponent(base.storagePath)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erro ao excluir base");
      setSuccessMsg("Base excluída com sucesso!");
      await fetchBases();
    } catch (err: any) {
      setUploadError("Erro ao excluir base: " + (err.message || err));
    } finally {
      setDeletingId(null);
    }
  }

  // Filtrar pelo termo de pesquisa antes de ordenar e paginar
  let filteredBases = bases.filter(base => base.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  let basesOrdenadas = [...filteredBases];
  if (orderAlpha) {
    basesOrdenadas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  } else if (orderRecent) {
    basesOrdenadas.sort((a, b) => {
      const aDate = a.criadoEm ? new Date(a.criadoEm).getTime() : 0;
      const bDate = b.criadoEm ? new Date(b.criadoEm).getTime() : 0;
      return bDate - aDate;
    });
  }
  const totalPages = Math.ceil(basesOrdenadas.length / basesPerPage);
  const paginatedBases = basesOrdenadas.slice((currentPage - 1) * basesPerPage, currentPage * basesPerPage);

  // Seleção múltipla
  function handleSelectBase(id: string) {
    setSelectedBases((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  }
  function handleSelectAll() {
    const idsOnPage = paginatedBases.map((b) => b.id);
    const allSelected = idsOnPage.every((id) => selectedBases.includes(id));
    if (allSelected) {
      setSelectedBases((prev) => prev.filter((id) => !idsOnPage.includes(id)));
    } else {
      setSelectedBases((prev) => Array.from(new Set([...prev, ...idsOnPage])));
    }
  }
  function clearSelection() {
    setSelectedBases([]);
  }

  // Exclusão em lote
  async function handleDeleteSelected() {
    if (selectedBases.length === 0) return;
    if (!window.confirm(`Tem certeza que deseja excluir ${selectedBases.length} base(s)?`)) return;
    setUploadError("");
    setSuccessMsg("");
    for (const id of selectedBases) {
      const base = bases.find((b) => b.id === id);
      if (!base) continue;
      setDeletingId(id);
      try {
        const res = await fetch(`http://localhost:8003/api/base/${base.id}?storagePath=${encodeURIComponent(base.storagePath)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Erro ao excluir base");
      } catch (err: any) {
        setUploadError((prev) => prev + `\nErro ao excluir ${base.nome}: ` + (err.message || err));
      }
    }
    setSuccessMsg("Bases excluídas com sucesso!");
    setDeletingId(null);
    clearSelection();
    await fetchBases();
  }

  // Download em lote
  function handleDownloadSelected() {
    if (selectedBases.length === 0) return;
    for (const id of selectedBases) {
      const base = bases.find((b) => b.id === id);
      if (base && base.url) {
        window.open(base.url, '_blank');
      }
    }
  }

  return (
    <div className="bg-gray-900 min-h-screen rounded-lg shadow p-8 text-white">
      {/* Botões */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <button
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded shadow font-semibold"
          onClick={() => setShowTutorial(true)}
        >
          Tutorial
        </button>
        <button
          className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded shadow font-semibold"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? "Enviando..." : "Upload CSV"}
        </button>
        <button
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-2 rounded shadow font-semibold"
          onClick={() => setShowBrapiModal(true)}
        >
          Puxar CSV
        </button>
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Feedback */}
      {uploadError && <div className="text-red-400 mb-4">{uploadError}</div>}
      {successMsg && <div className="text-green-400 mb-4">{successMsg}</div>}
      {brapiFeedback.length > 0 && (
        <div className="mb-4">
          <div className="font-semibold mb-1">Resultado do Brapi:</div>
          <ul className="text-sm">
            {brapiFeedback.map(fb => (
              <li key={fb.ticker} className={fb.status === 'ok' ? 'text-green-600' : 'text-red-500'}>
                {fb.ticker}: {fb.msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtros de ordenação */}
      <div className="flex gap-6 items-center mb-4">
        <span className="font-semibold text-sm">Ordenar por:</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={orderAlpha}
            onChange={() => {
              setOrderAlpha(true);
              setOrderRecent(false);
            }}
            className="accent-cyan-600"
          />
          Alfabética
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={orderRecent}
            onChange={() => {
              setOrderAlpha(false);
              setOrderRecent(true);
            }}
            className="accent-cyan-600"
          />
          Mais recentes
        </label>
      </div>

      {/* Campo de pesquisa */}
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="Pesquisar base de dados..."
          className="w-full max-w-xs border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900"
          value={searchTerm}
          onChange={e => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Paginação */}
      <div className="flex items-center gap-4 mb-2">
        <button
          className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          Anterior
        </button>
        <span className="text-sm">Página {currentPage} de {totalPages}</span>
        <button
          className="px-3 py-1 rounded bg-gray-700 text-white disabled:opacity-50"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          Próxima
        </button>
      </div>

      {/* Botões de ação em lote */}
      <div className="flex gap-4 mb-4">
        <button
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
          onClick={handleDeleteSelected}
          disabled={selectedBases.length === 0}
        >
          Excluir selecionados
        </button>
        <button
          className="bg-cyan-700 hover:bg-cyan-800 text-white px-4 py-2 rounded font-semibold disabled:opacity-50"
          onClick={handleDownloadSelected}
          disabled={selectedBases.length === 0}
        >
          Baixar selecionados
        </button>
        {selectedBases.length > 0 && (
          <span className="text-sm text-cyan-300">{selectedBases.length} selecionado(s)</span>
        )}
      </div>

      {/* Modal de Tutorial */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 rounded-lg shadow-lg max-w-lg w-full p-8 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl"
              onClick={() => setShowTutorial(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-4">Como usar a Base de Dados</h2>
            <div className="space-y-3 text-base">
              <p>Esta página permite que você gerencie as bases de dados históricas utilizadas para backtests.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Faça upload de arquivos CSV contendo dados históricos de ativos.</li>
                <li>Veja todas as bases já cadastradas no sistema na tabela abaixo.</li>
                <li>Em breve, será possível visualizar, editar e remover bases diretamente por aqui.</li>
              </ul>
              <p>O arquivo CSV deve conter colunas como: <b>Data</b>, <b>Abertura</b>, <b>Fechamento</b>, <b>Volume</b>, etc.</p>
              <p>Se precisar de um exemplo de arquivo, solicite ao suporte.</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de puxar CSV do Brapi */}
      {showBrapiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 rounded-lg shadow-lg max-w-lg w-full p-8 relative">
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 text-2xl"
              onClick={() => setShowBrapiModal(false)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="text-2xl font-bold mb-4">Puxar dados do Brapi</h2>
            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ticker(s) <span className="text-gray-500">(ex: PETR4,VALE3)</span></label>
                <input
                  type="text"
                  name="tickers"
                  value={brapiForm.tickers}
                  onChange={handleBrapiChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="Digite um ou mais tickers separados por vírgula"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Período (range)</label>
                  <select
                    name="range"
                    value={brapiForm.range}
                    onChange={handleBrapiChange}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="1mo">1 mês</option>
                    <option value="3mo">3 meses</option>
                    <option value="6mo">6 meses</option>
                    <option value="1y">1 ano</option>
                    <option value="5y">5 anos</option>
                    <option value="10y">10 anos</option>
                    <option value="max">Máximo</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">Intervalo</label>
                  <select
                    name="interval"
                    value={brapiForm.interval}
                    onChange={handleBrapiChange}
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="1m">1 minuto</option>
                    <option value="5m">5 minutos</option>
                    <option value="15m">15 minutos</option>
                    <option value="60m">1 hora</option>
                    <option value="1d">Diário</option>
                    <option value="1wk">Semanal</option>
                    <option value="1mo">Mensal</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de ativo</label>
                <select
                  name="tipo"
                  value={brapiForm.tipo}
                  onChange={handleBrapiChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="stock">Ação</option>
                  <option value="fii">FII</option>
                  <option value="bdr">BDR</option>
                  <option value="indice">Índice</option>
                  <option value="crypto">Criptomoeda</option>
                  <option value="currency">Moeda</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded font-semibold"
                  onClick={() => setShowBrapiModal(false)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded font-semibold"
                  onClick={handleBrapiFetch}
                  disabled={brapiLoading}
                >
                  {brapiLoading ? 'Buscando...' : 'Buscar dados'}
                </button>
              </div>
            </form>
            {brapiError && <div className="text-red-500 text-sm mt-2">{brapiError}</div>}
          </div>
        </div>
      )}

      {/* Feedback de loading/erro */}
      {loading && <div className="text-cyan-400 mb-4">Carregando bases de dados...</div>}
      {error && <div className="text-red-400 mb-4">{error}</div>}

      {/* Tabela de bases existentes */}
      <div className="overflow-x-auto mt-8">
        <table className="min-w-full bg-gray-800 rounded-lg">
          <thead>
            <tr>
              <th className="px-2 py-3">
                <input
                  type="checkbox"
                  checked={paginatedBases.length > 0 && paginatedBases.every((b) => selectedBases.includes(b.id))}
                  onChange={handleSelectAll}
                  className="accent-cyan-600"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Tamanho</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBases.map((base) => (
              <tr key={base.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                <td className="px-2 py-4 text-center">
                  <button
                    title={base.locked ? 'Desbloquear base' : 'Bloquear base'}
                    onClick={async (e) => {
                      e.preventDefault();
                      await fetch(`http://localhost:8003/api/base/${base.id}/lock`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ locked: !base.locked })
                      });
                      setBases(prev => prev.map(b => b.id === base.id ? { ...b, locked: !b.locked } : b));
                    }}
                    className="text-xl focus:outline-none"
                  >
                    {base.locked ? <FiLock className="text-red-500" /> : <FiUnlock className="text-cyan-400 hover:text-cyan-600" />}
                  </button>
                  <input
                    type="checkbox"
                    checked={selectedBases.includes(base.id)}
                    onChange={() => handleSelectBase(base.id)}
                    className="accent-cyan-600 ml-2"
                    disabled={base.locked}
                    title={base.locked ? 'Base bloqueada. Desbloqueie para selecionar.' : ''}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{base.nome}</td>
                <td className="px-6 py-4 whitespace-nowrap">{(base.tamanho / 1024).toFixed(1)} KB</td>
                <td className="px-6 py-4 whitespace-nowrap">{base.criadoEm ? new Date(base.criadoEm).toLocaleDateString("pt-BR") : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 