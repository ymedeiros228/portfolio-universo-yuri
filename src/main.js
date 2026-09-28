// ============================================================
// Orquestração: scroll suave → progresso → câmera; rótulos
// presos ao 3D; navegação; revelações; GitHub ao vivo.
// ============================================================
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STOPS } from "./stops.js";

gsap.registerPlugin(ScrollTrigger);
document.documentElement.classList.add("js");

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const loader = document.getElementById("loader");
const sections = [...document.querySelectorAll("[data-stop]")];
const navItems = [...document.querySelectorAll(".nav__item")];
const hudSector = document.getElementById("hud-sector");
const hudName = document.getElementById("hud-name");
const progressBar = document.getElementById("progress");
const markers = [...document.querySelectorAll("[data-marker]")];
const plabels = [...document.querySelectorAll("[data-planet]")].map((el) => {
  const [s, p] = el.dataset.planet.split(":").map(Number);
  return { el, s, p, shown: false };
});

/* ---------------- cena (carregada sob demanda) ---------------- */
let universe = null;
let revealed = false;

function finishLoading() {
  if (revealed) return;
  revealed = true;
  loader.classList.add("is-done");
  intro();
}

import("./scene/Universe.js")
  .then(({ Universe }) => {
    universe = new Universe(document.getElementById("universe"), { onFirstFrame: finishLoading, onFrame: placeLabels });
  })
  .catch((err) => {
    // sem WebGL: o conteúdo HTML continua completo, só sem o espaço 3D
    console.warn("[universo] WebGL indisponível:", err);
    document.body.classList.add("no-webgl");
    finishLoading();
  });
setTimeout(finishLoading, 7000); // nunca prender o visitante no loader

/* ---------------- rótulos presos ao 3D ---------------- */
const _p = {}, _c = {};
function placeLabels(u) {
  const p = u.smooth;
  // marcadores do mapa: somem ao sair da abertura
  const hub = Math.max(0, Math.min(1, 1 - p * 1.8));
  root.style.setProperty("--hub", hub.toFixed(3));
  root.style.setProperty("--hub-vis", hub > 0.01 ? "visible" : "hidden");
  const k = innerHeight / (2 * Math.tan((u.camera.fov * Math.PI) / 360));
  if (hub > 0.01) {
    u.systems.systems.forEach((s, i) => {
      const m = markers[i];
      u.project(s.center, _p);
      const onScreen = _p.z < 1 && _p.x > 0 && _p.x < innerWidth && _p.y > 0 && _p.y < innerHeight;
      m.style.transform = onScreen ? `translate3d(${_p.x.toFixed(1)}px, ${_p.y.toFixed(1)}px, 0)` : "translate3d(-999px,-999px,0)";
      // afastamento do texto = raio do planeta na tela
      const rp = ((s.ring ? s.radius * 2.1 : s.radius) * k) / _p.dist;
      m.style.setProperty("--off", `${Math.max(14, rp + 10).toFixed(1)}px`);
      // perto da borda direita, o texto passa para o lado esquerdo da estrela
      m.classList.toggle("is-left", _p.x > innerWidth - (innerWidth < 820 ? 130 : 230));
    });
  }
  // rótulos das luas do planeta visitado
  const edge = innerWidth - (innerWidth < 820 ? 110 : 240);
  const vis = [];
  plabels.forEach((l) => {
    const w = Math.max(0, Math.min(1, 1 - Math.abs(p - (l.s + 1)) * 3));
    if (w <= 0) {
      if (l.shown) { l.el.style.opacity = "0"; l.shown = false; }
      return;
    }
    const sys = u.systems.systems[l.s];
    const planet = sys.moons[l.p];
    // lua escondida atrás do planeta (ou fora da tela): sem rótulo
    const c = u.project(sys.center, _c);
    const cr = (sys.radius * k) / c.dist;
    u.project(planet.world, _p);
    if ((_p.dist > c.dist && Math.hypot(_p.x - c.x, _p.y - c.y) < cr) || _p.x < 0 || _p.x > innerWidth - 16 || _p.y < 0 || _p.y > innerHeight) {
      if (l.shown) { l.el.style.opacity = "0"; l.shown = false; }
      return;
    }
    const r = (planet.size * k) / _p.dist;
    const left = _p.x > edge;
    l.w ??= l.el.offsetWidth; // medidas feitas uma vez só
    l.h ??= l.el.offsetHeight;
    vis.push({ l, w, left, x: left ? _p.x - r - 8 - l.w : _p.x + r + 8, y: _p.y - 10 });
  });
  // evita rótulos encavalados: empurra para baixo quem colide
  vis.sort((a, b) => a.y - b.y);
  for (let i = 1; i < vis.length; i++) {
    for (let j = 0; j < i; j++) {
      const A = vis[j], B = vis[i];
      if (Math.abs(A.x - B.x) < Math.max(A.l.w, B.l.w) && B.y - A.y < A.l.h + 6) B.y = A.y + A.l.h + 6;
    }
  }
  vis.forEach(({ l, w, left, x, y }) => {
    l.el.classList.toggle("is-left", left);
    l.el.style.opacity = (w * w).toFixed(3);
    l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    l.shown = true;
  });
}

/* ---------------- scroll suave ---------------- */
const lenis = reduced ? null : new Lenis({ duration: 1.35, easing: (t) => 1 - Math.pow(1 - t, 4), wheelMultiplier: 0.9 });
if (lenis) {
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop(); // liberado ao fim da abertura
}

function goTo(i) {
  const el = sections[i];
  if (!el) return;
  const y = i === 0 ? 0 : el.offsetTop + el.offsetHeight / 2 - innerHeight / 2;
  lenis ? lenis.scrollTo(Math.max(0, y), { duration: 2.4 }) : scrollTo({ top: y, behavior: "auto" });
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-goto]");
  if (!a) return;
  e.preventDefault();
  goTo(Number(a.dataset.goto));
});

/* ---------------- progresso: centro da tela entre centros das seções ---------------- */
let centers = [];
function measure() {
  centers = sections.map((s) => s.offsetTop + s.offsetHeight / 2);
  centers[0] = innerHeight / 2;
  centers[centers.length - 1] = Math.max(centers[centers.length - 2] + 1, root.scrollHeight - innerHeight / 2);
}

let active = -1;
function onScroll() {
  const y = (lenis ? lenis.scroll : scrollY) + innerHeight / 2;
  let p = 0;
  if (y >= centers[centers.length - 1]) p = centers.length - 1;
  else {
    for (let i = 0; i < centers.length - 1; i++) {
      if (y < centers[i + 1]) { p = i + Math.max(0, (y - centers[i]) / (centers[i + 1] - centers[i])); break; }
    }
  }
  universe?.setProgress(p);

  // sombra de leitura: presente nas paradas com painel à esquerda
  const shade = Math.min(1, p * 1.6);
  root.style.setProperty("--shade", shade.toFixed(3));
  progressBar.style.transform = `scaleY(${(p / (centers.length - 1)).toFixed(4)})`;

  const idx = Math.round(p);
  if (idx !== active) {
    active = idx;
    navItems.forEach((n) => {
      const [a, b] = n.dataset.range.split(",").map(Number);
      n.classList.toggle("is-active", idx >= a && idx <= b);
    });
    hudSector.textContent = String(idx).padStart(2, "0");
    hudName.textContent = STOPS[idx].label;
  }
}

measure();
addEventListener("resize", () => { measure(); onScroll(); });
addEventListener("load", () => { measure(); onScroll(); });
lenis ? lenis.on("scroll", onScroll) : addEventListener("scroll", onScroll, { passive: true });
onScroll();

/* ---------------- relógio das coordenadas (hora de Teresina) ---------------- */
const clock = document.getElementById("clock");
const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Fortaleza", hour: "2-digit", minute: "2-digit", second: "2-digit" });
const tick = () => { clock.textContent = fmt.format(new Date()); };
tick();
setInterval(tick, 1000);

/* ---------------- revelações ---------------- */
const SHOW = { opacity: 1, y: 0, filter: "blur(0px)" };
function intro() {
  const hub = document.getElementById("inicio");
  const splits = hub.querySelectorAll(".split");
  const reveals = hub.querySelectorAll(".reveal");
  if (reduced) { gsap.set([splits, reveals], SHOW); lenis?.start(); setupReveals(); return; }
  gsap.timeline({ delay: 0.4, onComplete: () => lenis?.start() })
    .fromTo(".markers", { opacity: 0 }, { opacity: 1, duration: 2.4, ease: "power2.out", clearProps: "opacity" }, 0.6)
    .to(splits, { ...SHOW, duration: 2, ease: "expo.out" }, 0)
    .to(reveals, { ...SHOW, duration: 1.6, ease: "expo.out", stagger: 0.12 }, 0.3)
    .from(".side, .top", { opacity: 0, duration: 1.6, ease: "power2.out" }, 0.2);
  setupReveals();
}

function setupReveals() {
  sections.slice(1).forEach((sec) => {
    const splits = sec.querySelectorAll(".split");
    const reveals = sec.querySelectorAll(".reveal");
    if (reduced) { gsap.set([splits, reveals], SHOW); return; }
    const tl = gsap.timeline({ scrollTrigger: { trigger: sec, start: "top 62%", end: "bottom 38%", toggleActions: "play reverse play reverse" } });
    if (splits.length) tl.to(splits, { ...SHOW, duration: 1.4, ease: "expo.out" });
    if (reveals.length) tl.to(reveals, { ...SHOW, duration: 1.1, ease: "expo.out", stagger: 0.06 }, splits.length ? "-=1.15" : 0);
  });
}

/* ---------------- lightbox das telas ---------------- */
const box = document.getElementById("lightbox");
const boxImg = document.createElement("img");
boxImg.alt = "";
box.prepend(boxImg);
document.addEventListener("click", (e) => {
  const t = e.target.closest("[data-lightbox]");
  if (t) {
    boxImg.src = t.dataset.lightbox;
    boxImg.alt = t.querySelector("img")?.alt || "";
    box.showModal();
    lenis?.stop();
  } else if (e.target === box || e.target.closest(".lightbox__close")) box.close();
});
box.addEventListener("close", () => lenis?.start());

/* ---------------- GitHub ao vivo ---------------- */
const escHTML = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const LANG_COLORS = { JavaScript: "#f1e05a", TypeScript: "#3178c6", Python: "#3572a5", HTML: "#e34c26", CSS: "#663399", Rust: "#dea584" };
const ago = (iso) => {
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return d <= 0 ? "hoje" : d === 1 ? "ontem" : d < 30 ? `há ${d} dias` : d < 60 ? "há 1 mês" : `há ${Math.floor(d / 30)} meses`;
};
async function github() {
  const KEY = "gh-ymedeiros228";
  let repos = null;
  try { repos = JSON.parse(sessionStorage.getItem(KEY)); } catch { /* armazenamento indisponível */ }
  if (!repos) {
    const r = await fetch("https://api.github.com/users/ymedeiros228/repos?per_page=100&sort=pushed");
    if (!r.ok) throw new Error(`GitHub ${r.status}`);
    repos = (await r.json()).map((x) => ({ language: x.language, pushed_at: x.pushed_at }));
    try { sessionStorage.setItem(KEY, JSON.stringify(repos)); } catch { /* ok */ }
  }
  const langs = {};
  repos.forEach((x) => { if (x.language) langs[x.language] = (langs[x.language] || 0) + 1; });
  const sorted = Object.entries(langs).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, n]) => s + n, 0);
  const last = repos.map((x) => x.pushed_at).sort().pop();
  document.querySelectorAll('[data-gh="repos"]').forEach((el) => { el.textContent = repos.length; });
  document.querySelector('[data-gh="langs"]').textContent = sorted.length;
  document.querySelector('[data-gh="last"]').textContent = ago(last);
  document.querySelector('[data-gh="bar"]').innerHTML = sorted
    .map(([l, n]) => `<span style="flex-grow:${n};background:${LANG_COLORS[l] || "#8b6cff"}" title="${escHTML(l)}"></span>`).join("");
  document.querySelector('[data-gh="legend"]').innerHTML = sorted
    .map(([l, n]) => `<li><i style="background:${LANG_COLORS[l] || "#8b6cff"}"></i>${escHTML(l)} <span>${Math.round((n / total) * 100)}%</span></li>`).join("");
}
github().catch((err) => {
  console.warn("[github]", err);
  document.getElementById("github").classList.add("is-offline");
});

// atalhos de depuração (só no servidor de desenvolvimento)
if (import.meta.env.DEV) {
  window.__jump = (i) => {
    const el = sections[i];
    const y = i === 0 ? 0 : Math.max(0, el.offsetTop + el.offsetHeight / 2 - innerHeight / 2);
    lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y);
    onScroll();
    if (universe) universe.smooth = universe.progress;
  };
}
