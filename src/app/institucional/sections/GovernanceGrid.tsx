'use client';

import GovernanceCard from '../components/GovernanceCard';

type GovernanceGridProps = {
  items: Array<{
    eyebrow: string;
    title: string;
    bullets: string[];
  }>;
};

const GovernanceGrid = ({ items }: GovernanceGridProps) => {
  return (
    <section className="bg-white py-8 md:py-12">
      <div className="container mx-auto px-4 space-y-12">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Governança e controles</p>
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
            Estrutura dedicada a decisões conscientes e transparentes
          </h2>
          <p className="text-lg text-gray-600">
            Nossos comitês e políticas internas garantem que cada alocação seja registrada em nosso sistema e seja feita com alinhamento e comunicação clara.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item) => (
            <GovernanceCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default GovernanceGrid;

