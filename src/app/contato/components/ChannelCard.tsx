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
    <article className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white/90 p-6 shadow">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-50 text-xl">{icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{label}</h3>
            <p className="text-xs uppercase tracking-wide text-slate-500">{availability}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
        <p className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-gray-800">{value}</p>
      </div>
      <div className="mt-6">
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-cyan-600"
        >
          {actionLabel}
        </a>
      </div>
    </article>
  );
};

export default ChannelCard;

