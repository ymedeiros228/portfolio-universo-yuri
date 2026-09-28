// ============================================================
// Conteúdo do portfólio — fonte única da verdade.
// Números só entram quando são reais (vistos no próprio sistema).
// ============================================================

export const PROFILE = {
  name: "Yuri Medeiros",
  role: "Desenvolvedor full-stack",
  focus: ["Saúde pública", "GIS", "IA aplicada"],
  location: "Teresina — PI, Brasil",
  education: "Ciência da Computação · UNINASSAU",
  github: "https://github.com/ymedeiros228",
  linkedin: "https://www.linkedin.com/in/yuri-medeiros-1071533b4/",
  email: "ymedeiros228@gmail.com",
};

// Cada projeto é um planeta num braço da galáxia.
// `system` posiciona o planeta (braço, raio, desvio angular) e dá a cor de destaque;
// `planet` define a aparência e o tamanho (peso do projeto);
// cada destaque (`highlights`) vira uma lua orbitando o planeta.
export const PROJECTS = [
  {
    id: "sigaps",
    name: "SIGAPS",
    kicker: "GIS · Atenção Primária à Saúde",
    lead: "O território da saúde, visto de uma só vez.",
    body:
      "Plataforma GIS open source para gestão territorial das microáreas da APS. Agentes de saúde pintam ruas no mapa, o sistema calcula cobertura e a equipe enxerga domicílios, UBS e indicadores numa única tela.",
    highlights: [
      { value: "9", label: "UBS mapeadas em Passagem Franca/MA" },
      { value: "189", label: "ruas no território municipal" },
      { value: "PWA", label: "funciona no celular do agente" },
    ],
    stack: ["React", "NestJS", "TypeScript", "PostGIS", "Leaflet"],
    media: ["media/sigaps-mapa.webp", "media/sigaps-dashboard.webp"],
    github: "https://github.com/ymedeiros228/sigaps",
    demo: "https://sigaps-api.onrender.com",
    color: [0.55, 0.85, 0.95],
    system: { arm: 1, r: 14.5, da: 0.02, star: "#9fe6ff" },
    planet: { type: "gas", size: 1.15, colors: ["#e8d2a6", "#b98a5a", "#f4ead2"], atmosphere: "#ffd9a0", rings: true },
  },
  {
    id: "painel-ubs",
    name: "Painel UBS",
    kicker: "Desktop · PlanificaSUS",
    lead: "Software que roda onde a internet não chega.",
    body:
      "Aplicativo desktop para registrar e acompanhar as ações das UBS no PlanificaSUS, implantado em Passagem Franca/MA. É portable: abre direto do pendrive, salva tudo localmente e exporta CSV pronto para o Excel.",
    highlights: [
      { value: "0", label: "instalações necessárias" },
      { value: "Offline", label: "dados salvos na própria máquina" },
      { value: "CSV", label: "exportação compatível com Excel" },
    ],
    stack: ["Electron", "JavaScript", "HTML", "CSS"],
    media: ["media/painel-dashboard.webp", "media/painel-cadastro.webp"],
    github: "https://github.com/ymedeiros228/painel-ubs-planifica",
    demo: "https://github.com/ymedeiros228/painel-ubs-planifica/releases/latest",
    demoLabel: "Baixar",
    color: [0.62, 0.74, 1.0],
    system: { arm: 0, r: 25, da: 0.02, star: "#a9b8ff" },
    planet: { type: "ocean", size: 0.95, colors: ["#1d4f8f", "#3f8f6a", "#e9eef5"], atmosphere: "#7fb4ff" },
  },
  {
    id: "sipae",
    name: "SIPAE IA",
    kicker: "IA · Educação pública",
    lead: "Um copiloto que amplifica o educador.",
    body:
      "Copiloto pedagógico que valida planejamentos do SIPAE com modelos de linguagem: aponta inconsistências, sugere ajustes e devolve ao gestor um parecer claro. Feito para a rede municipal de Passagem Franca/MA.",
    highlights: [
      { value: "LLM", label: "validação de planejamentos" },
      { value: "Python", label: "pipeline de análise" },
    ],
    stack: ["Python", "LLM", "Prompt engineering"],
    media: [],
    github: "https://github.com/ymedeiros228/sipae-validador",
    color: [0.78, 0.66, 1.0],
    system: { arm: 0, r: 17, da: 0.03, star: "#d4b8ff" },
    planet: { type: "ice", size: 0.8, colors: ["#8f7fd0", "#4d3f9a", "#cfc6f2"], atmosphere: "#c3b0ff" },
  },
  {
    id: "chatbot",
    name: "Chatbot CS",
    kicker: "Automação · Customer Success",
    lead: "Baixo código, atendimento 24/7.",
    body:
      "Chatbot de Customer Success orquestrado no n8n: entende a mensagem com IA, qualifica o lead e registra todo o histórico no Google Sheets. Sem servidor dedicado, sem infraestrutura complexa.",
    highlights: [
      { value: "24/7", label: "atendimento automático" },
      { value: "n8n", label: "fluxo visual, fácil de manter" },
    ],
    stack: ["n8n", "IA", "Google Sheets", "Webhooks"],
    media: [],
    github: "https://github.com/ymedeiros228/chatbot-ia-n8n-customer-success",
    color: [0.55, 0.95, 0.72],
    system: { arm: 0, r: 20, da: -1.45, star: "#8fffc8" },
    planet: { type: "gas", size: 0.72, colors: ["#8fe0b8", "#2f8f78", "#d9fff0"], atmosphere: "#8fffd0" },
  },
  {
    id: "byte-box",
    name: "Byte & Box",
    kicker: "Front-end · E-commerce",
    lead: "Acabamento front-end como disciplina.",
    body:
      "Loja de eletrônicos em React e Vite com catálogo, carrinho e checkout persistidos no navegador. Um estudo de estado claro, performance e cuidado com cada interação.",
    highlights: [
      { value: "React", label: "componentes e estado" },
      { value: "0", label: "backend necessário" },
    ],
    stack: ["React", "Vite", "JavaScript", "localStorage"],
    media: [],
    github: "https://github.com/ymedeiros228/ecommerce-eletronicos",
    color: [1.0, 0.72, 0.55],
    system: { arm: 1, r: 22, da: 0.02, star: "#ffc09a" },
    planet: { type: "rock", size: 0.62, colors: ["#c9724a", "#6b3524", "#f0b089"], atmosphere: "#ffb08a" },
  },
  {
    id: "movie-explorer",
    name: "Movie Explorer",
    kicker: "Front-end · API TMDB",
    lead: "Tipagem estrita, curadoria visual.",
    body:
      "Catálogo de filmes em React e TypeScript consumindo a API do TMDB: busca, páginas de detalhe e uma interface que coloca os pôsteres em primeiro plano.",
    highlights: [
      { value: "TS", label: "tipagem de ponta a ponta" },
      { value: "TMDB", label: "API pública consumida" },
    ],
    stack: ["React", "TypeScript", "Vite", "TMDB API"],
    media: [],
    github: "https://github.com/ymedeiros228/movie-explorer",
    color: [1.0, 0.6, 0.72],
    system: { arm: 1, r: 26, da: 0.02, star: "#ff9fb8" },
    planet: { type: "lava", size: 0.56, colors: ["#3a1a2a", "#ff5a7a", "#ffb0a0"], atmosphere: "#ff7a9a" },
  },
];

// Trabalhos menores — estrelas soltas na borda da galáxia.
export const ARCHIVE = [
  { name: "PAES MED AI", note: "App local de estudo para o PAES/UEMA com IA", url: "https://github.com/ymedeiros228/PAES_MED_AI" },
  { name: "nothe", note: "App de notas leve e rápido em Rust", url: "https://github.com/ymedeiros228/nothe" },
  { name: "kimi-actions", note: "GitHub Action de code review com IA", url: "https://github.com/ymedeiros228/kimi-actions" },
  { name: "universe-database", note: "Banco PostgreSQL de corpos celestes", url: "https://github.com/ymedeiros228/universe-database" },
];

// Constelação de habilidades: só o que aparece nos projetos acima.
export const SKILLS = [
  { group: "Front-end", items: ["React", "TypeScript", "JavaScript", "Vite", "Three.js", "HTML & CSS"] },
  { group: "Back-end", items: ["NestJS", "Node.js", "Python", "REST APIs"] },
  { group: "Dados & GIS", items: ["PostgreSQL", "PostGIS", "Leaflet", "CSV / Excel"] },
  { group: "IA & automação", items: ["LLMs", "Prompt engineering", "n8n", "Webhooks"] },
  { group: "Desktop & DevOps", items: ["Electron", "Rust", "Git", "GitHub Actions"] },
];

// Ícones do painel de stack (nomes do pacote simple-icons).
export const STACK_ICONS = [
  ["siReact", "React"], ["siTypescript", "TypeScript"], ["siJavascript", "JavaScript"], ["siNestjs", "NestJS"],
  ["siNodedotjs", "Node.js"], ["siPython", "Python"], ["siPostgresql", "PostgreSQL"], ["siLeaflet", "Leaflet"],
  ["siElectron", "Electron"], ["siN8n", "n8n"], ["siVite", "Vite"], ["siThreedotjs", "Three.js"],
  ["siRust", "Rust"], ["siGithubactions", "GitHub Actions"],
];

// Geometria da galáxia compartilhada entre cena e caminho da câmera.
export const GALAXY = {
  radius: 30,
  arms: 2,
  pitch: 0.36, // tangente do ângulo de abertura dos braços
};

// Ângulo de um braço espiral logarítmico no raio r.
export function armAngle(arm, r) {
  return arm * Math.PI + Math.log(r) / GALAXY.pitch;
}

// Posição local (no plano da galáxia) do sistema de um projeto.
export function systemPosition(sys) {
  const a = armAngle(sys.arm, sys.r) + sys.da;
  return [Math.cos(a) * sys.r, 0.9, Math.sin(a) * sys.r];
}
