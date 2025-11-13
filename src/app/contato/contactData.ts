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
    value: 'contato@upinvestimentos.com.br',
    actionLabel: 'Copiar e-mail',
    href: 'mailto:contato@upinvestimentos.com.br',
    availability: 'Resposta em até 1 dia útil',
    icon: '✉️',
  },
  {
    id: 'telefone',
    label: 'Telefone',
    description: 'Para assuntos urgentes ou alinhamentos de agenda, fale diretamente com nosso time.',
    value: '+55 (11) 4000-1234',
    actionLabel: 'Ligar agora',
    href: 'tel:+551140001234',
    availability: 'Segunda a sexta, 9h às 17h',
    icon: '📞',
  },
  {
    id: 'retorno',
    label: 'Solicitar retorno',
    description: 'Informe o melhor horário para ligação e retornaremos com um consultor dedicado.',
    value: 'Retornamos no mesmo dia útil',
    actionLabel: 'Solicitar contato',
    href: '#formulario',
    availability: 'Preencha o formulário e indicamos o horário',
    icon: '🔁',
  },
];

export const meetingSlots = [
  {
    id: 'segunda-manha',
    day: 'Segundas-feiras',
    period: 'Manhã (09h - 11h)',
    description: 'Reuniões remotas de diagnóstico com duração de 30 minutos.',
  },
  {
    id: 'quarta-tarde',
    day: 'Quartas-feiras',
    period: 'Tarde (15h - 17h)',
    description: 'Agenda ideal para apresentar carteiras e tirar dúvidas sobre governança.',
  },
  {
    id: 'quinta-remoto',
    day: 'Quintas-feiras',
    period: 'Remoto (18h - 19h30)',
    description: 'Horário estendido para investidores que precisam falar após o expediente.',
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

