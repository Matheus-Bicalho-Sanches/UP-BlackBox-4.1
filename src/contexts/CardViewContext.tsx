'use client'

import { createContext } from 'react';

// Criar contexto para visualização em cards
export const CardViewContext = createContext({
  isCardView: false,
  toggleCardView: () => {}
}); 