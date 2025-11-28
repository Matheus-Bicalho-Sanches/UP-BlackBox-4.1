'use client';

import ProcessStepCard from '../components/ProcessStepCard';

type ProcessFlowProps = {
  steps: Array<{
    step: string;
    description: string;
  }>;
};

const ProcessFlow = ({ steps }: ProcessFlowProps) => {
  return (
    <section className="bg-slate-50 py-8 md:py-12">
      <div className="container mx-auto px-4 space-y-12">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Como trabalhamos</p>
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Metodologia para transformar dados em decisões</h2>
          <p className="text-lg text-gray-600">
            Nossa disciplina conecta pesquisa profunda, decisões colegiadas e acompanhamento contínuo para proteger e
            multiplicar patrimônio.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-4">
          {steps.map((step, index) => (
            <ProcessStepCard key={step.step} index={index} {...step} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProcessFlow;

