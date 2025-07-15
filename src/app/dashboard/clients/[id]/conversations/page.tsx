'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import app from '@/config/firebase';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

// Dynamic import of ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => (
    <div className="h-96 bg-gray-700/50 rounded-lg animate-pulse"></div>
  ),
});

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ font: [] }],
    [{ size: ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ align: [] }],
    ['clean'],
  ],
};

const formats = [
  'header',
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'strike',
  'color',
  'background',
  'list',
  'bullet',
  'align',
];

interface Client {
  id: string;
  name: string;
  conversationHistory?: string;
}

export default function ConversationsPage({ params }: { params: { id: string } }) {
  const [client, setClient] = useState<Client | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const router = useRouter();
  const db = getFirestore(app);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const docRef = doc(db, 'clients', params.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const clientData = {
            id: docSnap.id,
            ...docSnap.data(),
          } as Client;
          setClient(clientData);
          setContent(clientData.conversationHistory || '');
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
  }, [params.id, db, router]);

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);

    try {
      const docRef = doc(db, 'clients', client.id);
      await updateDoc(docRef, {
        conversationHistory: content,
      });
      setLastSaved(new Date());
    } catch (error) {
      console.error('Error saving conversation history:', error);
      alert('Erro ao salvar o histórico. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="w-[95%] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Histórico de Conversas</h1>
          <p className="text-gray-400">Cliente: {client.name}</p>
        </div>
        <div className="flex items-center gap-4">
          {lastSaved && (
            <span className="text-sm text-gray-400">
              Última alteração: {lastSaved.toLocaleString('pt-BR')}
            </span>
          )}
          <button
            onClick={() => router.back()}
            className="text-gray-300 hover:text-white"
          >
            Voltar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <div className="min-h-[600px] text-white">
          <ReactQuill
            theme="snow"
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            className="h-[550px] mb-12 bg-gray-700 rounded-lg"
          />
        </div>
      </div>
    </div>
  );
} 