"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Combobox } from "@headlessui/react";

type Strategy = { id: string; name: string };
type Account = { AccountID: string; nomeCliente?: string; BrokerID?: number | string };

export interface AccountSelectorProps {
  value: string;
  onChange: (newValue: string) => void;
  accounts: Account[];
  strategies: Strategy[];
  placeholder?: string;
  disabled?: boolean;
  onlyAccounts?: boolean; // quando true, não exibe grupos MASTER e Estratégias
}

function normalize(text: string): string {
  return (text || "")
    .toString()
    .normalize("NFD")
    // remover diacríticos de forma compatível
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getDisplayLabel(value: string, accounts: Account[], strategies: Strategy[]): string {
  if (value === "MASTER") {
    return "MASTER - Todas as contas";
  }
  if (value.startsWith("strategy:")) {
    const id = value.replace("strategy:", "");
    const st = strategies.find((s) => s.id === id);
    return st ? st.name : value;
  }
  const acc = accounts.find((a) => a.AccountID === value);
  if (acc) {
    const name = acc.nomeCliente ? ` - ${acc.nomeCliente}` : "";
    return `${acc.AccountID}${name}`;
  }
  return value || "Selecionar conta";
}

export default function AccountSelector({
  value,
  onChange,
  accounts,
  strategies,
  placeholder = "Buscar conta por nome ou ID...",
  disabled,
  onlyAccounts = false,
}: AccountSelectorProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  
  // Deduplicar contas por (AccountID + BrokerID) para evitar chaves duplicadas
  const dedupedAccounts = useMemo(() => {
    const seen = new Set<string>();
    const out: Account[] = [];
    for (const acc of accounts) {
      const key = `${acc.AccountID}-${acc.BrokerID ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(acc);
    }
    return out;
  }, [accounts]);

  // Debounce para evitar flicker e buscas intermediárias
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(handle);
  }, [query]);

  const filteredAccounts = useMemo(() => {
    const raw = debouncedQuery.trim();
    if (!raw) return dedupedAccounts;
    const q = normalize(raw);
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return dedupedAccounts;

    type Scored = { acc: Account; score: number };

    const scored: Scored[] = [];
    for (const acc of dedupedAccounts) {
      const idN = normalize(acc.AccountID);
      const nameN = normalize(acc.nomeCliente || "");
      const nameTokens = nameN.split(/\s+/).filter(Boolean);

      // Regra de correspondência: todos os tokens devem aparecer no nome OU no ID
      const allTokensMatch = tokens.every((t) => nameN.includes(t) || idN.includes(t));
      if (!allTokensMatch) continue;

      // Scoring para ordenar por relevância
      let score = 0;
      const first = tokens[0];
      // Priorizar início de palavra no nome
      if (nameTokens.some((nt) => nt.startsWith(first))) score += 5;
      else if (idN.startsWith(first)) score += 4;
      else if (nameN.includes(first)) score += 2;
      else if (idN.includes(first)) score += 1;

      // Tokens restantes dão pequenos boosts
      for (let i = 1; i < tokens.length; i++) {
        const t = tokens[i];
        if (nameTokens.some((nt) => nt.startsWith(t))) score += 1;
        else if (nameN.includes(t)) score += 0.5;
      }

      scored.push({ acc, score });
    }

    // Ordenar por score desc e, em empate, pelo nome exibido
    return scored
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const aLabel = `${a.acc.nomeCliente || ""} ${a.acc.AccountID}`.toUpperCase();
        const bLabel = `${b.acc.nomeCliente || ""} ${b.acc.AccountID}`.toUpperCase();
        return aLabel.localeCompare(bLabel, "pt-BR");
      })
      .map((s) => s.acc);
  }, [dedupedAccounts, debouncedQuery]);

  const hideNonAccountGroups = onlyAccounts || debouncedQuery.trim().length > 0;

  return (
    <Combobox
      value={value}
      onChange={(val: string | null) => {
        if (!val) {
          // Não altera a seleção quando a entrada é limpa/manual
          setIsEditing(true);
          return;
        }
        onChange(val);
        // Ao selecionar uma opção, sair do modo de edição e limpar a query
        setIsEditing(false);
        setQuery("");
      }}
      disabled={disabled}
    >
      <div className="relative w-full max-w-xl">
        <div className="relative">
          <Combobox.Input
            className="w-full rounded-md border border-gray-600 bg-gray-800 py-2 pl-3 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-600"
            displayValue={(val: string) => (isEditing ? query : getDisplayLabel(val, accounts, strategies))}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              setIsEditing(true);
            }}
            onBlur={() => {
              setIsEditing(false);
            }}
            placeholder={placeholder}
          />
          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2 text-gray-300">
            ▼
          </Combobox.Button>
        </div>

        <Combobox.Options className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-md border border-gray-700 bg-[#1f2937] py-1 text-sm shadow-lg focus:outline-none">
          {!hideNonAccountGroups && (
            <>
              {/* Grupo: MASTER */}
              <div className="px-3 py-1 text-xs uppercase tracking-wide text-gray-400">Master</div>
              <Combobox.Option
                value="MASTER"
                className={({ active }) => `cursor-pointer px-3 py-2 ${active ? "bg-cyan-600 text-white" : "text-gray-200"}`}
              >
                MASTER - Todas as contas
              </Combobox.Option>

              {/* Grupo: Estratégias */}
              <div className="mt-1 px-3 py-1 text-xs uppercase tracking-wide text-gray-400">Estratégias</div>
              {strategies.length === 0 ? (
                <div className="px-3 py-2 text-gray-400">Nenhuma estratégia</div>
              ) : (
                strategies.map((st) => (
                  <Combobox.Option
                    key={st.id}
                    value={`strategy:${st.id}`}
                    className={({ active }) => `cursor-pointer px-3 py-2 ${active ? "bg-cyan-600 text-white" : "text-gray-200"}`}
                  >
                    {st.name}
                  </Combobox.Option>
                ))
              )}
            </>
          )}

          {/* Grupo: Contas Individuais (filtrável) */}
          <div className="mt-1 px-3 py-1 text-xs uppercase tracking-wide text-gray-400">Contas Individuais</div>
          {filteredAccounts.length === 0 ? (
            <div className="px-3 py-2 text-gray-400">Sem resultados</div>
          ) : (
            filteredAccounts.map((acc, idx) => (
              <Combobox.Option
                key={`${acc.AccountID}-${acc.BrokerID ?? ''}-${idx}`}
                value={acc.AccountID}
                className={({ active }) => `cursor-pointer px-3 py-2 ${active ? "bg-cyan-600 text-white" : "text-gray-200"}`}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{acc.AccountID}{acc.nomeCliente ? ` - ${acc.nomeCliente}` : ""}</span>
                </div>
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </div>
    </Combobox>
  );
}


