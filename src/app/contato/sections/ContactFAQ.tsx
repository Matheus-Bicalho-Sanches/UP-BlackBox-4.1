'use client';

import FAQItemCard from '../components/FAQItemCard';

type ContactFAQProps = {
  items: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
};

const ContactFAQ = ({ items }: ContactFAQProps) => {
  return (
    <section className="bg-slate-50 py-8 md:py-12">
      <div className="container mx-auto px-4 space-y-12">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Dúvidas frequentes</p>
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">FAQ sobre atendimento</h2>
          <p className="text-lg text-gray-600">
            Veja como funciona nosso fluxo de atendimento, confidencialidade e acompanhamento das solicitações.
          </p>
        </header>
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item) => (
            <FAQItemCard key={item.id} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ContactFAQ;

