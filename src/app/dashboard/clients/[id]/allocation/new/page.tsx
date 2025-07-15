'use client';

import React, { useState } from 'react';

// TODO: Implementar lógica completa do formulário

interface Asset {
  classe: string;
  // Adicionar outros campos do ativo aqui (ex: valor, ticker)
}

export default function NewAllocationPage() {
  const [assets, setAssets] = useState<Asset[]>([{ classe: '' }]);

  // Placeholder - Implementar a lógica real para atualizar o estado
  const handleAssetChange = (index: number, field: keyof Asset, value: string) => {
    console.log(`Asset ${index}, Field ${field}, Value ${value}`);
    // Lógica para atualizar o estado 'assets' será necessária aqui
  };

  // Usando o primeiro ativo (índice 0) como exemplo por enquanto
  const asset = assets[0];
  const index = 0;

  return (
    <div>
      {/* TODO: Adicionar título da página e estrutura geral */}
      <h1>Nova Alocação</h1>

      <form>
        {/* TODO: Mapear sobre o array 'assets' para múltiplos ativos */}
        <div className="mb-4">
          <label htmlFor={`classe-${index}`} className="block text-sm font-medium text-gray-300 mb-1">
            Classe de Ativo <span className="text-red-500">*</span>
          </label>
          <select
            id={`classe-${index}`}
            name={`classe-${index}`}
            value={asset.classe}
            onChange={(e) => handleAssetChange(index, 'classe', e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            required
          >
            <option value="">Selecione a classe</option>
            <option value="Caixa">Caixa</option>
            <option value="Renda Fixa Pós-fixada">Renda Fixa Pós-fixada</option>
            <option value="Renda Fixa Indexada">Renda Fixa Indexada</option>
            <option value="Renda Fixa Prefixada">Renda Fixa Prefixada</option>
            <option value="Multimercado">Multimercado</option>
            <option value="Renda Variável">Renda Variável</option>
            <option value="Fundos Imobiliários">Fundos Imobiliários</option>
            <option value="Internacional">Internacional</option>
            <option value="Previdência">Previdência</option>
            <option value="Alternativos">Alternativos</option>
          </select>
        </div>

        {/* TODO: Adicionar campos para outros dados do ativo (valor, ticker, etc.) */}
        {/* TODO: Adicionar botões para adicionar/remover ativos e submeter o formulário */}

        <button type="submit" className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-md text-white">
          Salvar Alocação
        </button>
      </form>
    </div>
  );
} 