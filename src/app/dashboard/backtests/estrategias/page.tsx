"use client";
import React, { useState, useEffect } from "react";
import { FiEye } from "react-icons/fi";
import { db } from '@/config/firebase';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';

interface Estrategia {
  id: string;
  nome: string;
  descricao: string;
  variaveis: string;
  resultados: string;
  observacoes: string;
}

export default function EstrategiasPage() {
  const [estrategias, setEstrategias] = useState<Estrategia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showInfoId, setShowInfoId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({
    descricao: '',
    variaveis: '',
    resultados: '',
    observacoes: '',
  });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [orderAlpha, setOrderAlpha] = useState(false);
  const [orderRecent, setOrderRecent] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const estrategiasPerPage = 50;

  useEffect(() => {
    async function fetchEstrategias() {
      setLoading(true);
      setError("");
      try {
        const snapshot = await getDocs(collection(db, "estrategias"));
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          nome: doc.data().nome,
          descricao: doc.data().descricao || "",
          variaveis: doc.data().variaveis || '',
          resultados: doc.data().resultados || '',
          observacoes: doc.data().observacoes || '',
        }));
        setEstrategias(docs);
      } catch (err: any) {
        setError(err.message || "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    fetchEstrategias();
  }, []);

  useEffect(() => {
    if (showInfoId) {
      const est = estrategias.find(e => e.id === showInfoId);
      setEditFields({
        descricao: est?.descricao || '',
        variaveis: est?.variaveis || '',
        resultados: est?.resultados || '',
        observacoes: est?.observacoes || '',
      });
      setSaveMsg('');
    }
  }, [showInfoId]);

  async function handleSave() {
    if (!showInfoId) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const ref = doc(db, 'estrategias', showInfoId);
      await updateDoc(ref, {
        descricao: editFields.descricao,
        variaveis: editFields.variaveis,
        resultados: editFields.resultados,
        observacoes: editFields.observacoes,
      });
      setEstrategias(prev => prev.map(e => e.id === showInfoId ? { ...e, ...editFields } : e));
      setSaveMsg('Salvo com sucesso!');
    } catch (err: any) {
      setSaveMsg('Erro ao salvar: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  }

  // Filtrar pelo termo de pesquisa antes de ordenar e paginar
  let filteredEstrategias = estrategias.filter(est => est.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  let estrategiasOrdenadas = [...filteredEstrategias];
  if (orderAlpha) {
    estrategiasOrdenadas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  } else if (orderRecent) {
    estrategiasOrdenadas.sort((a, b) => {
      // Supondo que não há campo de data, manter ordem original
      return 0;
    });
  }
  const totalPages = Math.ceil(estrategiasOrdenadas.length / estrategiasPerPage);
  const paginatedEstrategias = estrategiasOrdenadas.slice((currentPage - 1) * estrategiasPerPage, currentPage * estrategiasPerPage);

  return (
    <div className="bg-gray-900 min-h-screen rounded-lg shadow p-8 text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Estratégias</h1>
        <button
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded shadow font-semibold"
          onClick={() => alert('Em breve: tutorial de estratégias!')}
        >
          Tutorial
        </button>
      </div>
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
          placeholder="Pesquisar estratégia..."
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
      {loading ? (
        <div className="text-gray-300">Carregando estratégias...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-gray-800 rounded-lg">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Descrição</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Mais infos</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEstrategias.map((estrat) => (
                <tr key={estrat.id} className="border-b border-gray-700 hover:bg-gray-700/30">
                  <td className="px-6 py-4 whitespace-nowrap font-semibold">{estrat.nome.replace(/^Estratégia:\s*/i, '')}</td>
                  <td className="px-6 py-4 whitespace-pre-line text-gray-200">{estrat.descricao}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      className="text-cyan-400 hover:text-cyan-300"
                      title="Mais informações"
                      onClick={() => setShowInfoId(estrat.id)}
                    >
                      <FiEye size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pop-up de mais informações */}
      {showInfoId && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 rounded-lg shadow-lg w-full max-w-8xl w-[1500px] h-[70vh] flex flex-col p-12 relative overflow-y-auto">
            <button
              className="absolute top-4 right-6 text-gray-500 hover:text-gray-800 text-3xl"
              onClick={() => setShowInfoId(null)}
              aria-label="Fechar"
            >
              ×
            </button>
            <h2 className="text-3xl font-bold mb-8">Mais informações</h2>
            <div className="space-y-8 flex-1">
              <div className="flex flex-col md:flex-row gap-8 w-full">
                {/* Coluna 1 */}
                <div className="flex-1 space-y-8">
                  <div>
                    <span className="font-semibold">Descrição:</span>
                    <textarea
                      className="mt-2 w-full text-gray-700 bg-gray-100 rounded p-3 min-h-[100px]"
                      value={editFields.descricao}
                      onChange={e => setEditFields(f => ({ ...f, descricao: e.target.value }))}
                      placeholder="Descreva a estratégia, lógica, contexto, etc."
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <span className="font-semibold">Variáveis necessárias para backtest:</span>
                    <textarea
                      className="mt-2 w-full text-gray-700 bg-gray-100 rounded p-3 min-h-[120px]"
                      value={editFields.variaveis}
                      onChange={e => setEditFields(f => ({ ...f, variaveis: e.target.value }))}
                      placeholder="Ex: ticker, período, capital inicial, stop loss, take profit"
                      disabled={saving}
                    />
                  </div>
                </div>
                {/* Coluna 2 */}
                <div className="flex-1 space-y-8">
                  <div>
                    <span className="font-semibold">Estudos/resultados:</span>
                    <textarea
                      className="mt-2 w-full text-gray-700 bg-gray-100 rounded p-3 min-h-[100px] whitespace-pre-line"
                      value={editFields.resultados}
                      onChange={e => setEditFields(f => ({ ...f, resultados: e.target.value }))}
                      placeholder={`Ex:\n- Retorno anualizado: 12,5%\n- Sharpe: 1,2\n- Drawdown máximo: -8,3%\n- Taxa de acerto: 54%\n- Nº de operações: 120\n- Volatilidade anual: 18%\n- Retorno mensal médio: 1,1%`}
                      disabled={saving}
                    />
                  </div>
                  <div>
                    <span className="font-semibold">Outras observações:</span>
                    <textarea
                      className="mt-2 w-full text-gray-700 bg-gray-100 rounded p-3 min-h-[80px] whitespace-pre-line"
                      value={editFields.observacoes}
                      onChange={e => setEditFields(f => ({ ...f, observacoes: e.target.value }))}
                      placeholder={`Ex:\n- Estratégia recomendada para ativos líquidos.\n- Evitar uso em períodos de alta volatilidade.\n- Pode ser combinada com filtro de tendência semanal.\n- Resultados melhores em ativos do setor financeiro.\n- Testada no período 2018-2024.`}
                      disabled={saving}
                      rows={4}
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-4 items-center pt-4">
                {saveMsg && <span className={saveMsg.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}>{saveMsg}</span>}
                <button
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded shadow font-semibold disabled:opacity-60"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 