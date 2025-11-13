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
    eyebrow: 'Renda Passiva',
    title: 'Carteira Imobiliária Integrada',
    description:
      'Seleção proprietária de FIIs, FI-Infra e FI-Agro com foco em distribuição estável de rendimentos, exposição setorial balanceada e análise profunda de gestão e risco.',
    icon: '🏢',
    bullets: [
      'Curadoria de fundos listados e exclusivos com comitê semanal',
      'Modelagem de fluxo de caixa projetado e stress tests regulatórios',
      'Relatórios mensais com insights sobre vacância, inadimplência e pipeline',
    ],
    metrics: [
      { label: 'Distribuição alvo', value: 'IPCA + 6% a.a.' },
      { label: 'Ticket inicial', value: 'A partir de R$ 250 mil' },
    ],
    ctaLabel: 'Ver exemplo de carteira',
    ctaHref: '#comparativo',
  },
  {
    eyebrow: 'Estratégias Táticas',
    title: 'Carteira Multimercado Estruturada',
    description:
      'Alocação dinâmica com fundos multimercado proprietários e casas parceiras, combinando estratégias macro, long & short e crédito tático para descorrelação.',
    icon: '📈',
    bullets: [
      'Mapeamento de volatilidade objetivo por perfil de risco',
      'Uso de derivativos para proteção de downside e ajustes táticos',
      'Relatórios quinzenais com leitura de cenários e calls de comitê',
    ],
    metrics: [
      { label: 'Descorrelação', value: 'Correlação histórica 0,35 com Ibovespa' },
      { label: 'Ticket inicial', value: 'A partir de R$ 500 mil' },
    ],
    highlight: true,
    ctaLabel: 'Solicitar simulação',
    ctaHref: '/contato',
  },
  {
    eyebrow: 'Wealth Management',
    title: 'Gestão Patrimonial Completa',
    description:
      'Gestão 360° com olhar de longo prazo sobre renda fixa, fundos, ETFs globais e posições proprietárias, alinhando liquidez, sucessão e objetivos familiares.',
    icon: '🌐',
    bullets: [
      'Planejamento estratégico com metas de 3, 5 e 10 anos',
      'Integração com veículos de previdência e estruturas offshore',
      'Conselho familiar trimestral com material executivo customizado',
    ],
    metrics: [
      { label: 'Cobertura', value: '+85% do patrimônio monitorado em tempo real' },
      { label: 'Ticket inicial', value: 'A partir de R$ 1 milhão' },
    ],
    ctaLabel: 'Agendar conversa',
    ctaHref: '/contato',
  },
];

export const comparisonItems: ServiceComparisonItem[] = [
  {
    id: 'fii',
    name: 'Carteira Imobiliária Integrada',
    profile: 'Investidor em busca de renda passiva e diversificação setorial',
    horizon: 'Médio / Longo prazo (36+ meses)',
    minimumTicket: 'R$ 250 mil',
    benchmark: 'IPCA + 4% a 6% a.a.',
    governance: 'Comitê de FIIs quinzenal, stress tests trimestrais',
  },
  {
    id: 'multimercado',
    name: 'Carteira Multimercado Estruturada',
    profile: 'Investidor com tolerância a volatilidade moderada e visão tática',
    horizon: 'Médio prazo (18 a 36 meses)',
    minimumTicket: 'R$ 500 mil',
    benchmark: 'CDI + 4% a.a. / CDI + 6% a.a.',
    governance: 'Comitê macro semanal, monitoramento intraday de risco',
  },
  {
    id: 'wealth',
    name: 'Gestão Patrimonial Completa',
    profile: 'Famílias e empresas com visão de longo prazo e objetivos sucessórios',
    horizon: 'Longo prazo (60+ meses)',
    minimumTicket: 'R$ 1 milhão',
    benchmark: 'Blend IPCA + CDI + MSCI World',
    governance: 'Conselho familiar trimestral, políticas de risco dedicadas',
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

