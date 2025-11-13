'use client';

type Highlight = {
  title: string;
  description: string;
  icon?: string;
};

type CultureHighlightsProps = {
  highlights: Highlight[];
};

const iconMap: Record<string, string> = {
  partnership: '🤝',
  governance: '🏛️',
  innovation: '🚀',
  data: '📊',
};

export const CultureHighlights = ({ highlights }: CultureHighlightsProps) => {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      {highlights.map(({ title, description, icon }) => (
        <article
          key={title}
          className="rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-lg"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-2xl">
              {icon ? iconMap[icon] ?? '⭐' : '⭐'}
            </span>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

export default CultureHighlights;

