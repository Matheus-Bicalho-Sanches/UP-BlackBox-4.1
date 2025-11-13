'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import HeroInstitutional from './sections/HeroInstitutional';
import StoryTimeline from './sections/StoryTimeline';
import ValueGrid from './sections/ValueGrid';
import GovernanceGrid from './sections/GovernanceGrid';
import ProcessFlow from './sections/ProcessFlow';
import RecognitionsWall from './sections/RecognitionsWall';
import DocumentLibrary from './sections/DocumentLibrary';
import {
  heroData,
  timelineEvents,
  valuePillars,
  governanceItems,
  processSteps,
  recognitions,
} from './institutionalData';
import documents from './policyDocuments';

const CursorGlow = dynamic(() => import('@/components/CursorGlow'), { ssr: false });
const Footer = dynamic(() => import('@/components/Footer'));

export default function InstitucionalPage() {
  return (
    <>
      <CursorGlow />
      <main className="relative z-10">
        <HeroInstitutional data={heroData} />
        <StoryTimeline events={timelineEvents} />
        <ValueGrid pillars={valuePillars} />
        <GovernanceGrid items={governanceItems} />
        <ProcessFlow steps={processSteps} />
        <RecognitionsWall recognitions={recognitions} />
        <DocumentLibrary documents={documents} />

        <section className="bg-gradient-to-r from-cyan-600 to-blue-600 py-20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col gap-6 text-center text-white md:flex-row md:items-center md:justify-between md:text-left">
              <div className="max-w-2xl space-y-3">
                <p className="text-sm uppercase tracking-[0.3em] text-white/70">Conexão humana</p>
                <h2 className="text-3xl font-semibold">Conheça as pessoas e continue a conversa</h2>
                <p className="text-lg text-white/80">
                  A UP é construída por especialistas que respiram mercado, tecnologia e governança. Estamos prontos para
                  apoiar a próxima etapa do seu patrimônio.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 md:justify-end">
                <Link
                  href="/equipe"
                  className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-cyan-700 shadow-lg transition hover:bg-slate-100"
                >
                  Conhecer a equipe
                </Link>
                <Link
                  href="/contato"
                  className="rounded-full border border-white/40 px-8 py-3 text-sm font-semibold text-white/90 hover:border-white hover:text-white"
                >
                  Falar com a governança
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

