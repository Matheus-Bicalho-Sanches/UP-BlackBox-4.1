'use client';

type HeroStatProps = {
  label: string;
  value: string;
};

const HeroStat = ({ label, value }: HeroStatProps) => {
  return (
    <div className="rounded-3xl border border-white/20 bg-white/10 px-6 py-4 text-white backdrop-blur-md">
      <dt className="text-xs uppercase tracking-[0.3em] text-white/70">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold">{value}</dd>
    </div>
  );
};

export default HeroStat;

