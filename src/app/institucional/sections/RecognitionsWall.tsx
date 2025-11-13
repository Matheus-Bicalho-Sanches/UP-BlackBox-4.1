'use client';

import RecognitionBadge from '../components/RecognitionBadge';

type RecognitionsWallProps = {
  recognitions: Array<{
    title: string;
    description: string;
    year: string;
  }>;
};

const RecognitionsWall = ({ recognitions }: RecognitionsWallProps) => {
  return (
    <section className="bg-white py-20 md:py-24">
      <div className="container mx-auto px-4 space-y-12">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Reconhecimentos</p>
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Selos, parcerias e prêmios que nos motivam</h2>
          <p className="text-lg text-gray-600">
            Acreditamos em certificações, auditorias e parcerias como forma de reforçar nosso compromisso com as melhores
            práticas.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {recognitions.map((recognition) => (
            <RecognitionBadge key={`${recognition.title}-${recognition.year}`} {...recognition} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default RecognitionsWall;

