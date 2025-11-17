'use client';

import OfficeCard from '../components/OfficeCard';

type OfficesSectionProps = {
  offices: Array<{
    id: string;
    city: string;
    address: string;
    info: string;
    mapImage: string;
    schedule: string;
  }>;
};

const OfficesSection = ({ offices }: OfficesSectionProps) => {
  return (
    <section className="bg-slate-900 py-8 md:py-12">
      <div className="container mx-auto px-4 space-y-12">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Onde estamos</p>
          <h2 className="text-3xl font-semibold text-white md:text-4xl">Escritórios e hubs de atendimento</h2>
          <p className="text-lg text-slate-200">
            Agende sua visita presencial ou reserve uma sala virtual com nossos times de investimentos e relacionamento.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-2">
          {offices.map((office) => (
            <OfficeCard key={office.id} {...office} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default OfficesSection;

