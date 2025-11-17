'use client';

import { ReactNode } from 'react';

type TeamSectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  background?: 'default' | 'muted';
  children: ReactNode;
};

const sectionBg: Record<Required<TeamSectionProps>['background'], string> = {
  default: 'bg-white',
  muted: 'bg-slate-50',
};

export const TeamSection = ({
  id,
  eyebrow,
  title,
  description,
  background = 'default',
  children,
}: TeamSectionProps) => {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={`${sectionBg[background]} py-8 md:py-12`}
    >
      <div className="container mx-auto px-4">
        <header className="max-w-3xl mx-auto text-center space-y-4">
          {eyebrow && <p className="text-sm uppercase tracking-widest text-cyan-600">{eyebrow}</p>}
          <h2 id={id ? `${id}-title` : undefined} className="text-3xl md:text-4xl font-semibold text-gray-900">
            {title}
          </h2>
          {description && <p className="text-lg text-gray-600">{description}</p>}
        </header>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
};

export default TeamSection;

