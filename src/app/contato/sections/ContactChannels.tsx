'use client';

import ChannelCard from '../components/ChannelCard';

type ContactChannelsProps = {
  channels: Array<{
    id: string;
    label: string;
    description: string;
    value: string;
    actionLabel: string;
    href: string;
    availability: string;
    icon: string;
  }>;
};

const ContactChannels = ({ channels }: ContactChannelsProps) => {
  return (
    <section className="bg-white py-8 md:py-12">
      <div className="container mx-auto px-4 space-y-10">
        <header className="max-w-3xl space-y-4 text-center md:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-600">Canais diretos</p>
          <h2 className="text-3xl font-semibold text-gray-900 md:text-4xl">Escolha como prefere falar com a UP</h2>
          <p className="text-lg text-gray-600">
            Nosso time está disponível em múltiplos canais. Se preferir, preencha o formulário e retornaremos no melhor
            horário.
          </p>
        </header>
        <div className="grid gap-6">
          {channels.map((channel) => (
            <ChannelCard key={channel.id} {...channel} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default ContactChannels;

