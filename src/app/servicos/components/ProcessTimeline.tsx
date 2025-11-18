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
          {/* Seta vertical para mobile */}
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className="absolute -bottom-8 left-1/2 block h-16 w-px -translate-x-1/2 bg-gradient-to-b from-cyan-500/60 to-transparent md:hidden"
            />
          )}
          {/* Seta horizontal para desktop */}
          {index < steps.length - 1 && (
            <div
              aria-hidden
              className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 md:block"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-cyan-500"
              >
                <path
                  d="M9 18L15 12L9 6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
};

export default ProcessTimeline;

