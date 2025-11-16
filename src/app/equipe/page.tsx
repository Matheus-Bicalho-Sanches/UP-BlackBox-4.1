'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import TeamSection from './components/TeamSection';
import { CultureHighlights } from './components/CultureHighlights';
import TeamGrid from './components/TeamGrid';
import TeamFilterBar, { ALL_AREAS_OPTION } from './components/TeamFilterBar';
import { cultureHighlights, specialistTeam, teamAreas } from './teamData';

const CursorGlow = dynamic(() => import('@/components/CursorGlow'), { ssr: false });
const Footer = dynamic(() => import('@/components/Footer'));

export default function EquipePage() {
  const [selectedArea, setSelectedArea] = useState<string>(ALL_AREAS_OPTION);

  const filteredMembers = useMemo(() => {
    if (selectedArea === ALL_AREAS_OPTION) {
      return specialistTeam;
    }
    return specialistTeam.filter((member) => member.areas.includes(selectedArea));
  }, [selectedArea]);

  return (
    <>
      <CursorGlow />
      <main className="relative z-10">
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 py-32">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl space-y-6">
              <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Equipe UP</p>
              <h1 className="text-4xl font-semibold text-white md:text-5xl">
                Pessoas com experiência de mercado, focadas em retornos acima da média
              </h1>
              <p className="text-lg text-slate-200">
                Equipe de especialistas com governança, processos
                auditados e a mesma skin in the game dos nossos clientes.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="https://api.whatsapp.com/send/?phone=5543991811304&text&type=phone_number&app_absent=0"
                  className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur transition hover:border-white hover:text-white"
                >
                  Fale com a equipe
                </Link>
              </div>
            </div>
          </div>
        </section>

        <TeamSection
          id="cultura"
          eyebrow="Nossa Cultura"
          title="Especialistas multidisciplinares conectados por valores em comum"
          description="Unimos gestores, desenvolvedores, analistas de dados e especialistas em relacionamento para construir soluções proprietárias."
          background="default"
        >
          <CultureHighlights highlights={cultureHighlights} />
        </TeamSection>

        <TeamSection
          id="especialistas"
          eyebrow="Times e Especialistas"
          title="Conheça as pessoas da equipe"
          description="Filtre por área para conhecer os profissionais responsáveis por cada frente da UP."
        >
          <div className="space-y-12">
            <TeamFilterBar areas={teamAreas} selectedArea={selectedArea} onSelect={setSelectedArea} />
            <TeamGrid members={filteredMembers} />
          </div>
        </TeamSection>

        <TeamSection
          id="expertise"
          eyebrow="Expertise"
          title="Dados, tecnologia e inteligência artificial"
          description="Combinação de research proprietário, IA e backtests para a tomada de decisão."
          background="muted"
        >
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-cyan-100 bg-white/90 p-6 text-center shadow">
              <p className="text-4xl font-semibold text-cyan-600">+ 200 MB</p>
              <p className="mt-2 text-sm text-gray-600">
                de dados armazenados todos os dias úteis
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-center shadow">
              <p className="text-4xl font-semibold text-cyan-600">+ 1000</p>
              <p className="mt-2 text-sm text-gray-600">
                backtests realizados semanalmente
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-center shadow">
              <p className="text-4xl font-semibold text-cyan-600">+ 500</p>
              <p className="mt-2 text-sm text-gray-600">
                ordens de compra ou venda executadas diariamente
              </p>
            </div>
          </div>
        </TeamSection>

        <section className="bg-gradient-to-r from-cyan-600 to-blue-600 py-20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col gap-6 text-center text-white md:flex-row md:items-center md:justify-between md:text-left">
              <div className="max-w-2xl space-y-3">
                <p className="text-sm uppercase tracking-[0.3em] text-white/70">Próximo passo</p>
                <h2 className="text-3xl font-semibold">Converse com quem acompanha o mercado ao seu lado</h2>
                <p className="text-lg text-white/80">
                  Agende uma conversa com nossos especialistas para entender como podemos estruturar uma carteira sob
                  medida para seus objetivos.
                </p>
              </div>
              <Link
                href="https://api.whatsapp.com/send/?phone=5543991811304&text&type=phone_number&app_absent=0"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-cyan-700 shadow-lg transition hover:bg-slate-100"
              >
                Falar com a equipe
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

