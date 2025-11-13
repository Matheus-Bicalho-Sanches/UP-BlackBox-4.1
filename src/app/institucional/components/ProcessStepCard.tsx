'use client';

type ProcessStepCardProps = {
  index: number;
  step: string;
  description: string;
};

const ProcessStepCard = ({ index, step, description }: ProcessStepCardProps) => {
  return (
    <article className="relative rounded-3xl border border-slate-200 bg-white/90 p-6 shadow">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 text-sm font-semibold text-white">
        {(index + 1).toString().padStart(2, '0')}
      </span>
      <h3 className="mt-3 text-lg font-semibold text-gray-900">{step}</h3>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">{description}</p>
    </article>
  );
};

export default ProcessStepCard;

