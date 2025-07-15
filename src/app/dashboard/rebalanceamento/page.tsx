'use client'

import { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  getFirestore, 
  doc, 
  setDoc, 
  deleteDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import app from '@/config/firebase';

// Interface para o cliente
interface Cliente {
  id: string;
  nome: string;
}

// Interface para os itens do checklist
interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  createdAt: number; // Para ordenação
}

export default function RebalanceamentoPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<{[clientId: string]: ChecklistItem[]}>({});
  const [newItemText, setNewItemText] = useState<string>('');
  const [savingItem, setSavingItem] = useState<boolean>(false);
  const db = getFirestore(app);

  // Buscar lista de clientes do Firestore
  useEffect(() => {
    const fetchClientes = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Buscar dados da coleção 'clients' no Firestore
        const clientesCollection = collection(db, 'clients');
        const clientesSnapshot = await getDocs(clientesCollection);
        
        // Mapear os documentos para o formato necessário
        const clientesList = clientesSnapshot.docs.map(doc => ({
          id: doc.id,
          nome: doc.data().name || 'Nome não informado' // Usar o campo 'name' conforme especificado
        }));
        
        setClientes(clientesList);
      } catch (err) {
        console.error('Erro ao buscar clientes:', err);
        setError(err instanceof Error ? err.message : 'Erro ao buscar clientes');
      } finally {
        setLoading(false);
      }
    };
    
    fetchClientes();
  }, [db]);

  // Buscar os itens do checklist de um cliente do Firestore
  const fetchChecklistItems = async (clientId: string) => {
    try {
      const checklistCollection = collection(db, `clients/${clientId}/rebalanceamento`);
      const q = query(checklistCollection, orderBy('createdAt')); // Ordenar por createdAt
      const checklistSnapshot = await getDocs(q);
      
      const items = checklistSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChecklistItem[];
      
      setChecklistItems(prev => ({
        ...prev,
        [clientId]: items
      }));
      
    } catch (err) {
      console.error(`Erro ao buscar checklist para cliente ${clientId}:`, err);
      // Não exibimos o erro na interface, apenas inicializamos com array vazio
      setChecklistItems(prev => ({
        ...prev,
        [clientId]: []
      }));
    }
  };

  // Toggle expandir/recolher checklist
  const toggleExpand = async (clientId: string) => {
    if (expandedClient === clientId) {
      setExpandedClient(null);
    } else {
      setExpandedClient(clientId);
      if (!checklistItems[clientId]) {
        await fetchChecklistItems(clientId);
      }
    }
  };

  // Adicionar novo item ao checklist
  const addChecklistItem = async (clientId: string) => {
    if (!newItemText.trim() || savingItem) return;
    
    try {
      setSavingItem(true);
      
      const timestamp = Date.now();
      const newItemData = {
        text: newItemText,
        checked: false,
        createdAt: timestamp
      };
      
      // Salvar no Firestore
      const checklistCollection = collection(db, `clients/${clientId}/rebalanceamento`);
      const docRef = await addDoc(checklistCollection, newItemData);
      
      // Atualizar estado local com o novo item e ID real
      const newItem: ChecklistItem = { id: docRef.id, ...newItemData };
      setChecklistItems(prev => ({
        ...prev,
        [clientId]: [...(prev[clientId] || []), newItem]
      }));
      
      setNewItemText('');
      
    } catch (err) {
      console.error('Erro ao salvar item:', err);
      alert('Erro ao salvar item. Tente novamente.');
    } finally {
      setSavingItem(false);
    }
  };

  // Toggle o estado checked de um item
  const toggleChecklistItem = async (clientId: string, itemId: string) => {
    const currentItems = checklistItems[clientId] || [];
    const itemIndex = currentItems.findIndex(item => item.id === itemId);
    if (itemIndex === -1) return;

    const currentItem = currentItems[itemIndex];
    const newCheckedState = !currentItem.checked;

    // Atualizar estado local imediatamente
    const updatedItems = [
      ...currentItems.slice(0, itemIndex),
      { ...currentItem, checked: newCheckedState },
      ...currentItems.slice(itemIndex + 1)
    ];
    setChecklistItems(prev => ({ ...prev, [clientId]: updatedItems }));

    try {
      // Atualizar no Firestore
      const itemRef = doc(db, `clients/${clientId}/rebalanceamento/${itemId}`);
      await updateDoc(itemRef, { checked: newCheckedState });
    } catch (err) {
      console.error('Erro ao atualizar item:', err);
      // Reverter mudança local em caso de erro
      setChecklistItems(prev => ({ ...prev, [clientId]: currentItems }));
      alert('Erro ao atualizar item. Tente novamente.');
    }
  };

  // Remover um item do checklist
  const removeChecklistItem = async (clientId: string, itemId: string) => {
    const currentItems = checklistItems[clientId] || [];
    const updatedItems = currentItems.filter(item => item.id !== itemId);

    // Remover do estado local primeiro
    setChecklistItems(prev => ({ ...prev, [clientId]: updatedItems }));

    try {
      // Remover do Firestore
      const itemRef = doc(db, `clients/${clientId}/rebalanceamento/${itemId}`);
      await deleteDoc(itemRef);
    } catch (err) {
      console.error('Erro ao remover item:', err);
      // Reverter a mudança local em caso de erro
      setChecklistItems(prev => ({ ...prev, [clientId]: currentItems }));
      alert('Erro ao remover item. Tente novamente.');
    }
  };

  // Lidar com tecla Enter para adicionar item
  const handleKeyPress = (e: React.KeyboardEvent, clientId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItem(clientId);
    }
  };

  // Função para calcular progresso
  const calculateProgress = (clientId: string): number => {
    const items = checklistItems[clientId] || [];
    if (items.length === 0) return 0;
    const checkedItems = items.filter(item => item.checked).length;
    return (checkedItems / items.length) * 100;
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Rebalanceamento de Carteiras</h2>
      
      {loading && (
        <div className="text-center py-8 text-gray-300">
          Carregando clientes...
        </div>
      )}
      
      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-200 p-4 rounded mb-4">
          {error}
        </div>
      )}
      
      {!loading && !error && clientes.length === 0 && (
        <div className="bg-gray-700 text-center py-8 rounded w-4/5 mx-auto">
          <p className="text-gray-300">Nenhum cliente encontrado.</p>
        </div>
      )}
      
      {!loading && !error && clientes.length > 0 && (
        <div className="w-4/5 mx-auto space-y-4">
          {clientes.map((cliente) => {
            const progress = calculateProgress(cliente.id);
            return (
              <div key={cliente.id} className="bg-gray-700 rounded-lg border border-gray-600 overflow-hidden">
                {/* Cabeçalho do card */}
                <div 
                  className="p-4 flex justify-between items-center w-full cursor-pointer hover:bg-gray-600/50 transition-colors"
                >
                  <div className="flex-grow pr-4">
                    <h3 className="text-lg font-medium text-white">{cliente.nome}</h3>
                    {/* Barra de Progresso */}
                    <div className="mt-2 h-2 w-full bg-gray-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-cyan-500 transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                  <button 
                    onClick={() => toggleExpand(cliente.id)}
                    className="h-8 w-8 flex-shrink-0 flex items-center justify-center rounded-full bg-cyan-600 hover:bg-cyan-700 text-white text-xl transition-colors"
                    aria-label="Expandir checklist"
                  >
                    {expandedClient === cliente.id ? '−' : '+'}
                  </button>
                </div>
                
                {/* Checklist expandido */}
                {expandedClient === cliente.id && (
                  <div className="px-4 pb-4 border-t border-gray-600">
                    <div className="pt-4 space-y-2">
                      {/* Lista de itens do checklist */}
                      {(checklistItems[cliente.id]?.length ?? 0) === 0 ? (
                        <p className="text-gray-400 text-center py-2">Nenhum item adicionado.</p>
                      ) : (
                        checklistItems[cliente.id]?.map((item) => (
                          <div key={item.id} className="flex items-start gap-2 group">
                            <input 
                              type="checkbox" 
                              checked={item.checked} 
                              onChange={() => toggleChecklistItem(cliente.id, item.id)}
                              className="mt-1 h-4 w-4 rounded border-gray-500 text-cyan-600 focus:ring-cyan-500"
                            />
                            <span className={`text-white flex-grow ${item.checked ? 'line-through text-gray-400' : ''}`}>
                              {item.text}
                            </span>
                            <button 
                              onClick={() => removeChecklistItem(cliente.id, item.id)} 
                              className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="Remover item"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        ))
                      )}
                      
                      {/* Adicionar novo item */}
                      <div className="flex items-center gap-2 mt-4">
                        <input 
                          type="text" 
                          value={newItemText} 
                          onChange={(e) => setNewItemText(e.target.value)} 
                          onKeyPress={(e) => handleKeyPress(e, cliente.id)}
                          placeholder="Adicionar novo item..." 
                          className="flex-grow bg-gray-800 border border-gray-600 rounded p-2 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500"
                          disabled={savingItem}
                        />
                        <button 
                          onClick={() => addChecklistItem(cliente.id)} 
                          className="bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                          disabled={!newItemText.trim() || savingItem}
                        >
                          {savingItem ? 'Salvando...' : 'Adicionar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 