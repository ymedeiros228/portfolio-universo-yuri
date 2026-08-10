// ============================================================
// O UNIVERSO DE YURI — orquestração de UI
// ============================================================

import { Universe } from "./scene.js";
import { PROJECTS, ABOUT, ARCHIVE, PROFILE } from "./projects.js";

const $ = (s) => document.querySelector(s);

const veil       = $("#veil");
const centerName = $("#center-name");
const signature  = $("#signature");
const foot       = $("#foot");
const whisper    = $("#whisper");
const starLabels = $("#star-labels");
const archiveLabels = $("#archive-labels");
const world      = $("#world");
const worldReturn= $("#world-return");
const worldIndex = $("#world-index");
const worldName  = $("#world-name");
const worldEpithet = $("#world-epithet");
const moonLabels = $("#moon-labels");
const scripture  = $("#world-scripture");
const constLabels= $("#constellation-labels");
const worldGithub= $("#world-github");
const worldDemo  = $("#world-demo");

setTimeout(() => veil && veil.classList.add("is-hidden"), 5000); // fallback

let scene;
try {
  scene = new Universe($("#scene-root"));
} catch (err) {
  console.error("[Universo] init failed:", err);
  if (veil) veil.classList.add("is-hidden");
}

let activeProject = null;
let activeMoonIdx = -1;
let hasDeparted = false;

function containLabel(el, x, y, padding = 14) {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  const rect = el.getBoundingClientRect();
  const shiftX = rect.left < padding
    ? padding - rect.left
    : rect.right > window.innerWidth - padding
      ? window.innerWidth - padding - rect.right
      : 0;
  const shiftY = rect.top < padding
    ? padding - rect.top
    : rect.bottom > window.innerHeight - padding
      ? window.innerHeight - padding - rect.bottom
      : 0;
  if (shiftX || shiftY) {
    el.style.left = `${x + shiftX}px`;
    el.style.top = `${y + shiftY}px`;
  }
}

/* ----------------- Star labels ----------------- */
const starLabelEls = new Map();
const hideStarLabel = (el) => {
  el.style.opacity = "0";
  el.classList.remove("is-shown", "is-hovered");
};
PROJECTS.forEach((p) => {
  const el = document.createElement("button");
  el.className = "star-label";
  el.type = "button";
  el.dataset.id = p.id;
  el.innerHTML = `<span class="star-label__name">${p.name}</span>`;
  el.addEventListener("click", () => {
    if (!hasDeparted) {
      hasDeparted = true;
      centerName.classList.add("is-fading");
      whisper.classList.add("is-gone");
      scene.depart();
    }
    setTimeout(() => scene.enterProject(p.id), 100);
  });
  starLabels.appendChild(el);
  starLabelEls.set(p.id, el);
});

scene.onLabels((systems) => {
  const hoveredId = scene.getHoveredId ? scene.getHoveredId() : null;
  systems.forEach((sys) => {
    if (sys.project.isAbout) return;
    const el = starLabelEls.get(sys.project.id);
    if (!el) return;
    const w = sys.worldPos.clone(); w.y += 0.9;
    const s = scene.projectToScreen(w);
    if (s.behind) { hideStarLabel(el); return; }
    // Fade por distância: aparece quando a câmera está perto o suficiente
    const dist = sys.worldPos.distanceTo(scene.camPos);
    const op = Math.max(0, Math.min(1, (40 - dist) / 18));
    if (op < 0.05) { hideStarLabel(el); return; }
    containLabel(el, s.x, s.y);
    el.style.opacity = op;
    el.classList.add("is-shown");
    // Highlight se hover
    el.classList.toggle("is-hovered", sys.project.id === hoveredId);
  });
  const shown = new Set(systems.filter(s => !s.project.isAbout).map(s => s.project.id));
  starLabelEls.forEach((el, id) => { if (!shown.has(id)) hideStarLabel(el); });
});

centerName.addEventListener("mouseenter", () => scene.setCenterHovered(true));
centerName.addEventListener("mouseleave", () => scene.setCenterHovered(false));

/* ----------------- Archive labels ----------------- */
const archiveLabelEls = ARCHIVE.map((a) => {
  const el = document.createElement("a");
  el.className = "archive-label";
  el.href = a.url;
  el.target = "_blank";
  el.rel = "noopener";
  el.innerHTML = `<div class="archive-label__name">${a.name}</div>`;
  el.title = a.note;
  archiveLabels.appendChild(el);
  return el;
});

scene.onArchiveLabels((stars) => {
  if (!stars.length) { archiveLabelEls.forEach(el => el.classList.remove("is-shown")); return; }
  stars.forEach((st, i) => {
    const el = archiveLabelEls[i];
    if (!el) return;
    const s = scene.projectToScreen(st.pos);
    if (s.behind) { el.classList.remove("is-shown"); return; }
    containLabel(el, s.x, s.y + 18);
    el.classList.add("is-shown");
  });
});

/* ----------------- Moon labels ----------------- */
let moonLabelEls = [];
scene.onMoonLabels((moons) => {
  if (moons.length && moonLabelEls.length !== moons.length) {
    moonLabels.innerHTML = "";
    moonLabelEls = moons.map((m, i) => {
      const el = document.createElement("button");
      el.className = "moon-label";
      el.type = "button";
      el.innerHTML = `<span class="moon-label__text">${m.data.label}</span>`;
      el.addEventListener("click", () => selectMoon(i));
      moonLabels.appendChild(el);
      return el;
    });
  }
  if (!moons.length) { moonLabels.innerHTML = ""; moonLabelEls = []; return; }
  moons.forEach((m, i) => {
    const el = moonLabelEls[i];
    if (!el) return;
    const s = scene.projectToScreen(m.worldPos);
    if (s.behind) { el.classList.remove("is-shown"); return; }
    if (window.innerWidth > 820) {
      const dx = s.x - window.innerWidth * 0.5;
      const dy = s.y - window.innerHeight * 0.5;
      const distance = Math.hypot(dx, dy) || 1;
      const offset = 64;
      let x = Math.min(window.innerWidth - 72, Math.max(72, s.x + dx / distance * offset));
      const fan = (i - (moons.length - 1) * 0.5) * 22;
      const y = Math.min(window.innerHeight - 72, Math.max(72, s.y + dy / distance * offset + fan));
      const editorialLeft = Math.max(440, window.innerWidth * 0.28);
      const editorialRight = window.innerWidth * 0.62;
      x = Math.min(editorialRight, Math.max(editorialLeft, x));
      containLabel(el, x, y);
    } else {
      const dx = s.x - window.innerWidth * 0.5;
      const dy = s.y - window.innerHeight * 0.48;
      const distance = Math.hypot(dx, dy) || 1;
      const offset = 34;
      const x = s.x + dx / distance * offset;
      const y = s.y + dy / distance * offset;
      containLabel(el, x, Math.min(window.innerHeight - 300, Math.max(150, y)), 12);
    }
    el.classList.add("is-shown");
    el.classList.toggle("is-active", i === activeMoonIdx);
  });
});

/* ----------------- Constellation labels ----------------- */
let constLabelEls = [];
scene.onConstellationLabels((techs, stars) => {
  if (techs.length && constLabelEls.length !== techs.length) {
    constLabels.innerHTML = "";
    constLabelEls = techs.map((name) => {
      const el = document.createElement("div");
      el.className = "const-label";
      el.textContent = name;
      constLabels.appendChild(el);
      return el;
    });
  }
  if (!techs.length) { constLabels.innerHTML = ""; constLabelEls = []; return; }
  if (!stars) return;
  stars.forEach((v, i) => {
    const el = constLabelEls[i];
    if (!el) return;
    const w = v.clone().add(scene.projectWorld.position);
    const s = scene.projectToScreen(w);
    if (s.behind) { el.classList.remove("is-shown"); return; }
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    el.classList.add("is-shown");
  });
});

/* ----------------- Depart ----------------- */
function depart() {
  if (hasDeparted) return;
  hasDeparted = true;
  centerName.classList.add("is-fading");
  whisper.classList.add("is-gone");
  scene.depart();
}
["pointerdown", "wheel", "keydown"].forEach(ev =>
  window.addEventListener(ev, depart, { once: true, passive: true })
);

centerName.addEventListener("click", (e) => {
  if (!hasDeparted) {
    hasDeparted = true;
    centerName.classList.add("is-fading");
    whisper.classList.add("is-gone");
    scene.depart();
  }
  setTimeout(() => scene.enterProject("about"), 900);
  e.stopPropagation();
});

/* ----------------- Enter / Exit ----------------- */
scene.onEnter((project) => {
  activeProject = project;
  activeMoonIdx = -1;
  if (project.isAbout) {
    worldIndex.textContent = "YURI";
    worldName.textContent = PROFILE.name;
    worldEpithet.textContent = PROFILE.role;
  } else {
    const idx = PROJECTS.findIndex(p => p.id === project.id);
    worldIndex.textContent = `${String(idx + 1).padStart(2, "0")} / ${String(PROJECTS.length).padStart(2, "0")}`;
    worldName.textContent = project.name;
    worldEpithet.textContent = project.epithet;
  }
  worldGithub.href = project.github;
  worldDemo.href = project.demo;
  scripture.classList.remove("is-shown");
  scripture.innerHTML = "";
  world.classList.add("is-visible");
  signature.classList.add("is-world-hidden");
  foot.classList.add("is-world-hidden");
  starLabels.style.opacity = "0";
  archiveLabels.style.opacity = "0";
  setTimeout(() => selectMoon(0), 2000);
});

scene.onExit(() => {
  // Não esconder tudo de uma vez — fade gradual sincronizado com a câmera
  scripture.classList.remove("is-shown");
  activeMoonIdx = -1;
  signature.classList.remove("is-world-hidden");
  foot.classList.remove("is-world-hidden");
  // O world (overlay) começa a sumir imediatamente mas com CSS transition de 2.5s
  world.classList.remove("is-visible");
  // Labels das estrelas reaparecem gradualmente após 1.5s (quando a galáxia já está visível)
  setTimeout(() => {
    starLabels.style.opacity = "1";
    archiveLabels.style.opacity = "1";
  }, 1800);
});

worldReturn.addEventListener("click", () => scene.exitProject());

/* ----------------- Moon selection ----------------- */
function selectMoon(i) {
  if (!activeProject) return;
  activeMoonIdx = i;
  const m = activeProject.moons[i];
  scripture.classList.remove("is-shown");
  void scripture.offsetWidth;
  scripture.innerHTML = renderScripture(m, activeProject);
  scripture.classList.add("is-shown");
}

function renderScripture(m, project) {
  if (m.kind === "text") return `<h3>${m.heading}</h3><p>${m.body}</p>`;
  if (m.kind === "tech") return `<h3>Tecnologias</h3><ul>${m.items.map(t => `<li>${t}</li>`).join("")}</ul>`;
  if (m.kind === "stat") return `<h3>Resultados</h3><div class="stat">${m.stats.map(s => `<div><div class="stat__num">${s.num}</div><div class="stat__label">${s.label}</div></div>`).join("")}</div>`;
  if (m.kind === "link") {
    const isGithub = m.id === "github";
    const url = isGithub ? project.github : project.demo;
    if (isGithub) worldGithub.href = url; else worldDemo.href = url;
    const label = project.isAbout ? "Abrir" : (m.id === "demo" ? "Demo" : "GitHub");
    return `<h3>${label}</h3><p>Abre em uma nova janela — o código e a experiência ao vivo.</p>`;
  }
  if (m.kind === "contact") {
    return `<h3>${m.heading}</h3><p>${m.body}</p>
      <div class="contact-links">${m.links.map(l => `<a class="contact-link" href="${l.url}" target="_blank" rel="noopener">${l.label} <span>↗</span></a>`).join("")}</div>`;
  }
  return "";
}

/* ----------------- Veil + reveal ----------------- */
window.addEventListener("load", () => {
  setTimeout(() => veil.classList.add("is-hidden"), 600);
  setTimeout(() => signature.classList.add("is-visible"), 1800);
  setTimeout(() => foot.classList.add("is-visible"), 2000);
  setTimeout(() => whisper.classList.add("is-visible"), 2800);
  setTimeout(() => whisper.classList.add("is-gone"), 14000);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && world.classList.contains("is-visible")) scene.exitProject();
});
