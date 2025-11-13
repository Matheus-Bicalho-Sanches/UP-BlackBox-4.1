'use client';

import { useState } from 'react';

type AccordionItem = {
  id: string;
  title: string;
  description: string;
};

type DifferentialsAccordionProps = {
  items: AccordionItem[];
};

export const DifferentialsAccordion = ({ items }: DifferentialsAccordionProps) => {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const isOpen = item.id === openId;
        return (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-white/90 shadow">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left"
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : item.id)}
            >
              <span className="text-base font-semibold text-gray-900">{item.title}</span>
              <span
                aria-hidden
                className={`flex h-8 w-8 items-center justify-center rounded-full border border-cyan-200 text-cyan-600 transition ${
                  isOpen ? 'rotate-45' : ''
                }`}
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="px-6 pb-6 text-sm text-gray-600 leading-relaxed">
                <p>{item.description}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DifferentialsAccordion;

