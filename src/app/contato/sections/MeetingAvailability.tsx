'use client';

import MeetingSlotCard from '../components/MeetingSlotCard';

type MeetingAvailabilityProps = {
  slots: Array<{
    id: string;
    day: string;
    period: string;
    description: string;
  }>;
};

const MeetingAvailability = ({ slots }: MeetingAvailabilityProps) => {
  return (
    <section className="bg-slate-50 py-18 md:py-20">
      <div className="container mx-auto px-4 space-y-10">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Reuniões de diagnóstico</p>
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Reserve um horário com nossos especialistas</h2>
          <p className="text-lg text-gray-600">
            Escolha o período ideal e nosso time confirma a agenda com link de reunião ou visita presencial.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {slots.map((slot) => (
            <MeetingSlotCard key={slot.id} {...slot} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default MeetingAvailability;

