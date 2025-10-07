'use client'

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, ComposedChart, Legend, TooltipProps } from 'recharts';
import { motion } from 'framer-motion';
import html2canvas from 'html2canvas';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';

// Dados reais carregados via fetch (igual à home)

// Mapeia meses PT-BR para números para formatação de data no eixo
const monthMap: Record<string, string> = {
  jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06',
  jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12',
};

function formatDateLabel(label: string) {
  // label vem no formato 'dd-mesAbrev'
  const [day, mon] = label.split('-');
  const monthNum = monthMap[mon as keyof typeof monthMap] || '??';
  return `${day.padStart(2, '0')}/${monthNum}/24`;
}

// Formata ticks percentuais, escondendo valores negativos para evitar sobreposição
function formatPercentTick(v: number) {
  return v < 0 ? '' : `${v.toFixed(1)}%`;
}

// Custom tooltip (igual à home)
function CustomTooltip({ active, payload, label }: TooltipProps<ValueType, NameType>) {
  if (active && payload && payload.length) {
    // Filtra itens indesejados (ex.: entrada "tatica" duplicada)
    const filteredPayload = payload.filter((pl) => pl.name !== 'tatica');
    return (
      <div className="backdrop-blur-md bg-gray-900/80 border border-cyan-500/30 p-2 rounded-lg shadow-lg text-xs">
        <p className="text-cyan-300 font-semibold mb-1">{label}</p>
        {filteredPayload.map((pl, idx) => (
          <p key={idx} className="text-gray-200">{pl.name}: <span className="font-bold">{typeof pl.value === 'number' ? pl.value.toLocaleString('pt-BR') : pl.value}</span></p>
        ))}
      </div>
    );
  }
  return null;
}

// Legenda customizada (igual à home)
function CustomLegend({ payload }: { payload?: any[] }) {
  if (!payload) return null;
  
  // Filtra para remover entradas indesejadas e manter apenas BlackBox FIIs, IFIX e CDI
  const filteredPayload = payload.filter(entry => {
    // Remove qualquer entrada que seja 'tatica' mas não tenha o nome correto
    if (entry.dataKey === 'tatica' && entry.value !== 'BlackBox FIIs') {
      return false;
    }
    return true;
  });
  
  return (
    <ul className="flex justify-center gap-4 text-xs text-white">
      {filteredPayload.map((entry, index) => (
        <li key={`item-${index}`} className="flex items-center gap-1">
          <span style={{ backgroundColor: entry.color }} className="inline-block w-3 h-3 rounded-full" />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

// Componente para o preview da arte
function StoriesPreview({ 
  carteira, 
  periodo, 
  dados, 
  retornoTotal, 
  vsIfix, 
  vsCdi 
}: {
  carteira: string;
  periodo: string;
  dados: any[];
  retornoTotal: number;
  vsIfix: number;
  vsCdi: number;
}) {
  return (
    <div 
      id="stories-preview"
      className="w-[270px] h-[480px] bg-gradient-to-br from-cyan-900 via-gray-900 to-gray-800 relative overflow-hidden"
      style={{ aspectRatio: '9/16' }}
    >
      {/* Logo no topo */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
        <div 
          style={{ 
            width: '96px', 
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <img
            src="/images/up-logo-white.png"
            alt="UP Carteiras Administradas"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </div>
      </div>

      {/* Título */}
      <div className="absolute top-16 left-4 right-4 z-10">
        <h1 className="text-white text-sm font-bold text-center leading-tight">Aumente o retorno da sua carteira com a UP Gestão de recursos</h1>
      </div>

      {/* Gráfico */}
      <div className="absolute top-32 left-4 right-4 bottom-48 z-10">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2dd4bf33" />
            <XAxis
              dataKey="date"
              stroke="#fff"
              tick={{ fill: '#fff', fontSize: 8 }}
              tickFormatter={formatDateLabel}
            />
            <YAxis 
              stroke="#fff" 
              tick={{ fill: '#fff', fontSize: 8 }} 
              tickFormatter={formatPercentTick} 
              domain={['dataMin', 'dataMax + 5']} 
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend verticalAlign="top" height={24} content={CustomLegend} />
            <defs>
              <linearGradient id="colorRet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="tatica"
              stroke={undefined}
              fill="url(#colorRet)"
              isAnimationActive
              animationDuration={3500}
              legendType="none"
              tooltipType="none"
            />
            <Line
              type="monotone"
              dataKey="tatica"
              name="BlackBox FIIs"
              stroke="#06b6d4"
              strokeWidth={2.2}
              dot={false}
              connectNulls
              legendType="line"
              isAnimationActive
              animationDuration={3500}
            />
            {carteira === 'BlackBox FIIs' && (
              <Line
                type="monotone"
                dataKey="ifix"
                name="IFIX"
                stroke="#2dd4bf"
                strokeWidth={2.2}
                dot={false}
                strokeDasharray="5 5"
                connectNulls
                legendType="line"
                isAnimationActive
                animationDuration={3500}
              />
            )}
            <Line
              type="monotone"
              dataKey="cdi"
              name="CDI"
              stroke="#ffffff"
              strokeWidth={2.2}
              dot={false}
              strokeDasharray="3 3"
              connectNulls
              legendType="line"
              isAnimationActive
              animationDuration={3500}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Copy persuasivo */}
      <div className="absolute bottom-20 left-4 right-4 z-10">
        <div className="bg-gray-800/80 rounded-lg p-3 backdrop-blur-sm">
          <div className="text-center">
            <div className="text-cyan-400 text-xs font-bold" style={{ fontSize: '10px' }}>+{retornoTotal.toFixed(1)}% de Retorno nos últimos 12 meses</div>
            <div className="text-gray-300 text-xs" style={{ fontSize: '9px' }}>Carteira de Fundos imobiliários, Fundos de Infraestrutura e Fundos do Agronegócio.</div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <div className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          Invista com UP
        </div>
      </div>
    </div>
  );
}

export default function MarketingPage() {
  const [carteira, setCarteira] = useState('BlackBox FIIs');
  const [periodo, setPeriodo] = useState('2020-2025');
  const [dadosFiltrados, setDadosFiltrados] = useState<{date:string; tatica:number; ifix?:number; cdi:number;}[]>([]);
  const [retornoTotal, setRetornoTotal] = useState(32.59);
  const [vsIfix, setVsIfix] = useState(9.34);
  const [vsCdi, setVsCdi] = useState(12.98);
  
  // Dados reais carregados via fetch (igual à home)
  const [retornoData, setRetornoData] = useState<{date:string; tatica:number; ifix:number; cdi:number;}[]>([]);
  const [retornoDataMulti, setRetornoDataMulti] = useState<{date:string; tatica:number; cdi:number;}[]>([]);

  // Carregar dados reais (igual à home)
  useEffect(() => {
    fetch('/data/retorno-carteira.json')
      .then(res => res.json())
      .then((d) => {
        setRetornoData(d);
        setDadosFiltrados(d);
      })
      .catch(err => console.error('Erro carregando retorno-carteira', err));
    
    fetch('/data/retorno-carteira-multi.json')
      .then(res => res.json())
      .then((d) => {
        setRetornoDataMulti(d);
      })
      .catch(err => console.error('Erro carregando retorno-carteira-multi', err));
  }, []);

  // Filtrar dados baseado no período selecionado
  useEffect(() => {
    const currentData = carteira === 'BlackBox FIIs' ? retornoData : retornoDataMulti;
    
    if (periodo === '2020-2025') {
      setDadosFiltrados(currentData);
      setRetornoTotal(32.59);
      setVsIfix(9.34);
      setVsCdi(12.98);
    } else if (periodo === '2023-2025') {
      const filtrados = currentData.filter(d => d.date.includes('23') || d.date.includes('24') || d.date.includes('25'));
      setDadosFiltrados(filtrados);
      setRetornoTotal(28.45);
      setVsIfix(7.23);
      setVsCdi(9.87);
    } else if (periodo === '2024-2025') {
      const filtrados = currentData.filter(d => d.date.includes('24') || d.date.includes('25'));
      setDadosFiltrados(filtrados);
      setRetornoTotal(18.32);
      setVsIfix(4.56);
      setVsCdi(6.78);
    }
  }, [periodo, carteira, retornoData, retornoDataMulti]);

  const handleExport = async () => {
    const element = document.getElementById('stories-preview');
    if (!element) return;

    try {
      // Garantir que a imagem da logo esteja carregada
      const logoImg = element.querySelector('img');
      if (logoImg) {
        await new Promise((resolve) => {
          if (logoImg.complete) {
            resolve(true);
          } else {
            logoImg.onload = () => resolve(true);
            logoImg.onerror = () => resolve(true);
          }
        });
      }

      const canvas = await html2canvas(element, {
        width: 1080,
        height: 1920,
        scale: 2, // Reduzido para melhor compatibilidade
        useCORS: true,
        backgroundColor: null,
        allowTaint: true,
        foreignObjectRendering: false, // Desabilitado para melhor compatibilidade
        logging: false,
        // Configurações específicas para melhor renderização
        onclone: (clonedDoc) => {
          // Garantir que as imagens sejam carregadas e não distorcidas
          const images = clonedDoc.querySelectorAll('img');
          images.forEach(img => {
            img.style.objectFit = 'contain';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.width = 'auto';
            img.style.height = 'auto';
            img.style.display = 'block';
          });
        }
      });

      const link = document.createElement('a');
      link.download = `up-${carteira.toLowerCase().replace(/\s+/g, '-')}-${periodo}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (error) {
      console.error('Erro ao exportar:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Marketing - Gerador de Artes</h1>
        <div className="text-sm text-gray-400">
          Crie artes profissionais para stories e campanhas
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel de Configuração */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Configurações</h2>
          
          <div className="space-y-4">
            {/* Seleção de Carteira */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Carteira
              </label>
              <select
                value={carteira}
                onChange={(e) => setCarteira(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="BlackBox FIIs">BlackBox FIIs</option>
                <option value="BlackBox Multi">BlackBox Multi</option>
                <option value="BlackBox Ações">BlackBox Ações</option>
              </select>
            </div>

            {/* Seleção de Período */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Período
              </label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="2020-2025">2020-2025 (5 anos)</option>
                <option value="2023-2025">2023-2025 (3 anos)</option>
                <option value="2024-2025">2024-2025 (2 anos)</option>
              </select>
            </div>

            {/* Botão de Exportação */}
            <button
              onClick={handleExport}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Exportar PNG (1080x1920)
            </button>
          </div>
        </div>

        {/* Preview da Arte */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Preview da Arte</h2>
          
          <div className="flex justify-center">
            <StoriesPreview
              carteira={carteira}
              periodo={periodo}
              dados={dadosFiltrados}
              retornoTotal={retornoTotal}
              vsIfix={vsIfix}
              vsCdi={vsCdi}
            />
          </div>
        </div>
      </div>

      {/* Informações Adicionais */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Informações da Arte</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-cyan-400 font-semibold">Dimensões</div>
            <div className="text-gray-300">1080x1920px (9:16)</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-cyan-400 font-semibold">Formato</div>
            <div className="text-gray-300">PNG (Alta Resolução)</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-cyan-400 font-semibold">Uso</div>
            <div className="text-gray-300">Stories Instagram/Facebook</div>
          </div>
        </div>
      </div>
    </div>
  );
}
