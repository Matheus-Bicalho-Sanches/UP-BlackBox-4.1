'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import ServiceCard from './components/ServiceCard';
import ServiceComparisonTable from './components/ServiceComparisonTable';
import ProcessTimeline from './components/ProcessTimeline';
import DifferentialsAccordion from './components/DifferentialsAccordion';
import TestimonialGrid from './components/TestimonialGrid';
import FAQList from './components/FAQList';
import {
  services,
  comparisonItems,
  onboardingSteps,
  differentialItems,
  testimonialItems,
  faqItems,
} from './serviceData';

const CursorGlow = dynamic(() => import('@/components/CursorGlow'), { ssr: false });
const Footer = dynamic(() => import('@/components/Footer'));

export default function ServicosPage() {
  return (
    <>
      <CursorGlow />
      <main className="relative z-10">
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 py-28">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl space-y-6">
              <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Nossos Serviços</p>
              <h1 className="text-4xl font-semibold text-white md:text-5xl">
                Portfólios administrados com dados, tecnologia, análise fundamentalista e quantitativa.
              </h1>
              <p className="text-lg text-slate-200">
                Três estratégias complementares para gestão de patrimônio, com diferentes níveis de liquidez, risco e retorno.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="#servicos"
                  className="rounded-full bg-cyan-500 px-6 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-cyan-600"
                >
                  Explorar serviços
                </Link>
                <Link
                  href="https://api.whatsapp.com/send/?phone=5543991811304&text&type=phone_number&app_absent=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur transition hover:border-white hover:text-white"
                >
                  Falar com especialista
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="servicos" className="bg-white py-8 md:py-12">
          <div className="container mx-auto px-4">
            <header className="max-w-3xl space-y-4 text-center md:text-left">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Soluções sob medida</p>
              <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
                Escolha a proposta que conversa com seus objetivos de patrimônio
              </h2>
              <p className="text-lg text-gray-600">
                Cada carteira combina pesquisa própria, tecnologia e monitoramento constante para transformar dados em
                decisões concretas.
              </p>
            </header>
            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <ServiceCard key={service.title} {...service} />
              ))}
            </div>
          </div>
        </section>

        <section id="comparativo" className="bg-slate-50 py-8 md:py-12">
          <div className="container mx-auto px-4 space-y-10">
            <header className="max-w-3xl space-y-4 text-center md:text-left">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Comparativo rápido</p>
              <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Qual serviço faz sentido agora?</h2>
              <p className="text-lg text-gray-600">
                Compare perfil indicado, horizonte, ticket mínimo e benchmarks para identificar o melhor ponto de partida.
              </p>
            </header>
            <ServiceComparisonTable items={comparisonItems} />
          </div>
        </section>

        <section className="bg-white py-8 md:py-12">
          <div className="container mx-auto px-4 space-y-12">
            <header className="max-w-3xl space-y-4 text-center md:text-left">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Jornada do investidor</p>
              <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">
                Onboarding guiado e acompanhamento contínuo
              </h2>
              <p className="text-lg text-gray-600">
                Do diagnóstico ao rebalanceamento, cada etapa é documentada, com entregáveis claros e canais de contato
                permanentes.
              </p>
            </header>
            <ProcessTimeline steps={onboardingSteps} />
          </div>
        </section>

        <section className="bg-slate-900 py-8 md:py-12">
          <div className="container mx-auto px-4 space-y-12">
            <header className="max-w-3xl space-y-4 text-center md:text-left">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">Diferenciais</p>
              <h2 className="text-3xl font-semibold text-white md:text-4xl">
                Governança, tecnologia e proximidade no centro de tudo
              </h2>
              <p className="text-lg text-slate-200">
                Estrutura modular para atender famílias, empresários e investidores institucionais com transparência.
              </p>
            </header>
            <DifferentialsAccordion items={differentialItems} />
          </div>
        </section>

        <section className="bg-white py-8 md:py-12">
          <div className="container mx-auto px-4 space-y-12">
            <header className="max-w-3xl space-y-4 text-center md:text-left">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">O que dizem nossos clientes</p>
              <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Resultados percebidos na rotina</h2>
              <p className="text-lg text-gray-600">
                Depoimentos fictícios que ilustram como cada serviço atua em diferentes estágios do ciclo patrimonial.
              </p>
            </header>
            <TestimonialGrid testimonials={testimonialItems} />
          </div>
        </section>

        <section className="bg-slate-50 py-8 md:py-12">
          <div className="container mx-auto px-4 space-y-12">
            <header className="max-w-3xl space-y-4 text-center md:text-left">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Perguntas frequentes</p>
              <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">FAQ sobre nossos serviços</h2>
              <p className="text-lg text-gray-600">
                Respostas diretas para questionamentos comuns antes de iniciar o processo de gestão.
              </p>
            </header>
            <FAQList items={faqItems} />
          </div>
        </section>

        <section className="bg-gradient-to-r from-cyan-600 to-blue-600 py-10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col gap-6 text-center text-white md:flex-row md:items-center md:justify-between md:text-left">
              <div className="max-w-2xl space-y-3">
                <p className="text-sm uppercase tracking-[0.3em] text-white/70">Próximo passo</p>
                <h2 className="text-3xl font-semibold">Vamos estruturar a melhor solução para o seu patrimônio</h2>
                <p className="text-lg text-white/80">
                  Agende uma conversa sem compromisso para receber uma análise sob medida e entender como a UP pode
                  apoiar sua jornada.
                </p>
              </div>
              <Link
                href="/contato"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-cyan-700 shadow-lg transition hover:bg-slate-100"
              >
                Falar com a UP
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

