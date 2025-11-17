import { ServiceCardProps } from './components/ServiceCard';

export type ServiceComparisonItem = {
  id: string;
  name: string;
  profile: string;
  horizon: string;
  minimumTicket: string;
  benchmark: string;
  governance: string;
};

export type TimelineStep = {
  id: string;
  title: string;
  description: string;
  deliverable: string;
  timeframe: string;
};

export type DifferentialItem = {
  id: string;
  title: string;
  description: string;
};

export type TestimonialItem = {
  id: string;
  quote: string;
  author: string;
  role: string;
};

export type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

export const services: ServiceCardProps[] = [
  {
    eyebrow: 'Médio risco',
    title: 'Carteira UP FIIs',
    description:
      'Estratégia proprietária de FIIs, FI-Infra e FI-Agro com foco em ganho de capital no longo prazo, com risco controlado.',
    icon: '🏢',
    bullets: [
      'Acompanhamento de dezenas de fundos listados',
      'Operações curtas, com foco em ganho de capital rápido',
      'Análise fundamentalista + análise quantitativa',
    ],
    metrics: [
      { label: 'Alvo de retorno', value: 'IFIX + 8% a.a.' },
      { label: 'Ticket inicial', value: 'A partir de R$ 50 mil' },
    ],
    ctaLabel: 'Veja a lâmina da estratégia',
    ctaHref: '#comparativo',
  },
  {
    eyebrow: 'Alto risco',
    title: 'Carteira UP Multimercado',
    description:
      'Estratégia multimercado proprietária combinando estratégias quantitativas em diversas classes de ativo como ações, FIIs, futuros, ETFs e opções.',
    icon: '📈',
    bullets: [
      'Tomada de decisão principalmente quantitativa',
      'Carteira com alavancagem de até 6x',
      'Hard stop pela gestão de risco em 20% de drawdown',
    ],
    metrics: [
      { label: 'Alvo de Retorno', value: 'CDI + 10%' },
      { label: 'Ticket inicial', value: 'A partir de R$ 100 mil' },
    ],
    highlight: true,
    ctaLabel: 'Veja a lâmina da estratégia',
    ctaHref: '/contato',
  },
  {
    eyebrow: 'Baixo risco',
    title: 'Gestão Patrimonial Completa',
    description:
      'Gestão 360° com olhar de longo prazo sobre renda fixa, fundos, ETFs globais e estratégias proprietárias, alinhando liquidez, sucessão e objetivos familiares.',
    icon: '🌐',
    bullets: [
      'Planejamento financeiro personalizado',
      'Relatórios mensais e acompanhamento periódico',
      'Zero conflito de interesse (fee-based)',
    ],
    metrics: [
      { label: 'Alvo de retorno', value: '110% a 130% do CDI' },
      { label: 'Ticket inicial', value: 'A partir de R$ 50 mil' },
    ],
    ctaLabel: 'Fale conosco',
    ctaHref: '/contato',
  },
];

export const comparisonItems: ServiceComparisonItem[] = [
  {
    id: 'fii',
    name: 'Carteira UP FIIs',
    profile: 'Investidor com tolerância de risco média e pelo menos 300 mil investidos no total',
    horizon: 'Médio / Longo prazo (36+ meses)',
    minimumTicket: 'R$ 50 mil',
    benchmark: 'IFIX + 8% a.a.',
    governance: 'Relatório mensal + grupo no WhatsApp',
  },
  {
    id: 'multimercado',
    name: 'Carteira UP Multimercado',
    profile: 'Investidor com alto apetite à risco e pelo menos 500 mil investidos no total',
    horizon: 'Médio prazo (18 a 36 meses)',
    minimumTicket: 'R$ 100 mil',
    benchmark: 'CDI + 10%',
    governance: 'Relatório mensal + grupo no WhatsApp',
  },
  {
    id: 'wealth',
    name: 'Gestão Patrimonial Completa',
    profile: 'Famílias e empresas com objetivos de longo prazo (60+ meses)',
    horizon: 'Longo prazo (60+ meses)',
    minimumTicket: 'R$ 50 mil',
    benchmark: '110% a 130% do CDI',
    governance: 'Relatório mensal + reuniões sempre que necessário',
  },
];

export const onboardingSteps: TimelineStep[] = [
  {
    id: 'diagnostico',
    title: 'Diagnóstico e assinatura',
    description:
      'Reunião inicial para entender objetivos, restrições e estrutura societária. Coleta de documentos e alinhamento de governança.',
    deliverable: 'Carta de investimento preliminar',
    timeframe: 'Semana 1',
  },
  {
    id: 'estrategia',
    title: 'Desenho da estratégia',
    description:
      'Modelagem de cenários, definição de alocações alvo e construção de portfólios com base nos comitês proprietários.',
    deliverable: 'Plano tático e alocação recomendada',
    timeframe: 'Semana 2',
  },
  {
    id: 'implementacao',
    title: 'Implementação assistida',
    description:
      'Execução das alocações, coordenação com bancos/corretoras e setup de relatórios, com comunicação transparente sobre custos e impostos.',
    deliverable: 'Carteira implantada e monitor de risco ativo',
    timeframe: 'Semanas 3-4',
  },
  {
    id: 'acompanhamento',
    title: 'Acompanhamento contínuo',
    description:
      'Comitês de acompanhamento, rebalanceamentos automáticos e relatórios executivos com destaque de risco, performance e próximos passos.',
    deliverable: 'Relatórios mensais + reuniões estratégicas',
    timeframe: 'Ciclo contínuo',
  },
];

export const differentialItems: DifferentialItem[] = [
  {
    id: 'comites',
    title: 'Comitês proprietários e skin in the game',
    description:
      'Gestores investem nas mesmas estratégias e participam de comitês dedicados para cada serviço, garantindo alinhamento total.',
  },
  {
    id: 'dados',
    title: 'Infraestrutura de dados em tempo real',
    description:
      'Integramos fontes de mercado, custódia e sistemas proprietários para monitorar risco, liquidez e performance minuto a minuto.',
  },
  {
    id: 'relatorios',
    title: 'Relatórios executivos e experiências personalizadas',
    description:
      'Material visual sob medida, dashboards exclusivos e reuniões recorrentes com linguagem clara para famílias e conselhos.',
  },
  {
    id: 'compliance',
    title: 'Compliance, LGPD e controles robustos',
    description:
      'Processos auditáveis, segregação de funções e políticas de segurança que garantem confidencialidade e aderência regulatória.',
  },
];

export const testimonialItems: TestimonialItem[] = [
  {
    id: 'cliente1',
    quote:
      'A carteira imobiliária trouxe previsibilidade aos fluxos da holding sem perder a liquidez necessária para novos projetos.',
    author: 'Marina Albuquerque',
    role: 'Sócia-fundadora de Family Office',
  },
  {
    id: 'cliente2',
    quote:
      'O time da UP acompanha cada movimento do multimercado e nos ajuda a entender os cenários antes mesmo das reuniões mensais.',
    author: 'Eduardo Ribeiro',
    role: 'Executivo do setor de tecnologia',
  },
];

export const faqItems: FAQItem[] = [
  {
    id: 'prazo-implementacao',
    question: 'Quanto tempo leva para implementar uma carteira após o diagnóstico?',
    answer:
      'O processo completo leva de 3 a 4 semanas. Nas primeiras duas semanas definimos a estratégia e alocação; nas semanas seguintes executamos as operações junto às instituições financeiras.',
  },
  {
    id: 'custos',
    question: 'Quais são os custos envolvidos e como a remuneração é estruturada?',
    answer:
      'Trabalhamos com taxa de administração alinhada ao serviço escolhido, sem rebates de terceiros. Toda a remuneração é transparente e combinada antes da implementação.',
  },
  {
    id: 'custodia',
    question: 'Onde ficam os ativos e como o investidor acompanha o patrimônio?',
    answer:
      'Os ativos permanecem custodiados nas instituições dos clientes. Oferecemos dashboards proprietários e relatórios executivos para visão consolidada de todas as posições.',
  },
];

