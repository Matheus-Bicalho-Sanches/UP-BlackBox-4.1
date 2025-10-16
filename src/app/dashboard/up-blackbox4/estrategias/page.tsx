"use client";
import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

/**
 * Página de Estratégias - UP BlackBox 4.0
 * 
 * CONTEXTO:
 * - Estratégias representam carteiras específicas da gestora
 * - Exemplos: UP BlackBox FIIs (manual), UP BlackBox Multi (manual → automatizada)
 * - Cada estratégia pode ter múltiplas contas de clientes alocadas
 * - Sistema permite gerenciar alocações de capital por cliente por estratégia
 * 
 * FUNCIONALIDADES:
 * - Criar/editar estratégias (carteiras)
 * - Gerenciar alocações de clientes por estratégia
 * - Definir valor investido por cliente
 */

interface Strategy {
  id: string;
  name: string;
  description?: string;
}

export default function EstrategiasPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // modal controls
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // allocation controls
  const [allocStrategy, setAllocStrategy] = useState<Strategy | null>(null);
  const [allocModalOpen, setAllocModalOpen] = useState(false);

  // fetch strategies on mount
  useEffect(() => {
    async function fetchStrategies() {
      try {
        const res = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URL}/strategies");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setStrategies(data.strategies || []);
      } catch (err: any) {
        setError(`Erro ao buscar estratégias: ${err.message}`);
      }
    }
    fetchStrategies();
  }, []);

  async function handleCreateStrategy(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError("");
    try {
      // envia para backend (ainda não implementado). Enquanto isso, mock local
      const payload = { name: newName.trim(), description: newDesc.trim() };
      const res = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URL}/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Assume que backend devolve objeto strategy completo
      setStrategies((prev) => [...prev, data.strategy]);
      setModalOpen(false);
      setNewName("");
      setNewDesc("");
    } catch (err: any) {
      // fallback: adiciona mock local para não bloquear testes de UI
      const fake: Strategy = { id: uuidv4(), name: newName, description: newDesc };
      setStrategies((prev) => [...prev, fake]);
      setModalOpen(false);
      setError("Backend não respondeu, estratégia criada apenas no front por enquanto.");
    }
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 16 }}>
      <h1 style={{ color: "#fff", marginBottom: 24 }}>Estratégias</h1>
      <button
        onClick={() => setModalOpen(true)}
        style={{ padding: "8px 16px", background: "#06b6d4", color: "#fff", borderRadius: 4 }}
      >
        Nova estratégia
      </button>

      {error && <p style={{ color: "#f00", marginTop: 16 }}>{error}</p>}

      <div style={{ marginTop: 24 }}>
        {strategies.length === 0 && <p style={{ color: "#aaa" }}>Nenhuma estratégia cadastrada.</p>}
        {strategies.map((s) => (
          <div key={s.id} style={{ background: "#181818", padding: 16, borderRadius: 8, marginBottom: 12 }}>
            <h3 style={{ color: "#fff", margin: 0 }}>{s.name}</h3>
            {s.description && <p style={{ color: "#ccc", marginTop: 4 }}>{s.description}</p>}
            <div style={{ marginTop: 8 }}>
              <button
                style={{ padding: "6px 12px", background: "#3b82f6", color: "#fff", borderRadius: 4, fontSize: 14 }}
                onClick={() => {
                  setAllocStrategy(s);
                  setAllocModalOpen(true);
                }}
              >
                Gerenciar alocações
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Nova Estratégia */}
      {modalOpen && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50,
          }}
          onClick={() => setModalOpen(false)}
        >
          <div
            style={{ background: "#222", padding: 24, borderRadius: 8, width: 400 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ color: "#fff", marginBottom: 16 }}>Nova Estratégia</h2>
            <form onSubmit={handleCreateStrategy} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                type="text"
                placeholder="Nome"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
              />
              <textarea
                placeholder="Descrição (opcional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                style={{ padding: 8, borderRadius: 4, border: "1px solid #444", minHeight: 80 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" onClick={() => setModalOpen(false)} style={{ padding: "6px 12px", background:'#6b7280', color:'#fff', borderRadius:4 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading} style={{ padding: "6px 12px", background: "#06b6d4", color: "#fff", borderRadius: 4 }}>
                  {loading ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Gerenciar Alocações */}
      {allocModalOpen && allocStrategy && (
        <AllocationModal strategy={allocStrategy} onClose={() => setAllocModalOpen(false)} />
      )}
    </div>
  );
}

// -------- AllocationModal component --------
import React from "react";
import AccountSelector from "@/components/AccountSelector";
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import app from '@/config/firebase';

interface Allocation {
  id: string;
  strategy_id: string;
  account_id: string;
  broker_id: number;
  valor_investido: number;
  client_name?: string; // Adicionar campo para nome do cliente
}

interface AllocationModalProps {
  strategy: Strategy;
  onClose: () => void;
}

function AllocationModal({ strategy, onClose }: AllocationModalProps) {
  const [allocations, setAllocations] = React.useState<Allocation[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [accounts, setAccounts] = React.useState<any[]>([]);
  const [clientNames, setClientNames] = React.useState<{[key: string]: string}>({});
  const [allocSearch, setAllocSearch] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState<string>("");

  // form states
  const [selAccountId, setSelAccountId] = React.useState<string>("");
  const [valorInvestido, setValorInvestido] = React.useState(0);

  const db = getFirestore(app);

  React.useEffect(() => {
    async function fetchData() {
      try {
        // Buscar alocações
        const allocRes = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/allocations?strategy_id=${strategy.id}`);
        if (!allocRes.ok) throw new Error("Falha ao buscar alocações");
        const allocData = await allocRes.json();
        
        // Buscar contas da API
        const accRes = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URL}/contasDll");
        let fetchedAccounts: any[] = [];
        let nomeMap: {[key: string]: string} = {};
        
        if (accRes.ok) {
          const accData = await accRes.json();
          fetchedAccounts = accData.contas || accData.accounts || [];
          
          // Criar mapa AccountID -> Nome Cliente
          for (const c of fetchedAccounts) {
            nomeMap[c.AccountID] = c["Nome Cliente"] || "Sem nome";
          }
        }

        // Adicionar nomes aos objetos das contas
        const accountsWithNames = fetchedAccounts.map((acc: any) => ({
          ...acc,
          nomeCliente: nomeMap[acc.AccountID] || "Sem nome"
        }));

        // Ordenar contas alfabeticamente pelo nome do cliente
        accountsWithNames.sort((a: any, b: any) => {
          const nomeA = (a.nomeCliente || "").toUpperCase();
          const nomeB = (b.nomeCliente || "").toUpperCase();
          return nomeA.localeCompare(nomeB, 'pt-BR');
        });

        // Adicionar nomes dos clientes às alocações existentes
        const allocationsWithNames = (allocData.allocations || []).map((alloc: Allocation) => ({
          ...alloc,
          client_name: nomeMap[alloc.account_id] || "Cliente não encontrado"
        }));

        setAllocations(allocationsWithNames);
        setAccounts(accountsWithNames);
        // default: vazio para forçar seleção via busca
        setSelAccountId("");
        setClientNames(nomeMap);
      } catch (err: any) {
        setError(err.message);
      }
    }
    fetchData();
  }, [strategy.id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (accounts.length === 0 || !selAccountId) return;
    const account = accounts.find(a => a.AccountID === selAccountId);
    if (!account) return;
    const payload = {
      strategy_id: strategy.id,
      account_id: account.AccountID || account.account_id || account.AccountId,
      broker_id: account.BrokerID || account.broker_id || account.BrokerId,
      valor_investido: valorInvestido,
    };
    setLoading(true);
    try {
      const res = await fetch("${process.env.NEXT_PUBLIC_BACKEND_URL}/allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erro ao criar alocação");
      const data = await res.json();
      
      // Adicionar o nome do cliente à nova alocação
      const newAllocation = {
        ...data.allocation,
        client_name: clientNames[payload.account_id] || "Cliente não encontrado"
      };
      
      setAllocations((prev) => [...prev, newAllocation]);
      setValorInvestido(0);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }

  async function handleDelete(allocation: Allocation) {
    if (!confirm("Excluir alocação?")) return;
    await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/allocations/${allocation.strategy_id}/${allocation.account_id}/${allocation.broker_id}`,
      { method: "DELETE" }
    );
    setAllocations((prev) => prev.filter((a) => a.id !== allocation.id));
  }

  const normalize = (t: string) =>
    (t || "")
      .toString()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();

  const filteredAllocations = allocations.filter((a) => {
    if (!allocSearch.trim()) return true;
    const q = normalize(allocSearch);
    return (
      normalize(a.client_name || "").includes(q) ||
      normalize(String(a.account_id)).includes(q) ||
      normalize(String(a.broker_id)).includes(q)
    );
  });

  return (
    <div
      style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#222", padding: 24, borderRadius: 8, width: "min(95vw, 1100px)", maxHeight: "90%", minHeight: "600px", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: "#fff" }}>Alocações – {strategy.name}</h2>
        {error && <p style={{ color: "#f00" }}>{error}</p>}

        {/* Busca e Lista */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
          <input
            type="text"
            placeholder="Buscar por cliente, conta ou broker..."
            value={allocSearch}
            onChange={(e) => setAllocSearch(e.target.value)}
            style={{ flex: 1, padding: 8, borderRadius: 4, border: '1px solid #444', background: '#181818', color: '#fff' }}
          />
        </div>
        <div style={{ width: '100%', marginTop: 12, maxHeight: 420, overflowY: 'auto', borderRadius: 4 }}>
          <table style={{ width: "100%", color: "#fff", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Cliente</th>
                <th>Conta</th>
                <th>Broker</th>
                <th style={{ textAlign: "right" }}>Valor Investido (R$)</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
            {filteredAllocations.map((a) => {
              const isEditing = editingId === a.id;
              return (
                <tr key={a.id}>
                  <td style={{ color: "#06b6d4", fontWeight: "bold" }}>{a.client_name}</td>
                  <td>{a.account_id}</td>
                  <td>{a.broker_id}</td>
                  <td style={{ textAlign: "right" }}>
                    {isEditing ? (
                      <input
                        type="number"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        min={0}
                        step={100}
                        style={{ width: 160, padding: 6, borderRadius: 4, border: '1px solid #444', background: '#181818', color: '#fff', textAlign: 'right' }}
                        autoFocus
                      />
                    ) : (
                      a.valor_investido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={async () => {
                            try {
                              const newValueNum = Number(editingValue);
                              if (Number.isNaN(newValueNum) || newValueNum < 0) return alert('Valor inválido');
                              const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/allocations/${a.strategy_id}/${a.account_id}/${a.broker_id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ valor_investido: newValueNum })
                              });
                              if (!res.ok) {
                                const data = await res.json().catch(()=>({detail:'Erro'}));
                                throw new Error(data.detail || 'Falha ao atualizar alocação');
                              }
                              // Atualizar estado local
                              setAllocations(prev => prev.map(item => item.id === a.id ? { ...item, valor_investido: newValueNum } : item));
                              setEditingId(null);
                              setEditingValue('');
                            } catch (err:any) {
                              alert(err.message || 'Erro ao atualizar alocação');
                            }
                          }}
                          style={{ marginRight: 8, padding: '6px 10px', background: '#10b981', color: '#fff', borderRadius: 4 }}
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditingValue(''); }}
                          style={{ padding: '6px 10px', background: '#6b7280', color: '#fff', borderRadius: 4 }}
                        >
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditingId(a.id); setEditingValue(String(a.valor_investido)); }}
                          style={{ marginRight: 8, color: '#60a5fa' }}
                        >
                          Editar
                        </button>
                        <button onClick={() => handleDelete(a)} style={{ color: '#f87171' }}>Excluir</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredAllocations.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "#aaa", textAlign: "center", padding: 8 }}>Nenhuma alocação.</td>
              </tr>
            )}
            </tbody>
          </table>
        </div>

        {/* Form adicionar */}
        <form onSubmit={handleAdd} style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ color: "#fff", fontSize: 16 }}>Nova alocação</h3>
          <AccountSelector
            value={selAccountId || ""}
            onChange={(val) => setSelAccountId(val)}
            accounts={accounts}
            strategies={[]}
            onlyAccounts
            placeholder="Buscar cliente por nome ou ID..."
          />
          <input
            type="number"
            placeholder="Valor investido (R$)"
            value={valorInvestido}
            min={0}
            step={100}
            onChange={(e) => setValorInvestido(Number(e.target.value))}
            required
            style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "6px 12px", background:'#6b7280', color:'#fff', borderRadius:4 }}>Fechar</button>
            <button type="submit" disabled={loading} style={{ padding: "6px 12px", background: "#06b6d4", color: "#fff", borderRadius: 4 }}>
              {loading ? "Salvando..." : "Adicionar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 