'use client';

import ValueCard from '../components/ValueCard';

type ValueGridProps = {
  pillars: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
};

const ValueGrid = ({ pillars }: ValueGridProps) => {
  return (
    <section className="bg-slate-50 py-20 md:py-24">
      <div className="container mx-auto px-4 space-y-12">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Nossa cultura</p>
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
            Valores que conectam pessoas e tecnologia
          </h2>
          <p className="text-lg text-gray-600">
            O mercado financeiro brasileiro é cheio de vieses e conflitos de interesse. Como endereçamos isso?
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((pillar) => (
            <ValueCard key={pillar.title} {...pillar} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ValueGrid;

