'use client';

type GovernanceCardProps = {
  eyebrow: string;
  title: string;
  bullets: string[];
};

const GovernanceCard = ({ eyebrow, title, bullets }: GovernanceCardProps) => {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-semibold text-gray-900">{title}</h3>
      <ul className="mt-4 space-y-3 text-sm text-gray-600">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <span aria-hidden className="mt-1 text-cyan-500">
              •
            </span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </article>
  );
};

export default GovernanceCard;

