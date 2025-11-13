'use client';

import TimelineEventCard from '../components/TimelineEventCard';

type StoryTimelineProps = {
  events: Array<{
    year: string;
    title: string;
    description: string;
  }>;
};

const StoryTimeline = ({ events }: StoryTimelineProps) => {
  return (
    <section className="bg-white py-20 md:py-24">
      <div className="container mx-auto px-4 space-y-12">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Nossa história</p>
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
            Uma jornada de evolução constante ao lado dos clientes
          </h2>
          <p className="text-lg text-gray-600">
            Crescemos integrando pesquisa, tecnologia e governança, mantendo o foco em relações duradouras.
          </p>
        </header>
        <div className="space-y-6 border-l border-slate-200 pl-6 md:grid md:grid-cols-2 md:gap-6 md:border-0 md:pl-0">
          {events.map((event, index) => (
            <div key={event.year} className="md:relative md:before:absolute md:before:-left-3 md:before:top-6 md:before:h-6 md:before:w-6 md:before:rounded-full md:before:border md:before:border-cyan-500 md:before:bg-white">
              <TimelineEventCard {...event} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StoryTimeline;

