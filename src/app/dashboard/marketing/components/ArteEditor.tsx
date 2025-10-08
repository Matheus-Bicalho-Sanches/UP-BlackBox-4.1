'use client';

import React from 'react';
import { ArteMarketing } from '../types/arte.types';

interface ArteEditorProps {
  arte: ArteMarketing | null;
  onUpdate: (campo: string, valor: any) => void;
  onDuplicar: () => void;
  onExcluir: () => void;
}

export default function ArteEditor({
  arte,
  onUpdate,
  onDuplicar,
  onExcluir
}: ArteEditorProps) {
  if (!arte) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 h-full flex flex-col items-center justify-center text-center">
        <svg className="w-24 h-24 text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <h3 className="text-xl font-semibold text-white mb-2">Nenhuma arte selecionada</h3>
        <p className="text-gray-400 text-sm max-w-md">
          Selecione uma arte da lista ao lado ou crie uma nova para começar a editar
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700">
        <div>
          <h2 className="text-xl font-semibold text-white">{arte.nome}</h2>
          <p className="text-sm text-gray-400 mt-1">Editando configurações da arte</p>
        </div>
        
      </div>

      {/* Configurações - Scrollable */}
      <div className="flex-1 overflow-y-auto space-y-6">
        {/* Seção: Informações Básicas */}
        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Informações Básicas
          </h3>
          
          <div className="space-y-4">
            {/* Nome da Arte */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Nome da Arte
              </label>
              <input
                type="text"
                value={arte.nome}
                onChange={(e) => onUpdate('nome', e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Ex: FIIs Q4 2024"
              />
            </div>

            {/* Carteira */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Carteira
              </label>
              <select
                value={arte.carteira}
                onChange={(e) => onUpdate('carteira', e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="BlackBox FIIs">BlackBox FIIs</option>
                <option value="BlackBox Multi">BlackBox Multi</option>
                <option value="BlackBox Ações">BlackBox Ações</option>
              </select>
            </div>

            {/* Período */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Período
              </label>
              <select
                value={arte.periodo}
                onChange={(e) => onUpdate('periodo', e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="2020-2025">2020-2025 (5 anos)</option>
                <option value="2023-2025">2023-2025 (3 anos)</option>
                <option value="2024-2025">2024-2025 (2 anos)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seção: Textos Personalizados */}
        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Textos Personalizados
          </h3>
          
          <div className="space-y-4">
            {/* Título Customizado */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Título da Arte
              </label>
              <textarea
                value={arte.customizacoes.titulo || ''}
                onChange={(e) => onUpdate('customizacoes.titulo', e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                rows={2}
                placeholder="Deixe vazio para usar o padrão"
              />
              <p className="text-xs text-gray-500 mt-1">Padrão: "Aumente o retorno da sua carteira..."</p>
            </div>

            {/* Texto do CTA */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Texto do Botão (CTA)
              </label>
              <input
                type="text"
                value={arte.customizacoes.textoCTA || ''}
                onChange={(e) => onUpdate('customizacoes.textoCTA', e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="Deixe vazio para usar o padrão"
              />
              <p className="text-xs text-gray-500 mt-1">Padrão: "Invista com UP"</p>
            </div>
          </div>
        </div>

        {/* Seção: Visual */}
        <div>
          <h3 className="text-sm font-semibold text-cyan-400 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Personalização Visual
          </h3>
          
          <div className="space-y-4">
            {/* Cor Primária */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cor Primária (em breve)
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={arte.customizacoes.corPrimaria || '#06b6d4'}
                  onChange={(e) => onUpdate('customizacoes.corPrimaria', e.target.value)}
                  className="w-12 h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
                  disabled
                />
                <input
                  type="text"
                  value={arte.customizacoes.corPrimaria || '#06b6d4'}
                  onChange={(e) => onUpdate('customizacoes.corPrimaria', e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="#06b6d4"
                  disabled
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Funcionalidade em desenvolvimento</p>
            </div>

            {/* Mostrar Legenda */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">
                Mostrar Legenda do Gráfico
              </label>
              <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                <input
                  type="checkbox"
                  checked={arte.customizacoes.mostrarLegenda ?? true}
                  onChange={(e) => onUpdate('customizacoes.mostrarLegenda', e.target.checked)}
                  className="opacity-0 w-0 h-0 peer"
                  disabled
                />
                <span className="absolute cursor-not-allowed inset-0 bg-gray-600 rounded-full transition peer-checked:bg-cyan-600"></span>
                <span className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition peer-checked:translate-x-6"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer com ações secundárias */}
      <div className="mt-6 pt-4 border-t border-gray-700 flex gap-2">
        <button
          onClick={onDuplicar}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition duration-300 flex items-center justify-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Duplicar Arte
        </button>
        
        <button
          onClick={onExcluir}
          className="bg-red-900/50 hover:bg-red-800 text-red-200 px-4 py-2 rounded-lg text-sm font-semibold transition duration-300 flex items-center justify-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Excluir
        </button>
      </div>
    </div>
  );
}

