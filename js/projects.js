// ============================================================
// O UNIVERSO DE YURI
// Dados reais ancorados no GitHub: github.com/ymedeiros228
//
// O núcleo da galáxia é o próprio Yuri (SOBRE).
// Cada sistema estelar = um projeto real.
// A constelação ARQUIVO sussurra os trabalhos menores.
// ============================================================

export const PROFILE = {
  name: "YURI MEDEIROS",
  role: "Ciência da Computação · Full-stack · Saúde pública · GIS · IA",
  location: "Teresina — PI, Brasil",
  github: "https://github.com/ymedeiros228",
  linkedin: "https://www.linkedin.com/in/yuri-medeiros-1071533b4/",
  education: "Ciência da Computação · UNINASSAU"
};

// O núcleo. Clicar no nome mergulha aqui.
export const ABOUT = {
  id: "about",
  name: "SOBRE",
  isAbout: true,
  epithet: "O núcleo da galáxia",
  color: 0xe8d8c0,
  accent: 0xf0e8d8,
  orbitRadius: 0,
  orbitAngle: 0,
  planet: { size: 2.8, rough: 0.5, metal: 0.2, bands: 0.35 },
  moons: [
    {
      id: "sobre", label: "Sobre", kind: "text",
      heading: "Software que serve ao público",
      body: "Sou desenvolvedor full-stack em Teresina, Piauí. Construo sistemas para saúde pública, plataformas GIS e automações com IA — onde dados territoriais viram decisões e modelos de linguagem viram copilotos. Acredito em software que serve ao público: open source, implantável em municípios reais, pensado para a realidade de quem tem pouca infraestrutura de TI."
    },
    {
      id: "formacao", label: "Formação", kind: "text",
      heading: "Ciência da Computação · UNINASSAU",
      body: "Ciência da Computação na UNINASSAU. Formação em algoritmos, bancos de dados, engenharia de software e sistemas distribuídos — aplicada a problemas reais de saúde pública e território."
    },
    {
      id: "stack", label: "Stack", kind: "tech",
      items: ["React", "NestJS", "TypeScript", "PostGIS", "PostgreSQL", "Electron", "Python", "n8n", "Rust"]
    },
    {
      id: "contato", label: "Contato", kind: "contact",
      heading: "Vamos conversar",
      body: "Aberto a projetos de saúde pública, GIS, automação com IA e produtos full-stack.",
      links: [
        { label: "GitHub", url: "https://github.com/ymedeiros228" },
        { label: "LinkedIn", url: "https://www.linkedin.com/in/yuri-medeiros-1071533b4/" }
      ]
    }
  ],
  constellation: ["React", "NestJS", "PostGIS", "Python"],
  github: "https://github.com/ymedeiros228",
  demo: "https://www.linkedin.com/in/yuri-medeiros-1071533b4/"
};

// Sistemas estelares — projetos reais.
export const PROJECTS = [
  {
    id: "sigaps",
    name: "SIGAPS",
    epithet: "GIS open source para a Atenção Primária à Saúde",
    color: 0x8ad0d8,
    accent: 0xc0eee8,
    orbitRadius: 6.6,
    orbitAngle: 0.0,
    planet: { size: 2.5, rough: 0.6, metal: 0.15, bands: 0.9 },
    moons: [
      {
        id: "overview", label: "Visão", kind: "text",
        heading: "O território, visto de uma só vez",
        body: "SIGAPS é uma plataforma GIS open source para a gestão territorial das microáreas da Atenção Primária à Saúde. Construída em React, NestJS e PostGIS, transforma dados territoriais em mapas vivos — equipes de saúde enxergam sua área, seus domicílios e seus indicadores numa única tela. Democratiza a visão territorial que antes pertencia apenas a sistemas fechados."
      },
      {
        id: "tech", label: "Tecnologias", kind: "tech",
        items: ["React", "NestJS", "TypeScript", "PostGIS", "PostgreSQL", "PWA"]
      },
      {
        id: "results", label: "Resultados", kind: "stat",
        stats: [
          { num: "MIT", label: "Licença open source" },
          { num: "PWA", label: "Funciona offline" }
        ]
      },
      { id: "github", label: "GitHub", kind: "link", url: "https://github.com/ymedeiros228/sigaps" },
      { id: "demo", label: "Demo", kind: "link", url: "https://github.com/ymedeiros228/sigaps" }
    ],
    constellation: ["React", "NestJS", "PostGIS", "PWA"],
    github: "https://github.com/ymedeiros228/sigaps",
    demo: "https://github.com/ymedeiros228/sigaps"
  },
  {
    id: "painel-ubs-planifica",
    name: "PAINEL UBS",
    epithet: "Desktop Electron para as UBS no PlanificaSUS",
    color: 0x8ac0d8,
    accent: 0xb8d8e8,
    orbitRadius: 8.7,
    orbitAngle: 1.05,
    planet: { size: 2.3, rough: 0.75, metal: 0.1, bands: 0.7 },
    moons: [
      {
        id: "overview", label: "Visão", kind: "text",
        heading: "Pensado para a realidade do município",
        body: "Aplicativo desktop Electron para registro e monitoramento das ações das UBS no PlanificaSUS — implantado em Passagem Franca/MA. Roda como portable Windows, sem instalação, pensado para equipes sem infraestrutura de TI. Software que funciona onde a internet é instável e o orçamento é curto."
      },
      {
        id: "tech", label: "Tecnologias", kind: "tech",
        items: ["Electron", "JavaScript", "HTML", "Desktop", "Healthcare", "APS"]
      },
      {
        id: "results", label: "Resultados", kind: "stat",
        stats: [
          { num: "1", label: "Município implantado" },
          { num: "Portable", label: "Sem instalação" }
        ]
      },
      { id: "github", label: "GitHub", kind: "link", url: "https://github.com/ymedeiros228/painel-ubs-planifica" },
      { id: "demo", label: "Demo", kind: "link", url: "https://github.com/ymedeiros228/painel-ubs-planifica" }
    ],
    constellation: ["Electron", "JavaScript", "APS", "Desktop"],
    github: "https://github.com/ymedeiros228/painel-ubs-planifica",
    demo: "https://github.com/ymedeiros228/painel-ubs-planifica"
  },
  {
    id: "sipae-validador",
    name: "SIPAE IA",
    epithet: "Copiloto pedagógico com IA para o SIPAE",
    color: 0xb8a8e8,
    accent: 0xd8ccf2,
    orbitRadius: 10.5,
    orbitAngle: 2.1,
    planet: { size: 2.1, rough: 0.85, metal: 0.05, bands: 0.4 },
    moons: [
      {
        id: "overview", label: "Visão", kind: "text",
        heading: "IA a serviço do gestor educacional",
        body: "Copiloto pedagógico que valida planejamentos SIPAE com IA — assiste o gestor, aponta inconsistências e sugere ajustes. IA aplicada à educação, no município de Passagem Franca/MA. Um modelo que não substitui o educador: o amplifica."
      },
      {
        id: "tech", label: "Tecnologias", kind: "tech",
        items: ["Python", "IA", "Educação", "SIPAE", "LLM"]
      },
      {
        id: "results", label: "Resultados", kind: "stat",
        stats: [
          { num: "IA", label: "Validação automática" },
          { num: "MA", label: "Passagem Franca" }
        ]
      },
      { id: "github", label: "GitHub", kind: "link", url: "https://github.com/ymedeiros228/sipae-validador" },
      { id: "demo", label: "Demo", kind: "link", url: "https://github.com/ymedeiros228/sipae-validador" }
    ],
    constellation: ["Python", "LLM", "Educação", "SIPAE"],
    github: "https://github.com/ymedeiros228/sipae-validador",
    demo: "https://github.com/ymedeiros228/sipae-validador"
  },
  {
    id: "chatbot-n8n",
    name: "CHATBOT N8N",
    epithet: "Automação de Customer Success com n8n e IA",
    color: 0x8ad8a8,
    accent: 0xc0f0d0,
    orbitRadius: 12.1,
    orbitAngle: 3.15,
    planet: { size: 2.0, rough: 0.7, metal: 0.2, bands: 0.6 },
    moons: [
      {
        id: "overview", label: "Visão", kind: "text",
        heading: "Baixo código, alto impacto",
        body: "Chatbot de Customer Success construído com n8n, Google Sheets e IA — automatiza o atendimento, qualifica leads e mantém o histórico em planilhas vivas. Automação de baixo código com resultado de alto impacto: 24/7, sem infraestrutura complexa."
      },
      {
        id: "tech", label: "Tecnologias", kind: "tech",
        items: ["n8n", "Google Sheets", "IA", "Automação", "Chatbot"]
      },
      {
        id: "results", label: "Resultados", kind: "stat",
        stats: [
          { num: "n8n", label: "Baixo código" },
          { num: "24/7", label: "Atendimento automático" }
        ]
      },
      { id: "github", label: "GitHub", kind: "link", url: "https://github.com/ymedeiros228/chatbot-ia-n8n-customer-success" },
      { id: "demo", label: "Demo", kind: "link", url: "https://github.com/ymedeiros228/chatbot-ia-n8n-customer-success" }
    ],
    constellation: ["n8n", "IA", "Sheets", "Automação"],
    github: "https://github.com/ymedeiros228/chatbot-ia-n8n-customer-success",
    demo: "https://github.com/ymedeiros228/chatbot-ia-n8n-customer-success"
  },
  {
    id: "byte-box",
    name: "BYTE & BOX",
    epithet: "E-commerce front-end — React + Vite",
    color: 0xd8a088,
    accent: 0xe8c0a8,
    orbitRadius: 13.5,
    orbitAngle: 4.2,
    planet: { size: 2.2, rough: 0.55, metal: 0.25, bands: 1.0 },
    moons: [
      {
        id: "overview", label: "Visão", kind: "text",
        heading: "Acabamento front-end como disciplina",
        body: "Byte & Box — e-commerce front-end em React e Vite, com carrinho e checkout persistidos em localStorage. Estudo de acabamento front-end: performance, clareza de estado e cuidado de UX. Pequeno no escopo, exigente no detalhe."
      },
      {
        id: "tech", label: "Tecnologias", kind: "tech",
        items: ["React", "Vite", "JavaScript", "Frontend", "localStorage"]
      },
      {
        id: "results", label: "Resultados", kind: "stat",
        stats: [
          { num: "0", label: "Backend necessário" },
          { num: "Local", label: "Estado persistente" }
        ]
      },
      { id: "github", label: "GitHub", kind: "link", url: "https://github.com/ymedeiros228/ecommerce-eletronicos" },
      { id: "demo", label: "Demo", kind: "link", url: "https://github.com/ymedeiros228/ecommerce-eletronicos" }
    ],
    constellation: ["React", "Vite", "Frontend", "UX"],
    github: "https://github.com/ymedeiros228/ecommerce-eletronicos",
    demo: "https://github.com/ymedeiros228/ecommerce-eletronicos"
  },
  {
    id: "movie-explorer",
    name: "MOVIE EXPLORER",
    epithet: "Catálogo de filmes — React, TypeScript, TMDB",
    color: 0x9fb0d8,
    accent: 0xcfe0f2,
    orbitRadius: 14.7,
    orbitAngle: 5.25,
    planet: { size: 2.0, rough: 0.65, metal: 0.15, bands: 0.8 },
    moons: [
      {
        id: "overview", label: "Visão", kind: "text",
        heading: "Tipagem estrita, curadoria visual",
        body: "Movie Explorer — catálogo de filmes em React, TypeScript e Vite, consumindo a API do TMDB. Busca, detalhes e curadoria visual. Pequeno no escopo, exigente no acabamento e na tipagem."
      },
      {
        id: "tech", label: "Tecnologias", kind: "tech",
        items: ["React", "TypeScript", "Vite", "TMDB", "Frontend"]
      },
      {
        id: "results", label: "Resultados", kind: "stat",
        stats: [
          { num: "TMDB", label: "API consumida" },
          { num: "TS", label: "Tipagem estrita" }
        ]
      },
      { id: "github", label: "GitHub", kind: "link", url: "https://github.com/ymedeiros228/movie-explorer" },
      { id: "demo", label: "Demo", kind: "link", url: "https://github.com/ymedeiros228/movie-explorer" }
    ],
    constellation: ["React", "TypeScript", "Vite", "TMDB"],
    github: "https://github.com/ymedeiros228/movie-explorer",
    demo: "https://github.com/ymedeiros228/movie-explorer"
  }
];

// Constelação ARQUIVO — trabalhos menores, sussurrados ao fundo.
export const ARCHIVE = [
  {
    name: "nothe",
    note: "App de notas leve e rápido — Rust",
    url: "https://github.com/ymedeiros228/nothe",
    angle: 0.6, radius: 18.5
  },
  {
    name: "universe-database",
    note: "Banco PostgreSQL de corpos celestes — freeCodeCamp",
    url: "https://github.com/ymedeiros228/universe-database",
    angle: 2.7, radius: 19.2
  },
  {
    name: "kimi-actions",
    note: "GitHub Action de code review com IA — Python",
    url: "https://github.com/ymedeiros228/kimi-actions",
    angle: 4.6, radius: 17.8
  }
];
