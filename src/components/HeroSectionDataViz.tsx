'use client'
import { Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, TooltipProps, Legend, LineChart, ComposedChart } from 'recharts';
import CountUp from 'react-countup';
import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent';
import RisingTicksBackground from '@/components/RisingTicksBackground';
import { useEffect, useState } from 'react';

const patrimonioGestora = [
  { year: 2020, valor: 2000000 },
  { year: 2021, valor: 5000000 },
  { year: 2022, valor: 12000000 },
  { year: 2023, valor: 18000000 },
  { year: 2024, valor: 25000000 },
];

// Dados de retorno agora são carregados via fetch (JSON estático em public/data).

const stats = [
  { label: 'Famílias Atendidas', value: 60, suffix: '+' },
  { label: 'Patrimônio sob Gestão', value: 35000000, prefix: 'R$ ', format: 'money' },
  { label: 'Retorno Médio 2024', value: 17.2, suffix: '%', decimals: 1 },
  { label: 'Carteiras Personalizadas', value: 100, suffix: '%' },
];

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

// Custom tooltip
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

// Legenda customizada com visual anterior
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

export default function HeroSectionDataViz() {
  const { ref, inView } = useInView({ threshold: 0.3 });

  // Chave usada para forçar remontagem do gráfico e reiniciar as animações
  const [chartKey, setChartKey] = useState(0);

  // Controla o aspecto do gráfico (altura). Mobile (sm) = 16/9, desktop = 3/1
  const [chartAspect, setChartAspect] = useState<number>(3);

  // Estado para armazenar dados carregados
  const [retornoData, setRetornoData] = useState<{date:string; tatica:number; ifix:number; cdi:number;}[]>([]);
  const [retornoDataMulti, setRetornoDataMulti] = useState<{date:string; tatica:number; cdi:number;}[]>([]);
  
  // Estado para controlar qual carteira está selecionada
  const [selectedCarteira, setSelectedCarteira] = useState<'fii' | 'multi'>('fii');

  useEffect(() => {
    const updateAspect = () => {
      if (typeof window !== 'undefined') {
        setChartAspect(window.innerWidth < 640 ? 16 / 9 : 3);
      }
    };
    updateAspect();
    window.addEventListener('resize', updateAspect);
    return () => window.removeEventListener('resize', updateAspect);
  }, []);

  // Sempre que a seção entra em view, incrementamos a chave para que o gráfico remonte
  useEffect(() => {
    if (inView) {
      setChartKey(prev => prev + 1);
    }
  }, [inView]);

  // Carrega JSON apenas no cliente
  useEffect(() => {
    fetch('/data/retorno-carteira.json')
      .then(res => res.json())
      .then((d) => {
        setRetornoData(d);
        if (typeof window !== 'undefined') {
          // @ts-ignore exposição para debugging
          window.retornoCarteira = d;
        }
      })
      .catch(err => console.error('Erro carregando retorno-carteira', err));
    
    fetch('/data/retorno-carteira-multi.json')
      .then(res => res.json())
      .then((d) => {
        setRetornoDataMulti(d);
        if (typeof window !== 'undefined') {
          // @ts-ignore exposição para debugging
          window.retornoCarteiraMulti = d;
        }
      })
      .catch(err => console.error('Erro carregando retorno-carteira-multi', err));
  }, []);

  // Gera array de ticks para eixo X quando dados disponíveis
  const getCurrentData = () => selectedCarteira === 'fii' ? retornoData : retornoDataMulti;
  const currentData = getCurrentData();
  
  const ticks = currentData.length ? [
    currentData[0].date,
    currentData[Math.floor(currentData.length / 2)].date,
    currentData[currentData.length - 1].date,
  ] : [];

  // Se dados ainda não carregaram mostra skeleton simples
  if (!retornoData.length || !retornoDataMulti.length) {
    return (
      <section className="min-h-[50vh] flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-cyan-900">
        <p className="text-gray-300">Carregando dados…</p>
      </section>
    );
  }

  return (
    <section ref={ref} className="relative min-h-[90vh] flex flex-col justify-center items-center bg-gradient-to-br from-gray-900 via-gray-800 to-cyan-900 overflow-hidden">
      <RisingTicksBackground />
      {/* Fade-out na parte inferior para suavizar os ticks/candles */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-cyan-900 z-[2]" />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="z-10 w-full max-w-5xl mx-auto text-center py-20 px-4"
      >
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
          Histórico e estatísticas
        </h1>
        <p className="text-lg sm:text-xl text-gray-300 mb-8">
          Veja o retorno das nossas principais carteiras e suas estatísticas
        </p>
        {/* Gráfico + métricas de performance (agora empilhados verticalmente para evitar áreas vazias em telas grandes) */}
        <div className="grid grid-cols-1 gap-8 mb-10">
          {/* Tabs para seleção de carteira */}
          <div className="flex justify-center mb-4">
            <div className="bg-gray-800/60 rounded-lg p-1 backdrop-blur-md">
              <button
                onClick={() => setSelectedCarteira('fii')}
                className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
                  selectedCarteira === 'fii'
                    ? 'bg-cyan-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                BlackBox FIIs
              </button>
              <button
                onClick={() => setSelectedCarteira('multi')}
                className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
                  selectedCarteira === 'multi'
                    ? 'bg-cyan-500 text-white shadow-lg'
                    : 'text-gray-300 hover:text-white hover:bg-gray-700/50'
                }`}
              >
                BlackBox Multi
              </button>
            </div>
          </div>
          
          {/* Gráfico de retorno da carteira (agora na primeira coluna) */}
          <div className="bg-white/10 rounded-xl p-6 shadow-lg backdrop-blur-md">
            <h3 className="text-lg font-semibold text-cyan-300 mb-2">
              Retorno da carteira {selectedCarteira === 'fii' ? 'BlackBox FIIs' : 'BlackBox Multi'}
            </h3>
            <ResponsiveContainer width="100%" aspect={chartAspect}>
              <ComposedChart key={`${chartKey}-${selectedCarteira}`} data={currentData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2dd4bf33" />
                <XAxis
                  dataKey="date"
                  stroke="#fff"
                  tick={{ fill: '#fff' }}
                  ticks={ticks}
                  tickFormatter={formatDateLabel}
                />
                <YAxis stroke="#fff" tick={{ fill: '#fff' }} tickFormatter={formatPercentTick} domain={['dataMin', 'dataMax + 5']} />
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
                {selectedCarteira === 'fii' && (
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
                  stroke="#38bdf8"
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

                      {/* Estatísticas de Performance (segunda coluna) */}
            <div className="bg-white/10 rounded-xl p-4 sm:p-6 shadow-lg backdrop-blur-md flex flex-col justify-center">
              <h3 className="text-base sm:text-lg font-semibold text-cyan-300 mb-4 sm:mb-6 text-center">Desempenho Operacional</h3>
              {/* Nos desktops (lg) exibir todos os 6 cards em uma única linha */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
                {(() => {
                  // Estatísticas específicas para cada carteira
                  const stats = selectedCarteira === 'fii' ? [
                    { label: 'Total de Operações', value: 699, suffix: '' },
                    { label: 'Tempo Médio por Posição', value: '10d22h', isString: true },
                    { label: 'Operações com Ganhos', value: 80.51, suffix: '%', decimals: 2 },
                    { label: 'Operações com Perdas', value: 19.49, suffix: '%', decimals: 2 },
                    { label: 'Maior Ganho por Operação', value: 25, prefix: '+', suffix: '%', decimals: 0 },
                    { label: 'Fator de Lucro', value: 4.79, suffix: 'x', decimals: 2 },
                  ] : [
                    { label: 'Total de Operações', value: 208, suffix: '' },
                    { label: 'Tempo Médio por Posição', value: '2d18h', isString: true },
                    { label: 'Operações com Ganhos', value: 85.58, suffix: '%', decimals: 2 },
                    { label: 'Operações com Perdas', value: 14.42, suffix: '%', decimals: 2 },
                    { label: 'Maior Ganho por Operação', value: 7.7, prefix: '+', suffix: '%', decimals: 1 },
                    { label: 'Fator de Lucro', value: 6.3, suffix: 'x', decimals: 1 },
                  ];
                  
                  return stats.map((stat, idx) => (
                    <div key={`${idx}-${chartKey}-${selectedCarteira}`} className="bg-gray-800/60 rounded-lg p-3 sm:p-4 shadow-md flex flex-col items-center transform transition duration-300 ease-out hover:-translate-y-1 hover:scale-105 hover:bg-gray-800/80">
                      <span className="text-xl sm:text-2xl md:text-3xl font-extrabold text-cyan-400 mb-1">
                        {stat.isString ? (
                          stat.value
                        ) : (
                          <CountUp
                            key={`${chartKey}-${selectedCarteira}`}
                            end={stat.value as number}
                            duration={3.5}
                            decimals={stat.decimals || 0}
                            prefix={stat.prefix || ''}
                            suffix={stat.suffix || ''}
                            decimal="," />
                        )}
                      </span>
                      <span className="text-gray-200 text-xs md:text-sm text-center font-medium leading-tight">
                        {stat.label}
                      </span>
                    </div>
                  ));
                })()}
            </div>
          </div>
        </div>
        {/* Estatísticas animadas removidas a pedido do cliente */}
        <div className="mt-6 flex justify-center">
          <a
            href="https://wa.me/5543991811304"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 bg-transparent border-2 border-white text-white hover:bg-white/10 rounded-lg font-semibold transition duration-300 transform hover:scale-105"
          >
            Fale conosco no WhatsApp
          </a>
        </div>
      </motion.div>
    </section>
  );
} 