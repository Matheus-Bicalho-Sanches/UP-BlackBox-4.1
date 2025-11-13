'use client';

type ValueCardProps = {
  icon: string;
  title: string;
  description: string;
};

const ValueCard = ({ icon, title, description }: ValueCardProps) => {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 text-center shadow transition hover:-translate-y-1 hover:shadow-lg">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-2xl text-cyan-600">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-3 text-sm text-gray-600 leading-relaxed">{description}</p>
    </article>
  );
};

export default ValueCard;

