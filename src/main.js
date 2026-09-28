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
    universe.useExternalLoop((fn) => gsap.ticker.add(fn));
    onScroll();
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
      const lim = innerWidth - (innerWidth < 820 ? 130 : 230);
      if (_p.x > lim + 30) m.classList.add("is-left");
      else if (_p.x < lim - 30) m.classList.remove("is-left");
    });
  }
  // rótulos das luas do planeta visitado
  // Tudo aqui é suavizado (visibilidade, lado e posição): nada liga/desliga
  // de um quadro para o outro — é isso que evitava o "pisca" dos rótulos.
  const now = performance.now();
  const dt = Math.min(0.1, (now - (placeLabels.last || now)) / 1000);
  placeLabels.last = now;
  const ease = 1 - Math.exp(-dt * 10);
  const edge = innerWidth - (innerWidth < 820 ? 110 : 240);
  const vis = [];
  plabels.forEach((l) => {
    let w = Math.max(0, Math.min(1, 1 - Math.abs(p - (l.s + 1)) * 3));
    if (u.travel && u.travel.index !== l.s + 1) w = 0; // em voo: só o destino ganha rótulos
    let target = 0;
    if (w > 0) {
      const sys = u.systems.systems[l.s];
      const moon = sys.moons[l.p];
      // lua atrás do planeta (ou fora da tela): o rótulo se apaga suavemente
      const c = u.project(sys.center, _c);
      const cr = (sys.radius * k) / c.dist;
      u.project(moon.world, _p);
      const behind = _p.dist > c.dist ? Math.max(0, Math.min(1, (cr * 1.1 - Math.hypot(_p.x - c.x, _p.y - c.y)) / (cr * 0.25))) : 0;
      const off = _p.z >= 1 || _p.x < 0 || _p.x > innerWidth - 16 || _p.y < 0 || _p.y > innerHeight;
      target = off ? 0 : w * w * (1 - behind);
      if (!off) {
        const r = (moon.size * k) / _p.dist;
        // lado com histerese: só troca depois de passar 40px da borda
        if (l.left === undefined) l.left = _p.x > edge;
        else if (l.left && _p.x < edge - 40) l.left = false;
        else if (!l.left && _p.x > edge + 40) l.left = true;
        l.w ??= l.el.offsetWidth; // medidas feitas uma vez só
        l.h ??= l.el.offsetHeight;
        vis.push({ l, x: l.left ? _p.x - r - 8 - l.w : _p.x + r + 8, y: _p.y - 10 });
      }
    }
    l.a = (l.a || 0) + (target - (l.a || 0)) * ease;
    if (l.a < 0.004 && target === 0) {
      if (l.shown) { l.el.style.opacity = "0"; l.shown = false; l.x = undefined; }
      return;
    }
    l.el.style.opacity = l.a.toFixed(3);
    l.shown = true;
  });
  // evita rótulos encavalados: empurra para baixo quem colide
  vis.sort((a, b) => a.y - b.y);
  for (let i = 1; i < vis.length; i++) {
    for (let j = 0; j < i; j++) {
      const A = vis[j], B = vis[i];
      if (Math.abs(A.x - B.x) < Math.max(A.l.w, B.l.w) && B.y - A.y < A.l.h + 6) B.y = A.y + A.l.h + 6;
    }
  }
  vis.forEach(({ l, x, y }) => {
    l.el.classList.toggle("is-left", l.left);
    // posição amortecida: empurrões e trocas de lado deslizam em vez de saltar
    if (l.x === undefined) { l.x = x; l.y = y; }
    const pe = 1 - Math.exp(-dt * 18);
    l.x += (x - l.x) * pe;
    l.y += (y - l.y) * pe;
    l.el.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0)`;
  });
}

/* ---------------- scroll suave ---------------- */
const lenis = reduced ? null : new Lenis({ lerp: 0.075, wheelMultiplier: 0.8, touchMultiplier: 1.2, syncTouch: true, syncTouchLerp: 0.08 });
if (lenis) {
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop(); // liberado ao fim da abertura
}

function goTo(i) {
  const el = sections[i];
  if (!el) return;
  const y = Math.max(0, i === 0 ? 0 : el.offsetTop + el.offsetHeight / 2 - innerHeight / 2);
  // duração proporcional à distância, mas sempre calma
  const from = universe ? universe.smooth : 0;
  const dur = Math.min(2.8, 1.5 + Math.abs(i - from) * 0.16);
  if (universe && !reduced) {
    universe.flyTo(i, dur);
    // voos viram "cena": faixas entram e saem com a viagem
    gsap.timeline({ overwrite: true })
      .to(root, { "--cine": 0.55, duration: dur * 0.3, ease: "power2.out" })
      .to(root, { "--cine": 0, duration: dur * 0.45, ease: "power2.inOut" }, dur * 0.55);
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  lenis ? lenis.scrollTo(y, { duration: dur, easing: ease, force: true }) : scrollTo({ top: y, behavior: "auto" });
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

/* ---------------- toque orgânico no ponteiro ---------------- */
// Botões magnéticos: puxados de leve em direção ao cursor, voltam com mola.
// Painéis: luz no vidro e na borda que acompanha o cursor.
if (!reduced && matchMedia("(pointer: fine)").matches) {
  document.querySelectorAll(".btn, .top__cta, .socials a").forEach((el) => {
    const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.28);
      y((e.clientY - (r.top + r.height / 2)) * 0.36);
    });
    el.addEventListener("pointerleave", () => {
      gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: "elastic.out(1, 0.45)", overwrite: true });
    });
  });
  document.querySelectorAll(".panel").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
      el.style.setProperty("--glow", "1");
    });
    el.addEventListener("pointerleave", () => el.style.setProperty("--glow", "0"));
  });
}

/* ---------------- revelações ---------------- */
const SHOW = { opacity: 1, y: 0, filter: "blur(0px)" };
function intro() {
  const hub = document.getElementById("inicio");
  const splits = hub.querySelectorAll(".split");
  const reveals = hub.querySelectorAll(".reveal");
  if (reduced) { gsap.set([splits, reveals], SHOW); lenis?.start(); setupReveals(); return; }
  // voo de abertura só quando a página começa no topo (recarga no meio: direto ao ponto)
  const cinematic = universe && (universe.progress || 0) < 0.05;
  if (cinematic) {
    universe.startIntro(4.6);
    // faixas de cinema presentes desde o primeiro quadro, recolhem quando a câmera pousa
    gsap.fromTo(root, { "--cine": 1 }, { "--cine": 0, duration: 1.6, ease: "power3.inOut", delay: 3.6 });
    // o nome chega com as letras abertas e se fecha, como um título de filme
    if (innerWidth > 820) gsap.from(".hub__name", { letterSpacing: "1.4em", duration: 3.2, ease: "expo.out", delay: 1.6, clearProps: "letterSpacing" });
  }
  const d = cinematic ? 1 : 0; // o texto espera a câmera sair da luz
  gsap.timeline({ delay: 0.4, onComplete: () => lenis?.start() })
    .fromTo(".markers", { opacity: 0 }, { opacity: 1, duration: 2.4, ease: "power2.out", clearProps: "opacity" }, 0.6 + d * 2.6)
    .to(splits, { ...SHOW, duration: 2.2, ease: "expo.out" }, d * 1.4)
    .to(reveals, { ...SHOW, duration: 1.6, ease: "expo.out", stagger: 0.12 }, 0.3 + d * 1.8)
    .from(".side, .top, .hud", { opacity: 0, duration: 1.6, ease: "power2.out" }, 0.2 + d * 2.4);
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
  window.__u = () => universe;
  window.__jump = (i) => {
    const el = sections[i];
    const y = i === 0 ? 0 : Math.max(0, el.offsetTop + el.offsetHeight / 2 - innerHeight / 2);
    lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : scrollTo(0, y);
    onScroll();
    if (universe) universe.smooth = universe.progress;
  };
}
