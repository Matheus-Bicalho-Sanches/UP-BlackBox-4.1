'use client'
import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import Papa from 'papaparse';
import { useInView } from 'react-intersection-observer';

const exemploPergunta = 'Pergunte estatísticas ou faça backtests envolvendo o Ibovespa';
const exemploResposta = 'OBS: Dados diários de 2021 a 2025 somente';

type Candle = {
  x: number;
  open: number;
  close: number;
  high: number;
  low: number;
  isAlta: boolean;
  closeForNext: number;
};

function gerarCandle(lastClose: number, i: number, qtd: number, altura: number, largura: number): Candle {
  const open = lastClose + (Math.random() - 0.5) * 30;
  const close = open + (Math.random() - 0.5) * 40;
  const high = Math.max(open, close) + Math.random() * 20;
  const low = Math.min(open, close) - Math.random() * 20;
  const isAlta = close > open;
  return {
    x: (i * (largura / qtd)) + 20,
    open,
    close,
    high,
    low,
    isAlta,
    closeForNext: close,
  };
}

function gerarCandleAnimado(base: Candle): Candle {
  // Oscilações pequenas em torno do candle base
  let open = base.open;
  let close = base.close + (Math.random() - 0.5) * 10;

  // O preço atual pode oscilar entre open e close
  // O high só aumenta se o novo close superar o high anterior
  let high = base.high;
  if (close > base.high) {
    high = close;
  }

  // O low só diminui se o novo close for menor que o low anterior
  let low = base.low;
  if (close < base.low) {
    low = close;
  }

  // Pequena chance do open oscilar também, mas mantendo o corpo realista
  if (Math.random() < 0.2) {
    open = open + (Math.random() - 0.5) * 6;
    if (open > high) high = open;
    if (open < low) low = open;
  }

  const isAlta = close > open;
  return {
    ...base,
    open,
    close,
    high,
    low,
    isAlta,
    closeForNext: close,
  };
}

// Versão otimizada usando Canvas em vez de SVG
function CandlesCanvas({ width = 1440, height = 600, qtd = 60 }: { width?: number; height?: number; qtd?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { ref: wrapperRef, inView } = useInView({ threshold: 0 });
  const animRef = useRef<number>();
  const candlesRef = useRef<Candle[]>([]);
  const formingRef = useRef<Candle | null>(null);
  const frameCountRef = useRef(0);

  // Responsividade simples
  const baseY = 110;
  const localQtd = width < 640 ? 40 : qtd;

  // Inicializa candles só uma vez
  useEffect(() => {
    const arr: Candle[] = [];
    let lastClose = (height - 60) / 2;
    for (let i = 0; i < localQtd; i++) {
      const open = lastClose;
      const close = open + (Math.random() - 0.5) * 20;
      const high = Math.max(open, close) + Math.random() * 10;
      const low = Math.min(open, close) - Math.random() * 10;
      const isAlta = close > open;
      arr.push({
        x: 0,
        open,
        close,
        high,
        low,
        isAlta,
        closeForNext: close,
      });
      lastClose = close;
    }
    candlesRef.current = arr;
    // último candle (em formação) começa estático mas animará no loop
    formingRef.current = arr[arr.length - 1];
  }, [localQtd, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const step = width / (localQtd + 6);

    const draw = () => {
      if (!inView || document.visibilityState !== 'visible') return; // pausa

      ctx.clearRect(0, 0, width, height);

      // Move forming candle periodically
      frameCountRef.current++;
      if (frameCountRef.current % 5 === 0 && formingRef.current) {
        const move = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random() * 4);
        formingRef.current.close += move;
        if (formingRef.current.close > formingRef.current.high) formingRef.current.high = formingRef.current.close;
        if (formingRef.current.close < formingRef.current.low) formingRef.current.low = formingRef.current.close;
        formingRef.current.isAlta = formingRef.current.close > formingRef.current.open;
        // a cada 40 frames cria um novo candle
        if (frameCountRef.current % 40 === 0) {
          const cur = formingRef.current;
          const newCandle: Candle = {
            x: 0,
            open: cur.close,
            close: cur.close,
            high: cur.close,
            low: cur.close,
            isAlta: false,
            closeForNext: cur.close,
          };
          candlesRef.current.push(newCandle);
          formingRef.current = newCandle;
          if (candlesRef.current.length > localQtd) candlesRef.current.shift();
        }
      }

      candlesRef.current.forEach((c, idx) => {
        const x = 20 + idx * step;
        const o = c.open + baseY;
        const cl = c.close + baseY;
        const hi = c.high + baseY;
        const lo = c.low + baseY;
        const color = c.isAlta ? '#ef4444' : '#22d3ee';

        // pavio
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, hi);
        ctx.lineTo(x, lo);
        ctx.stroke();

        // corpo
        ctx.fillStyle = color;
        const bodyY = Math.min(o, cl);
        const bodyH = Math.max(6, Math.abs(cl - o));
        ctx.fillRect(x - 3, bodyY, 6, bodyH);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    if (inView) animRef.current = requestAnimationFrame(draw);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [inView, width, height, localQtd]);

  // Pausar quando sai da viewport
  useEffect(() => {
    if (!inView && animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = undefined;
    } else if (inView && !animRef.current) {
      animRef.current = requestAnimationFrame(() => {}); // reinicia próximo efeito
    }
  }, [inView]);

  return <canvas ref={el => {canvasRef.current = el; wrapperRef(el as any)}} style={{ position: 'absolute', top: 0, left: 0 }} />;
}

// Hook para animação de digitação no placeholder, agora com frases alternadas
function useTypewriterLoop(phrases: string[], speed = 60, pause = 3000) {
  const [displayed, setDisplayed] = useState('');
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);

  useEffect(() => {
    if (charIdx < phrases[phraseIdx].length) {
      const timeout = setTimeout(() => {
        setDisplayed(phrases[phraseIdx].slice(0, charIdx + 1));
        setCharIdx(charIdx + 1);
      }, speed);
      return () => clearTimeout(timeout);
    } else {
      const timeout = setTimeout(() => {
        setPhraseIdx((prev) => (prev + 1) % phrases.length);
        setCharIdx(0);
        setDisplayed('');
      }, pause);
      return () => clearTimeout(timeout);
    }
  }, [charIdx, phraseIdx, phrases, speed, pause]);

  useEffect(() => {
    setCharIdx(0);
    setDisplayed('');
  }, [phraseIdx, phrases]);

  return displayed;
}

// Frases para o placeholder animado (fora do componente para evitar recriação)
const frasesPlaceholder = [
  "Qual foi a maior queda diária nos últimos anos?",
  "Faça um Backtest de momentum",
  "Qual foi o retorno do Ibovespa em 2023?",
  "Faça um Backtest envolvendo médias",
  "Qual a probabilidade de uma alta após uma queda de 3%?"
];

export default function HeroSectionIA2() {
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState('');
  const [mostrarGrafico, setMostrarGrafico] = useState(false);
  const [exemploAtivo, setExemploAtivo] = useState(true);
  const [winWidth, setWinWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1440);
  const [dadosCSV, setDadosCSV] = useState<any[]>([]);
  const [respostaTexto, setRespostaTexto] = useState('');
  const [codigoIA, setCodigoIA] = useState<string | null>(null);
  const [resultadoGrafico, setResultadoGrafico] = useState<any[] | null>(null);
  const [erroExecucao, setErroExecucao] = useState<string | null>(null);
  const [resultadoTextoIA, setResultadoTextoIA] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Carregar CSV ao montar
  useEffect(() => {
    fetch('/data/ibovespa.csv')
      .then(response => response.text())
      .then(csvText => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results: Papa.ParseResult<any>) => {
            setDadosCSV(results.data);
          }
        });
      });
  }, []);

  // Adaptar dados para o gráfico (fechamento diário)
  const dadosGrafico = dadosCSV.map(item => ({
    data: item.date,
    close: Number(item.close)
  })).filter(item => !isNaN(item.close));

  // Altura responsiva para a hero section e o gráfico
  let heroHeight = 600;
  if (typeof window !== 'undefined' && winWidth >= 1024) {
    heroHeight = window.innerHeight;
  } else if (winWidth < 640) heroHeight = 400;
  else if (winWidth < 1024) heroHeight = 500;

  useEffect(() => {
    setPergunta('');
    setResposta(exemploResposta);
    setMostrarGrafico(true);
    setExemploAtivo(true);
  }, []);

  useEffect(() => {
    function handleResize() {
      setWinWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const placeholderType = useTypewriterLoop(frasesPlaceholder, 60, 3000);

  // Substituir o onSubmit do form por handlePergunta
  const handlePergunta = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setResposta('Aguarde, consultando IA...');
    setRespostaTexto('');
    setCodigoIA(null);
    setResultadoGrafico(null);
    setMostrarGrafico(false);
    setExemploAtivo(false);
    setErroExecucao(null);
    setResultadoTextoIA(null);
    try {
      const resp = await fetch(process.env.NEXT_PUBLIC_BACKEND_ASK_URL || 'http://localhost:3001/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: pergunta }),
      });
      if (resp.status === 429) {
        const errData = await resp.json().catch(() => ({}));
        const msg = errData.error || 'Envio global máximo de mensagens por minuto atingido. Aguarde 1-2 minutos e tente novamente.';
        window.alert(msg);
        setRespostaTexto(msg);
        setResposta(msg);
        setCarregando(false);
        return;
      }
      if (!resp.ok) {
        throw new Error('Erro ao consultar IA');
      }
      const data = await resp.json();
      setResposta(data.answer);

      // Separar texto e código da resposta - regex mais flexível
      const regex = /```(?:js|javascript|javascript|js)?\s*([\s\S]*?)```/;
      const match = data.answer.match(regex);
      
      // Se não encontrar com ```, tenta encontrar código sem markdown
      let texto, codigo;
      if (match) {
        texto = data.answer.split('```')[0].trim();
        codigo = match[1].trim();
      } else {
        // Tenta detectar código sem markdown (função JavaScript)
        const functionRegex = /(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\})/;
        const functionMatch = data.answer.match(functionRegex);
        if (functionMatch) {
          const codeStart = data.answer.indexOf(functionMatch[1]);
          texto = data.answer.substring(0, codeStart).trim();
          codigo = functionMatch[1].trim();
        } else {
          texto = data.answer;
          codigo = null;
        }
      }
      setRespostaTexto(texto);
      setCodigoIA(codigo);
      setErroExecucao(null);
      setResultadoTextoIA(null);
      // Logar o código JS retornado pela IA no console
      if (codigo) {
        console.log('Código JS retornado pela IA:', codigo);
      }

      // Se houver código, executar sobre os dados CSV
      if (codigo && dadosCSV.length > 0) {
        try {
          let resultado;
          // Detecta se o código é uma função nomeada
          if (/function\s+\w+\s*\(/.test(codigo)) {
            const funcNameMatch = codigo.match(/function\s+(\w+)\s*\(/);
            if (funcNameMatch) {
              const funcName = funcNameMatch[1];
              // Usa new Function para declarar e executar a função no mesmo escopo
              // eslint-disable-next-line no-new-func
              const wrapper = new Function('dados', `${codigo}; return typeof ${funcName} === 'function' ? ${funcName}(dados) : undefined;`);
              resultado = wrapper(dadosCSV);
            } else {
              // fallback para função anônima
              // eslint-disable-next-line no-new-func
              const func = new Function('dados', codigo);
              resultado = func(dadosCSV);
            }
          } else {
            // Código padrão: função anônima ou bloco com return
            // eslint-disable-next-line no-new-func
            const func = new Function('dados', codigo);
            resultado = func(dadosCSV);
          }
          console.log('Resultado da execução do código IA:', resultado);
          if (Array.isArray(resultado)) {
            setResultadoGrafico(resultado);
            setMostrarGrafico(true);
            setResultadoTextoIA(null);
          } else {
            setMostrarGrafico(false);
            setResultadoTextoIA(
              typeof resultado === 'string'
                ? resultado
                : (resultado !== undefined && resultado !== null
                    ? JSON.stringify(resultado, null, 2)
                    : 'Sem resultado retornado pela IA.')
            );
          }

          // Nada a fazer, pois os logs do código da IA já aparecem no console do navegador automaticamente
          // (console.log do código executado via Function/Wrapper é redirecionado para o console do navegador)
        } catch (err) {
          setMostrarGrafico(false);
          setErroExecucao('Erro ao executar o código da IA: ' + (err instanceof Error ? err.message : String(err)));
          setResultadoTextoIA(null);
          console.error('Erro ao executar código IA:', err);
        }
      } else {
        setMostrarGrafico(false);
        setErroExecucao(null);
        setResultadoTextoIA(null);
      }
    } catch (err) {
      setResposta('Erro ao consultar a IA.');
      setRespostaTexto('Erro ao consultar a IA.');
      setCodigoIA(null);
      setMostrarGrafico(false);
      setErroExecucao('Erro ao consultar a IA.');
      setResultadoTextoIA(null);
    } finally {
      setCarregando(false);
    }
  };

  const hasResultContent = mostrarGrafico || resultadoTextoIA;

  return (
    <section
      className={`relative min-h-screen py-20 sm:py-20 py-8 bg-gradient-to-br from-cyan-900 via-gray-900 to-gray-800 flex flex-col items-center ${hasResultContent ? 'overflow-x-hidden' : 'overflow-hidden'}`}
      style={{
        minHeight: heroHeight,
        // Mantém a hero em tela cheia apenas enquanto não há resultado (gráfico ou texto) para evitar corte.
        height: winWidth >= 1024 && !hasResultContent ? '100vh' : undefined,
      }}
    >
      {/* Fundo animado de esferas SVG + candles SVG */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Esferas animadas do fundo */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1440 600"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="absolute top-0 left-0 animate-pulse-slow"
          style={winWidth < 640 ? { transform: 'translateY(-60px)' } : {}}
        >
          <circle cx="200" cy="80" r="18" fill="#06b6d4" fillOpacity="0.18">
            <animate attributeName="cy" values="80;120;80" dur="6s" repeatCount="indefinite" />
          </circle>
          <circle cx="600" cy="200" r="12" fill="#22d3ee" fillOpacity="0.13">
            <animate attributeName="cy" values="200;250;200" dur="7s" repeatCount="indefinite" />
          </circle>
          <circle cx="1200" cy="100" r="22" fill="#0ea5e9" fillOpacity="0.10">
            <animate attributeName="cy" values="100;160;100" dur="8s" repeatCount="indefinite" />
          </circle>
          <circle cx="900" cy="250" r="14" fill="#38bdf8" fillOpacity="0.15">
            <animate attributeName="cy" values="250;200;250" dur="5s" repeatCount="indefinite" />
          </circle>
          <circle cx="400" cy="300" r="10" fill="#0ea5e9" fillOpacity="0.10">
            <animate attributeName="cy" values="300;220;300" dur="9s" repeatCount="indefinite" />
          </circle>
          <circle cx="1000" cy="60" r="16" fill="#06b6d4" fillOpacity="0.13">
            <animate attributeName="cy" values="60;120;60" dur="10s" repeatCount="indefinite" />
          </circle>
          <circle cx="300" cy="180" r="8" fill="#38bdf8" fillOpacity="0.12">
            <animate attributeName="cy" values="180;140;180" dur="7s" repeatCount="indefinite" />
          </circle>
          <circle cx="800" cy="100" r="20" fill="#22d3ee" fillOpacity="0.09">
            <animate attributeName="cy" values="100;180;100" dur="11s" repeatCount="indefinite" />
          </circle>
          <circle cx="1300" cy="220" r="12" fill="#0ea5e9" fillOpacity="0.14">
            <animate attributeName="cy" values="220;160;220" dur="8s" repeatCount="indefinite" />
          </circle>
        </svg>
        {/* Gráfico de candles animado */}
        <CandlesCanvas width={winWidth || 1440} height={heroHeight} qtd={60} />
      </div>
      <div className="w-full max-w-2xl mx-auto text-center z-10 relative">
        {/* Logo centralizada no topo */}
        <div className="mb-4 flex justify-center">
          <div className="relative w-[180px] h-[60px] lg:w-[260px] lg:h-[90px]">
            <img
              src="/images/up-logo-white.png"
              alt="UP Carteiras Administradas"
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            />
          </div>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Carteiras Administradas</h2>
        <p className="text-lg text-gray-300 mb-12 sm:mb-8">Obtenha retornos acima da média com tecnologia e Inteligência Artificial.</p>
        <form
          onSubmit={handlePergunta}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-8 bg-gray-800/65 rounded-xl p-4"
        >
          <input
            type="text"
            className="px-4 py-3 rounded-lg bg-gray-800 text-white border border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 w-full"
            placeholder={placeholderType}
            value={pergunta}
            onChange={e => setPergunta(e.target.value)}
            required
          />
          <button
            type="submit"
            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition duration-300"
            disabled={carregando}
          >Perguntar</button>
        </form>
        {carregando && (
          <div className="flex justify-center items-center mb-4 animate-fade-in">
            <svg className="animate-spin h-6 w-6 text-cyan-400 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
            </svg>
            <span className="text-cyan-300 text-lg font-medium">Consultando IA...</span>
          </div>
        )}
        {(respostaTexto || (exemploAtivo && resposta)) && (
          <div className="bg-gray-800/70 text-cyan-100 rounded-lg p-6 mb-2 text-base sm:text-lg shadow-md animate-fade-in">
            {exemploAtivo ? (
              <span><b>Interaja:</b> <i>{exemploPergunta}</i><br /></span>
            ) : null}
            {respostaTexto || resposta}
          </div>
        )}
        {/* Exibir erro de execução, se houver */}
        {erroExecucao && (
          <div className="bg-red-900/80 text-red-200 rounded-lg p-3 mb-4 font-mono text-sm border border-red-400">
            {erroExecucao}
          </div>
        )}
        {mostrarGrafico && resultadoGrafico && (
          <div className="bg-white/10 rounded-xl p-6 shadow-lg backdrop-blur-md max-w-xl mx-auto animate-fade-in">
            <ResponsiveContainer width="100%" height={220}>
              {/* Detecta tipo de gráfico pelo formato dos dados */}
              {resultadoGrafico[0] && ((resultadoGrafico[0].ibov !== undefined && resultadoGrafico[0].estrategia !== undefined) || resultadoGrafico[0].data !== undefined) ? (
                // Gráfico de linha (equity ou série temporal)
                <LineChart data={resultadoGrafico} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2dd4bf33" />
                  <XAxis dataKey="data" stroke="#fff" tick={{ fill: '#fff', fontSize: 10 }} minTickGap={16} />
                  <YAxis stroke="#fff" tick={{ fill: '#fff' }}
                    tickFormatter={resultadoGrafico[0] && resultadoGrafico[0].ibov !== undefined && resultadoGrafico[0].estrategia !== undefined
                      ? v => v.toFixed(0) // Para equity curve, base 100
                      : v => `${(v/1000).toFixed(0)}k` // Para outros gráficos de linha
                    }
                  />
                  <Tooltip formatter={v => `${v.toLocaleString('pt-BR')}`} labelStyle={{ color: '#0e7490' }} contentStyle={{ background: '#fff', borderRadius: 8, color: '#0e7490' }} />
                  {/* Se o resultado tiver ibov e estrategia, plote as duas linhas */}
                  {resultadoGrafico[0] && resultadoGrafico[0].ibov !== undefined && resultadoGrafico[0].estrategia !== undefined ? (
                    <>
                      <Line type="monotone" dataKey="ibov" stroke="#06b6d4" strokeWidth={3} dot={false} isAnimationActive={true} animationDuration={1500} name="Ibovespa (base 100)" />
                      <Line type="monotone" dataKey="estrategia" stroke="#f59e42" strokeWidth={3} dot={false} isAnimationActive={true} animationDuration={1500} name="Estratégia (base 100)" />
                    </>
                  ) : (
                    <Line type="monotone" dataKey={Object.keys(resultadoGrafico[0] || {}).find(k => k !== 'data') || 'valor'} stroke="#06b6d4" strokeWidth={3} dot={false} isAnimationActive={true} animationDuration={1500} />
                  )}
                </LineChart>
              ) : resultadoGrafico[0] && (resultadoGrafico[0].categoria !== undefined || resultadoGrafico[0].label !== undefined) && resultadoGrafico[0].valor !== undefined ? (
                // Gráfico de barras
                <BarChart data={resultadoGrafico} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2dd4bf33" />
                  <XAxis dataKey={resultadoGrafico[0].categoria !== undefined ? 'categoria' : 'label'} stroke="#fff" tick={{ fill: '#fff', fontSize: 12 }} />
                  <YAxis stroke="#fff" tick={{ fill: '#fff' }} />
                  <Tooltip formatter={v => `${v.toLocaleString('pt-BR')}`} labelStyle={{ color: '#0e7490' }} contentStyle={{ background: '#fff', borderRadius: 8, color: '#0e7490' }} />
                  <Bar dataKey="valor" fill="#06b6d4" isAnimationActive={true} animationDuration={1500} />
                </BarChart>
              ) : resultadoGrafico.length > 0 && resultadoGrafico.length <= 10 && resultadoGrafico[0].valor !== undefined && (resultadoGrafico[0].categoria !== undefined || resultadoGrafico[0].label !== undefined) ? (
                // Gráfico de pizza para poucos dados
                <PieChart>
                  <Pie data={resultadoGrafico} dataKey="valor" nameKey={resultadoGrafico[0].categoria !== undefined ? 'categoria' : 'label'} cx="50%" cy="50%" outerRadius={80} fill="#06b6d4" label>
                    {resultadoGrafico.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={["#06b6d4", "#f59e42", "#22d3ee", "#0ea5e9", "#38bdf8", "#ef4444"][index % 6]} />
                    ))}
                  </Pie>
                  <Legend />
                  <Tooltip formatter={v => `${v.toLocaleString('pt-BR')}`} />
                </PieChart>
              ) : <></>}
            </ResponsiveContainer>
          </div>
        )}
        {/* Exibir resultado textual da execução do código, se não for array */}
        {resultadoTextoIA && (
          <div className="bg-gray-800/80 text-cyan-200 rounded-lg p-4 mb-4 font-mono text-base border border-cyan-400">
            <div className="mb-1 text-cyan-300 font-bold">Resultado da execução do código:</div>
            <pre>{resultadoTextoIA}</pre>
          </div>
        )}
      </div>
    </section>
  );
} 