/**
 * AnimatedWave
 *
 * Fundo ondulado repetido que se move horizontalmente de forma infinita.
 * Duas cópias do mesmo path são renderizadas em um <svg> mais largo
 * e todo o SVG é transladado via animação CSS.
 */
export default function AnimatedWave() {
  // Novo path "tileable": começa e termina na mesma altura (y = 160)
  // Isso garante continuidade perfeita quando a forma se repete horizontalmente.
  const path = "M0 160 C 60 120 120 200 180 160 S 300 120 360 160 S 420 200 480 160 S 540 120 600 160 S 660 200 720 160 S 780 120 840 160 S 900 200 960 160 S 1020 120 1080 160 S 1140 200 1200 160 L1200 320 L0 320 Z";

  return (
    <div className="wave-container">
      {/* Três ondas sobrepostas com durações e atrasos distintos */}
      <svg viewBox="0 0 1200 320" preserveAspectRatio="none" className="wave wave1">
        <path d={path} fill="#06b6d4" fillOpacity={0.15} />
      </svg>
      <svg viewBox="0 0 1200 320" preserveAspectRatio="none" className="wave wave2">
        <path d={path} fill="#06b6d4" fillOpacity={0.15} />
      </svg>
      <svg viewBox="0 0 1200 320" preserveAspectRatio="none" className="wave wave3">
        <path d={path} fill="#06b6d4" fillOpacity={0.15} />
      </svg>

      <style jsx>{`
        .wave-container {
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 320px;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        .wave {
          position: absolute;
          bottom: 0;
          width: 200%;
          height: 100%;
        }

        /* === ONDA 1 === */
        .wave1 {
          animation:
            waveFlow146 14.6s linear infinite,
            waveFade146 14.6s ease-in-out infinite;
          bottom: 0;
        }

        /* === ONDA 2 (inicia 5s depois apenas na primeira execução) === */
        .wave2 {
          animation:
            waveFlow158 15.8s linear infinite 5s,
            waveFade158 15.8s ease-in-out infinite 5s;
          bottom: 8px; /* leve deslocamento vertical para profundidade */
        }

        /* === ONDA 3 (inicia 10s depois apenas na primeira execução) === */
        .wave3 {
          animation:
            waveFlow173 17.3s linear infinite 10s,
            waveFade173 17.3s ease-in-out infinite 10s;
          bottom: 16px; /* mais distante */
        }

        /* Deslocamento horizontal 0 → -50% (velocidades distintas) */
        @keyframes waveFlow146 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes waveFlow158 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes waveFlow173 {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* Fades de 3 s para cada duração (percentual calculado) */
        @keyframes waveFade146 {
          0%   { opacity: 0; }
          20.5% { opacity: 1; } /* 3 / 14.6 ≈ 20.5% */
          79.5% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes waveFade158 {
          0%   { opacity: 0; }
          19%  { opacity: 1; } /* 3 / 15.8 ≈ 19% */
          81%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes waveFade173 {
          0%   { opacity: 0; }
          17.3% { opacity: 1; } /* 3 / 17.3 ≈ 17.3% */
          82.7% { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Tamanhos menores: reduz amplitude da onda */
        @media (max-width: 640px) {
          .wave-container {
            height: 160px; /* metade da altura original */
          }
          /* Ajusta o deslocamento vertical proporcionalmente */
          .wave2 { bottom: 4px; }
          .wave3 { bottom: 8px; }
        }
      `}</style>
    </div>
  );
} 