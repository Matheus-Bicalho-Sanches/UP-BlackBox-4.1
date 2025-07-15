'use client'
import { useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';

interface Props {
  density?: number; // número aproximado de ticks
  color?: string; // cor dos ticks (css rgba ou hex)
}

/**
 * RisingTicksBackground
 * 
 * Canvas que desenha pequenas barras verticais que sobem
 * continuamente, simulando "ticks" do mercado.
 * 
 * - Usa requestAnimationFrame para animação suave.
 * - pointer-events:none e position:absolute → não interfere em interação.
 */
export default function RisingTicksBackground({ density = 120, color = 'rgba(6,182,212,0.35)' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>();
  const ticksRef = useRef<{ x: number; y: number; len: number; speed: number }[]>([]);

  // Detecta se componente está visível na viewport
  const { ref: wrapperRef, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    function resize() {
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = canvas!.parentElement?.getBoundingClientRect().height! * dpr;
      canvas!.style.width = '100%';
      canvas!.style.height = '100%';
      // Reseta transform antes de reescalar para evitar acúmulo
      ctx.setTransform(1,0,0,1,0,0);
      ctx.scale(dpr, dpr);

      // Ajusta densidade em telas pequenas (metade em <640px)
      const effectiveDensity = window.innerWidth < 640 ? Math.round(density / 2) : density;

      // Recriar ticks com nova densidade
      ticksRef.current = Array.from({ length: effectiveDensity }, () => genTick(canvas!));
    }

    function genTick(cnv: HTMLCanvasElement) {
      return {
        x: Math.random() * cnv.width / dpr,
        y: Math.random() * cnv.height / dpr,
        len: 8 + Math.random() * 24,
        speed: 0.15 + Math.random() * 0.6,
      };
    }

    resize();
    window.addEventListener('resize', resize);

    function animate() {
      const width = canvas!.width / dpr;
      const height = canvas!.height / dpr;
      ctx.clearRect(0, 0, width, height);
      ctx.lineWidth = 1.2;

      const now = Date.now();

      ticksRef.current.forEach(t => {
        // Fade conforme a barra sobe (próximo do topo = mais transparente)
        const fade = Math.min(1, Math.max(0, t.y / height)); // 1 no fundo, 0 no topo
        // Pulso de luminescência
        const pulse = 0.6 + 0.4 * Math.sin((now + t.x * 50) / 400);
        const alpha = fade * pulse;

        ctx.strokeStyle = '#06b6d4';
        ctx.globalAlpha = alpha; // usa alpha global em vez de shadowBlur

        ctx.beginPath();
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x, t.y - t.len);
        ctx.stroke();

        ctx.globalAlpha = 1; // reset

        // Atualizar posição
        t.y -= t.speed;
        if (t.y + t.len < 0) {
          // Reinicia no fundo
          t.x = Math.random() * width;
          t.y = height + t.len;
          t.len = 8 + Math.random() * 24;
          t.speed = 0.15 + Math.random() * 0.6;
        }
      });

      animationRef.current = requestAnimationFrame(animate);
    }

    // Inicia animação somente se visível
    if (inView && document.visibilityState === 'visible') {
      animate();
    }
    return () => {
      cancelAnimationFrame(animationRef.current!);
      window.removeEventListener('resize', resize);
    };
  }, [density, color, inView]);

  // Pausa/retoma quando componente entra/sai da viewport ou quando guia muda
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && inView) {
        if (!animationRef.current) animationRef.current = requestAnimationFrame(() => {});
      } else {
        cancelAnimationFrame(animationRef.current!);
        animationRef.current = undefined;
      }
    };
    handleVisibility();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [inView]);

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
        }}
      />
    </div>
  );
} 