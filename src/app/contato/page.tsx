'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import ContactChannels from './sections/ContactChannels';
import ContactForm from './sections/ContactForm';
import MeetingAvailability from './sections/MeetingAvailability';
import OfficesSection from './sections/OfficesSection';
import ContactFAQ from './sections/ContactFAQ';
import {
  contactChannels,
  meetingSlots,
  offices,
  faqs,
  hero,
  privacyNotice,
} from './contactData';

const CursorGlow = dynamic(() => import('@/components/CursorGlow'), { ssr: false });
const Footer = dynamic(() => import('@/components/Footer'));

export default function ContatoPage() {
  return (
    <>
      <CursorGlow />
      <main className="relative z-10">
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 pt-24 pb-12 md:pt-28 md:pb-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl space-y-6">
              <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">{hero.eyebrow}</p>
              <h1 className="text-4xl font-semibold text-white md:text-5xl">{hero.title}</h1>
              <p className="text-lg text-slate-200">{hero.subtitle}</p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={hero.secondaryCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur transition hover:border-white hover:text-white"
                >
                  {hero.secondaryCta.label}
                </a>
              </div>
              <p className="text-sm text-slate-400">{hero.responseTime}</p>
            </div>
          </div>
        </section>

        <ContactChannels channels={contactChannels} />
        <MeetingAvailability slots={meetingSlots} />
        <ContactForm id="formulario" privacyNotice={privacyNotice} />
        <OfficesSection offices={offices} />
        <ContactFAQ items={faqs} />

        <section className="bg-gradient-to-r from-cyan-600 to-blue-600 py-10">
          <div className="container mx-auto px-4">
            <div className="flex flex-col gap-6 text-center text-white md:flex-row md:items-center md:justify-between md:text-left">
              <div className="max-w-2xl space-y-3">
                <p className="text-sm uppercase tracking-[0.3em] text-white/70">Próximo passo</p>
                <h2 className="text-3xl font-semibold">Estamos prontos para construir a estratégia certa com você</h2>
                <p className="text-lg text-white/80">
                  Conte com o nosso time para entender objetivos, mapear restrições e trazer propostas personalizadas.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 md:justify-end">
                <Link
                  href="#formulario"
                  className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-cyan-700 shadow-lg transition hover:bg-slate-100"
                >
                  Enviar mensagem
                </Link>
                <a
                  href="https://wa.me/5543991811304"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-white/40 px-8 py-3 text-sm font-semibold text-white/90 hover:border-white hover:text-white"
                >
                  Falar no WhatsApp
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

