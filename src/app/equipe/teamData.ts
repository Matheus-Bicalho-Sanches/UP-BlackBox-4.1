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
    id: 'livia-santana',
    name: 'Lívia Santana',
    role: 'Estrategista de Derivativos',
    areas: ['Gestão'],
    bio: 'Coordena estratégias de proteção de risco e estruturas de derivativos alinhadas aos objetivos de cada carteira.',
    badges: ['Risk Manager', 'Opções'],
    location: 'São Paulo',
  },
  {
    id: 'joao-castro',
    name: 'João Castro',
    role: 'Lead Data Scientist',
    areas: ['Pesquisa & Dados'],
    bio: 'Especialista em dados alternativos e modelagem de séries temporais, suporta o laboratório com ferramentas preditivas proprietárias.',
    badges: ['Python', 'Data Viz'],
    location: 'Londrina',
  },
  {
    id: 'fernanda-lima',
    name: 'Fernanda Lima',
    role: 'Quant Researcher',
    areas: ['Pesquisa & Dados'],
    bio: 'Desenvolve backtests, valida hipóteses e garante consistência estatística das estratégias implementadas nos portfólios.',
    badges: ['Backtests', 'Econometria'],
    location: 'Londrina',
  },
  {
    id: 'thiago-pereira',
    name: 'Thiago Pereira',
    role: 'Especialista em Relacionamento',
    areas: ['Experiência do Cliente'],
    bio: 'Faz a ponte entre o investidor e os gestores, conduzindo reuniões de acompanhamento e personalizando relatórios.',
    badges: ['CX Financeiro', 'Planejamento'],
    location: 'Curitiba',
  },
  {
    id: 'renata-oliveira',
    name: 'Renata Oliveira',
    role: 'Head de Compliance',
    areas: ['Governança'],
    bio: 'Garante aderência regulatória, estrutura de controles internos e políticas de proteção de dados alinhadas com a CVM e LGPD.',
    badges: ['LGPD', 'CVM'],
    location: 'São Paulo',
  },
  {
    id: 'bruno-gomes',
    name: 'Bruno Gomes',
    role: 'Tech Lead',
    areas: ['Tecnologia'],
    bio: 'Supervisiona a construção das plataformas internas, integrações com brokers e monitoramento em tempo real dos portfólios.',
    badges: ['React', 'Firebase'],
    location: 'Remoto',
  },
  {
    id: 'aline-martins',
    name: 'Aline Martins',
    role: 'UX Researcher',
    areas: ['Tecnologia'],
    bio: 'Investiga necessidades dos clientes para evoluir os painéis de acompanhamento, garantindo clareza e acessibilidade das informações.',
    badges: ['UX', 'Acessibilidade'],
    location: 'São Paulo',
  },
];

export const cultureHighlights = [
  {
    title: 'Parceria com Skin in the Game',
    description: 'Gestores investem nos mesmos portfólios que os clientes, alinhando incentivos e decisões de longo prazo.',
    icon: 'partnership',
  },
  {
    title: 'Governança e Compliance',
    description: 'Rotinas auditadas, comitês independentes e políticas transparentes para proteger cada decisão de investimento.',
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

