'use client'

import Sketch from 'react-p5';
import { useRef } from 'react';

export default function GenerativeSketch({ className }: { className?: string }) {
  let t = 0;

  // Gera uma seed aleatória única por montagem do componente
  const seedRef = useRef<number>(Math.floor(Math.random() * 100000));

  // helper computes displaced point
  const displaced = (p5: any, x: number, y: number): [number, number] => {
    const k = x / 8 - 25;
    const e = y / 8 - 25;
    const r = p5.mag(k, e);
    let d = 2 * Math.cos(r / 3 - t);
    // Em telas grandes, evita movimento de retorno (apenas 'expansão')
    if (p5.windowWidth >= 768) {
      // Remove fase de retorno
      if (d < 0) d = 0;
      // Aplica limiar para que o deslocamento só ocorra nos picos do cosseno (~25% do ciclo)
      const cRaw = Math.cos(r / 3 - t);
      const threshold = 0.85; // Tempo em % que o fundo gasta retornando ao seu estado original
      if (cRaw < threshold) d = 0;
      else {
        // Reescala suavemente para manter amplitude similar
        const scale = (cRaw - threshold) / (1 - threshold); // 0..1
        d = 2 * scale; // máximo ainda 2
      }
    }
    // Aplica falloff para limitar distorção. Em telas grandes, preserva amplitude mínima.
    let falloff = 1 / (1 + Math.pow(r / 60, 2)); // 60 controla alcance
    let scaleDisp = 1;
    if (p5.windowWidth < 768) {
      scaleDisp = 0.8; // reduz um pouco a amplitude em telas pequenas para suavizar blur
    }
    if (p5.windowWidth >= 768) {
      // Mantém mais força da onda ao longe: atenuação mais suave
      falloff = Math.pow(falloff, 1.3); // 1.3 < 2 => cai mais devagar
      scaleDisp = 0.3; // amplitude um pouco maior
    }
    return [x + d * k * falloff * scaleDisp, y + d * e * falloff * scaleDisp];
  };

  const setup = (p5: any, canvasParentRef: Element) => {
    p5.createCanvas(p5.windowWidth, 400).parent(canvasParentRef);
    p5.colorMode(p5.RGB, 255, 255, 255, 255);
    p5.background(9, 15, 23); // dark navy background
    // Resize handler to keep canvas width in sync
    p5.windowResized = () => {
      p5.resizeCanvas(p5.windowWidth, 400);
    };
    // Limita a taxa de frames para reduzir uso de CPU/GPU
    p5.frameRate(24);

    // Usa seed fixa para esta sessão para que o padrão seja único mas estável durante a animação
    const seed = seedRef.current;
    p5.randomSeed(seed);
  };

  const draw = (p5: any) => {
    // fade trail
    p5.background(9, 15, 23, 25); // fade with alpha

    // Define passo de grade conforme largura da tela
    let s = 4;
    if (p5.width >= 1600) s = 6; // telas ultrawide
    else if (p5.width >= 1200) s = 5;

    // Usa seed fixa para esta sessão para que o padrão seja único mas estável durante a animação
    const seed = seedRef.current;
    p5.randomSeed(seed);

    const isLarge = p5.width >= 768;
    const offsetX = !isLarge && p5.width < 768 ? (p5.width - 400) / 2 : 0;
    const xStart = isLarge ? 100 : 100 + offsetX;
    const xEnd = isLarge ? p5.width - 100 : 300 + offsetX;

    for (let y = 100; y < 300; y += s) {
      for (let x = xStart; x < xEnd; x += s) {
        const arr = [displaced(p5, x, y), displaced(p5, x, y + s), displaced(p5, x + s, y)];
        p5.shuffle(arr, true);

        // gradiente radial: escuro no centro, cyan nas extremidades
        let ratio;
        if (isLarge) {
          const dx = x - p5.width / 2;
          const dy = y - 200;
          const maxDist = Math.sqrt((p5.width / 2) ** 2 + 100 ** 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          ratio = p5.constrain(dist / maxDist, 0, 1);
        } else {
          const dx = x - (200 + offsetX);
          const dy = y - 200;
          const dist = Math.sqrt(dx * dx + dy * dy);
          ratio = p5.constrain(dist / 141, 0, 1);
        }

        const cCenter = p5.color(17, 24, 39, 160); // mais transparência no centro
        const cEdge = p5.color(34, 211, 238, 255);  // cyan mais vivo (#22d3ee)

        const boost = p5.constrain(ratio * 1.5, 0, 1); // intensifica ciano nas extremidades
        p5.stroke(p5.lerpColor(cCenter, cEdge, boost));

        // line between first two shuffled points
        p5.line(arr[0][0], arr[0][1], arr[1][0], arr[1][1]);
      }
    }

    // Acelera ondas em telas pequenas
    const inc = p5.windowWidth < 768 ? 0.04 : 0.02;
    t += inc;
  };

  return <Sketch setup={setup} draw={draw} className={className} />;
} 