'use client';

import { PaperClipIcon } from '@heroicons/react/24/outline';

type DocumentCardProps = {
  category: string;
  title: string;
  description: string;
  href: string;
};

const DocumentCard = ({ category, title, description, href }: DocumentCardProps) => {
  return (
    <article className="flex h-full flex-col justify-between rounded-3xl border border-slate-200 bg-white/90 p-6 shadow">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-600">{category}</p>
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
      </div>
      <div className="mt-6 flex items-center justify-end">
        <a
          href={href}
          target={href.startsWith('http') ? '_blank' : undefined}
          rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-600 transition hover:bg-cyan-50"
        >
          <PaperClipIcon className="h-4 w-4" />
          Download
        </a>
      </div>
    </article>
  );
};

export default DocumentCard;

