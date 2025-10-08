'use client';

import { useState, useEffect } from 'react';
import ArtesLista from './components/ArtesLista';
import ArteEditor from './components/ArteEditor';
import StoriesPreview from './components/StoriesPreview';
import { ArteMarketing, DadosGrafico } from './types/arte.types';

export default function MarketingPage() {
  // Estado para gerenciar artes
  const [artes, setArtes] = useState<ArteMarketing[]>([
    // Arte de exemplo (a que já criamos)
    {
      id: '1',
      nome: 'Story - TrackRecord FIIs 1',
      carteira: 'BlackBox FIIs',
      periodo: '2020-2025',
      customizacoes: {
        titulo: '',
        subtitulo: '',
        textoCTA: '',
        corPrimaria: '#06b6d4',
        mostrarLegenda: true,
        tamanhoFonteTitulo: 14, // Fonte padrão
        tamanhoFonteSubtitulo: 10,
        posicaoGraficoTop: 40, // Posição padrão (top-40 = 160px)
        alturaGrafico: 140, // Altura padrão
        fundoAnimado: false,
      },
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    },
    // Duplicata da primeira arte
    {
      id: '2',
      nome: 'Story - TrackRecord FIIs 2',
      carteira: 'BlackBox FIIs',
      periodo: '2020-2025',
      customizacoes: {
        titulo: '+32.6% de retorno ao ano te interessa?',
        subtitulo: 'Esse foi o retorno que os nossos clientes tiveram nos últimos 12 meses investindo em FIIs, FI-Infra e FI-Agro',
        textoCTA: '',
        corPrimaria: '#06b6d4',
        mostrarLegenda: true,
        tamanhoFonteTitulo: 16, // Fonte ainda maior
        tamanhoFonteSubtitulo: 9, // Fonte pequena para o subtítulo
        posicaoGraficoTop: 36, // Gráfico mais próximo do subtítulo (top-36 = 144px)
        alturaGrafico: 140, // Altura padrão
        fundoAnimado: false,
      },
      criadoEm: new Date(Date.now() - 86400000), // 1 dia atrás
      atualizadoEm: new Date(Date.now() - 86400000),
    },
    // Duplicata da arte 2 com fundo animado
    {
      id: '6',
      nome: 'Story - TrackRecord FIIs 3',
      carteira: 'BlackBox FIIs',
      periodo: '2020-2025',
      customizacoes: {
        titulo: '+32,6% de retorno ao ano te interessa?',
        subtitulo: 'Esse foi o retorno que os nossos clientes tiveram em 12 meses investindo em FII, FI-Infra e FI-Agro',
        textoCTA: '',
        corPrimaria: '#06b6d4',
        mostrarLegenda: true,
        tamanhoFonteTitulo: 18, // Fonte ainda maior
        tamanhoFonteSubtitulo: 9, // Fonte pequena para o subtítulo
        posicaoGraficoTop: 44, // Gráfico mais para baixo (top-44 = 176px)
        alturaGrafico: 160, // Gráfico um pouco mais alto (padrão: 140px)
        fundoAnimado: true, // Ativa o fundo animado
        textoRetorno: 'Valor mínimo de R$ 50.000,00',
        textoDescricao: 'Entre em contato para mais informações',
        mostrarCTA: false, // Remove o botão CTA desta arte
        posicaoLogoTop: 12, // Logo mais para baixo (top-12 = 48px)
        tamanhoLogo: 140, // Logo 40% maior (padrão: 100)
        posicaoTituloTop: 22, // Título mais para baixo (top-22 = 88px)
        posicaoTextoRetornoBottom: 20, // Box de texto mais para baixo (bottom-20 = 80px)
      },
      criadoEm: new Date(Date.now() - 172800000), // 2 dias atrás
      atualizadoEm: new Date(Date.now() - 172800000),
    },
    // Artes adicionais para demonstração
    {
      id: '3',
      nome: 'Multi - Performance 2024',
      carteira: 'BlackBox Multi',
      periodo: '2024-2025',
      customizacoes: {
        titulo: 'Maximize seus investimentos com UP',
        subtitulo: '',
        textoCTA: 'Comece agora',
        corPrimaria: '#06b6d4',
        mostrarLegenda: true,
        tamanhoFonteTitulo: 14,
        tamanhoFonteSubtitulo: 10,
        posicaoGraficoTop: 40,
        alturaGrafico: 140, // Altura padrão
        fundoAnimado: false,
      },
      criadoEm: new Date(Date.now() - 172800000), // 2 dias atrás
      atualizadoEm: new Date(Date.now() - 172800000),
    },
    {
      id: '4',
      nome: 'Ações - Crescimento Sustentável',
      carteira: 'BlackBox Ações',
      periodo: '2023-2025',
      customizacoes: {
        titulo: 'Invista no futuro com UP',
        subtitulo: '',
        textoCTA: 'Saiba mais',
        corPrimaria: '#06b6d4',
        mostrarLegenda: true,
        tamanhoFonteTitulo: 14,
        tamanhoFonteSubtitulo: 10,
        posicaoGraficoTop: 40,
        alturaGrafico: 140, // Altura padrão
        fundoAnimado: false,
      },
      criadoEm: new Date(Date.now() - 172800000), // 2 dias atrás
      atualizadoEm: new Date(Date.now() - 172800000),
    },
    {
      id: '5',
      nome: 'FIIs - Campanha Q4',
      carteira: 'BlackBox FIIs',
      periodo: '2020-2025',
      customizacoes: {
        titulo: 'Renda passiva que funciona',
        subtitulo: '',
        textoCTA: 'Invista hoje',
        corPrimaria: '#06b6d4',
        mostrarLegenda: true,
        tamanhoFonteTitulo: 14,
        tamanhoFonteSubtitulo: 10,
        posicaoGraficoTop: 40,
        alturaGrafico: 140, // Altura padrão
        fundoAnimado: false,
      },
      criadoEm: new Date(Date.now() - 259200000), // 3 dias atrás
      atualizadoEm: new Date(Date.now() - 259200000),
    },
  ]);
  
  const [arteSelecionadaId, setArteSelecionadaId] = useState<string | null>('1');
  
  // Dados dos gráficos (carregados via fetch)
  const [retornoData, setRetornoData] = useState<DadosGrafico[]>([]);
  const [retornoDataMulti, setRetornoDataMulti] = useState<DadosGrafico[]>([]);
  
  // Carregar dados reais (igual à implementação anterior)
  useEffect(() => {
    fetch('/data/retorno-carteira.json')
      .then(res => res.json())
      .then((d) => {
        setRetornoData(d);
      })
      .catch(err => console.error('Erro carregando retorno-carteira', err));
    
    fetch('/data/retorno-carteira-multi.json')
      .then(res => res.json())
      .then((d) => {
        setRetornoDataMulti(d);
      })
      .catch(err => console.error('Erro carregando retorno-carteira-multi', err));
  }, []);
  
  // Arte selecionada
  const arteSelecionada = artes.find(a => a.id === arteSelecionadaId) || null;
  
  // Dados filtrados para o preview
  const getDadosFiltrados = (arte: ArteMarketing | null): DadosGrafico[] => {
    if (!arte) return [];
    
    const currentData = arte.carteira === 'BlackBox FIIs' ? retornoData : retornoDataMulti;
    
    if (arte.periodo === '2020-2025') {
      return currentData;
    } else if (arte.periodo === '2023-2025') {
      return currentData.filter(d => d.date.includes('23') || d.date.includes('24') || d.date.includes('25'));
    } else if (arte.periodo === '2024-2025') {
      return currentData.filter(d => d.date.includes('24') || d.date.includes('25'));
    }
    
    return currentData;
  };
  
  // Métricas para o preview (simplificadas por enquanto)
  const getMetricas = (arte: ArteMarketing | null) => {
    if (!arte) return { retornoTotal: 0, vsIfix: 0, vsCdi: 0 };
    
    if (arte.periodo === '2020-2025') {
      return { retornoTotal: 32.59, vsIfix: 9.34, vsCdi: 12.98 };
    } else if (arte.periodo === '2023-2025') {
      return { retornoTotal: 28.45, vsIfix: 7.23, vsCdi: 9.87 };
    } else if (arte.periodo === '2024-2025') {
      return { retornoTotal: 18.32, vsIfix: 4.56, vsCdi: 6.78 };
    }
    
    return { retornoTotal: 32.59, vsIfix: 9.34, vsCdi: 12.98 };
  };
  
  // Handlers
  const handleSelecionarArte = (id: string) => {
    setArteSelecionadaId(id);
  };
  
  const handleDuplicarArte = (id: string) => {
    const arteOriginal = artes.find(a => a.id === id);
    if (!arteOriginal) return;
    
    const arteCopiada: ArteMarketing = {
      ...arteOriginal,
      id: Date.now().toString(),
      nome: `${arteOriginal.nome} (cópia)`,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    
    setArtes([...artes, arteCopiada]);
    setArteSelecionadaId(arteCopiada.id);
  };
  
  const handleExcluirArte = (id: string) => {
    if (artes.length === 1) {
      alert('Você precisa ter pelo menos uma arte!');
      return;
    }
    
    const confirmacao = confirm('Tem certeza que deseja excluir esta arte?');
    if (!confirmacao) return;
    
    setArtes(artes.filter(a => a.id !== id));
    
    if (arteSelecionadaId === id) {
      setArteSelecionadaId(artes.find(a => a.id !== id)?.id || null);
    }
  };
  
  const handleUpdateArte = (campo: string, valor: any) => {
    if (!arteSelecionada) return;
    
    setArtes(artes.map(a => {
      if (a.id === arteSelecionada.id) {
        if (campo.startsWith('customizacoes.')) {
          const customCampo = campo.replace('customizacoes.', '');
          return {
            ...a,
            customizacoes: {
              ...a.customizacoes,
              [customCampo]: valor,
            },
            atualizadoEm: new Date(),
          };
        } else {
          return {
            ...a,
            [campo]: valor,
            atualizadoEm: new Date(),
          };
        }
      }
      return a;
    }));
  };
  
  
  const dadosFiltrados = getDadosFiltrados(arteSelecionada);
  const metricas = getMetricas(arteSelecionada);
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Marketing - Gerador de Artes</h1>
          <div className="text-sm text-gray-400">
            Crie artes profissionais para stories e campanhas
          </div>
        </div>
      </div>

      {/* Layout Principal: 3 Colunas */}
      <div className="flex-1 px-6 pb-6">
        <div className="grid grid-cols-12 gap-6 min-h-[calc(100vh-200px)]">
          {/* Coluna 1: Lista de Artes (3 colunas) */}
          <div className="col-span-3 h-full">
          <ArtesLista
            artes={artes}
            arteSelecionada={arteSelecionadaId}
            onSelecionar={handleSelecionarArte}
            onDuplicar={handleDuplicarArte}
            onExcluir={handleExcluirArte}
          />
          </div>

          {/* Coluna 2: Preview da Arte (4 colunas) */}
          <div className="col-span-4 h-full">
            <div className="bg-gray-800 rounded-lg p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Preview da Arte</h2>
              </div>
              
              <div className="flex-1 flex items-center justify-center overflow-auto">
                {arteSelecionada ? (
                  <StoriesPreview
                    carteira={arteSelecionada.carteira}
                    periodo={arteSelecionada.periodo}
                    dados={dadosFiltrados}
                    retornoTotal={metricas.retornoTotal}
                    vsIfix={metricas.vsIfix}
                    vsCdi={metricas.vsCdi}
                    titulo={arteSelecionada.customizacoes.titulo}
                    subtitulo={arteSelecionada.customizacoes.subtitulo}
                    textoCTA={arteSelecionada.customizacoes.textoCTA}
                    tamanhoFonteTitulo={arteSelecionada.customizacoes.tamanhoFonteTitulo}
                    tamanhoFonteSubtitulo={arteSelecionada.customizacoes.tamanhoFonteSubtitulo}
                    posicaoGraficoTop={arteSelecionada.customizacoes.posicaoGraficoTop}
                    alturaGrafico={arteSelecionada.customizacoes.alturaGrafico}
                    fundoAnimado={arteSelecionada.customizacoes.fundoAnimado}
                    textoRetorno={arteSelecionada.customizacoes.textoRetorno}
                    textoDescricao={arteSelecionada.customizacoes.textoDescricao}
                    mostrarCTA={arteSelecionada.customizacoes.mostrarCTA}
                    posicaoLogoTop={arteSelecionada.customizacoes.posicaoLogoTop}
                    tamanhoLogo={arteSelecionada.customizacoes.tamanhoLogo}
                    posicaoTituloTop={arteSelecionada.customizacoes.posicaoTituloTop}
                    posicaoTextoRetornoBottom={arteSelecionada.customizacoes.posicaoTextoRetornoBottom}
                  />
                ) : (
                  <div className="text-center text-gray-400">
                    <svg className="w-20 h-20 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p>Selecione uma arte para visualizar</p>
                  </div>
                )}
              </div>

              {/* Info sobre dimensões */}
              {arteSelecionada && (
                <div className="mt-4 pt-4 border-t border-gray-700 grid grid-cols-3 gap-2 text-xs">
                  <div className="bg-gray-700 rounded p-2 text-center">
                    <div className="text-cyan-400 font-semibold">Dimensões</div>
                    <div className="text-gray-300">1080x1920px</div>
                  </div>
                  <div className="bg-gray-700 rounded p-2 text-center">
                    <div className="text-cyan-400 font-semibold">Formato</div>
                    <div className="text-gray-300">PNG</div>
                  </div>
                  <div className="bg-gray-700 rounded p-2 text-center">
                    <div className="text-cyan-400 font-semibold">Uso</div>
                    <div className="text-gray-300">Stories</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coluna 3: Editor de Configurações (5 colunas) */}
          <div className="col-span-5 h-full">
            <ArteEditor
              arte={arteSelecionada}
              onUpdate={handleUpdateArte}
              onDuplicar={() => arteSelecionada && handleDuplicarArte(arteSelecionada.id)}
              onExcluir={() => arteSelecionada && handleExcluirArte(arteSelecionada.id)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}