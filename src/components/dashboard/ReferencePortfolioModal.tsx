"use client";
import { useState, useEffect } from "react";
import { FiX, FiPlus, FiEdit2, FiTrash2, FiSave } from "react-icons/fi";
import { 
  ReferencePortfolio, 
  ReferencePosition, 
  referencePortfolioService 
} from "@/lib/reference-portfolio";

interface ReferencePortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  strategyId?: string;
  strategyName?: string;
  onPortfolioCreated?: (portfolio: ReferencePortfolio) => void;
  onPortfolioUpdated?: (portfolio: ReferencePortfolio) => void;
}

export default function ReferencePortfolioModal({
  isOpen,
  onClose,
  strategyId,
  strategyName,
  onPortfolioCreated,
  onPortfolioUpdated
}: ReferencePortfolioModalProps) {
  const [portfolios, setPortfolios] = useState<ReferencePortfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState<ReferencePortfolio | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form data
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true
  });

  // Position form data
  const [positionForm, setPositionForm] = useState({
    ticker: "",
    price: 0,
    quantity: 0,
    percentage: 0,
    description: ""
  });

  // Load portfolios when modal opens
  useEffect(() => {
    if (isOpen && strategyId) {
      loadPortfolios();
    }
  }, [isOpen, strategyId]);

  const loadPortfolios = async () => {
    if (!strategyId) return;
    
    try {
      setLoading(true);
      const portfoliosData = await referencePortfolioService.getPortfoliosByStrategy(strategyId);
      setPortfolios(portfoliosData);
    } catch (err: any) {
      setError(`Erro ao carregar carteiras: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = async () => {
    if (!strategyId || !strategyName) return;
    
    try {
      setLoading(true);
      setError("");

      const newPortfolio: Omit<ReferencePortfolio, 'id' | 'createdAt' | 'updatedAt'> = {
        strategy_id: strategyId,
        strategy_name: strategyName,
        name: formData.name,
        description: formData.description,
        positions: [],
        total_value: 0,
        is_active: formData.is_active
      };

      const portfolioId = await referencePortfolioService.createPortfolio(newPortfolio);
      const createdPortfolio = await referencePortfolioService.getPortfolio(portfolioId);
      
      if (createdPortfolio) {
        setPortfolios(prev => [createdPortfolio, ...prev]);
        setSelectedPortfolio(createdPortfolio);
        setIsCreating(false);
        setFormData({ name: "", description: "", is_active: true });
        onPortfolioCreated?.(createdPortfolio);
      }
    } catch (err: any) {
      setError(`Erro ao criar carteira: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePortfolio = async () => {
    if (!selectedPortfolio) return;
    
    try {
      setLoading(true);
      setError("");

      await referencePortfolioService.updatePortfolio(selectedPortfolio.id!, {
        name: formData.name,
        description: formData.description,
        is_active: formData.is_active
      });

      const updatedPortfolio = await referencePortfolioService.getPortfolio(selectedPortfolio.id!);
      if (updatedPortfolio) {
        setPortfolios(prev => prev.map(p => p.id === updatedPortfolio.id ? updatedPortfolio : p));
        setSelectedPortfolio(updatedPortfolio);
        setIsEditing(false);
        onPortfolioUpdated?.(updatedPortfolio);
      }
    } catch (err: any) {
      setError(`Erro ao atualizar carteira: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPosition = async () => {
    if (!selectedPortfolio) return;
    
    try {
      setLoading(true);
      setError("");

      await referencePortfolioService.addPosition(selectedPortfolio.id!, {
        ticker: positionForm.ticker.toUpperCase(),
        price: positionForm.price,
        quantity: positionForm.quantity,
        percentage: positionForm.percentage,
        description: positionForm.description
      });

      const updatedPortfolio = await referencePortfolioService.getPortfolio(selectedPortfolio.id!);
      if (updatedPortfolio) {
        setPortfolios(prev => prev.map(p => p.id === updatedPortfolio.id ? updatedPortfolio : p));
        setSelectedPortfolio(updatedPortfolio);
        setPositionForm({ ticker: "", price: 0, quantity: 0, percentage: 0, description: "" });
      }
    } catch (err: any) {
      setError(`Erro ao adicionar posição: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRemovePosition = async (positionIndex: number) => {
    if (!selectedPortfolio) return;
    
    try {
      setLoading(true);
      setError("");

      await referencePortfolioService.removePosition(selectedPortfolio.id!, positionIndex);
      
      const updatedPortfolio = await referencePortfolioService.getPortfolio(selectedPortfolio.id!);
      if (updatedPortfolio) {
        setPortfolios(prev => prev.map(p => p.id === updatedPortfolio.id ? updatedPortfolio : p));
        setSelectedPortfolio(updatedPortfolio);
      }
    } catch (err: any) {
      setError(`Erro ao remover posição: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePortfolio = async () => {
    if (!selectedPortfolio) return;
    
    if (!confirm(`Tem certeza que deseja excluir a carteira "${selectedPortfolio.name}"?`)) {
      return;
    }
    
    try {
      setLoading(true);
      setError("");

      await referencePortfolioService.deletePortfolio(selectedPortfolio.id!);
      setPortfolios(prev => prev.filter(p => p.id !== selectedPortfolio.id));
      setSelectedPortfolio(null);
    } catch (err: any) {
      setError(`Erro ao excluir carteira: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectPortfolio = (portfolio: ReferencePortfolio) => {
    setSelectedPortfolio(portfolio);
    setFormData({
      name: portfolio.name,
      description: portfolio.description || "",
      is_active: portfolio.is_active
    });
    setIsCreating(false);
    setIsEditing(false);
  };

  const startCreating = () => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedPortfolio(null);
    setFormData({ name: "", description: "", is_active: true });
  };

  const startEditing = () => {
    setIsEditing(true);
    setIsCreating(false);
  };

  const cancelForm = () => {
    setIsCreating(false);
    setIsEditing(false);
    if (selectedPortfolio) {
      setFormData({
        name: selectedPortfolio.name,
        description: selectedPortfolio.description || "",
        is_active: selectedPortfolio.is_active
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: '#1a1a1a',
        borderRadius: 12,
        padding: 24,
        width: '90%',
        maxWidth: 1200,
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid #333'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          borderBottom: '1px solid #333',
          paddingBottom: 16
        }}>
          <h2 style={{ color: '#fff', margin: 0 }}>
            Carteiras de Referência - {strategyName}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#666',
              cursor: 'pointer',
              fontSize: 20
            }}
          >
            <FiX />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            background: '#7f1d1d',
            color: '#fff',
            padding: 12,
            borderRadius: 6,
            marginBottom: 16
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 24 }}>
          {/* Left Panel - Portfolio List */}
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <h3 style={{ color: '#fff', margin: 0 }}>Carteiras</h3>
              <button
                onClick={startCreating}
                disabled={loading}
                style={{
                  padding: '8px 12px',
                  background: '#06b6d4',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <FiPlus size={16} />
                Nova Carteira
              </button>
            </div>

            {loading ? (
              <div style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
                Carregando...
              </div>
            ) : portfolios.length === 0 ? (
              <div style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
                Nenhuma carteira encontrada
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {portfolios.map((portfolio) => (
                  <div
                    key={portfolio.id}
                    onClick={() => selectPortfolio(portfolio)}
                    style={{
                      padding: 12,
                      background: selectedPortfolio?.id === portfolio.id ? '#333' : '#222',
                      borderRadius: 8,
                      cursor: 'pointer',
                      border: '1px solid #444',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div>
                        <h4 style={{ color: '#fff', margin: 0, fontSize: 14 }}>
                          {portfolio.name}
                        </h4>
                        <p style={{ color: '#9ca3af', margin: 0, fontSize: 12 }}>
                          {portfolio.positions.length} posições
                        </p>
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}>
                        {portfolio.is_active && (
                          <span style={{
                            background: '#16a34a',
                            color: '#fff',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 10
                          }}>
                            Ativa
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel - Portfolio Details */}
          <div style={{ flex: 2, minWidth: 500 }}>
            {selectedPortfolio ? (
              <div>
                {/* Portfolio Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 20
                }}>
                  <div>
                    <h3 style={{ color: '#fff', margin: 0 }}>
                      {isEditing ? 'Editar Carteira' : selectedPortfolio.name}
                    </h3>
                    {selectedPortfolio.description && (
                      <p style={{ color: '#9ca3af', margin: '4px 0 0 0' }}>
                        {selectedPortfolio.description}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!isEditing && (
                      <button
                        onClick={startEditing}
                        disabled={loading}
                        style={{
                          padding: '6px 12px',
                          background: '#06b6d4',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <FiEdit2 size={14} />
                        Editar
                      </button>
                    )}
                    <button
                      onClick={handleDeletePortfolio}
                      disabled={loading}
                      style={{
                        padding: '6px 12px',
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <FiTrash2 size={14} />
                      Excluir
                    </button>
                  </div>
                </div>

                {/* Portfolio Form */}
                {(isCreating || isEditing) && (
                  <div style={{
                    background: '#222',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 20
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div>
                        <label style={{ color: '#fff', display: 'block', marginBottom: 4 }}>
                          Nome da Carteira:
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            borderRadius: 4
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#fff', display: 'block', marginBottom: 4 }}>
                          Descrição:
                        </label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          rows={3}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            borderRadius: 4,
                            resize: 'vertical'
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          id="is_active"
                          checked={formData.is_active}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        />
                        <label htmlFor="is_active" style={{ color: '#fff' }}>
                          Carteira Ativa
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={isCreating ? handleCreatePortfolio : handleUpdatePortfolio}
                          disabled={loading || !formData.name.trim()}
                          style={{
                            padding: '8px 16px',
                            background: loading || !formData.name.trim() ? '#555' : '#16a34a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: loading || !formData.name.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <FiSave size={14} />
                          {isCreating ? 'Criar' : 'Salvar'}
                        </button>
                        <button
                          onClick={cancelForm}
                          disabled={loading}
                          style={{
                            padding: '8px 16px',
                            background: '#666',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 4,
                            cursor: 'pointer'
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Positions Section */}
                <div>
                  <h4 style={{ color: '#fff', marginBottom: 16 }}>Posições</h4>
                  
                  {/* Add Position Form */}
                  <div style={{
                    background: '#222',
                    padding: 16,
                    borderRadius: 8,
                    marginBottom: 20
                  }}>
                    <h5 style={{ color: '#fff', marginBottom: 12 }}>Adicionar Posição</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                      <div>
                        <label style={{ color: '#fff', display: 'block', marginBottom: 4, fontSize: 12 }}>
                          Ticker:
                        </label>
                        <input
                          type="text"
                          value={positionForm.ticker}
                          onChange={(e) => setPositionForm(prev => ({ ...prev, ticker: e.target.value }))}
                          placeholder="PETR4"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            borderRadius: 4,
                            fontSize: 12
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#fff', display: 'block', marginBottom: 4, fontSize: 12 }}>
                          Preço:
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={positionForm.price}
                          onChange={(e) => setPositionForm(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                          placeholder="0.00"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            borderRadius: 4,
                            fontSize: 12
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#fff', display: 'block', marginBottom: 4, fontSize: 12 }}>
                          Quantidade:
                        </label>
                        <input
                          type="number"
                          value={positionForm.quantity}
                          onChange={(e) => setPositionForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                          placeholder="0"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            borderRadius: 4,
                            fontSize: 12
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ color: '#fff', display: 'block', marginBottom: 4, fontSize: 12 }}>
                          %:
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={positionForm.percentage}
                          onChange={(e) => setPositionForm(prev => ({ ...prev, percentage: parseFloat(e.target.value) || 0 }))}
                          placeholder="0.0"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            background: '#333',
                            color: '#fff',
                            border: '1px solid #555',
                            borderRadius: 4,
                            fontSize: 12
                          }}
                        />
                      </div>
                      <button
                        onClick={handleAddPosition}
                        disabled={loading || !positionForm.ticker.trim() || positionForm.quantity <= 0}
                        style={{
                          padding: '6px 12px',
                          background: loading || !positionForm.ticker.trim() || positionForm.quantity <= 0 ? '#555' : '#06b6d4',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          cursor: loading || !positionForm.ticker.trim() || positionForm.quantity <= 0 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <FiPlus size={14} />
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {/* Positions Table */}
                  {selectedPortfolio.positions.length === 0 ? (
                    <div style={{ color: '#9ca3af', textAlign: 'center', padding: 20 }}>
                      Nenhuma posição adicionada
                    </div>
                  ) : (
                    <div style={{
                      background: '#222',
                      borderRadius: 8,
                      overflow: 'hidden',
                      border: '1px solid #444'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ background: '#333' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', color: '#fff', fontWeight: 'bold' }}>
                              Ticker
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: '#fff', fontWeight: 'bold' }}>
                              Preço
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: '#fff', fontWeight: 'bold' }}>
                              Quantidade
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', color: '#fff', fontWeight: 'bold' }}>
                              %
                            </th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', color: '#fff', fontWeight: 'bold' }}>
                              Ações
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPortfolio.positions.map((position, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid #444' }}>
                              <td style={{ padding: '12px 16px', color: '#fff', fontWeight: 'bold' }}>
                                {position.ticker}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#fff' }}>
                                {position.price.toLocaleString('pt-BR', { 
                                  style: 'currency', 
                                  currency: 'BRL' 
                                })}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#fff' }}>
                                {position.quantity.toLocaleString('pt-BR')}
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'right', color: '#fff' }}>
                                {position.percentage.toFixed(1)}%
                              </td>
                              <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                <button
                                  onClick={() => handleRemovePosition(index)}
                                  disabled={loading}
                                  style={{
                                    padding: '4px 8px',
                                    background: '#dc2626',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    fontSize: 12
                                  }}
                                >
                                  <FiTrash2 size={12} />
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
            ) : (
              <div style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>
                Selecione uma carteira para ver os detalhes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 