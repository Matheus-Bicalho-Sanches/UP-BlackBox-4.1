'use client'

import { useState } from 'react'

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (method: 'CREDIT_CARD' | 'PIX') => void
  hasCard: boolean
  value: number
}

export default function PaymentModal({ isOpen, onClose, onConfirm, hasCard, value }: PaymentModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handlePayment = async (method: 'CREDIT_CARD' | 'PIX') => {
    try {
      setLoading(true)
      setError(null)
      await onConfirm(method)
      onClose()
    } catch (error: any) {
      setError(error.message || 'Erro ao processar pagamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <h3 className="text-xl font-bold text-white mb-4">
          Receber Pagamento
        </h3>
        
        <p className="text-gray-300 mb-6">
          Valor a receber: {value.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          })}
        </p>

        <div className="space-y-3">
          {hasCard && (
            <button
              onClick={() => handlePayment('CREDIT_CARD')}
              disabled={loading}
              className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-between"
            >
              <span>Cartão de Crédito</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </button>
          )}
          
          <button
            onClick={() => handlePayment('PIX')}
            disabled={loading}
            className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center justify-between"
          >
            <span>PIX</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 text-gray-400 hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
} 