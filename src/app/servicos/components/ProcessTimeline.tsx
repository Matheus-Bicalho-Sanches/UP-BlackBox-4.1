'use client';

type TimelineStep = {
  id: string;
  title: string;
  description: string;
  deliverable: string;
  timeframe: string;
};

type ProcessTimelineProps = {
  steps: TimelineStep[];
};

export const ProcessTimeline = ({ steps }: ProcessTimelineProps) => {
  return (
    <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
      {steps.map((step, index) => (
        <li key={step.id} className="relative rounded-3xl border border-slate-200 bg-white/90 p-6 shadow">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500 text-white">
              {(index + 1).toString().padStart(2, '0')}
            </span>
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">{step.timeframe}</p>
              <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-600 leading-relaxed">{step.description}</p>
          <p className="mt-5 rounded-full bg-cyan-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-700">
            Entregável: {step.deliverable}
          </p>
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className="absolute -bottom-8 left-1/2 hidden h-16 w-px bg-gradient-to-b from-cyan-500/60 to-transparent md:block"
            />
          )}
        </li>
      ))}
    </ol>
  );
};

export default ProcessTimeline;

