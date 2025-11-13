export type TeamMember = {
  id: string;
  name: string;
  role: string;
  area: string;
  bio: string;
  badges?: string[];
  imageUrl?: string;
  location?: string;
  tenure?: string;
};

export const leadershipTeam: TeamMember[] = [
  {
    id: 'ana-pereira',
    name: 'Ana Pereira, CFA',
    role: 'CEO & Chief Investment Officer',
    area: 'Liderança',
    bio: 'Com 18 anos de experiência em gestão de portfólios multimercado, lidera a visão estratégica da UP e a integração entre equipes de investimento e tecnologia.',
    badges: ['CFA', 'Ex-BTG', 'Mercado há 18 anos'],
    location: 'São Paulo',
    tenure: 'Desde 2019',
  },
  {
    id: 'marcos-silva',
    name: 'Marcos Silva',
    role: 'Diretor de Gestão Quantitativa',
    area: 'Liderança',
    bio: 'Responsável pelo laboratório quantitativo e pelas estratégias sistemáticas. Focado em transformar dados em sinal de investimento com governança robusta.',
    badges: ['PhD em Estatística', 'Machine Learning'],
    location: 'Londrina',
    tenure: 'Desde 2020',
  },
  {
    id: 'carla-souza',
    name: 'Carla Souza',
    role: 'Diretora de Relacionamento com Investidores',
    area: 'Liderança',
    bio: 'Conecta clientes e especialistas, garantindo comunicação transparente, rotinas de reporte e experiências sob medida para cada família de investidores.',
    badges: ['Planejadora CFP', 'UX de Investimentos'],
    location: 'Curitiba',
    tenure: 'Desde 2021',
  },
];

export const specialistTeam: TeamMember[] = [
  {
    id: 'ricardo-almeida',
    name: 'Ricardo Almeida',
    role: 'Portfolio Manager - Renda Variável',
    area: 'Gestão',
    bio: 'Constrói portfólios proprietários focados em ações brasileiras, combinando análise fundamentalista e sinais quantitativos.',
    badges: ['CNPI', 'Value & Growth'],
    location: 'São Paulo',
  },
  {
    id: 'livia-santana',
    name: 'Lívia Santana',
    role: 'Estrategista de Derivativos',
    area: 'Gestão',
    bio: 'Coordena estratégias de proteção de risco e estruturas de derivativos alinhadas aos objetivos de cada carteira.',
    badges: ['Risk Manager', 'Opções'],
    location: 'São Paulo',
  },
  {
    id: 'joao-castro',
    name: 'João Castro',
    role: 'Lead Data Scientist',
    area: 'Pesquisa & Dados',
    bio: 'Especialista em dados alternativos e modelagem de séries temporais, suporta o laboratório com ferramentas preditivas proprietárias.',
    badges: ['Python', 'Data Viz'],
    location: 'Londrina',
  },
  {
    id: 'fernanda-lima',
    name: 'Fernanda Lima',
    role: 'Quant Researcher',
    area: 'Pesquisa & Dados',
    bio: 'Desenvolve backtests, valida hipóteses e garante consistência estatística das estratégias implementadas nos portfólios.',
    badges: ['Backtests', 'Econometria'],
    location: 'Londrina',
  },
  {
    id: 'thiago-pereira',
    name: 'Thiago Pereira',
    role: 'Especialista em Relacionamento',
    area: 'Experiência do Cliente',
    bio: 'Faz a ponte entre o investidor e os gestores, conduzindo reuniões de acompanhamento e personalizando relatórios.',
    badges: ['CX Financeiro', 'Planejamento'],
    location: 'Curitiba',
  },
  {
    id: 'renata-oliveira',
    name: 'Renata Oliveira',
    role: 'Head de Compliance',
    area: 'Governança',
    bio: 'Garante aderência regulatória, estrutura de controles internos e políticas de proteção de dados alinhadas com a CVM e LGPD.',
    badges: ['LGPD', 'CVM'],
    location: 'São Paulo',
  },
  {
    id: 'bruno-gomes',
    name: 'Bruno Gomes',
    role: 'Tech Lead',
    area: 'Tecnologia',
    bio: 'Supervisiona a construção das plataformas internas, integrações com brokers e monitoramento em tempo real dos portfólios.',
    badges: ['React', 'Firebase'],
    location: 'Remoto',
  },
  {
    id: 'aline-martins',
    name: 'Aline Martins',
    role: 'UX Researcher',
    area: 'Tecnologia',
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
    description: 'Utilizamos séries históricas, modelos preditivos e simulações para embasar recomendações.',
    icon: 'data',
  },
];

export const teamAreas = Array.from(new Set(specialistTeam.map((member) => member.area)));

