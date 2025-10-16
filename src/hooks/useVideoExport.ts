import { useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import html2canvas from 'html2canvas';

interface VideoExportOptions {
  width: number;
  height: number;
  fps: number;
  duration: number;
}

export function useVideoExport() {
  const [progress, setProgress] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [ffmpeg] = useState(() => new FFmpeg());

  const loadFFmpeg = useCallback(async () => {
    if (ffmpeg.loaded) return;

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });

    ffmpeg.on('progress', ({ progress: p }) => {
      // O progresso do ffmpeg representa 50-100% do processo total
      const adjustedProgress = 50 + Math.round(p * 50);
      setProgress(adjustedProgress);
    });
  }, [ffmpeg]);

  const captureFrame = useCallback(async (
    element: HTMLElement,
    targetWidth: number,
    targetHeight: number
  ): Promise<Uint8Array> => {
    // Capturar o elemento usando html2canvas
    const canvas = await html2canvas(element, {
      width: element.offsetWidth,
      height: element.offsetHeight,
      scale: 1,
      backgroundColor: null,
      logging: false,
      useCORS: true,
      allowTaint: true,
    });

    // Criar um novo canvas com as dimensões de saída
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;
    const ctx = outputCanvas.getContext('2d');

    if (!ctx) throw new Error('Failed to get canvas context');

    // Desenhar o canvas capturado redimensionado
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    // Converter para JPEG bytes
    const blob = await new Promise<Blob>((resolve) => {
      outputCanvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92);
    });

    const arrayBuffer = await blob.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }, []);

  const exportVideo = useCallback(async (
    element: HTMLElement,
    options: VideoExportOptions
  ): Promise<void> => {
    setIsExporting(true);
    setProgress(0);

    try {
      console.log('Loading FFmpeg...');
      await loadFFmpeg();
      setProgress(5);

      const { width, height, fps, duration } = options;
      const totalFrames = Math.floor(fps * duration);
      const frameInterval = 1000 / fps; // milissegundos entre frames

      console.log(`Capturing ${totalFrames} frames at ${fps}fps (${duration}s)...`);
      console.log(`Target resolution: ${width}x${height}`);

      const frames: Uint8Array[] = [];

      // Capturar frames
      for (let i = 0; i < totalFrames; i++) {
        // Progresso de captura: 5-50%
        const captureProgress = 5 + Math.round((i / totalFrames) * 45);
        setProgress(captureProgress);

        console.log(`Capturing frame ${i + 1}/${totalFrames}...`);
        
        const frameData = await captureFrame(element, width, height);
        frames.push(frameData);

        // Aguardar próximo frame para permitir que a animação avance
        if (i < totalFrames - 1) {
          await new Promise(resolve => setTimeout(resolve, frameInterval));
        }
      }

      console.log(`Captured ${frames.length} frames. Converting to video...`);
      setProgress(50);

      // Escrever frames no ffmpeg
      for (let i = 0; i < frames.length; i++) {
        const frameNumber = i.toString().padStart(4, '0');
        await ffmpeg.writeFile(`frame${frameNumber}.jpg`, frames[i]);
      }

      console.log('Encoding video with FFmpeg...');
      
      // Converter para MP4
      await ffmpeg.exec([
        '-framerate', fps.toString(),
        '-i', 'frame%04d.jpg',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '23',
        '-movflags', '+faststart',
        'output.mp4'
      ]);

      setProgress(95);

      console.log('Reading output file...');
      
      // Ler o arquivo de saída
      const data = await ffmpeg.readFile('output.mp4');
      const blob = new Blob([data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      console.log('Downloading video...');
      
      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = `story-trackrecord-fiis-${Date.now()}.mp4`;
      a.click();

      // Cleanup
      URL.revokeObjectURL(url);
      
      console.log('Cleaning up temporary files...');
      
      // Limpar arquivos do ffmpeg
      for (let i = 0; i < frames.length; i++) {
        const frameNumber = i.toString().padStart(4, '0');
        await ffmpeg.deleteFile(`frame${frameNumber}.jpg`);
      }
      await ffmpeg.deleteFile('output.mp4');

      setProgress(100);
      
      console.log('Video export completed successfully!');
      
      // Reset após 2 segundos
      setTimeout(() => {
        setProgress(0);
        setIsExporting(false);
      }, 2000);

    } catch (error) {
      console.error('Error exporting video:', error);
      setIsExporting(false);
      setProgress(0);
      throw error;
    }
  }, [loadFFmpeg, captureFrame, ffmpeg]);

  return {
    exportVideo,
    progress,
    isExporting
  };
}
