'use client'

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { 
  doc, 
  getDoc, 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  addDoc,
  updateDoc,
  Timestamp // Importar Timestamp
} from 'firebase/firestore';
import app from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext'; // Para obter o usuário logado

// Interface para a transação, conforme planejado
interface Transaction {
  id: string; // ID do documento Firestore
  clientId: string;
  date: string; // YYYY-MM-DD
  type: 'aporte' | 'resgate';
  amount: number;
  portfolioValueBefore: number; // NOVO: Valor da carteira antes da transação
  createdAt: Timestamp; // Usar Timestamp do Firestore
  createdBy: string; // Email ou ID do usuário logado
  notes?: string;
}

export default function TransactionsPage({ params }: { params: { id: string } }) {
  const { user } = useAuth(); // Obter usuário atual
  const router = useRouter();
  const db = getFirestore(app);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<{ name: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isEditingHighlight, setIsEditingHighlight] = useState(false); // Estado para feedback visual
  
  // Estados para o formulário (usados para adicionar e editar)
  const [editId, setEditId] = useState<string | null>(null); // ID da transação em edição
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentType, setCurrentType] = useState<'aporte' | 'resgate'>('aporte');
  const [currentAmount, setCurrentAmount] = useState<number>(0);
  const [currentPortfolioValueBefore, setCurrentPortfolioValueBefore] = useState<number>(0); 
  const [currentNotes, setCurrentNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Função para buscar dados do cliente e transações
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Buscar dados do cliente (apenas se ainda não tiver)
      if (!client) {
          const clientDoc = await getDoc(doc(db, 'clients', params.id));
          if (!clientDoc.exists()) {
            setError("Cliente não encontrado.");
            setLoading(false);
            return;
          }
          setClient({ name: clientDoc.data().name });
      }

      // Buscar transações
      const transactionsRef = collection(db, 'transactions');
      const q = query(
        transactionsRef,
        where('clientId', '==', params.id),
        orderBy('date', 'desc') // Mais recentes primeiro na lista
      );
      const querySnapshot = await getDocs(q);
      
      const fetchedTransactions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      
      setTransactions(fetchedTransactions);

    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(`Erro ao buscar dados: ${err.message || 'Erro desconhecido.'}`);
    } finally {
      setLoading(false);
    }
  };

  // Buscar dados iniciais
  useEffect(() => {
    fetchData();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, db]); // Dependências para busca inicial

  // Função para iniciar a edição
  const handleEditClick = (transaction: Transaction) => {
    setEditId(transaction.id);
    setCurrentDate(transaction.date);
    setCurrentType(transaction.type);
    setCurrentAmount(transaction.amount);
    setCurrentPortfolioValueBefore(transaction.portfolioValueBefore);
    setCurrentNotes(transaction.notes || '');
    setFormError(null);
    // Opcional: rolar para o formulário
    const formElement = document.getElementById('transaction-form');
    formElement?.scrollIntoView({ behavior: 'smooth' });
    // Adiciona feedback visual
    setIsEditingHighlight(true);
    setTimeout(() => setIsEditingHighlight(false), 500); // Remove o destaque após 500ms
  };

  // Função para cancelar a edição
  const handleCancelEdit = () => {
    setEditId(null);
    setCurrentDate(new Date().toISOString().split('T')[0]);
    setCurrentType('aporte');
    setCurrentAmount(0);
    setCurrentPortfolioValueBefore(0);
    setCurrentNotes('');
    setFormError(null);
    setIsEditingHighlight(false); // Garante que o destaque seja removido
  };

  // Handler para submissão do formulário (Adicionar ou Atualizar)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); // Manter preventDefault aqui
    setFormError(null);

    if (!user) {
        setFormError("Usuário não autenticado.");
        return;
    }
    if (currentAmount <= 0) {
      setFormError("O valor da transação deve ser maior que zero.");
      return;
    }
    if (currentPortfolioValueBefore < 0) {
        setFormError("O valor do portfólio antes da transação não pode ser negativo.");
        return;
    }
    if (!currentDate) {
        setFormError("A data da transação é obrigatória.");
        return;
    }

    setSaving(true);

    try {
      const transactionData: any = { // Usar 'any' temporariamente ou criar interface específica
        clientId: params.id,
        date: currentDate,
        type: currentType,
        amount: currentAmount,
        portfolioValueBefore: currentPortfolioValueBefore,
        // Não atualizamos createdAt ou createdBy na edição
      };

      // Adiciona 'notes' apenas se não estiver vazio
      const trimmedNotes = currentNotes.trim();
      if (trimmedNotes) {
          transactionData.notes = trimmedNotes;
      } else {
          // Garantir que 'notes' seja removido ou definido como null/undefined se vazio
          // dependendo de como você quer tratar no Firestore. Se o campo pode não existir:
          transactionData.notes = null; // Ou delete transactionData.notes;
      }

      if (editId) {
        // Atualizar transação existente
        const transactionRef = doc(db, 'transactions', editId);
        // Adiciona um campo de atualização para rastrear a modificação
        transactionData.lastUpdatedAt = Timestamp.now(); 
        transactionData.lastUpdatedBy = user.uid; 

        await updateDoc(transactionRef, transactionData);

      } else {
        // Adicionar nova transação
        transactionData.createdAt = Timestamp.now();
        transactionData.createdBy = user.uid;
        const transactionsRef = collection(db, 'transactions');
        await addDoc(transactionsRef, transactionData);
      }

      handleCancelEdit(); // Limpa o formulário e o modo de edição
      await fetchData(); // Rebusca a lista para incluir/atualizar a transação

    } catch (err: any) {
      console.error(`Error ${editId ? 'updating' : 'adding'} transaction:`, err);
      setFormError(`Erro ao ${editId ? 'atualizar' : 'salvar'} transação: ${err.message || 'Erro desconhecido.'}`);
    } finally {
      setSaving(false);
    }
  };
  
  // Funções de formatação
  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (dateString: string) => {
      try {
          return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
      } catch (e) { return dateString; }
  };
  const formatTimestamp = (timestamp: Timestamp | undefined) => {
      if (!timestamp) return 'N/A';
      try {
          return timestamp.toDate().toLocaleString('pt-BR');
      } catch (e) { return 'Data inválida'; }
  }

  // --- Renderização ---

  if (loading && !client) { // Loading inicial mais robusto
    return (
      <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-[95%] mx-auto pb-12">
         <div className="flex justify-between items-center mb-6">
             <h1 className="text-2xl font-bold text-white">Erro</h1>
             <button onClick={() => router.back()} className="text-gray-300 hover:text-white">Voltar</button>
         </div>
         <div className="bg-red-900 text-red-100 p-4 rounded-lg text-center">
            <p>{error}</p>
         </div>
      </div>
    );
  }

  return (
    <div className="w-[95%] mx-auto pb-12">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Movimentações Financeiras</h1>
          <p className="text-gray-400">Cliente: {client?.name || 'Carregando...'}</p>
        </div>
        <button
          onClick={() => router.back()}
          className="text-gray-300 hover:text-white"
        >
          Voltar
        </button>
      </div>

      {/* Formulário para Adicionar/Editar Transação */}
      <div 
        id="transaction-form" 
        className={`bg-gray-800 rounded-lg p-6 mb-8 border border-gray-700 scroll-mt-20 transition-colors duration-300 ease-in-out ${isEditingHighlight ? 'bg-gray-700 border-cyan-500 shadow-lg' : ''}`} // Estilo condicional para destaque
      > 
        <h2 className="text-lg font-semibold text-white mb-4">
          {editId ? 'Editar Transação' : 'Adicionar Nova Transação'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4"> {/* Atualizado onSubmit */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Data */}
            <div>
              <label htmlFor="currentDate" className="block text-sm font-medium text-gray-300 mb-1">Data</label>
              <input
                id="currentDate"
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)} // Atualizado
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-70"
                required
                disabled={saving}
              />
            </div>
            {/* Tipo */}
            <div>
              <label htmlFor="currentType" className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
              <select
                id="currentType"
                value={currentType}
                onChange={(e) => setCurrentType(e.target.value as 'aporte' | 'resgate')} // Atualizado
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-70"
                required
                disabled={saving}
              >
                <option value="aporte">Aporte</option>
                <option value="resgate">Resgate</option>
              </select>
            </div>
            {/* Valor */}
            <div>
              <label htmlFor="currentAmount" className="block text-sm font-medium text-gray-300 mb-1">Valor Transação (R$)</label>
              <input
                id="currentAmount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={currentAmount === 0 ? '' : currentAmount}
                onChange={(e) => setCurrentAmount(parseFloat(e.target.value) || 0)} // Atualizado
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-70"
                required
                disabled={saving}
              />
            </div>
          </div>
          {/* Linha 2: Valor Portfólio Antes, Notas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Valor Portfólio Antes */}
              <div className="md:col-span-1">
                 <label htmlFor="currentPortfolioValueBefore" className="block text-sm font-medium text-gray-300 mb-1">Valor Portfólio Antes (R$)</label>
                 <input
                   id="currentPortfolioValueBefore"
                   type="number"
                   step="0.01"
                   min="0"
                   placeholder="0,00"
                   value={currentPortfolioValueBefore === 0 ? '' : currentPortfolioValueBefore}
                   onChange={(e) => setCurrentPortfolioValueBefore(parseFloat(e.target.value) || 0)} // Atualizado
                   className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-70"
                   required
                   disabled={saving}
                 />
              </div>
              {/* Notas */}
             <div className="md:col-span-2">
                <label htmlFor="currentNotes" className="block text-sm font-medium text-gray-300 mb-1">Notas (Opcional)</label>
                <textarea
                  id="currentNotes"
                  rows={2}
                  value={currentNotes}
                  onChange={(e) => setCurrentNotes(e.target.value)} // Atualizado
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-70"
                  disabled={saving}
                />
             </div>
          </div>
           {/* Erro do formulário */}
           {formError && (
             <p className="text-sm text-red-500">{formError}</p>
           )}
          {/* Botões Salvar/Cancelar */}
          <div className="flex justify-end gap-3">
            {editId && ( // Mostrar botão Cancelar apenas durante a edição
              <button
                type="button" // Importante ser type="button" para não submeter o form
                onClick={handleCancelEdit}
                disabled={saving} 
                className="px-4 py-2 text-gray-300 hover:text-white rounded border border-gray-600 hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saving || loading} 
              className="px-6 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors disabled:opacity-50"
            >
              {saving ? (editId ? 'Salvando...' : 'Adicionando...') : (editId ? 'Salvar Alterações' : 'Adicionar Transação')}
            </button>
          </div>
        </form>
      </div>

      {/* Lista de Transações */}
      <div className="bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-700">
        <h2 className="text-lg font-semibold text-white p-6 border-b border-gray-700">Histórico de Transações</h2>
        {loading ? (
            <div className="flex justify-center items-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
        ) : transactions.length === 0 ? (
            <p className="text-gray-400 text-center py-10 px-6">Nenhuma transação registrada para este cliente.</p>
        ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="text-left bg-gray-700/50">
                    <th className="px-6 py-3 text-gray-300 font-medium">Data</th>
                    <th className="px-6 py-3 text-gray-300 font-medium">Tipo</th>
                    <th className="px-6 py-3 text-gray-300 font-medium text-right">Valor</th>
                    <th className="px-6 py-3 text-gray-300 font-medium">Notas</th>
                    <th className="px-6 py-3 text-gray-300 font-medium">Registrado Por</th>
                    <th className="px-6 py-3 text-gray-300 font-medium">Registrado Em</th>
                    <th className="px-6 py-3 text-gray-300 font-medium text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="border-b border-gray-700 hover:bg-gray-700/50 last:border-b-0">
                      <td className="px-6 py-4 text-white whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-6 py-4 text-white">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          tx.type === 'aporte' ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                        }`}>
                          {tx.type === 'aporte' ? 'Aporte' : 'Resgate'}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-white text-right whitespace-nowrap ${
                          tx.type === 'aporte' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.type === 'aporte' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </td>
                      <td className="px-6 py-4 text-gray-300 max-w-xs truncate" title={tx.notes}>{tx.notes || '-'}</td>
                      <td className="px-6 py-4 text-gray-300 truncate" title={tx.createdBy}>{tx.createdBy || 'N/A'}</td>
                      <td className="px-6 py-4 text-gray-300 whitespace-nowrap">{formatTimestamp(tx.createdAt)}</td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleEditClick(tx)} // Atualizado onClick
                          title="Editar Transação"
                          className="p-1 text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
                          disabled={saving} // Desabilitar enquanto salva
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
                            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        )}
      </div>
    </div>
  );
} 