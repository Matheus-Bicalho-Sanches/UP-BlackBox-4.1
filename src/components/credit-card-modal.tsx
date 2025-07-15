'use client'

import { useState } from 'react'
import { tokenizeCard } from '@/lib/asaas'

interface CreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (tokenizedCard: any) => void;
  customerId: string; // Novo prop para o ID do cliente no Asaas
}

export function CreditCardModal({ isOpen, onClose, onSuccess, customerId }: CreditCardModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    holderName: '',
    number: '',
    expiryMonth: '',
    expiryYear: '',
    ccv: '',
    email: '',
    cpfCnpj: '',
    phone: '',
    postalCode: '',
    addressNumber: ''
  });

  const formatCardNumber = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{4})/g, '$1 ')
      .trim();
  };

  const formatExpiryMonth = (value: string) => {
    const month = value.replace(/\D/g, '');
    if (month && parseInt(month) > 12) return '12';
    return month;
  };

  const formatExpiryYear = (value: string) => {
    const year = value.replace(/\D/g, '');
    const currentYear = new Date().getFullYear();
    if (year.length === 4 && parseInt(year) < currentYear) {
      return currentYear.toString();
    }
    return year;
  };

  const formatCCV = (value: string) => {
    return value.replace(/\D/g, '');
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const formatPostalCode = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{3})\d+?$/, '$1');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const cardData = {
        customer: customerId,
        creditCard: {
          holderName: formData.holderName,
          number: formData.number.replace(/\s/g, ''),
          expiryMonth: formData.expiryMonth,
          expiryYear: formData.expiryYear,
          ccv: formData.ccv
        },
        creditCardHolderInfo: {
          name: formData.holderName,
          email: formData.email,
          cpfCnpj: formData.cpfCnpj.replace(/\D/g, ''),
          phone: formData.phone.replace(/\D/g, ''),
          postalCode: formData.postalCode.replace(/\D/g, ''),
          addressNumber: formData.addressNumber
        }
      };

      console.log('Enviando dados:', {
        customer: cardData.customer,
        cardNumber: `${cardData.creditCard.number.substring(0, 4)}...${cardData.creditCard.number.slice(-4)}`,
        holderName: cardData.creditCard.holderName,
        email: cardData.creditCardHolderInfo.email,
        cpfCnpj: cardData.creditCardHolderInfo.cpfCnpj,
        phone: cardData.creditCardHolderInfo.phone,
        postalCode: cardData.creditCardHolderInfo.postalCode
      });

      const response = await fetch('/api/asaas/tokenize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cardData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao cadastrar cartão');
      }

      const tokenizedCard = await response.json();
      onSuccess(tokenizedCard);
      onClose();
    } catch (error: any) {
      console.error('Erro ao tokenizar cartão:', error);
      alert(error.message || 'Erro ao cadastrar cartão. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1C2127] text-white p-6 rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Cadastrar Cartão de Crédito</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form id="credit-card-form" onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2">
          <div>
            <label className="text-sm text-gray-400">Nome no Cartão</label>
            <input
              value={formData.holderName}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                holderName: e.target.value.toUpperCase() 
              }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              placeholder="NOME COMO ESTÁ NO CARTÃO"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">Número do Cartão</label>
            <input
              value={formData.number}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                number: formatCardNumber(e.target.value) 
              }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              maxLength={19} // 16 dígitos + 3 espaços
              placeholder="0000 0000 0000 0000"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-400">Mês</label>
              <input
                value={formData.expiryMonth}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  expiryMonth: formatExpiryMonth(e.target.value) 
                }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                maxLength={2}
                placeholder="MM"
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">Ano</label>
              <input
                value={formData.expiryYear}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  expiryYear: formatExpiryYear(e.target.value) 
                }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                maxLength={4}
                placeholder="AAAA"
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">CCV</label>
              <input
                value={formData.ccv}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  ccv: formatCCV(e.target.value) 
                }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                maxLength={4}
                placeholder="123"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">E-mail do Titular</label>
            <input
              value={formData.email}
              onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              type="email"
              placeholder="email@exemplo.com"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">CPF do Titular</label>
            <input
              value={formData.cpfCnpj}
              onChange={e => setFormData(prev => ({ ...prev, cpfCnpj: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              placeholder="000.000.000-00"
              required
            />
          </div>

          <div>
            <label className="text-sm text-gray-400">Telefone do Titular</label>
            <input
              value={formData.phone}
              onChange={e => setFormData(prev => ({ 
                ...prev, 
                phone: formatPhone(e.target.value) 
              }))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              placeholder="(00) 00000-0000"
              maxLength={15}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-400">CEP do Titular</label>
              <input
                value={formData.postalCode}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  postalCode: formatPostalCode(e.target.value) 
                }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                placeholder="00000-000"
                maxLength={9}
                required
              />
            </div>

            <div>
              <label className="text-sm text-gray-400">Número</label>
              <input
                value={formData.addressNumber}
                onChange={e => setFormData(prev => ({ 
                  ...prev, 
                  addressNumber: e.target.value 
                }))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white"
                placeholder="123"
                required
              />
            </div>
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-gray-800">
          <button 
            type="submit" 
            form="credit-card-form"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Cadastrando...' : 'Cadastrar Cartão'}
          </button>
        </div>
      </div>
    </div>
  )
} 