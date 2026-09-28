// ============================================================
// Universe: renderer, pós-processamento, qualidade adaptativa
// e o loop. Recebe o progresso do scroll de fora (setProgress).
// ============================================================
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { PROJECTS } from "../data.js";
import { buildGalaxy } from "./galaxy.js";
import { buildSky } from "./sky.js";
import { buildSystems } from "./systems.js";
import { buildPath, dwell } from "./path.js";

// Lente: aberração cromática leve nas bordas, vinheta e grão de filme.
const LensShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAspect; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
      vec2 off = c * r2 * 0.0025;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col *= mix(1.0, 0.45, smoothstep(0.2, 1.1, r2));
      col *= 1.0 + (h(vUv * 800.0 + fract(uTime) * 91.0) - 0.5) * 0.05;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export class Universe {
  constructor(root, { onFirstFrame, onFrame } = {}) {
    this.root = root;
    this.mobile = window.matchMedia("(max-width: 820px), (pointer: coarse)").matches;
    this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.onFirstFrame = onFirstFrame;
    this.onFrame = onFrame;
    this.progress = 0;       // alvo vindo do scroll
    this.smooth = 0;         // progresso amortecido que a câmera usa
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this._last = performance.now();
    this._elapsed = 0;
    this.maxPR = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.5 : 2);
    this.pr = this.maxPR;
    this._frameTimes = [];

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: false });
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setClearColor(0x010207, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    root.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.01, 2000);

    this.sky = buildSky(this.renderer, { count: this.mobile ? 7000 : 16000 });
    this.galaxy = buildGalaxy(this.renderer, { count: this.mobile ? 60000 : 140000, mobile: this.mobile });
    this.scene.add(this.sky.group, this.galaxy.group);

    this.systems = buildSystems(PROJECTS, { reduced: this.reduced });
    this.systems.systems.forEach((s) => this.galaxy.group.add(s.group));
    this.path = buildPath(this.systems.systems, this.mobile);
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();

    this._initPost();
    this._resize = this._resize.bind(this);
    addEventListener("resize", this._resize);
    addEventListener("pointermove", (e) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) this._last = performance.now(); });
    this._resize();
    this._loop = this._loop.bind(this);
    this.renderer.setAnimationLoop(this._loop);
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.75, 0.55, 0.68);
    this.composer.addPass(this.bloom);
    this.lens = new ShaderPass(LensShader);
    this.composer.addPass(this.lens);
    this.composer.addPass(new OutputPass());
  }

  _resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pr);
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(this.pr);
    this.composer.setSize(w, h);
    this.lens.uniforms.uAspect.value = w / h;
    this.galaxy.setPixelScale(h, this.pr);
    this.sky.setPixelRatio(this.pr);
  }

  // Qualidade adaptativa: se o FPS cair, reduz a resolução interna.
  _adapt(dt) {
    this._frameTimes.push(dt);
    if (this._frameTimes.length < 90) return;
    const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
    this._frameTimes.length = 0;
    if (avg > 1 / 45 && this.pr > 1) {
      this.pr = Math.max(1, this.pr - 0.25);
      this._resize();
    } else if (avg < 1 / 58 && this.pr < this.maxPR) {
      this.pr = Math.min(this.maxPR, this.pr + 0.25);
      this._resize();
    }
  }

  setProgress(p) { this.progress = p; }

  // Bolha sem estrelas em volta do sistema mais próximo da câmera.
  _focus(p) {
    let best = 0, bi = -1;
    this.path.stops.forEach((s, i) => {
      if (!s.sys) return;
      const w = THREE.MathUtils.clamp(1 - Math.abs(p - i) * 1.15, 0, 1);
      if (w > best) { best = w; bi = i; }
    });
    if (bi < 0) return this.galaxy.setFocus(this._pos, 0);
    this.galaxy.setFocus(this.path.stops[bi].sys.group.position, 5.5 * best);
  }

  // Projeta um ponto do mundo na tela (px). z > 1 = atrás da câmera.
  project(world, out = {}) {
    this._proj ??= new THREE.Vector3();
    this._proj.copy(world).project(this.camera);
    out.x = (this._proj.x * 0.5 + 0.5) * innerWidth;
    out.y = (-this._proj.y * 0.5 + 0.5) * innerHeight;
    out.z = this._proj.z;
    out.dist = this.camera.position.distanceTo(world);
    return out;
  }

  _loop() {
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 0.1);
    this._last = now;
    const t = (this._elapsed += dt);
    this._adapt(dt);

    // amortecimento independente de FPS
    const k = this.reduced ? 1 : 1 - Math.exp(-dt * 4.5);
    this.smooth += (this.progress - this.smooth) * k;
    this.pointerSmooth.lerp(this.pointer, this.reduced ? 0 : 1 - Math.exp(-dt * 2.5));

    const anim = this.reduced ? 0 : t;
    // a galáxia gira como corpo rígido, bem devagar
    this.galaxy.group.rotation.y = anim * 0.004;
    this.galaxy.group.updateMatrixWorld();
    this.systems.update(anim, this.camera);
    this.path.update();
    this._focus(this.smooth);

    const p = dwell(this.smooth);
    this.camera.fov = this.path.sample(p, this._pos, this._look);
    this.camera.updateProjectionMatrix();

    // flutuação sutil + parallax do ponteiro, proporcionais à distância do alvo
    const amp = this.reduced ? 0 : this._pos.distanceTo(this._look) * 0.02;
    this._pos.x += (Math.sin(t * 0.13) * 0.4 + this.pointerSmooth.x) * amp;
    this._pos.y += (Math.sin(t * 0.11 + 1.3) * 0.3 + this.pointerSmooth.y * 0.6) * amp;
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);

    this.sky.update(this.camera);
    this.galaxy.update(anim, this.camera);
    this.lens.uniforms.uTime.value = t;
    this.composer.render(dt);
    this.onFrame?.(this);

    if (this.onFirstFrame) { const f = this.onFirstFrame; this.onFirstFrame = null; requestAnimationFrame(f); }
  }
}
