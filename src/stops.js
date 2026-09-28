// ============================================================
// Mapa de paradas da câmera ↔ seções da página e navegação.
// Módulo leve: usado no navegador e no build.
// ============================================================
import { PROJECTS } from "./data.js";

const N = PROJECTS.length;
export const STOP = { hub: 0, first: 1, skills: N + 1, about: N + 2, stack: N + 3, contact: N + 4 };
export const STOPS = [
  { id: "inicio", label: "Início" },
  ...PROJECTS.map((p) => ({ id: p.id, label: p.name })),
  { id: "skills", label: "Skills" },
  { id: "sobre", label: "Sobre" },
  { id: "stack", label: "Stack" },
  { id: "contato", label: "Contato" },
];
export const NAV = [
  { label: "Início", icon: "home", stop: STOP.hub, range: [0, 0] },
  { label: "Universo", icon: "orbit", stop: STOP.first, range: [1, N] },
  { label: "Skills", icon: "stars", stop: STOP.skills, range: [STOP.skills, STOP.skills] },
  { label: "Sobre", icon: "user", stop: STOP.about, range: [STOP.about, STOP.about] },
  { label: "Stack", icon: "layers", stop: STOP.stack, range: [STOP.stack, STOP.stack] },
  { label: "Contato", icon: "mail", stop: STOP.contact, range: [STOP.contact, STOP.contact] },
];

