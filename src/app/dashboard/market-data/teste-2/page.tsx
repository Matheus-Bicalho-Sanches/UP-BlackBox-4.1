"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FiEdit2, FiTrash2, FiPlus } from "react-icons/fi";
import { db } from "@/config/firebase";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

interface QuantStrategy {
  id: string;
  nome: string;
  status: boolean;
  carteiraBlackBox: string;
  tamanhoPosition: number;
  createdAt?: any;
  updatedAt?: any;
}

interface BlackBoxStrategy {
  id: string;
  name: string;
  description?: string;
}

interface StatusChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  strategy: QuantStrategy | null;
  newStatus: boolean;
}

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  strategy: QuantStrategy | null;
}

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (strategy: Partial<QuantStrategy>) => void;
  strategy: QuantStrategy | null;
  blackBoxStrategies: BlackBoxStrategy[];
  mode: 'create' | 'edit';
}

function StatusChangeModal({ isOpen, onClose, onConfirm, strategy, newStatus }: StatusChangeModalProps) {
  if (!isOpen || !strategy) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-white mb-4">
          {newStatus ? "Ativar" : "Desativar"} Estratégia
        </h3>
        <p className="text-gray-300 mb-6">
          Tem certeza que deseja <strong>{newStatus ? "ativar" : "desativar"}</strong> a estratégia{" "}
          <strong>"{strategy.nome}"</strong>?
        </p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className={`flex-1 ${newStatus ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
          >
            {newStatus ? "Ativar" : "Desativar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ isOpen, onClose, onConfirm, strategy }: DeleteModalProps) {
  if (!isOpen || !strategy) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-white mb-4">Excluir Estratégia</h3>
        <p className="text-gray-300 mb-6">
          Tem certeza que deseja excluir a estratégia <strong>"{strategy.nome}"</strong>?
          <br />
          <span className="text-red-400 text-sm">Esta ação não pode ser desfeita!</span>
        </p>
        <div className="flex gap-4">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-red-600 hover:bg-red-700"
          >
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ isOpen, onClose, onSave, strategy, blackBoxStrategies, mode }: EditModalProps) {
  const [nome, setNome] = useState("");
  const [status, setStatus] = useState(false);
  const [carteiraBlackBox, setCarteiraBlackBox] = useState("");
  const [tamanhoPosition, setTamanhoPosition] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (strategy && mode === 'edit') {
      setNome(strategy.nome);
      setStatus(strategy.status);
      setCarteiraBlackBox(strategy.carteiraBlackBox);
      setTamanhoPosition(strategy.tamanhoPosition);
    } else {
      // Reset para modo criar
      setNome("");
      setStatus(false);
      setCarteiraBlackBox("");
      setTamanhoPosition(0);
    }
  }, [strategy, mode, isOpen]);

  const handleSave = async () => {
    if (!nome.trim() || !carteiraBlackBox || tamanhoPosition < 0 || tamanhoPosition > 100) {
      alert("Por favor, preencha todos os campos corretamente.\nTamanho da posição deve estar entre 0% e 100%.");
      return;
    }

    setLoading(true);
    try {
      await onSave({
        nome: nome.trim(),
        status,
        carteiraBlackBox,
        tamanhoPosition,
      });
      onClose();
    } catch (error) {
      console.error("Erro ao salvar estratégia:", error);
      alert("Erro ao salvar estratégia. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-lg">
        <h3 className="text-xl font-bold text-white mb-4">
          {mode === 'create' ? 'Nova' : 'Editar'} Estratégia Quant
        </h3>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="nome" className="text-gray-300">Nome da Estratégia</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: MACD + Bollinger Bands"
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          <div>
            <Label htmlFor="carteira" className="text-gray-300">Carteira BlackBox</Label>
            <Select value={carteiraBlackBox} onValueChange={setCarteiraBlackBox}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder="Selecione uma estratégia BlackBox" />
              </SelectTrigger>
              <SelectContent>
                {blackBoxStrategies.map((strat) => (
                  <SelectItem key={strat.id} value={strat.id}>
                    {strat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="tamanho" className="text-gray-300">Tamanho da Posição (%)</Label>
            <Input
              id="tamanho"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={tamanhoPosition}
              onChange={(e) => setTamanhoPosition(Number(e.target.value))}
              placeholder="0 - 100"
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="status"
              checked={status}
              onCheckedChange={(checked) => setStatus(!!checked)}
              className="border-gray-600"
            />
            <Label htmlFor="status" className="text-gray-300">
              Estratégia ativa
            </Label>
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? "Salvando..." : (mode === 'create' ? 'Criar' : 'Salvar')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EstrategiasQuantPage() {
  const [strategies, setStrategies] = useState<QuantStrategy[]>([]);
  const [blackBoxStrategies, setBlackBoxStrategies] = useState<BlackBoxStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    strategy: QuantStrategy | null;
    newStatus: boolean;
  }>({ isOpen: false, strategy: null, newStatus: false });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    strategy: QuantStrategy | null;
  }>({ isOpen: false, strategy: null });
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    strategy: QuantStrategy | null;
    mode: 'create' | 'edit';
  }>({ isOpen: false, strategy: null, mode: 'create' });

  // Carregar dados do Firebase e estratégias BlackBox
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Carregar estratégias quant do Firebase
      const quantSnapshot = await getDocs(collection(db, "quantStrategies"));
      const quantStrategies: QuantStrategy[] = [];
      quantSnapshot.forEach((doc) => {
        quantStrategies.push({ id: doc.id, ...doc.data() } as QuantStrategy);
      });
      
      // Ordenar por data de criação (mais recentes primeiro)
      quantStrategies.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
      });
      
      setStrategies(quantStrategies);

      // Carregar estratégias BlackBox da API
      try {
        const response = await fetch("http://localhost:8000/strategies");
        if (response.ok) {
          const data = await response.json();
          setBlackBoxStrategies(data.strategies || []);
        } else {
          console.error("Erro ao carregar estratégias BlackBox");
        }
      } catch (error) {
        console.error("Erro ao conectar com a API BlackBox:", error);
      }
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (strategy: QuantStrategy, newStatus: boolean) => {
    setStatusModal({ isOpen: true, strategy, newStatus });
  };

  const confirmStatusChange = async () => {
    if (!statusModal.strategy) return;

    try {
      const docRef = doc(db, "quantStrategies", statusModal.strategy.id);
      await updateDoc(docRef, {
        status: statusModal.newStatus,
        updatedAt: serverTimestamp(),
      });

      setStrategies(prev =>
        prev.map(s =>
          s.id === statusModal.strategy!.id
            ? { ...s, status: statusModal.newStatus }
            : s
        )
      );

      setStatusModal({ isOpen: false, strategy: null, newStatus: false });
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      alert("Erro ao atualizar status da estratégia.");
    }
  };

  const handleEdit = (strategy: QuantStrategy) => {
    setEditModal({ isOpen: true, strategy, mode: 'edit' });
  };

  const handleCreate = () => {
    setEditModal({ isOpen: true, strategy: null, mode: 'create' });
  };

  const handleSaveStrategy = async (strategyData: Partial<QuantStrategy>) => {
    try {
      if (editModal.mode === 'create') {
        // Criar nova estratégia
        const docRef = await addDoc(collection(db, "quantStrategies"), {
          ...strategyData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const newStrategy: QuantStrategy = {
          id: docRef.id,
          ...strategyData,
        } as QuantStrategy;

        setStrategies(prev => [newStrategy, ...prev]);
      } else {
        // Editar estratégia existente
        if (!editModal.strategy) return;

        const docRef = doc(db, "quantStrategies", editModal.strategy.id);
        await updateDoc(docRef, {
          ...strategyData,
          updatedAt: serverTimestamp(),
        });

        setStrategies(prev =>
          prev.map(s =>
            s.id === editModal.strategy!.id
              ? { ...s, ...strategyData }
              : s
          )
        );
      }
    } catch (error) {
      console.error("Erro ao salvar estratégia:", error);
      throw error;
    }
  };

  const handleDelete = (strategy: QuantStrategy) => {
    setDeleteModal({ isOpen: true, strategy });
  };

  const confirmDelete = async () => {
    if (!deleteModal.strategy) return;

    try {
      await deleteDoc(doc(db, "quantStrategies", deleteModal.strategy.id));
      setStrategies(prev => prev.filter(s => s.id !== deleteModal.strategy!.id));
      setDeleteModal({ isOpen: false, strategy: null });
    } catch (error) {
      console.error("Erro ao excluir estratégia:", error);
      alert("Erro ao excluir estratégia.");
    }
  };

  const getBlackBoxStrategyName = (id: string) => {
    const strategy = blackBoxStrategies.find(s => s.id === id);
    return strategy ? strategy.name : "Estratégia não encontrada";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Carregando estratégias...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Estratégias Quant</h1>
        <Button
          onClick={handleCreate}
          className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
        >
          <FiPlus size={16} />
          Nova Estratégia
        </Button>
      </div>

      {strategies.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">Nenhuma estratégia quant encontrada</div>
          <Button
            onClick={handleCreate}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Criar primeira estratégia
          </Button>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Nome Estratégia Quant
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Carteira BlackBox
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Tamanho Posição
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {strategies.map((strategy) => (
                  <tr key={strategy.id} className="hover:bg-gray-700/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {strategy.nome}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <Checkbox
                        checked={strategy.status}
                        onCheckedChange={(checked) =>
                          handleStatusChange(strategy, !!checked)
                        }
                        className="border-gray-600"
                      />
                      <span className="ml-2 text-xs text-gray-400">
                        {strategy.status ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-300">
                        {getBlackBoxStrategyName(strategy.carteiraBlackBox)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {strategy.tamanhoPosition.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(strategy)}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                          title="Editar"
                        >
                          <FiEdit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(strategy)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Excluir"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modais */}
      <StatusChangeModal
        isOpen={statusModal.isOpen}
        onClose={() => setStatusModal({ isOpen: false, strategy: null, newStatus: false })}
        onConfirm={confirmStatusChange}
        strategy={statusModal.strategy}
        newStatus={statusModal.newStatus}
      />

      <DeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, strategy: null })}
        onConfirm={confirmDelete}
        strategy={deleteModal.strategy}
      />

      <EditModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal({ isOpen: false, strategy: null, mode: 'create' })}
        onSave={handleSaveStrategy}
        strategy={editModal.strategy}
        blackBoxStrategies={blackBoxStrategies}
        mode={editModal.mode}
      />
    </div>
  );
} 