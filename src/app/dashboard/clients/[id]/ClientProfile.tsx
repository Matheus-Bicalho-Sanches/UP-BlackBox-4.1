'use client'

import { useState, useEffect } from 'react';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import app from '@/config/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, getDocs } from 'firebase/firestore';
import PaymentModal from '@/components/payment-modal';
import ClientProfitability from '@/components/dashboard/ClientProfitability';
import ClientAllocationHistoryChart from '@/components/dashboard/ClientAllocationHistoryChart';
import InputMask from 'react-input-mask';

interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  brokers?: string[];
  managementFee?: number;
  performanceFee?: number;
  investedAmount?: number;
  lastMeeting?: string;
  nextMeeting?: string;
  observations?: string;
  cardTokenId?: string;
  asaasId?: string;
  cpf?: string;
  benchmark?: string;
}

interface SectionProps {
  title: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  onEdit?: () => void;
}

function Section({ title, children, defaultExpanded = false, onEdit }: SectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-gray-800 rounded-lg shadow mb-6">
      <div 
        className="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent section toggle when clicking edit
                onEdit();
              }}
              className="p-1.5 text-gray-400 hover:text-cyan-500 transition-colors"
              title="Editar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </button>
          )}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={`h-5 w-5 transform transition-transform text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {isExpanded && (
        <div className="p-6 border-t border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}

interface Payment {
  id: string;
  date: string;
  value: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  asaasId?: string; // ID do pagamento no Asaas
  description?: string; // Descrição do pagamento
}

export default function ClientProfilePageClient({ id }: { id: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const db = getFirestore(app);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const docRef = doc(db, 'clients', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setClient({
            id: docSnap.id,
            ...docSnap.data(),
          } as Client);
        } else {
          router.push('/dashboard/clients');
        }
      } catch (error) {
        console.error('Error fetching client:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [id, db, router]);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const paymentsRef = collection(db, 'payments');
        const q = query(
          paymentsRef,
          where('clientId', '==', id),
        );
        const querySnapshot = await getDocs(q);
        const paymentsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Payment[];
        setPayments(paymentsData);
      } catch (error) {
        console.error('Error fetching payments:', error);
      } finally {
        setLoadingPayments(false);
      }
    };

    fetchPayments();
  }, [id, db]);

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      // Formato (XX) XXXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      // Formato (XX) XXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    // Retorna o original se não corresponder a 10 ou 11 dígitos
    return phone;
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return 'Não informado';
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Função para processar o pagamento
  const handlePayment = async (paymentId: string, method: 'CREDIT_CARD' | 'PIX') => {
    try {
      const response = await fetch('/api/asaas/payments/receive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentMethod: method,
          paymentId: paymentId,
          customerId: client?.asaasId,
          value: selectedPayment?.value,
          creditCardToken: client?.cardTokenId,
          description: selectedPayment?.description
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao processar pagamento');
      }

      // Atualizar a lista de pagamentos
      const updatedPayments = payments.map(payment => 
        payment.id === paymentId 
          ? { ...payment, status: 'paid' as const }
          : payment
      );
      setPayments(updatedPayments);
      setIsPaymentModalOpen(false);
      setSelectedPayment(null);

      alert('Pagamento processado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao processar pagamento:', error);
      alert(error.message || 'Erro ao processar pagamento');
    }
  };

  // Função para formatar CPF
  const formatCPF = (cpf?: string) => {
    if (!cpf) return 'Não informado';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf; // Retorna original se não tiver 11 dígitos
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  return (
    <div className="w-[95%] mx-auto space-y-0">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Perfil do Cliente</h1>
        <button
          onClick={() => router.back()}
          className="text-gray-300 hover:text-white"
        >
          Voltar
        </button>
      </div>

      {/* Informações Básicas */}
      <Section 
        title="Informações Básicas" 
        defaultExpanded={true}
        onEdit={() => router.push(`/dashboard/clients/${id}/edit`)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Nome</label>
            <p className="text-white text-lg">{client.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">CPF</label>
            <p className="text-white text-lg">{formatCPF(client.cpf)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">WhatsApp</label>
            <a
              href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-500 hover:text-cyan-400 text-lg"
            >
              {formatPhoneNumber(client.phone)}
            </a>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
            <p className="text-white text-lg">
              {client.email || <span className="text-gray-500">Não informado</span>}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Benchmark p/ Performance</label>
            <p className="text-white text-lg">
              {client.benchmark || <span className="text-gray-500">Não informado</span>}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Última Reunião
            </label>
            <p className="text-white text-lg">
              {client.lastMeeting || <span className="text-gray-500">Não informado</span>}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Próxima Reunião
            </label>
            <p className="text-white text-lg">
              {client.nextMeeting || <span className="text-gray-500">Não informado</span>}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Histórico de Conversas
            </label>
            <Link
              href={`/dashboard/clients/${id}/conversations`}
              className="text-cyan-500 hover:text-cyan-400 text-lg"
            >
              Ver histórico
            </Link>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Patrimônio Investido
            </label>
            <p className="text-white text-lg">
              {formatCurrency(client.investedAmount)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Taxa de Administração
            </label>
            <p className="text-white text-lg">
              {client.managementFee !== undefined && client.managementFee !== null ? (
                `${client.managementFee}%`
              ) : (
                <span className="text-gray-500">Não informado</span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">
              Taxa de Performance
            </label>
            <p className="text-white text-lg">
              {client.performanceFee !== undefined && client.performanceFee !== null ? (
                `${client.performanceFee}%`
              ) : (
                <span className="text-gray-500">Não informado</span>
              )}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Corretoras</label>
            <p className="text-white text-lg">
              {client.brokers && client.brokers.length > 0 
                ? client.brokers.join(', ')
                : 'Não informado'}
            </p>
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-400 mb-1">Observações</label>
            <div className="bg-gray-700/50 rounded-lg p-4 min-h-[120px]">
              {client.observations ? (
                <p className="text-white text-lg whitespace-pre-wrap">
                  {client.observations}
                </p>
              ) : (
                <p className="text-gray-500 text-lg">Não informado</p>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* Rentabilidade da Carteira - NOVA SEÇÃO */}
      <Section
        title="Rentabilidade da Carteira"
        defaultExpanded={true}
      >
         <ClientProfitability clientId={id} /> 
      </Section>

      {/* Alocação */}
      <Section 
        title={
          <div className="flex justify-between items-center w-full">
            <span className="mr-4">Histórico de Alocação por Classe</span>
            <button
              onClick={() => router.push(`/dashboard/clients/${id}/allocation`)}
              className="px-3 py-1 bg-cyan-600 text-white text-sm rounded hover:bg-cyan-700 transition-colors"
            >
              Ver alocação e movimentações
            </button>
          </div>
        }
        defaultExpanded={true}
      >
        <ClientAllocationHistoryChart clientId={id} />
      </Section>

      {/* Seção de Pagamentos - AGORA USANDO O COMPONENTE Section */}
      <Section title="Pagamentos" defaultExpanded={true}>
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!client?.cardTokenId}
                className="w-4 h-4 text-cyan-500 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 focus:ring-2"
                disabled
              />
              <span className="text-gray-300 text-sm">
                Cartão cadastrado
              </span>
              {!client?.cardTokenId && (
                <Link
                  href={`/dashboard/clients/${id}/card`}
                  className="text-cyan-500 hover:text-cyan-400 text-sm ml-2"
                >
                  Cadastrar cartão
                </Link>
              )}
            </div>
          </div>
          <button
            onClick={() => router.push(`/dashboard/clients/${id}/payments/new`)}
            className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600"
          >
            Novo Pagamento
          </button>
        </div>

        {loadingPayments ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
          </div>
        ) : payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-gray-400">
                  <th className="pb-3">Data</th>
                  <th className="pb-3">Vencimento</th>
                  <th className="pb-3">Valor</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t border-gray-700">
                    <td className="py-3 text-white">
                      {new Date(payment.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 text-white">
                      {new Date(payment.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 text-white">
                      {payment.value.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL'
                      })}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-sm ${
                        payment.status === 'paid' 
                          ? 'bg-green-900 text-green-300'
                          : payment.status === 'overdue'
                          ? 'bg-red-900 text-red-300'
                          : 'bg-yellow-900 text-yellow-300'
                      }`}>
                        {payment.status === 'paid' ? 'Pago' 
                          : payment.status === 'overdue' ? 'Atrasado' 
                          : 'Pendente'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/clients/${id}/payments/${payment.id}`)}
                          className="p-1.5 text-gray-400 hover:text-cyan-500 transition-colors"
                          title="Editar"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>

                        {payment.status !== 'paid' && (
                          <button
                            onClick={() => {
                              setSelectedPayment(payment);
                              setIsPaymentModalOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-green-500 transition-colors"
                            title="Receber pagamento"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            Nenhum pagamento registrado
          </div>
        )}
      </Section>

      {/* Modal de Pagamento */}
      {selectedPayment && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false)
            setSelectedPayment(null)
          }}
          onConfirm={(method) => handlePayment(selectedPayment.id, method)}
          hasCard={!!client?.cardTokenId}
          value={selectedPayment.value}
        />
      )}
    </div>
  );
} 