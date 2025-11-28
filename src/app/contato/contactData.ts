export const hero = {
  eyebrow: 'Fale com a UP',
  title: 'Canal direto com nossos especialistas',
  subtitle:
    'Estamos disponíveis para entender seus objetivos, apresentar nossas carteiras e montar um plano de acompanhamento sob medida.',
  primaryCta: {
    label: 'Preencher formulário',
  },
  secondaryCta: {
    label: 'Falar no WhatsApp',
    href: 'https://wa.me/5543991811304',
  },
  responseTime: 'Retornamos em até 1 dia útil (segunda a sexta, das 9h às 18h).',
};

export const contactChannels = [
  {
    id: 'whatsapp',
    label: 'WhatsApp institucional',
    description: 'Canal prioritário para dúvidas rápidas, follow-up e envio de documentos.',
    value: '+55 (43) 99181-1304',
    actionLabel: 'Abrir conversa',
    href: 'https://wa.me/5543991811304',
    availability: 'Segunda a sexta, 9h às 18h',
    icon: '💬',
  },
  {
    id: 'email',
    label: 'E-mail',
    description: 'Envie informações completas e receba retorno com materiais e próximos passos.',
    value: 'matheus.bs@up-gestora.com.br',
    actionLabel: 'Copiar e-mail',
    href: 'mailto:matheus.bs@up-gestora.com.br',
    availability: 'Resposta em até 1 dia útil',
    icon: '✉️',
  },
];

export const meetingSlots = [
  {
    id: 'segunda-manha',
    day: 'Segundas-feiras',
    period: 'Manhã (09h - 11h)',
    description: 'Reuniões remotas de diagnóstico com duração de 30 minutos.',
    whatsappMessage: 'Olá! Gostaria de agendar uma reunião de diagnóstico para Segunda-feira no período da manhã (09h - 11h).',
  },
  {
    id: 'quarta-noite',
    day: 'Quartas-feiras',
    period: 'Noite (19h - 20h)',
    description: 'Horário fora do expediente de bolsa para investidores que precisam falar após o expediente.',
    whatsappMessage: 'Olá! Gostaria de agendar uma reunião para Quarta-feira no período da noite (19h - 20h), fora do expediente de bolsa.',
  },
  {
    id: 'sexta-presencial',
    day: 'Sextas-feiras',
    period: 'Presencial (19h - 21h)',
    description: 'Visitas presenciais para reuniões estratégicas e apresentações detalhadas.',
    whatsappMessage: 'Olá! Gostaria de agendar uma visita presencial para Sexta-feira no período da noite (19h - 21h).',
  },
];

export const privacyNotice = {
  consentLabel: 'Autorizo o uso dos meus dados para contato e envio de materiais.',
  description:
    'Seus dados serão utilizados apenas para fins de atendimento. Consulte nosso aviso de privacidade para entender a Política LGPD.',
  policyLink: {
    label: 'Ler aviso de privacidade',
    href: '/docs/politica-privacidade.pdf',
  },
};

export const offices = [
  {
    id: 'sp',
    city: 'São Paulo',
    address: 'Av. Brigadeiro Faria Lima, 2400 - 12º andar, Itaim Bibi',
    info: 'Recebemos clientes com agendamento prévio. Disponibilizamos estacionamento conveniado.',
    mapImage: '/images/maps/sp-office-placeholder.jpg',
    schedule: 'Atendimento presencial: terças e quintas, 10h às 16h',
  },
  {
    id: 'londrina',
    city: 'Londrina',
    address: 'Rua Belo Horizonte, 850 - Centro',
    info: 'Base do laboratório quantitativo e núcleo de relacionamento com investidores.',
    mapImage: '/images/maps/londrina-office-placeholder.jpg',
    schedule: 'Visitas sob demanda, confirme sua agenda com o time',
  },
];

export const faqs = [
  {
    id: 'documentacao',
    question: 'Quais documentos devo enviar no primeiro contato?',
    answer:
      'Para agilizar, sugerimos enviar CPF/CNPJ, composição patrimonial aproximada, instituições utilizadas e metas (prazo, liquidez, sucessão). Essas informações podem ser compartilhadas após o contato inicial.',
  },
  {
    id: 'acompanhamento',
    question: 'Como acompanho minha solicitação após falar com a UP?',
    answer:
      'Você receberá um número de protocolo e será incluído em um canal de acompanhamento com nosso time. Em até 48h enviamos os próximos passos e agenda sugerida.',
  },
  {
    id: 'confidencialidade',
    question: 'Meus dados ficam protegidos? Vocês assinam NDA?',
    answer:
      'Sim. Utilizamos processos compatíveis com a LGPD, armazenamento seguro e disponibilizamos acordo de confidencialidade (NDA) sob demanda.',
  },
];

