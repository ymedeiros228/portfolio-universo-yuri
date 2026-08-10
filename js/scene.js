// ============================================================
// O UNIVERSO DE YURI — cena
// Galáxia central com partículas + bloom + nebulosas + câmera damping
// Projetos orbitam a galáxia como sistemas estelares.
// ============================================================

import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { PROJECTS, ABOUT, ARCHIVE } from "./projects.js";

const TAU = Math.PI * 2;
// Braços logarítmicos assimétricos — base da composição espiral (galáxia e poeira)
const SPIRAL_ARMS = [
  { offset: 0.0, pitch: 0.42, width: 1.0, weight: 0.42 },
  { offset: 3.05, pitch: 0.47, width: 1.2, weight: 0.38 },
  { offset: 1.55, pitch: 0.38, width: 1.6, weight: 0.20 },
];
// Sorteio ponderado: braços desiguais evitam simetria perfeita
const pickArm = () => {
  let k = Math.random();
  for (const arm of SPIRAL_ARMS) { k -= arm.weight; if (k <= 0) return arm; }
  return SPIRAL_ARMS[0];
};
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const easeOrganic = (k) => {
  // Easing ultra-suave: smoothstep triplo — desacelera muito gradualmente
  const s = k * k * (3 - 2 * k);
  const s2 = s * s * (3 - 2 * s);
  const s3 = s2 * s2 * (3 - 2 * s2);
  return s3 * 0.5 + s2 * 0.3 + s * 0.2;
};

export class Universe {
  constructor(root) {
    this.root = root;
    this.mode = "idle";
    this.clock = new THREE.Clock();
    this.pointer = new THREE.Vector2();
    this.pointerTarget = new THREE.Vector2();
    this._hoverNdc = new THREE.Vector2();
    this._projectVector = new THREE.Vector3();
    this._hasRendered = false;
    this._onFirstFrame = null;
    this.drag = { active: false, x: 0, y: 0 };
    this.raycaster = new THREE.Raycaster();
    this._pointerScreen = null;
    this._hoveredSys = null;
    this._centerHovered = false;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this._motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    this._motionMedia.addEventListener?.("change", (event) => { this.reducedMotion = event.matches; });
    this._dragMoved = false;
    this._yaw = 0.0;
    this._pitch = 0.46;
    this._radius = 28.0;
    this._fov = 52;
    this._fovTarget = 52;
    this._yawVel = 0;
    this._pitchVel = 0;
    this._breathPhase = Math.random() * TAU;
    this._introT = 0;        // 0..1 intro animation
    this._introDur = 5.5;    // seconds — mais lenta e cinematográfica

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initPost();
    this._buildNebulae();
    this._buildStarfield();
    this._buildDust();
    this._buildGalaxy();
    this._buildCore();
    this._buildProjectSystems();
    this._buildArchive();
    this._buildProjectWorld();
    this._bindEvents();
    this._loop = this._loop.bind(this);
    this._paused = false;
    document.addEventListener("visibilitychange", () => {
      this._paused = document.hidden;
      if (!this._paused) this.clock.getDelta(); // reset delta ao voltar
    });
    this._loop();
  }

  /* ============================ INFRA ============================ */

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", stencil: false, depth: true });
    // Render nativo em resolução total — sem clamp, qualidade 4K em telas HiDPI
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x030617, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.48;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.root.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030617, 0.007);
  }

  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(this._fov, window.innerWidth / window.innerHeight, 0.1, 600);
    this.camera.position.set(0, 8, 30);
    this.camPos = this.camera.position.clone();
    this.camLook = new THREE.Vector3(0, 0, 0);
  }

  _initPost() {
    const rtSize = new THREE.Vector2(window.innerWidth, window.innerHeight);
    const rtPixelRatio = window.devicePixelRatio || 1;
    // Render target em alta resolução com HDR e mipmaps
    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(
      Math.floor(rtSize.x * rtPixelRatio), Math.floor(rtSize.y * rtPixelRatio),
      { type: THREE.HalfFloatType, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true }
    ));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(rtSize, 0.06, 0.25, 0.95);
    this.composer.addPass(this.bloom);
    // Color grading: vignette + grain imperceptível + tilt quase neutro
    this.gradePass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float uTime; uniform vec2 uRes; varying vec2 vUv;
        void main(){
          vec2 uv = vUv;
          vec2 d = uv - 0.5;
          float dist = length(d);
          vec3 col = texture2D(tDiffuse, uv).rgb;
          // ===== CONTRASTE LOCAL (unsharp mask) — quase imperceptível =====
          vec2 px = 1.0 / uRes;
          vec3 blur = vec3(0.0);
          blur += texture2D(tDiffuse, uv + vec2(-px.x, -px.y)).rgb * 0.0625;
          blur += texture2D(tDiffuse, uv + vec2( 0.0,  -px.y)).rgb * 0.125;
          blur += texture2D(tDiffuse, uv + vec2( px.x, -px.y)).rgb * 0.0625;
          blur += texture2D(tDiffuse, uv + vec2(-px.x,  0.0)).rgb * 0.125;
          blur += texture2D(tDiffuse, uv).rgb * 0.25;
          blur += texture2D(tDiffuse, uv + vec2( px.x,  0.0)).rgb * 0.125;
          blur += texture2D(tDiffuse, uv + vec2(-px.x,  px.y)).rgb * 0.0625;
          blur += texture2D(tDiffuse, uv + vec2( 0.0,  px.y)).rgb * 0.125;
          blur += texture2D(tDiffuse, uv + vec2( px.x,  px.y)).rgb * 0.0625;
          col = col + (col - blur) * 0.06;
          // ===== DEPTH OF FIELD SUTIL =====
          float lum = dot(blur, vec3(0.299, 0.587, 0.114));
          float dofFactor = smoothstep(0.0, 0.12, lum) * smoothstep(0.85, 0.25, dist);
          col = mix(blur, col, 0.75 + dofFactor * 0.25);
          // ===== TILT QUASE NEUTRO =====
          float warmth = 1.0 - smoothstep(0.0, 0.8, dist);
          col *= vec3(1.0, 1.0, 1.0 + (1.0 - warmth) * 0.015);
          // ===== ABERRAÇÃO CROMÁTICA ULTRA-SUTIL =====
          float caStrength = 0.0015 * smoothstep(0.3, 0.9, dist);
          col.r = texture2D(tDiffuse, uv + vec2(caStrength, 0.0)).r;
          col.b = texture2D(tDiffuse, uv - vec2(caStrength, 0.0)).b;
          // ===== CONTRASTE SUAVE — não amplifica saturação =====
          col = (col - 0.5) * 1.06 + 0.5;
          col = max(col, vec3(0.0));
          // ===== VIGNETTE SUAVE =====
          float vigPulse = 0.72 + sin(uTime * 0.08) * 0.01;
          col *= 1.0 - smoothstep(0.42, 0.95, dist) * vigPulse;
          // ===== GRAIN IMPERCEPTÍVEL =====
          float grain = fract(sin(dot(uv * 800.0 + uTime, vec2(12.9898, 78.233))) * 43758.5453);
          col += (grain - 0.5) * 0.002;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    this.composer.addPass(this.gradePass);
    // SMAA: antialiasing de alta qualidade pós-processamento
    this.smaaPass = new SMAAPass(window.innerWidth * (window.devicePixelRatio || 1), window.innerHeight * (window.devicePixelRatio || 1));
    this.composer.addPass(this.smaaPass);
    this.composer.addPass(new OutputPass());
  }

  /* ============================ NEBULAE ============================ */

  _makeNebulaTexture(hue) {
    if (!this._texCache) this._texCache = new Map();
    const key = `neb-${hue}`;
    if (this._texCache.has(key)) return this._texCache.get(key);
    const S = 1024, c = document.createElement("canvas");
    c.width = c.height = S;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, S, S);
    const g1 = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
    g1.addColorStop(0, `hsla(${hue}, 18%, 35%, 0.18)`);
    g1.addColorStop(0.3, `hsla(${hue}, 15%, 22%, 0.06)`);
    g1.addColorStop(1, `hsla(${hue}, 12%, 12%, 0)`);
    ctx.fillStyle = g1; ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 6; i++) {
      const bx = S/2 + (Math.random() - 0.5) * S * 0.6;
      const by = S/2 + (Math.random() - 0.5) * S * 0.6;
      const br = S * (0.12 + Math.random() * 0.25);
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      const h = hue + (Math.random() - 0.5) * 20;
      g.addColorStop(0, `hsla(${h}, 18%, 30%, ${0.04 + Math.random() * 0.04})`);
      g.addColorStop(1, `hsla(${h}, 14%, 16%, 0)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this._texCache.set(key, t);
    return t;
  }

  _buildNebulae() {
    this.nebulaGroup = new THREE.Group();
    this.scene.add(this.nebulaGroup);
    // Nebulosas: azul espacial + violeta suave + rosa cósmico discreto
    const configs = [
      { pos: [0, 1, -8], scale: 55, hue: 232, color: 0x0a0e1a, op: 0.04 },
      { pos: [-22, -3, 12], scale: 45, hue: 258, color: 0x0c0a16, op: 0.035 },
      { pos: [20, 4, -15], scale: 50, hue: 218, color: 0x08101a, op: 0.03 },
      { pos: [8, -6, 18], scale: 38, hue: 278, color: 0x0e0a18, op: 0.022 },
    ];
    this.nebulae = configs.map(cfg => {
      const tex = this._makeNebulaTexture(cfg.hue);
      const mat = new THREE.SpriteMaterial({ map: tex, color: cfg.color, transparent: true, opacity: cfg.op, depthWrite: false, blending: THREE.AdditiveBlending });
      const s = new THREE.Sprite(mat);
      s.position.set(...cfg.pos);
      s.scale.set(cfg.scale, cfg.scale, 1);
      s.userData = { baseOp: cfg.op, baseScale: cfg.scale, phase: Math.random() * TAU, baseX: cfg.pos[0], baseY: cfg.pos[1], baseZ: cfg.pos[2] };
      this.nebulaGroup.add(s);
      return s;
    });
  }

  /* ============================ STARFIELD ============================ */

  _buildStarfield() {
    const N = 3000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), siz = new Float32Array(N), col = new Float32Array(N * 3);
    const pal = [new THREE.Color(0xffffff), new THREE.Color(0xfff4e0), new THREE.Color(0xdfe7ff), new THREE.Color(0xffe9c8), new THREE.Color(0xcfd8f0)];
    for (let i = 0; i < N; i++) {
      const r = 80 + Math.random() * 180;
      const t = Math.random() * TAU, p = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(p) * Math.cos(t);
      pos[i*3+1] = r * Math.cos(p) * 0.5;
      pos[i*3+2] = r * Math.sin(p) * Math.sin(t);
      siz[i] = Math.random() * 1.3 + 0.2;
      const c = pal[(Math.random() * pal.length) | 0].clone().multiplyScalar(0.4);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; varying float vT;
        uniform float uTime; uniform float uPx;
        void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0);
        float seed = position.x*0.13+position.y*0.27+position.z*0.11;
        // Twinkle quase imperceptível — estrelas cinematográficas não piscam
        float tw1 = sin(uTime * 0.15 + seed);
        vT = 0.5 + 0.5 * tw1 * 0.15;
        gl_PointSize = aSize * uPx * (280.0 / -mv.z) * (0.92 + vT * 0.08);
        gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vT;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        // Núcleo gaussiano + halo suave + spike de difração sutil
        float core = exp(-d * d * 20.0);
        float halo = exp(-d * d * 4.0) * 0.25;
        float spike = max(0.0, 1.0 - abs(uv.x) * 8.0) * max(0.0, 1.0 - abs(uv.y) * 1.5) * 0.08;
        spike += max(0.0, 1.0 - abs(uv.y) * 8.0) * max(0.0, 1.0 - abs(uv.x) * 1.5) * 0.08;
        float a = (core + halo + spike) * vT * 0.8;
        gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1.0
    });
    this.starfield = new THREE.Points(geo, mat);
    this.scene.add(this.starfield);
  }

  /* ============================ DUST ============================ */

  _buildDust() {
    const N = 2000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 5 + Math.random() * 26;
      const t = Math.random() * TAU;
      pos[i*3]   = Math.cos(t) * r;
      pos[i*3+1] = (Math.random() - 0.5) * 2.2 * (1 - r/34);
      pos[i*3+2] = Math.sin(t) * r;
      const inner = 1 - r/34;
      // Poeira orbital: azulada dessaturada no interior, violeta escuro fora
      const c = new THREE.Color().setHSL(0.65 + (1-inner)*0.07, 0.18, 0.04 + inner*0.065);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      siz[i] = Math.random() * 1.6 + 0.3;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC;
        uniform float uTime; uniform float uPx;
        void main(){ vC = aColor; vec3 p = position; float a = uTime * 0.012;
        float c = cos(a), s = sin(a); p.xz = mat2(c,-s,s,c) * p.xz;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = aSize * uPx * (200.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        float a = exp(-d * d * 8.0) * 0.025; gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1.0
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
  }

  /* ============================ GALAXY (particles with 3D bulge) ============================ */

  _buildGalaxy() {
    // ===== MASSA CÓSMICA ORGÂNICA sobre braços espirais =====
    // Braços logarítmicos como base + densidade por campo de ruído 3D (FBM)
    const N = 40000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N);
    const R = 24.0;

    // Paleta EXTREMAMENTE dessaturada — wallpaper cinematográfico
    const cWhiteCore = new THREE.Color(0xeee8e2);
    const cGoldSoft  = new THREE.Color(0xd0b67f);
    const cHaloBlue  = new THREE.Color(0x9a8fbd);
    const cBlueViolet= new THREE.Color(0x68649b);
    const cViolet    = new THREE.Color(0x514476);
    const cPurple    = new THREE.Color(0x302b5c);
    const cDeepBlue  = new THREE.Color(0x151b42);
    const cFarBlue   = new THREE.Color(0x080d24);
    const cVoid      = new THREE.Color(0x02040e);
    const cHII       = new THREE.Color(0x807888);
    const cDustRose  = new THREE.Color(0x504858);

    // Noise functions
    const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
    const noise2 = (x, y) => { const h = hash(x * 374.3 + y * 791.7); return h * 2 - 1; };
    const noise3 = (x, y, z) => { return noise2(x + z * 57.3, y + z * 91.7); };
    const fbm2 = (x, y) => { let v = 0, a = 0.5; for (let i = 0; i < 5; i++) { v += a * noise2(x, y); x *= 2.1; y *= 2.3; a *= 0.5; } return v; };
    const fbm3 = (x, y, z) => { let v = 0, a = 0.5; for (let i = 0; i < 5; i++) { v += a * noise3(x, y, z); x *= 2.1; y *= 2.3; z *= 2.0; a *= 0.5; } return v; };

    // Gradiente suave — transições lentas no centro, sem anéis visíveis
    const gradientStops = [
      { t: 0.00, c: cWhiteCore },
      { t: 0.15, c: cGoldSoft },
      { t: 0.28, c: cHaloBlue },
      { t: 0.38, c: cBlueViolet },
      { t: 0.50, c: cViolet },
      { t: 0.62, c: cPurple },
      { t: 0.75, c: cDeepBlue },
      { t: 0.90, c: cFarBlue },
      { t: 1.00, c: cVoid },
    ];
    const sampleGradient = (t) => {
      t = Math.max(0, Math.min(1, t));
      for (let i = 0; i < gradientStops.length - 1; i++) {
        const a = gradientStops[i], b = gradientStops[i + 1];
        if (t >= a.t && t <= b.t) {
          const lt = (t - a.t) / (b.t - a.t);
          const st = lt * lt * (3 - 2 * lt);
          return a.c.clone().lerp(b.c, st);
        }
      }
      return gradientStops[gradientStops.length - 1].c.clone();
    };

    for (let i = 0; i < N; i++) {
      let x, y, z, radius;
      const rand = Math.random();

      if (rand < 0.05) {
        // ===== NÚCLEO: poucas estrelas esparsas (5% apenas) =====
        // O brilho do núcleo vem dos sprites de glow, não das partículas
        const r = Math.pow(Math.random(), 0.5) * 5.0;
        const theta = Math.random() * TAU, phi = Math.acos(2 * Math.random() - 1);
        x = r * Math.sin(phi) * Math.cos(theta) + noise2(theta, phi) * 0.5;
        y = r * Math.cos(phi) * 0.4;
        z = r * Math.sin(phi) * Math.sin(theta) + noise2(theta * 2, phi) * 0.5;
        radius = r;
      } else {
        // ===== BRAÇOS ESPIRAIS SUAVES — insinuados pela densidade, nunca linhas =====
        const t = Math.pow((rand - 0.05) / 0.95, 0.55);
        radius = t * R;
        const arm = pickArm();
        // Espiral logarítmica: theta cresce com ln(raio)
        const spiralTheta = arm.offset + Math.log(Math.max(radius, 1.2) / 1.2) / arm.pitch;
        // Dispersão em torno do braço — cresce com o raio (braços difusos, não riscos)
        const spread = 0.30 + t * 0.55;
        const scatter = (Math.random() + Math.random() + Math.random() - 1.5) * spread;
        // Perturbação FBM forte: dissolve a estrutura espiral em massas orgânicas
        const warp = fbm2(Math.cos(spiralTheta) * radius * 0.09, Math.sin(spiralTheta) * radius * 0.09) * 0.85;
        const angle = spiralTheta + scatter * arm.width + warp;

        // Campo de densidade 3D — mantém regiões densas e vazios orgânicos
        const density = fbm3(Math.cos(angle) * radius * 0.08, Math.sin(angle) * radius * 0.08, radius * 0.05);
        let ang = angle, rad = radius;
        if (density < -0.15 && Math.random() < 0.6) {
          // Vazio — desloca ao longo do braço, sem sair da estrutura
          ang = angle + (Math.random() - 0.5) * 0.9;
          rad = radius * (0.8 + Math.random() * 0.4);
        }
        radius = rad;
        // Deriva radial orgânica — dissolve a borda do braço
        x = Math.cos(ang) * rad + noise2(rad * 0.1, ang * 2) * (0.5 + t * 1.2);
        z = Math.sin(ang) * rad + noise2(rad * 0.15, ang * 3) * (0.5 + t * 1.2);

        // Y: espessura orgânica — varia com noise, não é uniforme
        const yNoise = fbm2(x * 0.08, z * 0.08);
        const yThickness = 0.5 + (1 - t) * 2.5 + Math.abs(yNoise) * 1.5;
        y = (Math.random() - 0.5) * yThickness * Math.exp(-t * 1.5);
        y += yNoise * 0.8;
      }

      pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;

      // ===== COR: gradiente + noise angular para quebrar simetria =====
      const tr = radius / R;
      const angleForColor = Math.atan2(z, x);
      // Quebrar simetria: same raio pode ter cores diferentes em ângulos diferentes
      const colorNoise = fbm2(angleForColor * 1.5, radius * 0.15) * 0.18;
      const c = sampleGradient(tr + colorNoise);
      // Variação de brilho apenas (não matiz)
      const brightVar = (Math.random() - 0.5) * 0.05;
      const coreSoftness = 0.035 + Math.min(1, tr * 3.5) * 0.22;
      col[i*3] = Math.max(0, c.r * coreSoftness + brightVar);
      col[i*3+1] = Math.max(0, c.g * coreSoftness + brightVar);
      col[i*3+2] = Math.max(0, c.b * coreSoftness + brightVar);

      // ===== TAMANHO: grande e difuso — partículas se fundem em nuvens =====
      let sz = (1.8 + Math.random() * 3.0) * (1.45 - tr * 0.75);
      const coreFade = Math.min(1, tr / 0.22);
      const coreSizeFade = coreFade * coreFade * (3 - 2 * coreFade);
      sz *= 0.65 + coreSizeFade * 0.35;
      if (Math.random() < 0.008) sz *= 2.5; // estrelas brilhantes raras
      if (Math.random() < 0.002) sz *= 4.0; // supergigantes muito raras
      siz[i] = sz;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; varying float vDepth;
        uniform float uTime; uniform float uPx;
        void main(){ vC = aColor;
        // Rotação praticamente congelada
        float r = length(position.xz); float speed = 0.0005 / (0.5 + r * 0.04); float a = uTime * speed;
        float c = cos(a), s = sin(a); vec3 p = position; p.xz = mat2(c,-s,s,c) * p.xz;
        vec4 mv = modelViewMatrix * vec4(p,1.0); vDepth = -mv.z;
        gl_PointSize = aSize * uPx * (340.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vDepth;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        // Soft particle: gaussiana suave de alta qualidade
        float core = exp(-d * d * 12.0);
        float halo = exp(-d * d * 3.0) * 0.3;
        float a = core + halo;
        // Depth fog: partículas mais distantes são mais difusas
        float depthFade = smoothstep(60.0, 15.0, vDepth);
        // Opacidade varia com distância do centro — núcleo mais denso
        float radialFade = smoothstep(45.0, 10.0, vDepth);
        gl_FragColor = vec4(vC, a * (0.20 + radialFade * 0.15) * depthFade); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1.0
    });
    this.galaxy = new THREE.Points(geo, mat);
    this.scene.add(this.galaxy);

    // ===== NÚCLEO: 3 sprites de glow sobrepostos — energia difusa, não lâmpada =====
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 512;
    const gctx = glowCanvas.getContext("2d");
    const makeGlowTexture = (stops, detail = false) => {
      const c = document.createElement("canvas");
      c.width = c.height = 1024;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(512, 512, 0, 512, 512, 512);
      stops.forEach(s => g.addColorStop(s[0], s[1]));
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
      if (detail) {
        ctx.globalCompositeOperation = "screen";
        ctx.filter = "blur(14px)";
        const wisps = [
          [476, 444, 184, 76, -0.35, "rgba(255, 240, 210, 0.08)"],
          [604, 500, 152, 60, 0.45, "rgba(185, 165, 210, 0.065)"],
          [500, 612, 124, 56, -0.7, "rgba(255, 226, 180, 0.06)"],
          [640, 612, 96, 48, 0.25, "rgba(150, 165, 220, 0.05)"]
        ];
        wisps.forEach(([x, y, rx, ry, rotation, color]) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(rotation);
          ctx.scale(1, ry / rx);
          const wisp = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          wisp.addColorStop(0, color);
          wisp.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = wisp;
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        });
        ctx.filter = "blur(16px)";
        for (let i = 0; i < 9; i++) {
          const a = i * 2.399;
          const r = 68 + (i % 3) * 38;
          const x = 512 + Math.cos(a) * r;
          const y = 512 + Math.sin(a) * r;
          const blob = ctx.createRadialGradient(x, y, 0, x, y, 44 + (i % 2) * 18);
          blob.addColorStop(0, i % 2 ? "rgba(255, 244, 220, 0.05)" : "rgba(180, 165, 220, 0.045)");
          blob.addColorStop(1, "rgba(0, 0, 0, 0)");
          ctx.fillStyle = blob;
          ctx.fillRect(x - 70, y - 70, 140, 140);
        }
        ctx.filter = "none";
        ctx.globalCompositeOperation = "source-over";
      }
      return new THREE.CanvasTexture(c);
    };
    // Sprite 1: núcleo interno — branco quente → dourado (suave)
    const tex1 = makeGlowTexture([
      [0.0, "rgba(255, 248, 235, 0.08)"],
      [0.12, "rgba(242, 211, 160, 0.11)"],
      [0.35, "rgba(165, 135, 170, 0.06)"],
      [0.62, "rgba(75, 80, 145, 0.018)"],
      [1.0, "rgba(0, 0, 0, 0)"]
    ], true);
    // Sprite 2: halo médio — dourado → azul suave
    const tex2 = makeGlowTexture([
      [0.0, "rgba(238, 192, 125, 0.06)"],
      [0.2, "rgba(175, 145, 185, 0.06)"],
      [0.5, "rgba(75, 82, 150, 0.025)"],
      [0.75, "rgba(35, 48, 105, 0.01)"],
      [1.0, "rgba(0, 0, 0, 0)"]
    ]);
    // Sprite 3: halo externo — azul → transparente
    const tex3 = makeGlowTexture([
      [0.0, "rgba(105, 95, 180, 0.04)"],
      [0.3, "rgba(60, 70, 155, 0.022)"],
      [0.7, "rgba(25, 35, 95, 0.007)"],
      [1.0, "rgba(0, 0, 0, 0)"]
    ]);
    this.coreGlows = [];
    const glowConfigs = [
      { tex: tex1, scale: 7, op: 0.08 },
      { tex: tex2, scale: 18, op: 0.12 },
      { tex: tex3, scale: 32, op: 0.07 },
    ];
    // Sprite 4: núcleo central pequeno e brilhante — ponto focal sem estourar
    const texCore = makeGlowTexture([
      [0.0, "rgba(255, 250, 240, 0.22)"],
      [0.08, "rgba(248, 232, 200, 0.16)"],
      [0.25, "rgba(220, 195, 170, 0.06)"],
      [0.6, "rgba(150, 140, 160, 0.015)"],
      [1.0, "rgba(0, 0, 0, 0)"]
    ]);
    glowConfigs.push({ tex: texCore, scale: 5, op: 0.30 });
    // Lens flare sutil — sprite alongado horizontal
    const flareTex = makeGlowTexture([
      [0.0, "rgba(255, 245, 220, 0.12)"],
      [0.1, "rgba(230, 210, 180, 0.06)"],
      [0.4, "rgba(180, 165, 150, 0.02)"],
      [1.0, "rgba(0, 0, 0, 0)"]
    ]);
    glowConfigs.push({ tex: flareTex, scale: 12, op: 0.05 });
    glowConfigs.forEach(cfg => {
      const m = new THREE.SpriteMaterial({ map: cfg.tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: cfg.op });
      const sp = new THREE.Sprite(m);
      sp.scale.set(cfg.scale, cfg.scale, 1);
      sp.userData.baseOp = cfg.op;
      sp.userData.baseScale = cfg.scale;
      this.scene.add(sp);
      this.coreGlows.push(sp);
    });
    // coreHalo alias para compatibilidade com transições
    this.coreHalo = this.coreGlows[0];

    // ===== NEBULOSA VOLUMÉTRICA: 30 sprites grandes, extremamente sutis =====
    this.nebulaSprites = new THREE.Group();
    const nebTex = makeGlowTexture([
      [0.0, "rgba(40, 42, 55, 0.06)"],
      [0.3, "rgba(25, 28, 40, 0.03)"],
      [0.7, "rgba(10, 12, 20, 0.01)"],
      [1.0, "rgba(0, 0, 0, 0)"]
    ]);
    for (let i = 0; i < 50; i++) {
      const r = 4 + Math.pow(Math.random(), 0.6) * 18;
      const arm = pickArm();
      const spiralTheta = arm.offset + Math.log(Math.max(r, 1.2) / 1.2) / arm.pitch;
      const scatter = (Math.random() - 0.5) * (0.22 + r / R * 0.35);
      const angle = spiralTheta + scatter * arm.width
        + fbm2(Math.cos(spiralTheta) * r * 0.08, Math.sin(spiralTheta) * r * 0.08) * 0.35;
      const density = fbm3(Math.cos(angle) * r * 0.08, Math.sin(angle) * r * 0.08, r * 0.05);
      if (density < -0.1) continue;
      const x = Math.cos(angle) * r + noise2(r * 0.1, angle) * 2;
      const z = Math.sin(angle) * r + noise2(r * 0.15, angle) * 2;
      const y = noise2(x * 0.1, z * 0.1) * 1.5;
      const scale = 8 + Math.random() * 12;
      const op = 0.025 + Math.random() * 0.03;
      // Cor fria e muito dessaturada
      const tr = r / R;
      const nc = new THREE.Color();
      nc.setHSL(0.65 + Math.random() * 0.08, 0.22, 0.07 - tr * 0.025);
      nc.multiplyScalar(0.7);
      const m = new THREE.SpriteMaterial({ map: nebTex, color: nc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: op });
      const sp = new THREE.Sprite(m);
      sp.position.set(x, y, z);
      sp.scale.set(scale, scale, 1);
      sp.userData.baseOp = op;
      sp.userData.baseScale = scale;
      sp.userData.phase = Math.random() * TAU;
      this.nebulaSprites.add(sp);
    }
    this.scene.add(this.nebulaSprites);

    // ===== DARK DUST LANES: faixas escuras que bloqueiam luz (NormalBlending) =====
    const dustN = 8000;
    const dustGeo = new THREE.BufferGeometry();
    const dPos = new Float32Array(dustN * 3), dCol = new Float32Array(dustN * 3), dSiz = new Float32Array(dustN);
    let dustWritten = 0;
    for (let attempts = 0; dustWritten < dustN && attempts < dustN * 12; attempts++) {
      const angle = Math.random() * TAU;
      const r = 5 + Math.pow(Math.random(), 0.4) * 18;
      // Lanes escuras seguem padrões de noise — entre regiões brilhantes
      const laneNoise = fbm2(Math.cos(angle) * r * 0.06, Math.sin(angle) * r * 0.06);
      if (laneNoise > -0.05) continue; // só em regiões de lane
      // Lanes acompanham a borda interna dos braços
      const arm = pickArm();
      const spiralTheta = arm.offset + Math.log(Math.max(r, 1.2) / 1.2) / arm.pitch;
      const laneOffset = Math.random() < 0.5 ? -0.34 : -0.14;
      const lane = spiralTheta + laneOffset + (Math.random() - 0.5) * 0.14 * arm.width
        + fbm2(Math.cos(spiralTheta) * r * 0.09, Math.sin(spiralTheta) * r * 0.09) * 0.4;
      const x = Math.cos(lane) * r + noise2(r * 0.2, lane) * 0.8;
      const z = Math.sin(lane) * r + noise2(r * 0.25, lane) * 0.8;
      const y = noise2(x * 0.1, z * 0.1) * 0.55;
      dPos[dustWritten*3] = x; dPos[dustWritten*3+1] = y; dPos[dustWritten*3+2] = z;
      // Cor escura — azul-marrom muito escuro
      dCol[dustWritten*3] = 0.01; dCol[dustWritten*3+1] = 0.008; dCol[dustWritten*3+2] = 0.015;
      dSiz[dustWritten] = 1.2 + Math.random() * 1.8;
      dustWritten++;
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    dustGeo.setAttribute("aSize", new THREE.BufferAttribute(dSiz, 1));
    dustGeo.setAttribute("aColor", new THREE.BufferAttribute(dCol, 3));
    const dustMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC;
        uniform float uTime; uniform float uPx;
        void main(){ vC = aColor; vec3 p = position;
        float r = length(position.xz); float speed = 0.0005 / (0.5 + r * 0.04); float a = uTime * speed;
        float c = cos(a), s = sin(a); p.xz = mat2(c,-s,s,c) * p.xz;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = aSize * uPx * (300.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        float a = exp(-d * 2.5) * 0.08;
        gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending, opacity: 1.0
    });
    this.darkDust = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.darkDust);

    // Camadas de poeira
    this._buildInterstellarDust();
    this._buildForegroundDust();
  }

  _buildInterstellarDust() {
    // Poeira interestelar — distribuição orgânica por noise, sem braços
    const N = 15000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N);
    const R = 22.0;
    const hash = (n) => { const s = Math.sin(n * 12.9898) * 43758.5453; return s - Math.floor(s); };
    const noise2 = (x, y) => { const h = hash(x * 374.3 + y * 791.7); return h * 2 - 1; };
    const fbm2 = (x, y) => { let v = 0, a = 0.5; for (let i = 0; i < 4; i++) { v += a * noise2(x, y); x *= 2.1; y *= 2.3; a *= 0.5; } return v; };

    for (let i = 0; i < N; i++) {
      const t = Math.pow(Math.random(), 0.45);
      const radius = t * R;
      // Poeira acompanha os braços — dust lanes na borda interna de cada braço
      const arm = pickArm();
      const spiralTheta = arm.offset + Math.log(Math.max(radius, 1.2) / 1.2) / arm.pitch;
      const scatter = (Math.random() + Math.random() + Math.random() - 1.5) * (0.18 + t * 0.34);
      const warp = fbm2(Math.cos(spiralTheta) * radius * 0.09, Math.sin(spiralTheta) * radius * 0.09) * 0.45;
      const angle = spiralTheta - 0.16 + scatter * arm.width + warp;
      const x = Math.cos(angle) * radius + noise2(radius * 0.1, angle) * (0.5 + t * 1.1);
      const z = Math.sin(angle) * radius + noise2(radius * 0.15, angle) * (0.5 + t * 1.1);
      const y = (Math.random() - 0.5) * (0.5 + (1 - t) * 1.5) + fbm2(x * 0.08, z * 0.08) * 0.8;
      pos[i*3] = x; pos[i*3+1] = y; pos[i*3+2] = z;
      // Cores: azul profundo → violeta suave → lavanda escura
      const c = new THREE.Color();
      const lightFalloff = Math.exp(-t * 2.0);
      const hue = t < 0.25 ? 0.64 : (t < 0.55 ? 0.69 : 0.66);
      c.setHSL(hue, 0.12, 0.055 + (1 - t) * 0.025);
      c.multiplyScalar(lightFalloff);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      siz[i] = Math.random() * 5.0 + 2.0; // grande e difuso
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; varying float vRadius;
        uniform float uTime; uniform float uPx;
        void main(){ vC = aColor; float r = length(position.xz); vRadius = r;
        float speed = 0.0005 / (0.5 + r * 0.04); float a = uTime * speed;
        float c = cos(a), s = sin(a); vec3 p = position; p.xz = mat2(c,-s,s,c) * p.xz;
        p.y += sin(uTime * 0.03 + r * 0.3) * 0.015;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = aSize * uPx * (220.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vRadius;
        uniform float uTime;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        float a = exp(-d * d * 6.0) * 0.07;
        float breath = 0.9 + sin(uTime * 0.06 + vRadius * 0.2) * 0.1;
        gl_FragColor = vec4(vC * breath, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1.0
    });
    this.galaxyDust = new THREE.Points(geo, mat);
    this.scene.add(this.galaxyDust);
  }

  _buildForegroundDust() {
    // Poeira foreground (entre câmera e galáxia) + background (atrás da galáxia)
    // Parallax real quando a câmera se move
    const N = 6000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const isForeground = i < 4000;
      const r = isForeground ? (10 + Math.random() * 12) : (35 + Math.random() * 15);
      const theta = Math.random() * TAU, phi = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.cos(phi) * 0.6 + (Math.random() - 0.5) * 5;
      pos[i*3+2] = r * Math.sin(phi) * Math.sin(theta) + (isForeground ? 8 : -8);
      const c = new THREE.Color();
      const hue = 228 + Math.random() * 56;
      c.setHSL(hue / 360, 0.28, 0.03 + Math.random() * 0.03);
      col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
      siz[i] = Math.random() * 9.0 + 4.0;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(siz, 1));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPx: { value: this.renderer.getPixelRatio() } },
      vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC;
        uniform float uTime; uniform float uPx;
        void main(){ vC = aColor;
        vec3 p = position;
        p.x += sin(uTime * 0.02 + position.y * 0.2) * 0.12;
        p.y += cos(uTime * 0.03 + position.x * 0.15) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = aSize * uPx * (180.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float d = length(uv);
        float a = exp(-d * d * 6.0) * 0.03;
        gl_FragColor = vec4(vC, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1.0
    });
    this.foregroundDust = new THREE.Points(geo, mat);
    this.scene.add(this.foregroundDust);
  }

  /* ============================ CORE ============================ */

  _makeGlowTexture() {
    if (!this._texCache) this._texCache = new Map();
    if (this._texCache.has("glow-default")) return this._texCache.get("glow-default");
    const S = 512, c = document.createElement("canvas");
    c.width = c.height = S;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.10, "rgba(255,240,200,0.75)");
    g.addColorStop(0.30, "rgba(232,201,138,0.2)");
    g.addColorStop(1, "rgba(232,201,138,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this._texCache.set("glow-default", t);
    return t;
  }

  _buildCore() {
    // SEM sprite — o núcleo é só a densidade de partículas + bloom
    this.core = new THREE.Group();
    this.scene.add(this.core);
    this.coreLight = new THREE.PointLight(0xa0a8b8, 0.12, 22, 2.0);
    this.scene.add(this.coreLight);
    this.scene.add(new THREE.AmbientLight(0x080d18, 0.35));
  }

  /* ============================ PROJECT SYSTEMS (orbiting the galaxy) ============================ */

  _buildProjectSystems() {
    this.systems = [];
    this.systemsGroup = new THREE.Group();
    this.scene.add(this.systemsGroup);
    const glowTex = this._makeGlowTexture();
    const all = [ABOUT, ...PROJECTS];
    all.forEach((p, idx) => {
      const g = new THREE.Group();
      let sun = null, sprite = null, corona = null, orbs = [], light = null;
      if (!p.isAbout) {
        // Glow discreto para não competir com a galáxia
        sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: p.color, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
        sprite.scale.set(2.2, 2.2, 1);
        g.add(sprite);
        // Corona: segunda camada de glow, maior e mais sutil
        corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: p.color, transparent: true, opacity: 0.06, depthWrite: false, blending: THREE.AdditiveBlending }));
        corona.scale.set(4.5, 4.5, 1);
        g.add(corona);
        // Sol maior e brilhante
        sun = new THREE.Mesh(new THREE.SphereGeometry(0.25, 48, 48), new THREE.MeshBasicMaterial({ color: p.color }));
        g.add(sun);
        // Luz própria para iluminar o que estiver perto
        light = new THREE.PointLight(p.color, 0.2, 6, 2);
        g.add(light);
        // 2 planetas pequenos orbitando
        for (let k = 0; k < 2; k++) {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + k * 0.015, 32, 32), new THREE.MeshStandardMaterial({ color: 0x606060, emissive: 0x040408, roughness: 0.85 }));
          g.add(m);
          orbs.push({ mesh: m, r: 0.7 + k * 0.3, speed: 0.2 + k * 0.06, phase: k * 1.3 });
        }
      }
      this.systemsGroup.add(g);
      this.systems.push({ project: p, index: idx, group: g, sun, sprite, corona, light, orbs, orbitRadius: p.orbitRadius, orbitAngle: p.orbitAngle, orbitSpeed: p.isAbout ? 0 : 0.006 / (0.5 + p.orbitRadius * 0.05), worldPos: new THREE.Vector3() });
    });
  }

  /* ============================ ARCHIVE ============================ */

  _buildArchive() {
    this.archiveGroup = new THREE.Group();
    this.scene.add(this.archiveGroup);
    this.archiveStars = [];
    ARCHIVE.forEach(a => {
      const v = new THREE.Vector3(Math.cos(a.angle) * a.radius, (Math.random() - 0.5) * 1.5, Math.sin(a.angle) * a.radius);
      const star = new THREE.Mesh(new THREE.SphereGeometry(0.03, 24, 24), new THREE.MeshBasicMaterial({ color: 0x2a3040 }));
      star.position.copy(v);
      this.archiveGroup.add(star);
      this.archiveStars.push({ data: a, pos: v });
    });
  }

  /* ============================ PROJECT WORLD ============================ */

  _buildProjectWorld() {
    this.projectWorld = new THREE.Group();
    this.projectWorld.visible = false;
    this.scene.add(this.projectWorld);
    this.planetMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xd8b898) }, uAccent: { value: new THREE.Color(0xe8d0b8) }, uDeep: { value: new THREE.Color(0x0a0a14) } },
      vertexShader: `varying vec3 vN; varying vec3 vView; varying vec3 vPos;
        void main(){ vN = normalize(normalMatrix * normal); vPos = position;
        vec4 mv = modelViewMatrix * vec4(position,1.0); vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `
        varying vec3 vN; varying vec3 vView; varying vec3 vPos;
        uniform float uTime; uniform vec3 uColor; uniform vec3 uAccent; uniform vec3 uDeep;
        float hash3(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
        float noise3(vec3 p){
          vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
          float a = hash3(i), b = hash3(i+vec3(1,0,0)), c = hash3(i+vec3(0,1,0)), d = hash3(i+vec3(1,1,0));
          float e = hash3(i+vec3(0,0,1)), f2 = hash3(i+vec3(1,0,1)), g = hash3(i+vec3(0,1,1)), h2 = hash3(i+vec3(1,1,1));
          return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y), mix(mix(e,f2,f.x),mix(g,h2,f.x),f.y), f.z);
        }
        float fbm3(vec3 p){ float v = 0.0, a = 0.5; for(int i = 0; i < 6; i++){ v += a * noise3(p); p *= 2.0; a *= 0.5; } return v; }
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(vView);
          float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
          // Bandas gasosas: usar coordenadas esféricas para bandas horizontais suaves
          float lat = asin(clamp(vPos.y / 3.0, -1.0, 1.0));
          float flow = uTime * 0.015;
          // Múltiplas oitavas de turbulência para bandas orgânicas
          float turb = fbm3(vec3(vPos.x * 0.4, lat * 3.0, flow * 0.5));
          float bands = sin(lat * 5.0 + turb * 2.5);
          float detail = fbm3(vec3(vPos * 2.0 + vec3(flow, 0.0, 0.0)));
          // Combinar: bandas + turbulência + detalhe
          float t = bands * 0.5 + 0.5;
          t = mix(t, turb, 0.35);
          t = mix(t, detail * 0.5 + 0.5, 0.15);
          // Normal mapping procedural: perturba a normal com gradiente do FBM
          float eps = 0.5;
          float nx = fbm3(vec3(vPos.x + eps, vPos.y, vPos.z)) - fbm3(vec3(vPos.x - eps, vPos.y, vPos.z));
          float ny = fbm3(vec3(vPos.x, vPos.y + eps, vPos.z)) - fbm3(vec3(vPos.x, vPos.y - eps, vPos.z));
          float nz = fbm3(vec3(vPos.x, vPos.y, vPos.z + eps)) - fbm3(vec3(vPos.x, vPos.y, vPos.z - eps));
          vec3 Np = normalize(N + vec3(nx, ny, nz) * 0.15);
          // Cor: gradiente suave deep -> color -> accent
          vec3 base = mix(uDeep, uColor, smoothstep(0.2, 0.8, t));
          base = mix(base, uAccent, smoothstep(0.6, 0.95, t) * 0.4);
          // Iluminação: luz do canto superior-esquerdo, mais dramática
          vec3 lightDir = normalize(vec3(0.5, 0.6, 0.8));
          float wrap = (dot(Np, lightDir) + 0.25) / 1.25;
          wrap = max(wrap, 0.0);
          base *= 0.05 + wrap * 0.6;
          // Specular sutil nas bandas claras — usa normal perturbada
          float spec = pow(max(dot(reflect(-lightDir, Np), V), 0.0), 32.0) * 0.2;
          base += uAccent * spec * smoothstep(0.5, 0.9, t);
          // Terminador dramático (transição dia/noite)
          float term = smoothstep(-0.15, 0.25, dot(N, lightDir));
          vec3 night = uDeep * 0.15;
          base = mix(night, base, term);
          // Rim glow atmosférico
          base += uAccent * fres * 0.15;
          gl_FragColor = vec4(base, 1.0);
        }`
    });
    this.heroPlanet = new THREE.Mesh(new THREE.SphereGeometry(3.0, 256, 256), this.planetMat);
    this.projectWorld.add(this.heroPlanet);
    const haloMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0xd8b898) } },
      vertexShader: `varying vec3 vN; varying vec3 vView; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vView; uniform vec3 uColor; void main(){ float f = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), 4.0); gl_FragColor = vec4(uColor, f * 0.12); }`,
      transparent: true, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending
    });
    this.heroHalo = new THREE.Mesh(new THREE.SphereGeometry(3.3, 128, 128), haloMat);
    this.projectWorld.add(this.heroHalo);
    // Glow atmosférico externo — sprite grande e difuso
    const atmoGlowTex = this._makeGlowTexture();
    this.heroAtmoGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: atmoGlowTex, color: 0xd8b898, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.heroAtmoGlow.scale.set(10, 10, 1);
    this.projectWorld.add(this.heroAtmoGlow);
    this.moonGroup = new THREE.Group();
    this.projectWorld.add(this.moonGroup);
    this.moons = [];
    this.constellation = new THREE.Group();
    this.projectWorld.add(this.constellation);
  }

  _populateProjectWorld(project) {
    while (this.moonGroup.children.length) this.moonGroup.remove(this.moonGroup.children[0]);
    while (this.constellation.children.length) this.constellation.remove(this.constellation.children[0]);
    this.moons = [];
    this.planetMat.uniforms.uColor.value = new THREE.Color(project.color);
    this.planetMat.uniforms.uAccent.value = new THREE.Color(project.accent);
    this.heroHalo.material.uniforms.uColor.value = new THREE.Color(project.accent);
    this.heroAtmoGlow.material.color = new THREE.Color(project.accent);
    const pSize = project.planet.size;
    const planetScale = window.innerWidth > 820 ? pSize / 3.4 : pSize / 4.6;
    this.heroPlanet.scale.setScalar(planetScale);
    this.heroHalo.scale.setScalar(planetScale);
    this.heroAtmoGlow.scale.setScalar(planetScale * 3.3);
    const moonCount = project.moons.length;
    project.moons.forEach((m, i) => {
      const radius = 4.6 + i * 0.65;
      const moonSize = window.innerWidth > 820 ? 0.13 + (i % 3) * 0.02 : 0.09 + (i % 3) * 0.015;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(moonSize, 48, 48), new THREE.MeshStandardMaterial({ color: 0x6a6862, emissive: 0x040406, roughness: 0.9, metalness: 0.03 }));
      this.moonGroup.add(mesh);
      this.moons.push({ mesh, data: m, radius, speed: 0.1 + i * 0.03, phase: (i / moonCount) * TAU, tilt: (i % 2 === 0 ? 1 : -1) * 0.1, worldPos: new THREE.Vector3() });
    });
    const techs = project.constellation, stars = [];
    techs.forEach((_, i) => {
      const angle = (i / techs.length) * TAU + Math.random() * 0.4;
      const r = 9.5 + Math.random() * 5;
      const v = new THREE.Vector3(Math.cos(angle) * r, (Math.random() - 0.5) * 5, Math.sin(angle) * r - 7);
      stars.push(v);
      const sm = new THREE.Mesh(new THREE.SphereGeometry(0.04, 24, 24), new THREE.MeshBasicMaterial({ color: 0x4a5878 }));
      sm.position.copy(v);
      this.constellation.add(sm);
    });
    this._constellationStars = stars;
  }

  /* ============================ EVENTS ============================ */

  _bindEvents() {
    window.addEventListener("resize", () => this._onResize());
    // Usar window para pointermove (funciona mesmo sobre overlays)
    window.addEventListener("pointermove", (e) => {
      this.pointerTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.pointerTarget.y = -((e.clientY / window.innerHeight) * 2 - 1);
      this._pointerScreen = { x: e.clientX, y: e.clientY };
      if (!this.drag.active && (this.mode === "galaxy" || this.mode === "idle")) this._hoverRaycast();
      // Drag funciona em qualquer lugar
      if (this.drag.active) {
        const dx = (e.clientX - this.drag.x), dy = (e.clientY - this.drag.y);
        if (Math.abs(dx) + Math.abs(dy) > 4) this._dragMoved = true;
        if (this.mode === "galaxy" || this.mode === "idle") {
          // Sensibilidade mais suave — arrastar parece físico, não mecânico
          this._yawVel += dx * 0.0022;
          this._pitchVel += dy * 0.0018;
        }
        this.drag.x = e.clientX; this.drag.y = e.clientY;
      }
    });
    // pointerdown no window inteiro (canvas pode estar sob overlays)
    window.addEventListener("pointerdown", (e) => {
      // Ignora se clicou num botão/link interativo
      if (e.target.closest("button, a") && e.target.closest(".star-label, .moon-label, .world__return, .center-name, .archive-label, .foot__link, .world__link, .contact-link")) return;
      this.drag.active = true; this.drag.x = e.clientX; this.drag.y = e.clientY;
      this._dragMoved = false;
      this.renderer.domElement.style.cursor = "grabbing";
    });
    window.addEventListener("pointerup", (e) => {
      if (this.drag.active && !this._dragMoved && (this.mode === "galaxy" || this.mode === "idle")) {
        this._clickRaycast(e.clientX, e.clientY);
      }
      this.drag.active = false;
      this.renderer.domElement.style.cursor = this._hoveredSys ? "pointer" : "grab";
    });
    // Wheel no window
    window.addEventListener("wheel", (e) => {
      if (this.mode !== "galaxy" && this.mode !== "idle") return;
      if (e.target.closest(".world__scripture")) return;
      e.preventDefault();
      this._radius = THREE.MathUtils.clamp(this._radius + e.deltaY * 0.011, 14, 50);
    }, { passive: false });
  }

  _clickRaycast(cx, cy) {
    const ndc = new THREE.Vector2(
      (cx / window.innerWidth) * 2 - 1,
      -((cy / window.innerHeight) * 2 - 1)
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const meshes = this.systems.filter(s => s.sun).map(s => s.sun);
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (hits.length > 0) {
      const sys = this.systems.find(s => s.sun === hits[0].object);
      if (sys) this.enterProject(sys.project.id);
    }
  }

  _hoverRaycast() {
    if (!this._pointerScreen) return;
    this._hoverNdc.set(
      (this._pointerScreen.x / window.innerWidth) * 2 - 1,
      -((this._pointerScreen.y / window.innerHeight) * 2 - 1)
    );
    this.raycaster.setFromCamera(this._hoverNdc, this.camera);
    const meshes = this.systems.flatMap(s => [s.sun, s.sprite].filter(Boolean));
    const hits = this.raycaster.intersectObjects(meshes, false);
    this._hoveredSys = null;
    if (hits.length > 0) {
      const sys = this.systems.find(s => s.sun === hits[0].object || s.sprite === hits[0].object);
      if (sys) this._hoveredSys = sys;
    }
    if (!this._hoveredSys) {
      let nearest = null, nearestDist = 30;
      this.systems.forEach(sys => {
        const p = this.projectToScreen(sys.worldPos);
        const dist = Math.hypot(p.x - this._pointerScreen.x, p.y - this._pointerScreen.y);
        if (!p.behind && dist < nearestDist) { nearest = sys; nearestDist = dist; }
      });
      this._hoveredSys = nearest;
    }
    this.renderer.domElement.style.cursor = this.drag.active ? "grabbing" : (this._hoveredSys ? "pointer" : "grab");
  }

  setCenterHovered(hovered) { this._centerHovered = hovered; }
  setMoonHover(idx) { this._moonHover = idx; }

  _onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.gradePass.uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
    const dpr = window.devicePixelRatio || 1;
    if (this.smaaPass) this.smaaPass.setSize(window.innerWidth * dpr, window.innerHeight * dpr);
  }

  /* ============================ API ============================ */

  onLabels(fn) { this._labelsFn = fn; }
  onFirstFrame(fn) {
    this._onFirstFrame = fn;
    if (this._hasRendered) fn();
  }
  getPointerScreen() { return this._pointerScreen; }
  getHoveredId() { return this._hoveredSys ? this._hoveredSys.project.id : null; }
  getZoom() { return this._radius; }
  onMoonLabels(fn) { this._moonLabelsFn = fn; }
  onConstellationLabels(fn) { this._constLabelsFn = fn; }
  onArchiveLabels(fn) { this._archiveLabelsFn = fn; }
  onEnter(fn) { this._onEnter = fn; }
  onExit(fn) { this._onExit = fn; }
  depart() { if (this.mode !== "idle") return; this.mode = "galaxy"; this._radius = 26; }
  enterProject(id) {
    if (this.mode !== "galaxy" && this.mode !== "idle") return;
    if (this.mode === "idle") this.mode = "galaxy";
    const sys = this.systems.find(s => s.project.id === id);
    if (!sys) return;
    this.mode = "travel"; this.active = sys;
    this._tStart = this.clock.getElapsedTime();
    this._fromPos = this.camPos.clone(); this._fromLook = this.camLook.clone(); this._fromFov = this.camera.fov;
    this._populateProjectWorld(sys.project);
    this._fovTarget = 36;
  }
  exitProject() {
    if (this.mode !== "project") return;
    this.mode = "return";
    this._tStart = this.clock.getElapsedTime();
    this._fromPos = this.camPos.clone(); this._fromLook = this.camLook.clone(); this._fromFov = this.camera.fov;
    this._fovTarget = 52;
    if (this._onExit) this._onExit();
  }

  /* ============================ LOOP ============================ */

  _loop() {
    if (this._paused) { requestAnimationFrame(this._loop); return; }
    requestAnimationFrame(this._loop);
    const elapsed = this.clock.getElapsedTime();
    const t = this.reducedMotion ? 0 : elapsed;
    const dt = this.reducedMotion ? 0 : Math.min(this.clock.getDelta(), 0.05);

    this.starfield.material.uniforms.uTime.value = t;
    this.dust.material.uniforms.uTime.value = t;
    this.galaxy.material.uniforms.uTime.value = t;
    this.galaxyDust.material.uniforms.uTime.value = t;
    this.darkDust.material.uniforms.uTime.value = t;
    this.foregroundDust.material.uniforms.uTime.value = t;
    this.planetMat.uniforms.uTime.value = t;
    this.gradePass.uniforms.uTime.value = t;

    // Rotação praticamente congelada — a galáxia respira, não gira
    const rotSpeed = 0.0002 + Math.sin(t * 0.02) * 0.00003;
    this.galaxy.rotation.y += dt * rotSpeed;
    this.galaxyDust.rotation.y += dt * rotSpeed * 0.85;
    this.darkDust.rotation.y += dt * rotSpeed * 0.9;
    this.dust.rotation.y += dt * 0.0006;
    this.archiveGroup.rotation.y += dt * 0.0008;
    // Respiração ultra-lenta e profunda
    const galBreath = 1 + (Math.sin(t * 0.015) * 0.5 + Math.sin(t * 0.04 + 1.3) * 0.3 + Math.sin(t * 0.08 + 2.7) * 0.15) * 0.003;
    this.galaxy.scale.set(galBreath, galBreath, galBreath);
    this.galaxyDust.scale.setScalar(galBreath * 0.998);
    this.darkDust.scale.setScalar(galBreath * 0.999);
    // Glows do núcleo: respiram suavemente — energia difusa
    const haloBreath = 1 + (Math.sin(t * 0.05) * 0.5 + Math.sin(t * 0.12 + 1.7) * 0.3) * 0.035;
    this.coreGlows.forEach((sp, i) => {
      const breath = 1 + (Math.sin(t * (0.04 + i * 0.01)) * 0.5 + Math.sin(t * (0.1 + i * 0.02) + 1.7) * 0.3) * 0.03;
      sp.scale.set(sp.userData.baseScale * breath, sp.userData.baseScale * breath, 1);
      const centerBoost = this._centerHovered ? (i === 0 ? 1.16 : 1.08) : 1.0;
      sp.material.opacity = damp(sp.material.opacity, sp.userData.baseOp * centerBoost * (0.85 + (Math.sin(t * (0.05 + i * 0.02)) * 0.5 + Math.sin(t * (0.13 + i * 0.03) + 2.1) * 0.3) * 0.12), 4, dt);
    });
    // Nebulosa volumétrica: respira suavemente
    this.nebulaSprites.children.forEach((sp, i) => {
      const breath = 1 + (Math.sin(t * 0.04 + sp.userData.phase) * 0.5 + Math.sin(t * 0.1 + sp.userData.phase * 1.7) * 0.3) * 0.04;
      sp.scale.set(sp.userData.baseScale * breath, sp.userData.baseScale * breath, 1);
      sp.material.opacity = sp.userData.baseOp * (0.8 + (Math.sin(t * 0.06 + sp.userData.phase) * 0.5 + Math.sin(t * 0.14 + sp.userData.phase * 2) * 0.3) * 0.15);
    });

    this.nebulae.forEach((n, i) => {
      // Respiração orgânica: 2 oitavas
      const breath = 1 + (Math.sin(t * 0.05 + n.userData.phase) * 0.5 + Math.sin(t * 0.12 + n.userData.phase * 1.7) * 0.3) * 0.025;
      n.scale.set(n.userData.baseScale * breath, n.userData.baseScale * breath, 1);
      n.material.opacity = n.userData.baseOp * (0.85 + (Math.sin(t * 0.07 + n.userData.phase) * 0.5 + Math.sin(t * 0.15 + n.userData.phase * 2) * 0.3) * 0.12);
      // Oscilação senoidal em torno da posição base — simples e performático
      n.position.x = n.userData.baseX + Math.sin(t * 0.03 + n.userData.phase) * 1.2;
      n.position.z = n.userData.baseZ + Math.cos(t * 0.025 + n.userData.phase * 1.3) * 0.8;
    });
    this.nebulaGroup.rotation.y += dt * 0.0008;

    // Hover raycast — throttle + early-out se mouse parado
    this._raycastTimer = (this._raycastTimer || 0) + dt;
    const mouseMoved = this.pointerTarget.distanceTo(this._lastPointer || this.pointerTarget) > 0.001;
    if (this._raycastTimer > 0.05 && (mouseMoved || !this._lastPointer)) {
      this._raycastTimer = 0;
      this._lastPointer = this.pointerTarget.clone();
      if (this.mode === "galaxy" || this.mode === "idle") this._hoverRaycast();
    }

    this.systems.forEach(sys => {
      // Velocidade orbital que varia organicamente — não é constante
      const orbitSpeedVar = sys.orbitSpeed * (1 + Math.sin(t * 0.02 + sys.index) * 0.08);
      sys.orbitAngle += dt * orbitSpeedVar;
      // Órbita levemente elíptica
      const ecc = 0.05;
      const x = Math.cos(sys.orbitAngle) * sys.orbitRadius * (1 + ecc * Math.cos(sys.orbitAngle));
      const z = Math.sin(sys.orbitAngle) * sys.orbitRadius * (1 - ecc * Math.cos(sys.orbitAngle));
      sys.group.position.set(x, 0, z);
      sys.worldPos.copy(sys.group.position);
      sys.orbs.forEach(o => {
        const a = t * o.speed + o.phase;
        // Órbita elíptica natural — não é círculo perfeito
        const ecc = 0.15; // excentricidade
        o.mesh.position.set(
          Math.cos(a) * o.r * (1 + ecc * Math.cos(a)),
          Math.sin(a * 0.6) * 0.03 + Math.sin(a * 1.3) * 0.01,
          Math.sin(a) * o.r * (1 - ecc * Math.cos(a))
        );
      });
      if (sys.sprite) {
        // Pulsação orgânica: 3 oitavas, lenta, cada sol na sua fase
        const phase = sys.index * 2.3;
        const pulse = 1 + (Math.sin(t * 0.3 + phase) * 0.5 + Math.sin(t * 0.7 + phase * 1.7) * 0.3 + Math.sin(t * 0.13 + phase * 0.5) * 0.2) * 0.03;
        const hoverBoost = (sys === this._hoveredSys) ? 2.0 : 1.0;
        const targetOp = 0.18 * hoverBoost;
        sys.sprite.material.opacity = damp(sys.sprite.material.opacity, targetOp, 3, dt);
        const targetSpriteScale = 2.2 * pulse * hoverBoost;
        const spriteScale = damp(sys.sprite.scale.x, targetSpriteScale, 4, dt);
        sys.sprite.scale.set(spriteScale, spriteScale, 1);
        sys.sun.scale.setScalar(damp(sys.sun.scale.x, sys === this._hoveredSys ? 1.35 : 1.0, 3, dt));
        // Corona: respira mais devagar, independente
        if (sys.corona) {
          const coronaPulse = 1 + (Math.sin(t * 0.15 + phase * 1.3) * 0.5 + Math.sin(t * 0.37 + phase * 2.1) * 0.3) * 0.04;
          const targetCoronaScale = 4.5 * coronaPulse * hoverBoost;
          const coronaScale = damp(sys.corona.scale.x, targetCoronaScale, 3, dt);
          sys.corona.scale.set(coronaScale, coronaScale, 1);
          sys.corona.material.opacity = damp(sys.corona.material.opacity, 0.06 * hoverBoost, 2, dt);
        }
        if (sys.light) sys.light.intensity = damp(sys.light.intensity, sys === this._hoveredSys ? 0.55 : 0.2, 3, dt);
      }
    });

    // Núcleo: pulsação muito suave — energia sutil + boost no hover
    const corePulse = (Math.sin(t * 0.08) * 0.5 + Math.sin(t * 0.19 + 1.3) * 0.3 + Math.sin(t * 0.04 + 2.7) * 0.15) * 0.02;
    const hoverBoost = this._centerHovered ? 0.08 : 0;
    this.coreLight.intensity = damp(this.coreLight.intensity, 0.12 + corePulse + hoverBoost, 3, dt);
    // Cor neutra — branco acinzentado suave
    const coreColorPhase = (Math.sin(t * 0.06) + 1) * 0.5;
    this.coreLight.color.setRGB(
      0.62 + coreColorPhase * 0.03,
      0.63 + coreColorPhase * 0.02,
      0.68 - coreColorPhase * 0.03
    );

    if (this.projectWorld.visible) {
      // Planeta gira lento e constante
      this.heroPlanet.rotation.y += dt * 0.018;
      this.moons.forEach((m, i) => {
        const a = t * m.speed + m.phase;
        // Órbita elíptica natural com inclinação
        const ecc = 0.12;
        m.mesh.position.set(
          Math.cos(a) * m.radius * (1 + ecc * Math.cos(a)),
          Math.sin(a * 0.7) * m.tilt + Math.sin(a * 1.3) * 0.015,
          Math.sin(a) * m.radius * (1 - ecc * Math.cos(a))
        );
        m.mesh.rotation.y += dt * 0.08;
        m.worldPos.copy(m.mesh.position).add(this.projectWorld.position);
        // Highlight ao hover
        const isHovered = this._moonHover === i;
        const targetScale = isHovered ? 1.5 : 1.0;
        const curScale = m.mesh.scale.x;
        const newScale = damp(curScale, targetScale, 4, dt);
        m.mesh.scale.setScalar(newScale);
        if (m.mesh.material && m.mesh.material.emissive) {
          const targetEmissive = isHovered ? 0x1a1a2a : 0x040406;
          m.mesh.material.emissive.lerp(new THREE.Color(targetEmissive), 0.1);
        }
      });
      this.constellation.rotation.y += dt * 0.003;
    }

    this.pointer.x = damp(this.pointer.x, this.pointerTarget.x, 1.8, dt);
    this.pointer.y = damp(this.pointer.y, this.pointerTarget.y, 1.8, dt);
    this._yaw += this._yawVel;
    this._pitch = THREE.MathUtils.clamp(this._pitch + this._pitchVel, 0.12, 0.8);
    // Inércia: decai mais devagar, parece física real
    this._yawVel = damp(this._yawVel, 0, 0.8, dt);
    this._pitchVel = damp(this._pitchVel, 0, 0.8, dt);

    this._fov = damp(this._fov, this._fovTarget, 1.8, dt);
    this.camera.fov = this._fov;
    this.camera.updateProjectionMatrix();

    if (this.mode === "idle" || this.mode === "galaxy") this._camGalaxy(t, dt);
    else if (this.mode === "travel") this._camTravel(t);
    else if (this.mode === "project") this._camProject(t, dt);
    else if (this.mode === "return") this._camReturn(t);

    if (this._labelsFn) this._labelsFn(this.mode === "galaxy" ? this.systems : []);
    if (this._moonLabelsFn) this._moonLabelsFn(this.mode === "project" ? this.moons : []);
    if (this._constLabelsFn) this._constLabelsFn(this.mode === "project" ? (this.active ? this.active.project.constellation : []) : [], this._constellationStars);
    if (this._archiveLabelsFn) {
      this._archiveLabelsFn(
        this.mode === "galaxy" || this.mode === "idle" ? this.archiveStars : []
      );
    }

    this.composer.render();
    if (!this._hasRendered) {
      this._hasRendered = true;
      this._onFirstFrame?.();
    }
  }

  _organicOffset(t) {
    // Múltiplas oitavas de seno — simula ruído Perlin, movimento natural
    const o1x = Math.sin(t * 0.07) * 0.5 + Math.sin(t * 0.13 + 1.3) * 0.3 + Math.sin(t * 0.31 + 2.7) * 0.15;
    const o1y = Math.sin(t * 0.05 + this._breathPhase) * 0.5 + Math.sin(t * 0.11 + 0.7) * 0.3 + Math.sin(t * 0.27 + 1.9) * 0.15;
    const o1z = Math.cos(t * 0.09) * 0.5 + Math.cos(t * 0.17 + 2.1) * 0.3 + Math.cos(t * 0.23 + 0.4) * 0.15;
    return { x: o1x * 0.12, y: o1y * 0.18, z: o1z * 0.08 };
  }

  _camGalaxy(t, dt) {
    if (this.reducedMotion) {
      const yaw = this._yaw, pitch = this._pitch, r = this._radius;
      this._introT = 1;
      this.camPos.set(
        Math.sin(yaw) * Math.cos(pitch) * r,
        Math.sin(pitch) * r * 0.95 + 2.0,
        Math.cos(yaw) * Math.cos(pitch) * r
      );
      this.camLook.set(0, 0, 0);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      this.camera.fov = this._fovTarget;
      this.camera.updateProjectionMatrix();
      return;
    }
    // Intro: câmera vem de longe e aproxima
    if (this._introT < 1) {
      this._introT = Math.min(1, this._introT + dt / this._introDur);
    }
    const introEase = easeOrganic(this._introT);
    // FOV desacelera no final — não há salto abrupto
    const fovEase = introEase * introEase * (3 - 2 * introEase);
    const introRadius = lerp(60, this._radius, introEase);
    const introFov = lerp(75, this._fov, fovEase);
    this.camera.fov = introFov;
    this.camera.updateProjectionMatrix();

    const yaw = this._yaw + this.pointer.x * 0.12, pitch = this._pitch + this.pointer.y * 0.06, r = introRadius;
    const org = this._organicOffset(t);
    const tx = Math.sin(yaw) * Math.cos(pitch) * r + org.x;
    const tz = Math.cos(yaw) * Math.cos(pitch) * r + org.z;
    const ty = Math.sin(pitch) * r * 0.95 + 2.0 + org.y;
    // Damping mais lento — flutua como no espaço
    this.camPos.x = damp(this.camPos.x, tx, 0.7, dt);
    this.camPos.y = damp(this.camPos.y, ty, 0.7, dt);
    this.camPos.z = damp(this.camPos.z, tz, 0.7, dt);
    this.camLook.x = damp(this.camLook.x, 0, 1.0, dt);
    this.camLook.y = damp(this.camLook.y, 0, 1.0, dt);
    this.camLook.z = damp(this.camLook.z, 0, 1.0, dt);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  _camTravel(t) {
    const e = t - this._tStart, dur = 6.0;
    const k = this.reducedMotion ? 1 : Math.min(1, e / dur);
    const ease = this.reducedMotion ? 1 : easeOrganic(k);
    this.projectWorld.visible = true;
    this.projectWorld.position.copy(this.active.worldPos);
    const dest = this.active.worldPos.clone();
    const toPos = dest.clone().add(new THREE.Vector3(0, 0.7, 11.5));
    const toLook = dest.clone();
    this.camPos.lerpVectors(this._fromPos, toPos, ease);
    this.camLook.lerpVectors(this._fromLook, toLook, ease);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    // FOV transiciona suavemente para o do projeto
    this.camera.fov = THREE.MathUtils.lerp(this._fromFov, 36, ease);
    this.camera.updateProjectionMatrix();
    // Galáxia fade out com curva suave (não linear)
    const fade = 1 - ease;
    const fadeSoft = fade * fade * (3 - 2 * fade); // smoothstep
    this.galaxy.material.opacity = fadeSoft;
    this.galaxyDust.material.opacity = fadeSoft;
    this.darkDust.material.opacity = fadeSoft;
    this.foregroundDust.material.opacity = fadeSoft;
    this.coreGlows.forEach(sp => sp.material.opacity = sp.userData.baseOp * fadeSoft);
    this.nebulaSprites.children.forEach(sp => sp.material.opacity = sp.userData.baseOp * fadeSoft);
    this.dust.material.opacity = fadeSoft;
    this.starfield.material.opacity = fade;
    this.nebulae.forEach(n => n.material.opacity = n.userData.baseOp * fadeSoft);
    this.systemsGroup.children.forEach(c => { c.traverse(o => { if (o.material && o.material.opacity !== undefined) { o.userData.baseOp ??= o.material.opacity; o.material.opacity = o.userData.baseOp * fade; } }); });
    // Planeta fade in — começa invisível e aparece gradualmente
    const planetFade = ease;
    this.projectWorld.traverse(o => { if (o.material && o.material.opacity !== undefined) { if (o.userData.planetBaseOp === undefined) o.userData.planetBaseOp = o.material.opacity; o.material.opacity = o.userData.planetBaseOp * planetFade; } });
    if (k >= 1) {
      this.mode = "project";
      this.systemsGroup.visible = false;
      this.galaxy.visible = false;
      this.galaxyDust.visible = false;
      this.darkDust.visible = false;
      this.foregroundDust.visible = false;
      this.coreGlows.forEach(sp => sp.visible = false);
      this.nebulaSprites.visible = false;
      this.dust.visible = false;
      this.archiveGroup.visible = false;
      this.starfield.visible = false;
      this.nebulaGroup.visible = false;
      if (this._onEnter) this._onEnter(this.active.project);
    }
  }

  _camProject(t, dt) {
    const center = this.projectWorld.position.clone();
    // Órbita lenta e elíptica com offset orgânico
    const a = this.reducedMotion ? 0 : t * 0.015;
    const org = this.reducedMotion ? { x: 0, y: 0, z: 0 } : this._organicOffset(t);
    const orbitR = 11.5;
    const ecc = 0.08;
    const toPos = center.clone().add(new THREE.Vector3(
      Math.sin(a) * orbitR * (1 + ecc * Math.cos(a)) + org.x,
      0.7 + org.y + Math.sin(a * 0.5) * 0.3,
      Math.cos(a) * orbitR * (1 - ecc * Math.cos(a)) + org.z
    ));
    const toLook = center.clone();
    // Damping suave — flutua como no espaço
    if (this.reducedMotion) {
      this.camPos.copy(toPos);
      this.camLook.copy(toLook);
    } else {
      this.camPos.x = damp(this.camPos.x, toPos.x, 0.6, dt);
      this.camPos.y = damp(this.camPos.y, toPos.y, 0.6, dt);
      this.camPos.z = damp(this.camPos.z, toPos.z, 0.6, dt);
      this.camLook.x = damp(this.camLook.x, toLook.x, 1.0, dt);
      this.camLook.y = damp(this.camLook.y, toLook.y, 1.0, dt);
      this.camLook.z = damp(this.camLook.z, toLook.z, 1.0, dt);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
  }

  _camReturn(t) {
    const e = t - this._tStart, dur = 5.5;
    const k = this.reducedMotion ? 1 : Math.min(1, e / dur);
    const ease = this.reducedMotion ? 1 : easeOrganic(k);
    // Galáxia e fundo reaparecem gradualmente
    this.systemsGroup.visible = true;
    this.galaxy.visible = true;
    this.galaxyDust.visible = true;
    this.darkDust.visible = true;
    this.foregroundDust.visible = true;
    this.coreGlows.forEach(sp => sp.visible = true);
    this.nebulaSprites.visible = true;
    this.dust.visible = true;
    this.archiveGroup.visible = true;
    this.starfield.visible = true;
    this.nebulaGroup.visible = true;
    // Fade in da galáxia — smoothstep para entrada suave
    const fade = ease;
    const fadeSoft = fade * fade * (3 - 2 * fade);
    this.galaxy.material.opacity = fadeSoft;
    this.galaxyDust.material.opacity = fadeSoft;
    this.darkDust.material.opacity = fadeSoft;
    this.foregroundDust.material.opacity = fadeSoft;
    this.coreGlows.forEach(sp => sp.material.opacity = sp.userData.baseOp * fadeSoft);
    this.nebulaSprites.children.forEach(sp => sp.material.opacity = sp.userData.baseOp * fadeSoft);
    this.dust.material.opacity = fadeSoft;
    this.starfield.material.opacity = fade;
    this.nebulae.forEach(n => n.material.opacity = n.userData.baseOp * fadeSoft);
    this.systemsGroup.children.forEach(c => { c.traverse(o => { if (o.material && o.userData.baseOp !== undefined) o.material.opacity = o.userData.baseOp * fade; }); });
    // Fade out do projectWorld (planeta) — some gradualmente
    const planetFade = 1 - ease;
    if (this.projectWorld.visible) {
      this.projectWorld.traverse(o => { if (o.material && o.material.opacity !== undefined) { if (o.userData.planetBaseOp === undefined) o.userData.planetBaseOp = o.material.opacity; o.material.opacity = o.userData.planetBaseOp * planetFade; } });
    }
    // FOV restaura suavemente
    this.camera.fov = THREE.MathUtils.lerp(this._fromFov, this._fov, ease);
    this.camera.updateProjectionMatrix();
    // Câmera viaja de volta
    const yaw = this._yaw, pitch = this._pitch, r = this._radius;
    const toPos = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch) * r, Math.sin(pitch) * r * 0.95 + 2.0, Math.cos(yaw) * Math.cos(pitch) * r);
    const toLook = new THREE.Vector3(0, 0, 0);
    this.camPos.lerpVectors(this._fromPos, toPos, ease);
    this.camLook.lerpVectors(this._fromLook, toLook, ease);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (k >= 1) {
      this.projectWorld.visible = false;
      // Resetar opacidades do projectWorld para próxima vez
      this.projectWorld.traverse(o => { if (o.material && o.userData.planetBaseOp !== undefined) { o.material.opacity = o.userData.planetBaseOp; delete o.userData.planetBaseOp; } });
      this.mode = "galaxy";
      this.active = null;
    }
  }

  projectToScreen(v) {
    const p = this._projectVector.copy(v).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, behind: p.z > 1 };
  }

  destroy() {
    this._paused = true;
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => { m.map?.dispose(); m.dispose(); });
        else { o.material.map?.dispose(); o.material.dispose(); }
      }
    });
    this.composer?.dispose?.();
    this.renderer.dispose();
    if (this.renderer.domElement?.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
  }
}
