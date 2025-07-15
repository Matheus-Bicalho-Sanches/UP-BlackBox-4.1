"use client";
import { useState, useEffect, useRef } from "react";
// Firebase imports
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { FiEdit2, FiTrash2 } from "react-icons/fi";

// Configuração do Firebase (substitua pelos seus dados do projeto)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function ContasPage() {
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [log, setLog] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nomeCliente: "", valorInvestido: "", BrokerID: "", AccountID: "" });
  const [saving, setSaving] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editValor, setEditValor] = useState<string>("");
  const [editNome, setEditNome] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showAccountsList, setShowAccountsList] = useState(false);
  const [backendAccounts, setBackendAccounts] = useState<any[]>([]);
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchContas() {
      setLoading(true);
      setLog("");
      try {
        const querySnapshot = await getDocs(collection(db, "contasDll"));
        const contasList: any[] = [];
        querySnapshot.forEach((doc) => {
          contasList.push({ ...doc.data(), _id: doc.id });
        });
        setContas(contasList);
        setLog(`Total de contas encontradas: ${contasList.length}`);
      } catch (err) {
        setLog("Erro ao buscar contas no Firebase.");
      }
      setLoading(false);
    }
    fetchContas();
  }, [saving, successMsg]);

  async function handleAddConta(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setLog("");
    try {
      console.log('Enviando para Firestore:', {
        'Nome Cliente': form.nomeCliente,
        'Valor Investido': Number(form.valorInvestido),
        BrokerID: form.BrokerID,
        AccountID: form.AccountID
      });
      await addDoc(collection(db, "contasDll"), {
        'Nome Cliente': form.nomeCliente,
        'Valor Investido': Number(form.valorInvestido),
        BrokerID: form.BrokerID,
        AccountID: form.AccountID
      });
      setLog("Conta adicionada com sucesso!");
      setShowForm(false);
      setForm({ nomeCliente: "", valorInvestido: "", BrokerID: "", AccountID: "" });
    } catch (err) {
      setLog("Erro ao adicionar conta no Firebase.");
    }
    setSaving(false);
  }

  // Função para salvar edição
  async function handleSaveEdit(idx: number) {
    if (editIdx !== null && editId) {
      try {
        const docRef = doc(db, "contasDll", editId);
        const updates: any = {};
        if (editValor !== "") updates["Valor Investido"] = Number(editValor);
        if (editNome !== "") updates["Nome Cliente"] = editNome;
        await updateDoc(docRef, updates);
        setSuccessMsg("Dados da conta atualizados com sucesso!");
        setTimeout(() => setSuccessMsg(""), 2500);
      } catch (err) {
        setLog("Erro ao atualizar dados da conta.");
      }
      setEditIdx(null);
      setEditId(null);
      setEditValor("");
      setEditNome("");
      setShowModal(false);
    }
  }

  function openEditModal(idx: number, conta: any) {
    setEditIdx(idx);
    setEditValor(conta["Valor Investido"]?.toString() || "");
    setEditNome(conta["Nome Cliente"] || "");
    setEditId(conta._id);
    setShowModal(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function closeModal() {
    setShowModal(false);
    setEditIdx(null);
    setEditId(null);
    setEditValor("");
    setEditNome("");
  }

  // Função para deletar conta
  async function handleDeleteConta(contaId: string) {
    const confirmar = window.confirm("Tem certeza que deseja excluir esta conta?");
    if (!confirmar) return;
    setDeleting(true);
    setLog("");
    try {
      await deleteDoc(doc(db, "contasDll", contaId));
      setSuccessMsg("Conta deletada com sucesso!");
      setTimeout(() => setSuccessMsg(""), 2500);
    } catch (err) {
      setLog("Erro ao deletar conta.");
    }
    setDeleting(false);
  }

  return (
    <div style={{ maxWidth: 1400, margin: "40px auto", padding: 8, background: "#222", borderRadius: 8 }}>
      <h2 style={{ color: "#fff", marginBottom: 24 }}>Contas (Firebase)</h2>
      <button
        type="button"
        onClick={() => setShowForm(!showForm)}
        style={{ marginBottom: 16, marginRight: 8, padding: 10, borderRadius: 4, background: "#22c55e", color: "#fff", fontWeight: 600, border: 0 }}
      >
        {showForm ? "Cancelar" : "Adicionar conta"}
      </button>
      <button
        type="button"
        onClick={async () => {
          if (!showAccountsList && backendAccounts.length === 0) {
            try {
              const res = await fetch("http://localhost:8000/accounts");
              const data = await res.json();
              if (data.accounts) {
                setBackendAccounts(data.accounts);
              } else {
                setLog("Nenhuma conta retornada pelo backend.");
              }
            } catch (err) {
              setLog("Erro ao obter contas do backend.");
            }
          }
          setShowAccountsList(!showAccountsList);
        }}
        style={{ marginBottom: 16, padding: 10, borderRadius: 4, background: "#0ea5e9", color: "#fff", fontWeight: 600, border: 0 }}
      >
        {showAccountsList ? "Ocultar contas Profit" : "Listar contas Profit"}
      </button>
      {showForm && (
        <form onSubmit={handleAddConta} style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24, background: "#181818", padding: 16, borderRadius: 8 }}>
          <input
            type="text"
            placeholder="Nome Cliente"
            value={form.nomeCliente}
            onChange={e => setForm({ ...form, nomeCliente: e.target.value })}
            required
            style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
          />
          <input
            type="number"
            placeholder="Valor investido"
            value={form.valorInvestido}
            onChange={e => setForm({ ...form, valorInvestido: e.target.value })}
            required
            style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
          />
          <input
            type="text"
            placeholder="BrokerID"
            value={form.BrokerID}
            onChange={e => setForm({ ...form, BrokerID: e.target.value })}
            required
            style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
          />
          <input
            type="text"
            placeholder="AccountID"
            value={form.AccountID}
            onChange={e => setForm({ ...form, AccountID: e.target.value })}
            required
            style={{ padding: 8, borderRadius: 4, border: "1px solid #444" }}
          />
          <button type="submit" disabled={saving} style={{ padding: 10, borderRadius: 4, background: "#0ea5e9", color: "#fff", fontWeight: 600, border: 0 }}>
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      )}
      <div style={{ color: "#fff", marginBottom: 16 }}>{log}</div>
      {successMsg && (
        <div style={{ color: '#22c55e', marginBottom: 12, fontWeight: 600 }}>{successMsg}</div>
      )}
      {showAccountsList && (
        <table style={{ width: "100%", maxWidth: 600, margin: "24px auto", color: "#fff", background: "#181818", borderRadius: 8 }}>
          <thead>
            <tr>
              <th style={{ padding: 8, borderBottom: "1px solid #444", textAlign: "center" }}>BrokerID</th>
              <th style={{ padding: 8, borderBottom: "1px solid #444", textAlign: "center" }}>AccountID</th>
            </tr>
          </thead>
          <tbody>
            {[...backendAccounts].sort((a, b) => {
              const idA = (a.AccountID || "").toLowerCase();
              const idB = (b.AccountID || "").toLowerCase();
              return idA.localeCompare(idB);
            }).map((conta, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #333" }}>
                <td style={{ padding: 8, textAlign: "center" }}>{conta.BrokerID}</td>
                <td style={{ padding: 8, textAlign: "center" }}>{conta.AccountID}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {loading ? (
        <div style={{ color: "#fff" }}>Carregando...</div>
      ) : (
        <table style={{ width: "100%", maxWidth: 1300, margin: "0 auto", color: "#fff", background: "#181818", borderRadius: 8, padding: 0 }}>
          <thead>
            <tr>
              <th style={{ padding: 8, borderBottom: "1px solid #444", textAlign: 'left' }}>Nome Cliente</th>
              <th style={{ padding: 8, borderBottom: "1px solid #444", textAlign: 'center' }}>BrokerID</th>
              <th style={{ padding: 8, borderBottom: "1px solid #444", textAlign: 'center' }}>AccountID</th>
              <th style={{ padding: 8, borderBottom: "1px solid #444", textAlign: 'center' }}>Valor Investido</th>
              <th style={{ padding: 8, borderBottom: "1px solid #444", textAlign: 'center' }}>Editar</th>
              <th style={{ padding: 8, borderBottom: "1px solid #444", textAlign: 'center' }}>Excluir</th>
            </tr>
          </thead>
          <tbody>
            {contas.map((conta, idx) => (
              <tr key={idx} style={{ borderBottom: "1px solid #333" }}>
                <td style={{ padding: 8, textAlign: 'left' }}>{conta["Nome Cliente"] || "-"}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{conta.BrokerID}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{conta.AccountID}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>{conta["Valor Investido"] || "-"}</td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <button
                    style={{ background: "none", border: 0, color: "#0ea5e9", cursor: "pointer" }}
                    onClick={() => openEditModal(idx, conta)}
                  >
                    <FiEdit2 />
                  </button>
                </td>
                <td style={{ padding: 8, textAlign: 'center' }}>
                  <button
                    style={{ background: "none", border: 0, color: "#ef4444", cursor: "pointer" }}
                    onClick={() => handleDeleteConta(conta._id)}
                    disabled={deleting}
                  >
                    <FiTrash2 />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Modal de edição */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ background: '#222', padding: 32, borderRadius: 12, minWidth: 320, boxShadow: '0 2px 16px #0008', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 style={{ color: '#fff', marginBottom: 16 }}>Editar Conta</h3>
            <input
              type="text"
              placeholder="Nome Cliente"
              value={editNome}
              onChange={e => setEditNome(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #444', width: 220, marginBottom: 12 }}
            />
            <input
              ref={inputRef}
              type="number"
              placeholder="Valor Investido"
              value={editValor}
              onChange={e => setEditValor(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveEdit(editIdx!);
                if (e.key === 'Escape') closeModal();
              }}
              style={{ padding: 8, borderRadius: 4, border: '1px solid #444', width: 180, marginBottom: 20 }}
            />
            <div style={{ display: 'flex', gap: 16 }}>
              <button
                onClick={() => handleSaveEdit(editIdx!)}
                style={{ padding: '8px 18px', borderRadius: 4, background: '#22c55e', color: '#fff', fontWeight: 600, border: 0 }}
              >Salvar</button>
              <button
                onClick={closeModal}
                style={{ padding: '8px 18px', borderRadius: 4, background: '#444', color: '#fff', fontWeight: 600, border: 0 }}
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 