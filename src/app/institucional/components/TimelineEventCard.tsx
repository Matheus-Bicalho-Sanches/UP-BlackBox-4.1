'use client';

type TimelineEventCardProps = {
  year: string;
  title: string;
  description: string;
};

const TimelineEventCard = ({ year, title, description }: TimelineEventCardProps) => {
  return (
    <article className="relative rounded-3xl border border-slate-200 bg-white/90 p-6 shadow">
      <div className="flex items-baseline gap-3">
        <span className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-600">{year}</span>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="mt-4 text-sm text-gray-600 leading-relaxed">{description}</p>
    </article>
  );
};

export default TimelineEventCard;

