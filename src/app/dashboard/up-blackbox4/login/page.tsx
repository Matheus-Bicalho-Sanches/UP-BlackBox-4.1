"use client";
import { useState } from "react";

/**
 * Página de Login - UP BlackBox 4.0
 * 
 * CONTEXTO:
 * - Login automático na DLL do Profit (sistema de trading)
 * - Não é autenticação de usuário (feita em /login)
 * - Todos os colaboradores têm o mesmo nível de acesso
 * - Sistema em produção - não usar fallbacks fictícios
 * 
 * FUNCIONALIDADES:
 * - Login automático na DLL do Profit
 * - Logoff da DLL
 * - Status de conexão com o sistema de trading
 */

export default function LoginPage() {
  const [log, setLog] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoffLoading, setLogoffLoading] = useState(false);
  const [logoffMsg, setLogoffMsg] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setLog("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/login`, {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok) {
        setLog(data.log || "Login realizado com sucesso!");
      } else {
        setLog(data.detail || "Erro ao fazer login.");
      }
    } catch (err) {
      setLog("Erro de conexão com o backend.");
    }
    setLoading(false);
  }

  async function handleLogoff() {
    setLogoffLoading(true);
    setLogoffMsg("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/logoff`, { method: "POST" });
      if (res.ok) {
        setLogoffMsg("Logoff realizado com sucesso!");
      } else {
        setLogoffMsg("Erro ao fazer logoff.");
      }
    } catch (err) {
      setLogoffMsg("Erro de conexão com o backend.");
    }
    setLogoffLoading(false);
  }

  return (
    <div style={{ maxWidth: 400, margin: "40px auto", padding: 24, background: "#222", borderRadius: 8 }}>
      <h2 style={{ color: "#fff", marginBottom: 24 }}>Login automático no Sistema</h2>
      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button type="submit" disabled={loading} style={{ padding: 10, borderRadius: 4, background: "#06b6d4", color: "#fff", fontWeight: 600, border: 0 }}>
          {loading ? "Entrando..." : "Login automático"}
        </button>
      </form>
      <button
        type="button"
        onClick={handleLogoff}
        disabled={logoffLoading}
        style={{ marginTop: 24, padding: 10, borderRadius: 4, background: "#ef4444", color: "#fff", fontWeight: 600, border: 0, width: "100%" }}
      >
        {logoffLoading ? "Fazendo logoff..." : "Logoff"}
      </button>
      {logoffMsg && <div style={{ color: '#fff', marginTop: 12 }}>{logoffMsg}</div>}
      <div style={{ marginTop: 24, color: "#fff", whiteSpace: "pre-wrap" }}>
        <strong>Log/Retorno:</strong>
        <div>{log}</div>
      </div>
    </div>
  );
} 