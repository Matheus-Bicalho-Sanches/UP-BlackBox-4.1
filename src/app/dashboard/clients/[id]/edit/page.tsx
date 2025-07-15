'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import app from '@/config/firebase';
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
  observations?: string;
  cpf?: string;
  benchmark?: string;
}

export default function EditClientPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    brokers: [''],
    managementFee: '',
    performanceFee: '',
    investedAmount: '',
    lastMeeting: '',
    observations: '',
    cpf: '',
    benchmark: '',
  });

  const db = getFirestore(app);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        const docRef = doc(db, 'clients', params.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const clientData = docSnap.data() as Client;
          setFormData({
            name: clientData.name,
            phone: formatPhoneNumber(clientData.phone),
            email: clientData.email || '',
            brokers: clientData.brokers?.length ? clientData.brokers : [''],
            managementFee: clientData.managementFee?.toString() || '',
            performanceFee: clientData.performanceFee?.toString() || '',
            investedAmount: clientData.investedAmount 
              ? formatCurrency(clientData.investedAmount)
              : '',
            lastMeeting: clientData.lastMeeting || '',
            observations: clientData.observations || '',
            cpf: clientData.cpf || '',
            benchmark: clientData.benchmark || '',
          });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const cleanPhone = formData.phone.replace(/\D/g, '');

      const dataToSubmit = {
        name: formData.name,
        phone: cleanPhone,
        email: formData.email,
        brokers: formData.brokers.filter(broker => broker.trim() !== ''),
        managementFee: formData.managementFee ? parseFloat(formData.managementFee) : null,
        performanceFee: formData.performanceFee ? parseFloat(formData.performanceFee) : null,
        investedAmount: formData.investedAmount 
          ? parseFloat(formData.investedAmount.replace(/[R$\s.]/g, '').replace(',', '.'))
          : null,
        lastMeeting: formData.lastMeeting,
        observations: formData.observations,
        cpf: formData.cpf,
        benchmark: formData.benchmark,
      };

      const docRef = doc(db, 'clients', params.id);
      await updateDoc(docRef, dataToSubmit);
      router.push(`/dashboard/clients/${params.id}`);
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Erro ao atualizar cliente. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    
    if (value.length <= 11) {
      // Format as (XX) XXXXX-XXXX
      if (value.length > 2) {
        value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
      }
      if (value.length > 10) {
        value = `${value.slice(0, 10)}-${value.slice(10)}`;
      }
      
      setFormData({ ...formData, phone: value });
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, ''); // Remove non-digits
    
    // Convert to number with 2 decimal places
    const numberValue = parseInt(value) / 100;
    
    // Format as currency
    if (value) {
      const formatted = numberValue.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      });
      setFormData({ ...formData, investedAmount: formatted });
    } else {
      setFormData({ ...formData, investedAmount: '' });
    }
  };

  const handleBrokerChange = (index: number, value: string) => {
    const newBrokers = [...formData.brokers];
    newBrokers[index] = value;
    setFormData({ ...formData, brokers: newBrokers });
  };

  const addBrokerField = () => {
    setFormData({ ...formData, brokers: [...formData.brokers, ''] });
  };

  const removeBrokerField = (index: number) => {
    if (formData.brokers.length > 1) {
      const newBrokers = formData.brokers.filter((_, i) => i !== index);
      setFormData({ ...formData, brokers: newBrokers });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="w-[95%] mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Editar Cliente</h1>
        <button
          onClick={() => router.back()}
          className="text-gray-300 hover:text-white"
        >
          Voltar
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              CPF <span className="text-red-500">*</span>
            </label>
            <InputMask
              mask="999.999.999-99"
              maskChar={null}
              type="text"
              id="cpf"
              name="cpf"
              value={formData.cpf}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="000.000.000-00"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              WhatsApp <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={handlePhoneChange}
              placeholder="(00) 00000-0000"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              E-mail
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Corretoras
            </label>
            <div className="space-y-2">
              {formData.brokers.map((broker, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={broker}
                    onChange={(e) => handleBrokerChange(index, e.target.value)}
                    placeholder="Nome da corretora"
                    className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  {formData.brokers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBrokerField(index)}
                      className="px-3 py-2 text-red-500 hover:text-red-400"
                    >
                      Remover
                    </button>
                  )}
                  {index === formData.brokers.length - 1 && (
                    <button
                      type="button"
                      onClick={addBrokerField}
                      className="px-3 py-2 text-cyan-500 hover:text-cyan-400"
                    >
                      Adicionar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Patrimônio Investido
            </label>
            <input
              type="text"
              value={formData.investedAmount}
              onChange={handleAmountChange}
              placeholder="R$ 0,00"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Taxa de Administração (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.managementFee}
                onChange={handleChange}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Taxa de Performance (%)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.performanceFee}
                onChange={handleChange}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Última Reunião
            </label>
            <input
              type="date"
              value={formData.lastMeeting}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Observações
            </label>
            <textarea
              value={formData.observations}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y"
              placeholder="Adicione observações sobre o cliente..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Benchmark p/ Performance
            </label>
            <select
              name="benchmark"
              value={formData.benchmark}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">Selecione...</option>
              <option value="CDI">CDI</option>
              <option value="IFIX">IFIX</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-gray-300 hover:text-white"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 