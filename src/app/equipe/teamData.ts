export type TeamMember = {
  id: string;
  name: string;
  role: string;
  areas: string[];
  bio: string;
  badges?: string[];
  imageUrl?: string;
  location?: string;
  tenure?: string;
};

export const specialistTeam: TeamMember[] = [
  {
    id: 'matheus-bicalho',
    name: 'Matheus Bicalho',
    role: 'Portfolio Manager',
    areas: ['Gestão', 'Tecnologia'],
    bio: 'Desenvolvimento de sistemas proprietários para tomada de decisão combinando análise fundamentalista e sinais quantitativos.',
    badges: ['CGA', 'Quant'],
    location: 'Londrina',
  },
  {
    id: 'ilson-sanches',
    name: 'Ilson Sanches',
    role: 'Compliance',
    areas: ['Governança'],
    bio: 'Garante aderência regulatória, estrutura de controles internos e políticas de proteção de dados alinhadas com a CVM e LGPD.',
    badges: ['Jurídico', 'Regulação'],
    location: 'Londrina',
  },
  {
    id: 'igor-sartor',
    name: 'Igor Sartor',
    role: 'Relacionamento e administrativo',
    areas: ['Governança', 'Administrativo'],
    bio: 'Responsável por atendimento a clientes e controle administrativo interno, bem como suporte ao Compliance.',
    badges: ['Backoffice', 'Atendimento'],
    location: 'Londrina',
  },
  {
    id: 'vinicius-merscher',
    name: 'Vinicius Merscher',
    role: 'Broker e desenvolvedor',
    areas: ['Gestão', 'Tecnologia'],
    bio: 'Responsável pela emissão e supervisão de ordens, bem como auxiliar no desenvolvimento em geral.',
    badges: ['Python', 'Operacional'],
    location: 'Londrina',
  },
  {
    id: 'mario-lucio',
    name: 'Mario Lucio',
    role: 'Especialista em Fundos listados',
    areas: ['Gestão'],
    bio: 'Acompanhamento fundamentalista e técnico em tempo real de fundos listados',
    badges: ['Trading', 'Fundos listados'],
    location: 'Remoto',
  },
  {
    id: 'alexandre-nigri',
    name: 'Alexandre Nigri',
    role: 'Advisor',
    areas: ['Administrativo'],
    bio: 'Auxílio na tomada estratégica de decisão, bem como relacionamento com outras instituições.',
    badges: ['Conselheiro', 'Planejamento'],
    location: 'Remoto',
  },
];

export const cultureHighlights = [
  {
    title: 'Alinhamento de interesses',
    description: 'Gestores investem nos mesmos portfólios que os clientes, alinhando incentivos e decisões de longo prazo.',
    icon: 'partnership',
  },
  {
    title: 'Governança e Compliance',
    description: 'Processos internos bem definidos, comitês independentes e supervisão interna pelo compliance.',
    icon: 'governance',
  },
  {
    title: 'Tecnologia Proprietária',
    description: 'Laboratório quantitativo integra dados, algoritmos de mercado e monitoramento em tempo real.',
    icon: 'innovation',
  },
  {
    title: 'Decisão Baseada em Dados',
    description: 'Utilizamos séries históricas, análises fundamentalistas e backtests para a tomada de decisão.',
    icon: 'data',
  },
];

export const teamAreas = Array.from(
  new Set(specialistTeam.flatMap((member) => member.areas))
);

