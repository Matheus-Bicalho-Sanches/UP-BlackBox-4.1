// Tipos para o sistema de Marketing

export interface ArteMarketing {
  id: string;
  nome: string;
  carteira: 'BlackBox FIIs' | 'BlackBox Multi' | 'BlackBox Ações';
  periodo: '2020-2025' | '2023-2025' | '2024-2025';
  customizacoes: {
    titulo?: string;
    subtitulo?: string;
    corPrimaria?: string;
    textoCTA?: string;
    mostrarLegenda?: boolean;
    tamanhoFonteTitulo?: number; // Tamanho da fonte do título em pixels
    tamanhoFonteSubtitulo?: number; // Tamanho da fonte do subtítulo em pixels
    posicaoGraficoTop?: number; // Posição do topo do gráfico (em unidades do Tailwind: 32, 36, 40, etc)
    fundoAnimado?: boolean; // Ativa o fundo animado com ticks subindo
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

