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
    alturaGrafico?: number; // Altura do gráfico em pixels (padrão: 140px)
    fundoAnimado?: boolean; // Ativa o fundo animado com ticks subindo
    textoRetorno?: string; // Texto personalizado para o retorno
    textoDescricao?: string; // Texto personalizado para a descrição
    mostrarCTA?: boolean; // Controla se o botão CTA deve ser exibido
    posicaoLogoTop?: number; // Posição do topo da logo (em unidades do Tailwind: 8, 12, 16, etc)
    tamanhoLogo?: number; // Escala da logo em porcentagem (padrão: 100)
    posicaoTituloTop?: number; // Posição do topo do título (em unidades do Tailwind: 16, 20, 24, etc)
    posicaoTextoRetornoBottom?: number; // Posição do box de texto a partir do fundo (em unidades do Tailwind: 28, 32, 36, etc)
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

