'use client';

import { ReactNode } from 'react';

export type ServiceCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  icon?: ReactNode;
  bullets: string[];
  metrics?: Array<{ label: string; value: string }>;
  highlight?: boolean;
  ctaLabel?: string;
  ctaHref?: string;
};

export const ServiceCard = ({
  eyebrow,
  title,
  description,
  icon,
  bullets,
  metrics = [],
  highlight = false,
  ctaLabel,
  ctaHref,
}: ServiceCardProps) => {
  return (
    <article
      className={`flex h-full flex-col overflow-hidden rounded-3xl border ${
        highlight ? 'border-cyan-500 shadow-xl' : 'border-slate-200 shadow-lg'
      } bg-white/90 backdrop-blur transition hover:-translate-y-1`}
    >
      <div className="space-y-4 p-8">
        <div className="flex items-center gap-3">
          {icon && <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-2xl">{icon}</div>}
          <div>
            {eyebrow && <p className="text-xs font-semibold uppercase tracking-widest text-cyan-600">{eyebrow}</p>}
            <h3 className="text-2xl font-semibold text-gray-900">{title}</h3>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
        <ul className="space-y-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2 text-sm text-gray-700">
              <span aria-hidden className="mt-1 text-cyan-600">
                •
              </span>
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      {metrics.length > 0 && (
        <dl className="grid grid-cols-1 gap-4 border-t border-slate-200 bg-slate-50 px-8 py-6 sm:grid-cols-2">
          {metrics.map(({ label, value }) => (
            <div key={`${label}-${value}`}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
              <dd className="text-lg font-semibold text-gray-900">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {ctaLabel && ctaHref && (
        <div className="border-t border-slate-200 bg-white px-8 py-6">
          <a
            href={ctaHref}
            className="inline-flex items-center justify-center rounded-full bg-cyan-500 px-6 py-2 text-sm font-semibold text-white shadow hover:bg-cyan-600"
          >
            {ctaLabel}
          </a>
        </div>
      )}
    </article>
  );
};

export default ServiceCard;

