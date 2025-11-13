'use client';

type RecognitionBadgeProps = {
  title: string;
  description: string;
  year: string;
};

const RecognitionBadge = ({ title, description, year }: RecognitionBadgeProps) => {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 text-center shadow">
      <p className="text-xs uppercase tracking-[0.3em] text-cyan-600">Ano {year}</p>
      <h3 className="mt-3 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">{description}</p>
    </article>
  );
};

export default RecognitionBadge;

