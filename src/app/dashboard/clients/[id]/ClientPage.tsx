'use client'

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import app from '@/config/firebase';
import ClientProfilePageClient from './ClientProfile';

interface Client {
  name: string;
  email: string;
  cpfCnpj: string;
  cardTokenId?: string;
  // ... outros campos
}

export default function ClientPage({ id }: { id: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClient = async () => {
      const db = getFirestore(app);
      const clientDoc = await getDoc(doc(db, 'clients', id));
      
      if (clientDoc.exists()) {
        setClient(clientDoc.data() as Client);
      }
      setLoading(false);
    };

    fetchClient();
  }, [id]);

  if (loading) return <div>Carregando...</div>;
  if (!client) return <div>Cliente não encontrado</div>;

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Pagamentos</h1>
      </div>

      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        </div>
      }>
        <ClientProfilePageClient id={id} />
      </Suspense>
    </div>
  );
} 