'use client';

type MeetingSlotCardProps = {
  day: string;
  period: string;
  description: string;
};

export const MeetingSlotCard = ({ day, period, description }: MeetingSlotCardProps) => {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow transition hover:-translate-y-1 hover:shadow-lg">
      <h3 className="text-lg font-semibold text-gray-900">{day}</h3>
      <p className="mt-1 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-700">
        {period}
      </p>
      <p className="mt-4 text-sm text-gray-600 leading-relaxed">{description}</p>
      <p className="mt-4 text-xs text-slate-500">Após escolher um horário, confirmamos por e-mail ou WhatsApp.</p>
    </article>
  );
};

export default MeetingSlotCard;

