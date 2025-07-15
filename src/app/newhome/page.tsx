/**
 * New Home Page Component (Experimental)
 * 
 * Cópia da home atual para desenvolvimento de novas ideias, animações e microinterações.
 * Não afeta a home principal.
 */

import dynamic from 'next/dynamic';

const CursorGlow = dynamic(() => import('@/components/CursorGlow'), { ssr: false });
const HeroSectionIA2 = dynamic(() => import('@/components/HeroSectionIA2'), { ssr: false });
const HeroSectionDataViz = dynamic(() => import('@/components/HeroSectionDataViz'), { ssr: false });
const TimelineSection = dynamic(() => import('@/components/TimelineSection'), { ssr: false });
const SolutionsSection = dynamic(() => import('@/components/SolutionsSection'), { ssr: false });
const Footer = dynamic(() => import('@/components/Footer'));

export default function NewHome() {
  return (
    <>
      <CursorGlow />
      <main>
        {/* Nova Hero Section IA com fundo de candles animados */}
        <HeroSectionIA2 />
        {/* Resultados e Crescimento UP logo abaixo da hero section */}
        <HeroSectionDataViz />
        {/* Linha do tempo da trajetória */}
        <TimelineSection />
        {/* Equipe especializada & soluções personalizadas */}
        <SolutionsSection />
        {/* Seções removidas: AboutSection, ProcessSection, ComparisonSection */}
        {/* Seção de estatísticas removida */}
      </main>
      
      {/* Rodapé do site */}
      <Footer />
    </>
  );
} 