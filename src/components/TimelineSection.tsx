'use client';
import React, { useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import AnimatedWave from '@/components/AnimatedWave';
import { useInView } from 'react-intersection-observer';

const milestones = [
  { year: 'jan/2024', title: 'Planejamento', desc: 'Início do planejamento para a abertura da gestora' },
  { year: 'jun/2024', title: 'Equipe', desc: 'Abertura do processo seletivo e recrutamento da equipe' },
  { year: 'jul/2024', title: 'Início Quant', desc: 'Primeiras análises e backtests quantitativos' },
  { year: 'out/2024', title: 'Carteira tática', desc: 'Início da carteira UP FIIs em contas reais' },
  { year: 'dez/2024', title: 'Abertura CNPJ', desc: 'Abertura do CNPJ da gestora' },
  { year: 'maio/2025', title: 'Homologação CVM', desc: 'Gestora recebe aprovação da CVM para operar' },
  { year: 'junho/2025', title: 'Desenvolvimento robô', desc: 'Primeiros testes de operações completamente automatizadas' },
  { year: 'junho/2025', title: 'Novas estratégias', desc: 'Desenvolvimento de estratégias em outras classes de ativo' },
  { year: 'jul/2025', title: 'UP Multimercado', desc: 'Início da carteira multimercado em contas reais' },
  { year: 'Em breve', title: 'Automação completa', desc: 'Lançamento das primeiras estratégias 100% automatizadas' },
];

// Utilitário para formatar datas no padrão "Mmm/YYYY" (ex.: Jun/2024)
const formatDate = (val: string) => {
  // Caso seja apenas um ano ("2025"), mantém sem alteração
  if (/^\d{4}$/.test(val)) return val;

  // Se já estiver no formato mmm/aaaa, apenas capitaliza o mês
  const parts = val.split('/');
  if (parts.length === 2) {
    const monthRaw = parts[0].slice(0, 3).toLowerCase();
    const monthCap = monthRaw.charAt(0).toUpperCase() + monthRaw.slice(1);
    return `${monthCap}/${parts[1]}`;
  }
  return val;
};

export default function TimelineSection() {
  const { ref: sectionRef, inView } = useInView({ threshold: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>();
  const velocityRef = useRef(0); // px per frame
  const targetVelRef = useRef(0); // desired velocity updated by wheel

  const smoothStep = () => {
    const el = scrollRef.current;
    if (!el) return;

    // Easing velocity toward targetVel (more aggressive to settle quicker)
    velocityRef.current += (targetVelRef.current - velocityRef.current) * 0.12;

    // Apply scrolling
    if (Math.abs(velocityRef.current) > 0.1) {
      const maxScroll = el.scrollWidth - el.clientWidth;
      let next = el.scrollLeft + velocityRef.current;
      if (next < 0) {
        next = 0;
        velocityRef.current = 0;
        targetVelRef.current = 0;
      } else if (next > maxScroll) {
        next = maxScroll;
        velocityRef.current = 0;
        targetVelRef.current = 0;
      }
      el.scrollLeft = next;
    }

    // Friction to gradually reduce targetVel (stronger friction so it stops sooner)
    targetVelRef.current *= 0.7;

    if (Math.abs(velocityRef.current) > 0.1 || Math.abs(targetVelRef.current) > 0.1) {
      animRef.current = requestAnimationFrame(smoothStep);
    } else {
      animRef.current = undefined;
      velocityRef.current = 0;
      targetVelRef.current = 0;
    }
  };

  const kickAnim = () => {
    if (!inView) return;
    if (!animRef.current) animRef.current = requestAnimationFrame(smoothStep);
  };

  const startScroll = useCallback((dir: 'left' | 'right') => {
    targetVelRef.current = dir === 'left' ? -40 : 40;
    kickAnim();
  }, []);

  const stopScroll = useCallback(() => {
    targetVelRef.current = 0;
  }, []);

  // Permite rolagem horizontal usando scroll do mouse
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!inView) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        const atStart = el.scrollLeft === 0;
        const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1; // tolerance
        const scrollingLeft = e.deltaY < 0;
        const scrollingRight = e.deltaY > 0;

        // Se estamos no começo e rolando para cima (scrollingLeft) OU no fim e rolando para baixo (scrollingRight), deixe a página rolar
        if ((atStart && scrollingLeft) || (atEnd && scrollingRight)) {
          return; // não previne, página continua
        }

        e.preventDefault();
        const speedFactor = 0.4; // aumenta velocidade de rolagem
        targetVelRef.current += e.deltaY * speedFactor;
        // limita velocidade máxima para evitar roladas muito rápidas
        const maxVel = 25;
        if (targetVelRef.current > maxVel) targetVelRef.current = maxVel;
        if (targetVelRef.current < -maxVel) targetVelRef.current = -maxVel;
        kickAnim();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel as any);
  }, [inView]);

  // Cancela animação quando sai da viewport
  useEffect(() => {
    if (!inView && animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = undefined;
      velocityRef.current = 0;
      targetVelRef.current = 0;
    }
  }, [inView]);

  return (
    <section ref={sectionRef} className="relative py-24 bg-gradient-to-b from-gray-900 via-gray-800 to-gray-900 overflow-hidden">
      {/* linha divisória sutil */}
      <div className="divider-pulse pointer-events-none absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent z-[2]" />
      {/* background subtle particles */}
      <svg className="absolute inset-0 w-full h-full opacity-20" preserveAspectRatio="none">
        <defs>
          <radialGradient id="pulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#0e7490" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0e7490" stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 25 }).map((_, i) => (
          <circle key={i} cx={Math.random() * 100 + '%'} cy={Math.random() * 100 + '%'} r={Math.random() * 3 + 1} fill="url(#pulse)" />
        ))}
      </svg>

      <div className="relative z-10 max-w-6xl mx-auto px-4">
        <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-16">
          Nossa Trajetória
        </h2>

        {/* timeline container */}
        <div className="hidden md:block">
          {/* horizontal line (fixed width matching scroll area) */}
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent relative mb-12" />
          {/* horizontal scroll wrapper */}
          <div className="relative">
            <div ref={scrollRef} className="hide-scroll overflow-x-auto overflow-y-hidden -mx-8 px-8 edge-fade-mask">
              <div className="flex flex-nowrap gap-12 w-max scroll-snap-x mandatory">
                {milestones.map((m, idx) => (
                  <motion.div
                    key={`${idx}-${m.year}`}
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{ delay: idx * 0.2, duration: 1.2, ease: 'easeOut' }}
                    className="flex flex-col items-center text-center w-40"
                  >
                    <div className="relative mb-4">
                      <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping absolute top-0 left-0 right-0 bottom-0 m-auto" />
                      <div className="w-4 h-4 rounded-full bg-cyan-500 relative" />
                    </div>
                    <p className="text-cyan-400 font-semibold text-lg mb-1">{formatDate(m.year)}</p>
                    <h4 className="text-white font-bold mb-1">{m.title}</h4>
                    <p className="text-gray-300 text-sm leading-relaxed max-w-[10rem]">{m.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* fade é aplicado via CSS mask, divs removidos */}
          </div>
        </div>

        {/* mobile vertical timeline */}
        <div className="md:hidden flex flex-col gap-12 relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-cyan-400 to-transparent" />
          {milestones.map((m, idx) => (
            <motion.div
              key={`mobile-${idx}-${m.year}`}
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ delay: idx * 0.2, duration: 1.2, ease: 'easeOut' }}
              className="pl-12 relative"
            >
              <div className="absolute -left-2 top-1.5 w-4 h-4 rounded-full bg-cyan-500" />
              <p className="text-cyan-400 font-semibold">{formatDate(m.year)}</p>
              <h4 className="text-white font-bold mb-1">{m.title}</h4>
              <p className="text-gray-300 text-sm leading-relaxed">{m.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ondas animadas compartilhadas */}
      <AnimatedWave />
      {/* Gradiente de desfoque/fade na parte inferior para transição suave */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 md:h-24 bg-gradient-to-b from-transparent to-gray-900 backdrop-blur-sm" />
      {/* custom scrollbar hide */}
      <style jsx>{`
        .hide-scroll::-webkit-scrollbar{display:none;}
        .hide-scroll{-ms-overflow-style:none;scrollbar-width:none;}
        @keyframes dividerPulse{0%,100%{opacity:0.4;}50%{opacity:1;}}
        .divider-pulse{animation:dividerPulse 3s ease-in-out infinite;}
      `}</style>
      <style jsx>{`
        /* Máscara de desvanecimento nas bordas horizontais do carrossel */
        .edge-fade-mask {
          -webkit-mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
          mask-image: linear-gradient(to right, transparent 0%, #000 6%, #000 94%, transparent 100%);
        }
      `}</style>
    </section>
  );
} 