'use client';

type ChannelCardProps = {
  label: string;
  description: string;
  value: string;
  actionLabel: string;
  href: string;
  availability: string;
  icon: string;
};

export const ChannelCard = ({
  label,
  description,
  value,
  actionLabel,
  href,
  availability,
  icon,
}: ChannelCardProps) => {
  const isExternal = href.startsWith('http') || href.startsWith('mailto') || href.startsWith('tel');

  return (
    <article className="flex h-full flex-col md:flex-row md:items-center md:justify-between rounded-3xl border border-slate-200 bg-white/90 p-4 md:p-5 shadow gap-4 md:gap-6">
      <div className="flex-1 space-y-2 md:space-y-2">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-full bg-cyan-50 text-lg md:text-xl">{icon}</span>
          <div>
            <h3 className="text-base md:text-lg font-semibold text-gray-900">{label}</h3>
            <p className="text-xs uppercase tracking-wide text-slate-500">{availability}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
        <p className="rounded-2xl bg-slate-100 px-4 py-1.5 md:py-2 text-sm font-semibold text-gray-800 whitespace-nowrap">{value}</p>
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-5 py-1.5 md:py-2 text-sm font-semibold text-white shadow hover:bg-cyan-600 whitespace-nowrap"
        >
          {actionLabel}
        </a>
      </div>
    </article>
  );
};

export default ChannelCard;

