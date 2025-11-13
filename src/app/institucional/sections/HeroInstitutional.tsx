'use client';

import Link from 'next/link';
import HeroStat from '../components/HeroStat';

type HeroInstitutionalProps = {
  data: {
    eyebrow: string;
    title: string;
    subtitle: string;
    stats: Array<{ label: string; value: string }>;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
  };
};

const HeroInstitutional = ({ data }: HeroInstitutionalProps) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 py-28">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl space-y-6 text-white">
          <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">{data.eyebrow}</p>
          <h1 className="text-4xl font-semibold md:text-5xl">{data.title}</h1>
          <p className="text-lg text-slate-200">{data.subtitle}</p>

          <div className="flex flex-wrap gap-3">
            <Link
              href={data.primaryCta.href}
              className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-cyan-600"
            >
              {data.primaryCta.label}
            </Link>
            <Link
              href={data.secondaryCta.href}
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur transition hover:border-white hover:text-white"
            >
              {data.secondaryCta.label}
            </Link>
          </div>

          <dl className="mt-8 grid gap-4 sm:grid-cols-3">
            {data.stats.map((stat) => (
              <HeroStat key={stat.label} {...stat} />
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
};

export default HeroInstitutional;

