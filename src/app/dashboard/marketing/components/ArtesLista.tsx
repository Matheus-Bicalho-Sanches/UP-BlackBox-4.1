'use client';

import React, { useState, useMemo } from 'react';
import { ArteMarketing } from '../types/arte.types';

interface ArtesListaProps {
  artes: ArteMarketing[];
  arteSelecionada: string | null;
  onSelecionar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onExcluir: (id: string) => void;
}

export default function ArtesLista({
  artes,
  arteSelecionada,
  onSelecionar,
  onDuplicar,
  onExcluir
}: ArtesListaProps) {
  const [termoPesquisa, setTermoPesquisa] = useState('');

  // Filtrar artes baseado no termo de pesquisa
  const artesFiltradas = useMemo(() => {
    if (!termoPesquisa.trim()) return artes;
    
    return artes.filter(arte => 
      arte.nome.toLowerCase().includes(termoPesquisa.toLowerCase()) ||
      arte.carteira.toLowerCase().includes(termoPesquisa.toLowerCase()) ||
      arte.periodo.toLowerCase().includes(termoPesquisa.toLowerCase())
    );
  }, [artes, termoPesquisa]);
  return (
    <div className="bg-gray-800 rounded-lg p-4 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">Minhas Artes</h2>
      </div>

      {/* Campo de Pesquisa */}
      <div className="mb-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Pesquisar artes..."
            value={termoPesquisa}
            onChange={(e) => setTermoPesquisa(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 pl-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
          />
          <svg 
            className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {termoPesquisa && (
            <button
              onClick={() => setTermoPesquisa('')}
              className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 hover:text-white transition-colors"
            >
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {termoPesquisa && (
          <div className="mt-2 text-xs text-gray-400">
            {artesFiltradas.length} de {artes.length} artes encontradas
          </div>
        )}
      </div>

      {/* Lista de artes */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {artes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">Nenhuma arte criada ainda</p>
            <p className="text-xs mt-1">Clique em "Nova Arte" para começar</p>
          </div>
        ) : artesFiltradas.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">Nenhuma arte encontrada</p>
            <p className="text-xs mt-1">Tente um termo de pesquisa diferente</p>
          </div>
        ) : (
          artesFiltradas.map((arte) => (
            <div
              key={arte.id}
              onClick={() => onSelecionar(arte.id)}
              className={`
                p-4 rounded-lg cursor-pointer transition-all duration-200
                ${arteSelecionada === arte.id 
                  ? 'bg-cyan-900/50 border-2 border-cyan-500' 
                  : 'bg-gray-700 hover:bg-gray-650 border-2 border-transparent'
                }
              `}
            >
              <h3 className="text-white font-semibold text-sm truncate">{arte.nome}</h3>
            </div>
          ))
        )}
      </div>

      {/* Footer com contagem */}
      {artes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700 text-center text-xs text-gray-400">
          {termoPesquisa ? (
            <>
              {artesFiltradas.length} de {artes.length} artes
            </>
          ) : (
            <>
              {artes.length} {artes.length === 1 ? 'arte criada' : 'artes criadas'}
            </>
          )}
        </div>
      )}
    </div>
  );
}

