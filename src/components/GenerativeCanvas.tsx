'use client'

import dynamic from 'next/dynamic';

const Sketch = dynamic(() => import('./GenerativeSketch'), {
  ssr: false,
});

export default function GenerativeCanvas({ className }: { className?: string }) {
  return (
    <div className={`w-full flex justify-center py-12 ${className ?? ''}`}>
      <Sketch className="w-full h-auto" />
    </div>
  );
} 