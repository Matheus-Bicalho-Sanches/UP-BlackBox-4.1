'use client'
import { useEffect, useState, useRef } from 'react';

/**
 * CursorGlow
 * 
 * Um efeito visual em forma de "glow" (radial-gradient) que segue o ponteiro do mouse.
 * Funciona em qualquer página que inclua este componente.
 * - Sem interferir em cliques (pointer-events: none)
 * - Usa `position: fixed` para cobrir toda a viewport
 * - A cor/raio do gradiente pode ser ajustada via props futuramente
 */
export default function CursorGlow() {
  // Sem estado individual; utilizamos o array trail para glow atual e rastro
  const [trail, setTrail] = useState<{x:number; y:number; t:number}[]>([]);
  const ttl = 800; // duração da trilha em ms

  useEffect(() => {
    const start = () => {
      return window.setInterval(() => {
        setTrail(prev => prev.filter(p => Date.now() - p.t < ttl));
      }, 40);
    };

    let id = start();

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        clearInterval(id);
      } else {
        // reinicia somente se não houver ativo
        if (!id) id = start();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // atual handleMove: adjust with timestamp
  useEffect(() => {
    // Handler que funciona para PointerEvent e TouchEvent (fallback)
    const handleMove = (ev: PointerEvent | TouchEvent) => {
      let clientX: number | null = null;
      let clientY: number | null = null;

      if ('clientX' in ev && 'clientY' in ev) {
        // PointerEvent ou MouseEvent
        clientX = (ev as PointerEvent).clientX;
        clientY = (ev as PointerEvent).clientY;
      } else if ('touches' in ev && ev.touches.length > 0) {
        clientX = ev.touches[0].clientX;
        clientY = ev.touches[0].clientY;
      }

      if (clientX !== null && clientY !== null) {
        const point = { x: clientX, y: clientY, t: Date.now() };
        setTrail(prev => [...prev, point]);
      }
    };

    // PointerEvents (cobrem desktop + mobile modernos)
    window.addEventListener('pointermove', handleMove, { passive: true });
    // Fallback para navegadores sem PointerEvents (alguns iOS antigos)
    window.addEventListener('touchmove', handleMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('touchmove', handleMove);
    };
  }, []);

  // draw
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}
    >
      {trail.slice(0, -1).map((p, idx) => {
        const next = trail[idx + 1];
        if (!next) return null;
        const age = Date.now() - p.t;
        const progress = Math.min(1, age / ttl);
        const opacity = (1 - progress) * 0.6; // fade out
        const width = 1.5; // fino
        return (
          <line
            key={idx}
            x1={p.x}
            y1={p.y}
            x2={next.x}
            y2={next.y}
            stroke={`rgba(6,182,212,${opacity.toFixed(2)})`}
            strokeWidth={width}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
} 