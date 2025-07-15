'use client'

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import app from '@/config/firebase';

interface ClientData {
  id: string;
  name: string;
  email: string;
  investedAmount?: number;
}

interface AllocationData {
  date: string;
  totalValue: number;
  assets: {
    type: string;
    investments: {
      name: string;
      value: number;
    }[];
  }[];
}

export default function ClientPortalContent() {
  const { user } = useAuth();
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [latestAllocation, setLatestAllocation] = useState<AllocationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.email) return;

      try {
        const db = getFirestore(app);
        const clientsRef = collection(db, 'clients');
        const q = query(clientsRef, where('email', '==', user.email));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const clientDoc = querySnapshot.docs[0];
          const clientId = clientDoc.id;
          setClientData({
            id: clientId,
            ...clientDoc.data()
          } as ClientData);

          // Fetch latest allocation
          const allocationsRef = collection(db, 'allocations');
          const allocationsQuery = query(
            allocationsRef,
            where('clientId', '==', clientId)
          );
          const allocationsSnapshot = await getDocs(allocationsQuery);
          
          if (!allocationsSnapshot.empty) {
            const sortedAllocations = allocationsSnapshot.docs
              .map(doc => ({ ...doc.data() }))
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            setLatestAllocation(sortedAllocations[0] as AllocationData);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">
        Bem-vindo(a), {clientData?.name?.split(' ')[0]}!
      </h1>

      {/* Cards de Visão Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400">Patrimônio Total</h3>
            <svg className="h-5 w-5 text-cyan-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 8v8m-4-4h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">
            {latestAllocation?.totalValue.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL'
            })}
          </p>
          <p className="mt-2 text-sm text-green-500">
            +2.5% vs último mês
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400">Rentabilidade</h3>
            <svg className="h-5 w-5 text-cyan-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9l4-4 7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 15l4-4 7 7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">15.8%</p>
          <p className="mt-2 text-sm text-green-500">
            +1.2% vs CDI
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400">Volatilidade</h3>
            <svg className="h-5 w-5 text-cyan-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 12h4l3-9 4 18 3-9h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">8.2%</p>
          <p className="mt-2 text-sm text-yellow-500">
            Moderado
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-gray-400">Ativos</h3>
            <svg className="h-5 w-5 text-cyan-500" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">25</p>
          <p className="mt-2 text-sm text-cyan-500">
            Diversificado
          </p>
        </div>
      </div>

      {/* Seletor de Período */}
      <div className="flex space-x-2">
        <button className="px-3 py-1 text-sm rounded-md bg-cyan-500 text-white">1S</button>
        <button className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600">1M</button>
        <button className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600">3M</button>
        <button className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600">6M</button>
        <button className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600">1A</button>
        <button className="px-3 py-1 text-sm rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600">MAX</button>
      </div>

      {/* Área do Gráfico */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Evolução Patrimonial</h2>
        <div className="h-64 flex items-center justify-center text-gray-400">
          Área do Gráfico
        </div>
      </div>
    </div>
  );
} 