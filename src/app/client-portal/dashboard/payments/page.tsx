'use client'

import { useState, useEffect } from 'react'
import { getAuth } from 'firebase/auth'
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { CreditCardModal } from '@/components/credit-card-modal'
import app from '@/config/firebase'
import { formatCurrency } from '@/lib/utils'

interface Payment {
  id: string;
  date: string;
  dueDate: string;
  description: string;
  status: string;
  value: number;
  createdAt: string;
}

export default function PaymentsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasCard, setHasCard] = useState(false);
  const [asaasId, setAsaasId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientDocId, setClientDocId] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    const fetchClientData = async () => {
      const auth = getAuth(app);
      const db = getFirestore(app);

      if (auth.currentUser) {
        try {
          const clientsRef = collection(db, 'clients');
          const q = query(clientsRef, where('uid', '==', auth.currentUser.uid));
          const querySnapshot = await getDocs(q);

          if (!querySnapshot.empty) {
            const clientDoc = querySnapshot.docs[0];
            const clientData = clientDoc.data();
            setAsaasId(clientData.asaasId);
            setHasCard(!!clientData.cardTokenId);
            setClientDocId(clientDoc.id);

            const paymentsRef = collection(db, 'payments');
            const paymentsQuery = query(paymentsRef, where('clientId', '==', clientDoc.id));
            const paymentsSnapshot = await getDocs(paymentsQuery);
            
            const paymentsData = paymentsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            })) as Payment[];

            const sortedPayments = paymentsData.sort((a, b) => 
              new Date(b.date).getTime() - new Date(a.date).getTime()
            );

            setPayments(sortedPayments);
          } else {
            console.error('Cliente não encontrado');
          }
        } catch (error) {
          console.error('Erro ao buscar dados:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchClientData();
  }, []);

  const handleCardSuccess = async (tokenizedCard: any) => {
    try {
      const db = getFirestore(app);

      if (clientDocId) {
        await updateDoc(doc(db, 'clients', clientDocId), {
          cardTokenId: tokenizedCard.creditCardToken,
          lastCardDigits: tokenizedCard.creditCardNumber,
          cardBrand: tokenizedCard.creditCardBrand
        });

        setHasCard(true);
      }
    } catch (error) {
      console.error('Erro ao salvar token do cartão:', error);
      alert('Erro ao salvar dados do cartão. Tente novamente.');
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400';
      case 'paid':
        return 'bg-green-500/10 text-green-400';
      case 'overdue':
        return 'bg-red-500/10 text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendente',
      'paid': 'Pago',
      'overdue': 'Vencido'
    };
    return statusMap[status.toLowerCase()] || status;
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!asaasId) {
    return <div>Erro ao carregar dados do cliente.</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Pagamentos</h1>

      {/* Card Status */}
      <div className="bg-[#1C2127] rounded-lg shadow p-6">
        <div className="pb-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Método de Pagamento</h2>
        </div>
        <div className="mt-4 space-y-4">
          <div className="flex items-center space-x-4">
            <input 
              type="checkbox" 
              id="card-registered"
              checked={hasCard}
              readOnly
              className="w-4 h-4 rounded border-gray-700 bg-gray-800"
            />
            <label htmlFor="card-registered" className="text-sm text-gray-400">
              Cartão de crédito cadastrado
            </label>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Cadastrar cartão
          </button>
        </div>
      </div>

      <CreditCardModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleCardSuccess}
        customerId={asaasId}
      />

      {/* Histórico de Cobranças */}
      <div className="bg-[#1C2127] rounded-lg shadow p-6">
        <div className="pb-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Histórico de Cobranças</h2>
        </div>
        <div className="mt-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Data</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Descrição</th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {payments.length > 0 ? (
                  payments.map(payment => (
                    <tr key={payment.id} className="border-b border-gray-800">
                      <td className="py-3 px-4 text-gray-300">
                        {new Date(payment.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-3 px-4 text-gray-300">{payment.description}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded-full text-sm ${getStatusBadgeStyle(payment.status)}`}>
                          {getStatusText(payment.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-300">
                        {formatCurrency(payment.value)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-gray-400">
                      Nenhum pagamento encontrado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
} 