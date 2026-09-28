// ============================================================
// Gera o HTML das seções a partir de data.js no build (plugin
// do Vite). O conteúdo existe sem JavaScript: SEO, leitores de
// tela e fallback sem WebGL saem de graça.
// ============================================================
import * as si from "simple-icons";
import { PROFILE, PROJECTS, ARCHIVE, SKILLS, STACK_ICONS } from "./data.js";
import { STOP, STOPS, NAV } from "./stops.js";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const pad = (n) => String(n).padStart(2, "0");

/* ---------- ícones (traço) ---------- */
const svg = (d, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICONS = {
  home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v11.5h13V9"/><path d="M10 20.5v-6h4v6"/>'),
  orbit: svg('<circle cx="12" cy="12" r="2.6"/><ellipse cx="12" cy="12" rx="10" ry="4.2" transform="rotate(-28 12 12)"/><circle cx="20.2" cy="7.6" r="1" fill="currentColor"/>'),
  stars: svg('<circle cx="5" cy="6" r="1.5"/><circle cx="18" cy="4.5" r="1.5"/><circle cx="12" cy="12.5" r="1.8"/><circle cx="19" cy="19" r="1.5"/><circle cx="5.5" cy="18.5" r="1.2"/><path d="M6.2 7.1 10.7 11.2M13.3 11.3l3.9-5.4M13.4 13.8l4.4 4.1M10.6 13.6l-4 4"/>'),
  user: svg('<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1.4-3.9 4.2-5.9 7.5-5.9s6.1 2 7.5 5.9"/>'),
  layers: svg('<path d="m12 3 9 4.8-9 4.8-9-4.8L12 3z"/><path d="m3 12.2 9 4.8 9-4.8"/><path d="m3 16.4 9 4.8 9-4.8"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>'),
  arrow: svg('<path d="M7 17 17 7M8.5 7H17v8.5"/>', "ico ico--arrow"),
  pin: svg('<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/>'),
  cap: svg('<path d="m2.5 9 9.5-4.5L21.5 9 12 13.5 2.5 9z"/><path d="M6.5 11v4.6c1.5 1.5 3.4 2.2 5.5 2.2s4-.7 5.5-2.2V11"/>'),
  repo: svg('<path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15z"/><path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3"/>'),
  compass: svg('<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2z"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
};
// Marca pessoal: dois triângulos que formam um "Y" estelar.
export const MARK = `<svg class="mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h24L16 27 4 7z"/><path d="M10 7l6 10 6-10"/><path d="M16 17v10" opacity=".55"/></svg>`;
const brand = (key, cls = "brand") => {
  const i = si[key];
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${i.path}"/></svg>`;
};
const LINKEDIN = `<svg class="brand" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>`;

const btn = (href, label, primary = false) =>
  `<a class="btn${primary ? " btn--primary" : ""}" href="${esc(href)}" target="_blank" rel="noopener"><span>${esc(label)}</span>${ICONS.arrow}</a>`;

/* ---------- abertura: o mapa da galáxia ---------- */
function hub() {
  const markers = PROJECTS.map((p, i) => `
      <a class="marker" href="#${esc(p.id)}" data-goto="${i + 1}" data-marker="${i}" style="--accent:${esc(p.system.star)}">
        <span class="marker__text"><span class="marker__num">${pad(i + 1)}</span><span class="marker__name">${esc(p.name)}</span><span class="marker__cta">Ver planeta</span></span>
      </a>`).join("");
  return `
  <section class="stop stop--hub" id="inicio" data-stop="0">
    <div class="hub__center">
      <span class="hub__mark reveal">${MARK}</span>
      <h1 class="hub__name"><span class="split">Yuri Medeiros</span></h1>
      <p class="hub__role reveal">Desenvolvedor full-stack <i>•</i> GIS <i>•</i> IA aplicada</p>
    </div>
    <p class="hub__intro reveal">Cada planeta desta galáxia é um projeto que eu construí — do tamanho do impacto que teve. Escolha um, ou role para visitar todos.</p>
    <a class="hub__cue reveal" href="#${esc(PROJECTS[0].id)}" data-goto="1"><span>Role para explorar</span><span class="mouse"><i></i></span></a>
    <div class="markers" aria-label="Planetas (projetos)">${markers}</div>
  </section>`;
}

/* ---------- um planeta por projeto ---------- */
function project(p, i) {
  const media = p.media.length
    ? `<div class="thumbs">${p.media.map((m, k) => `<button class="thumb" type="button" data-lightbox="${esc(m)}" aria-label="Ampliar tela ${k + 1} do ${esc(p.name)}"><img src="${esc(m)}" alt="Tela do ${esc(p.name)}" loading="lazy" decoding="async" width="1600" height="900" />${ICONS.expand}</button>`).join("")}</div>`
    : "";
  const planets = p.highlights.slice(0, 3).map((h, k) => `
      <div class="plabel" data-planet="${i}:${k}"><span class="plabel__num">${pad(k + 1)}</span><span class="plabel__value">${esc(h.value)}</span><span class="plabel__text">${esc(h.label)}</span></div>`).join("");
  return `
  <section class="stop stop--system" id="${esc(p.id)}" data-stop="${i + 1}" style="--accent:${esc(p.system.star)}">
    <article class="panel panel--system">
      <p class="eyebrow reveal"><span class="eyebrow__num">Planeta ${pad(i + 1)}</span>${esc(p.kicker)}</p>
      <h2 class="sys__title"><span class="split">${esc(p.name)}</span></h2>
      <p class="sys__lead reveal">${esc(p.lead)}</p>
      <p class="sys__body reveal">${esc(p.body)}</p>
      <p class="label reveal">Tecnologias</p>
      <ul class="chips reveal">${p.stack.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      ${media ? `<div class="reveal">${media}</div>` : ""}
      <div class="actions reveal">
        ${btn(p.github, "Explorar código", true)}
        ${p.demo ? btn(p.demo, p.demoLabel || "Ver ao vivo") : ""}
      </div>
    </article>
    <div class="plabels" aria-hidden="true">${planets}</div>
  </section>`;
}

/* ---------- skills: constelação ---------- */
function constellation() {
  // centro + grupos em anel; itens em leque ao redor de cada grupo
  const W = 1000, H = 600, cx = W / 2, cy = H / 2;
  const groups = SKILLS.map((g, gi) => {
    const a = -Math.PI / 2 + (gi / SKILLS.length) * Math.PI * 2;
    const gx = cx + Math.cos(a) * 280, gy = cy + Math.sin(a) * 170;
    const items = g.items.map((name, k) => {
      // leque aberto para fora do centro; raios alternados evitam rótulos colados
      const spread = (k - (g.items.length - 1) / 2) * 0.5;
      const b = a + spread;
      const d = 96 + (k % 2) * 44;
      return { name, x: gx + Math.cos(b) * d * 1.15, y: gy + Math.sin(b) * d * 0.78 };
    });
    return { ...g, a, x: gx, y: gy, items };
  });
  let lines = "", stars = "", labels = "";
  groups.forEach((g, gi) => {
    lines += `<line class="c-line c-line--hub" x1="${cx}" y1="${cy}" x2="${g.x.toFixed(1)}" y2="${g.y.toFixed(1)}"/>`;
    g.items.forEach((it, k) => {
      const prev = k === 0 ? g : g.items[k - 1];
      lines += `<line class="c-line" x1="${g.x.toFixed(1)}" y1="${g.y.toFixed(1)}" x2="${it.x.toFixed(1)}" y2="${it.y.toFixed(1)}"/>`;
      if (k > 0) lines += `<line class="c-line c-line--faint" x1="${prev.x.toFixed(1)}" y1="${prev.y.toFixed(1)}" x2="${it.x.toFixed(1)}" y2="${it.y.toFixed(1)}"/>`;
      stars += `<circle class="c-star" cx="${it.x.toFixed(1)}" cy="${it.y.toFixed(1)}" r="2.6" style="--d:${(gi * 0.7 + k * 0.45).toFixed(2)}s"/>`;
      const right = it.x >= g.x;
      labels += `<text class="c-item" x="${(it.x + (right ? 9 : -9)).toFixed(1)}" y="${(it.y + 4).toFixed(1)}" text-anchor="${right ? "start" : "end"}">${esc(it.name)}</text>`;
    });
    stars += `<circle class="c-star c-star--hub" cx="${g.x.toFixed(1)}" cy="${g.y.toFixed(1)}" r="5"/>`;
    const up = g.y < cy;
    labels += `<text class="c-group" x="${g.x.toFixed(1)}" y="${(g.y + (up ? -16 : 26)).toFixed(1)}" text-anchor="middle">${esc(g.group)}</text>`;
  });
  return `<svg class="constellation" viewBox="0 0 ${W} ${H}" aria-hidden="true">
    <defs><radialGradient id="cg"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#c9b8ff"/><stop offset="1" stop-color="#8b6cff" stop-opacity="0"/></radialGradient></defs>
    ${lines}${stars}
    <circle cx="${cx}" cy="${cy}" r="46" fill="url(#cg)" opacity=".35"/>
    <g transform="translate(${cx - 16} ${cy - 16})" class="c-mark"><path d="M4 7h24L16 27 4 7z"/><path d="M10 7l6 10 6-10"/></g>
    ${labels}
  </svg>`;
}

function skills() {
  const list = SKILLS.map((g) => `<li><strong>${esc(g.group)}</strong><span>${g.items.map((i) => `<i>${esc(i)}</i>`).join("")}</span></li>`).join("");
  return `
  <section class="stop stop--skills" id="skills" data-stop="${STOP.skills}">
    <div class="panel panel--wide">
      <header class="panel__head reveal"><h2 class="h-panel">Skills</h2><p class="sub">Constelações do conhecimento</p></header>
      <div class="reveal skills__map">${constellation()}</div>
      <ul class="skills__list reveal">${list}</ul>
    </div>
  </section>`;
}

/* ---------- sobre ---------- */
function about() {
  return `
  <section class="stop stop--about" id="sobre" data-stop="${STOP.about}">
    <div class="panel panel--about">
      <header class="panel__head reveal"><h2 class="h-panel">Sobre mim</h2><p class="sub">Mais sobre minha jornada</p></header>
      <p class="about__lead"><span class="split">Software que serve ao público.</span></p>
      <p class="about__body reveal">Sou desenvolvedor full-stack em ${esc(PROFILE.location)}. Trabalho onde dados territoriais viram decisão e modelos de linguagem viram copilotos: mapas de saúde para equipes da Atenção Primária, apps que rodam offline em municípios pequenos e automações com IA.</p>
      <ul class="facts reveal">
        <li>${ICONS.pin}<strong>Teresina</strong><span>PI, Brasil</span></li>
        <li>${ICONS.cap}<strong>Computação</strong><span>UNINASSAU</span></li>
        <li>${ICONS.repo}<strong data-gh="repos">${PROJECTS.length + ARCHIVE.length}</strong><span>repositórios</span></li>
        <li>${ICONS.compass}<strong>3</strong><span>áreas de atuação</span></li>
      </ul>
      <p class="areas reveal">${PROFILE.focus.map((f) => `<span>${esc(f)}</span>`).join("")}</p>
    </div>
  </section>`;
}

/* ---------- stack + github ---------- */
function stack() {
  const icons = STACK_ICONS.map(([key, name]) => {
    const hex = si[key].hex;
    const color = ["000000", "181717"].includes(hex) ? "E8E8F0" : hex;
    return `<li class="tech" style="--c:#${color}">${brand(key)}<span>${esc(name)}</span></li>`;
  }).join("");
  const archive = ARCHIVE.map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener"><span class="arch__name">${esc(a.name)}</span><span class="arch__note">${esc(a.note)}</span>${ICONS.arrow}</a></li>`).join("");
  return `
  <section class="stop stop--stack" id="stack" data-stop="${STOP.stack}">
    <div class="bento">
      <div class="panel panel--tech reveal">
        <header class="panel__head"><h2 class="h-panel">Tech stack</h2><p class="sub">Tecnologias que uso nos projetos</p></header>
        <ul class="techs">${icons}</ul>
      </div>
      <div class="panel panel--gh reveal" id="github">
        <header class="panel__head"><h2 class="h-panel">GitHub</h2><p class="sub">Atividade pública, ao vivo</p></header>
        <div class="gh__stats">
          <div><strong data-gh="repos">—</strong><span>repositórios</span></div>
          <div><strong data-gh="langs">—</strong><span>linguagens</span></div>
          <div><strong data-gh="last">—</strong><span>último push</span></div>
        </div>
        <div class="gh__bar" data-gh="bar" aria-hidden="true"></div>
        <ul class="gh__legend" data-gh="legend"></ul>
        <p class="label">Outros repositórios</p>
        <ul class="archive">${archive}</ul>
      </div>
    </div>
  </section>`;
}

/* ---------- contato ---------- */
function contact() {
  return `
  <section class="stop stop--contact" id="contato" data-stop="${STOP.contact}">
    <div class="panel panel--contact">
      <header class="panel__head reveal"><h2 class="h-panel">Vamos conectar</h2><p class="sub">Vamos construir algo incrível juntos</p></header>
      <p class="contact__title"><span class="split">Tem um problema real? Vamos resolver.</span></p>
      <a class="contact__mail reveal" href="mailto:${esc(PROFILE.email)}">${esc(PROFILE.email)}${ICONS.arrow}</a>
      <div class="socials reveal">
        <a href="${esc(PROFILE.github)}" target="_blank" rel="noopener" aria-label="GitHub">${brand("siGithub")}</a>
        <a href="${esc(PROFILE.linkedin)}" target="_blank" rel="noopener" aria-label="LinkedIn">${LINKEDIN}</a>
        <a href="mailto:${esc(PROFILE.email)}" aria-label="E-mail">${ICONS.mail}</a>
      </div>
    </div>
    <p class="foot">© ${new Date().getFullYear()} Yuri Medeiros · Teresina, PI · Feito com Three.js e shaders escritos à mão</p>
  </section>`;
}

export function renderSections() {
  return [hub(), ...PROJECTS.map(project), skills(), about(), stack(), contact()].join("\n");
}

export function renderNav() {
  return NAV.map((n) =>
    `<a class="nav__item" href="#${STOPS[n.stop].id}" data-goto="${n.stop}" data-range="${n.range.join(",")}">${ICONS[n.icon]}<span>${esc(n.label)}</span></a>`,
  ).join("");
}

export function renderMark() { return MARK; }
