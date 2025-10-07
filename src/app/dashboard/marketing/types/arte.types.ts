// Tipos para o sistema de Marketing

export interface ArteMarketing {
  id: string;
  nome: string;
  carteira: 'BlackBox FIIs' | 'BlackBox Multi' | 'BlackBox Ações';
  periodo: '2020-2025' | '2023-2025' | '2024-2025';
  customizacoes: {
    titulo?: string;
    corPrimaria?: string;
    textoCTA?: string;
    mostrarLegenda?: boolean;
  };
  criadoEm: Date;
  atualizadoEm: Date;
}

export interface DadosGrafico {
  date: string;
  tatica: number;
  ifix?: number;
  cdi: number;
}

