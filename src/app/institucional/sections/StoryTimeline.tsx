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
        {/* Mobile: left border timeline; Desktop: two-column alternating with center line */}
        <div className="space-y-6 border-l border-slate-200 pl-6 md:space-y-0 md:border-0 md:pl-0">
          <div className="relative md:grid md:grid-cols-2 md:gap-x-10 md:gap-y-16 md:items-start">
            {/* Center vertical line for desktop */}
            <div className="hidden md:block absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-200" />

            {events.map((event, index) => {
              const isLeft = index % 2 === 0;
              // Use transform to create stagger without affecting layout height
              const offsetClass = index % 2 === 1 ? 'md:translate-y-20' : '';
              return (
                <div
                  key={event.year}
                  className={`relative ${isLeft ? 'md:pr-8' : 'md:pl-8'} ${offsetClass} md:flex md:flex-col`}
                >
                  {/* Connector dot on center line (desktop only) */}
                  <span
                    aria-hidden="true"
                    className={`hidden md:block absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full border border-cyan-500 bg-white ${
                      isLeft ? 'right-[-7px]' : 'left-[-7px]'
                    }`}
                  />
                  <TimelineEventCard {...event} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default StoryTimeline;

