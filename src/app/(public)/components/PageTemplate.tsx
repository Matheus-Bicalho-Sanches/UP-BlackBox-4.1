import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

const CursorGlow = dynamic(() => import('@/components/CursorGlow'), { ssr: false });
const HeroSectionIA2 = dynamic(() => import('@/components/HeroSectionIA2'), { ssr: false });
const HeroSectionDataViz = dynamic(() => import('@/components/HeroSectionDataViz'), { ssr: false });
const TimelineSection = dynamic(() => import('@/components/TimelineSection'), { ssr: false });
const SolutionsSection = dynamic(() => import('@/components/SolutionsSection'), { ssr: false });
const Footer = dynamic(() => import('@/components/Footer'));

type PageTemplateProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
};

const PageTemplate = ({ title, subtitle, children }: PageTemplateProps) => {
  return (
    <>
      <CursorGlow />
      <main className="relative z-10">
        <HeroSectionIA2 />
        <section className="container mx-auto px-4 py-16 md:py-24 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-3xl md:text-5xl font-semibold text-gray-900">{title}</h1>
            {subtitle && <p className="text-lg md:text-xl text-gray-600">{subtitle}</p>}
            {children}
          </div>
        </section>
        <HeroSectionDataViz />
        <TimelineSection />
        <SolutionsSection />
      </main>
      <Footer />
    </>
  );
};

export default PageTemplate;

