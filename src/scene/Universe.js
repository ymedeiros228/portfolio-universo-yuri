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
import { buildDust } from "./dust.js";

// Lente: aberração cromática leve nas bordas, vinheta e grão de filme.
const LensShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 }, uTexel: { value: new THREE.Vector2(1, 1) }, uWarp: { value: 0 } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAspect; uniform vec2 uTexel; uniform float uWarp; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5;
      float r2 = dot(c * vec2(uAspect, 1.0), c * vec2(uAspect, 1.0));
      vec2 off = c * r2 * 0.0012;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // nitidez: realce de detalhe (unsharp mask) com os 4 vizinhos,
      // limitado para não criar halos em volta das estrelas
      vec3 nb = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.)).rgb + texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.)).rgb
              + texture2D(tDiffuse, vUv + vec2(0., uTexel.y)).rgb + texture2D(tDiffuse, vUv - vec2(0., uTexel.y)).rgb;
      // menos realce no que já é muito brilhante (estrelas): evita cintilação
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col += clamp((col - nb * 0.25) * 0.4, -0.05, 0.05) * (1.0 - smoothstep(0.35, 0.9, lum));
      col = max(col, 0.0);
      // salto de hiperespaço: desfoque radial (a luz "estica" a partir do centro)
      if (uWarp > 0.002) {
        vec3 acc = vec3(0.0);
        for (int i = 0; i < 12; i++) {
          float k = float(i) / 12.0;
          acc += texture2D(tDiffuse, vUv - c * k * uWarp * 0.16).rgb;
        }
        col = mix(col, acc / 12.0 * (1.0 + uWarp * 0.6), clamp(uWarp * 1.6, 0.0, 1.0));
      }
      col *= mix(1.0, 0.45, smoothstep(0.2, 1.1, r2));
      col *= 1.0 + (h(vUv * 800.0 + fract(uTime * 0.25) * 91.0) - 0.5) * 0.018;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// Rede de segurança: pixel inválido (NaN/infinito) vira preto ANTES do bloom.
// Sem isso, um único NaN é espalhado pelo desfoque do bloom e apaga a tela inteira.
const SanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      bool bad = any(notEqual(c, c)) || any(greaterThan(abs(c), vec4(65000.0)));
      gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : min(c, vec4(64.0));
    }
  `,
};

const UP = new THREE.Vector3(0, 1, 0);

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
    // modo leve: celulares e máquinas modestas (poucos núcleos ou pouca memória)
    const cores = navigator.hardwareConcurrency || 8, mem = navigator.deviceMemory || 8;
    this.lite = this.mobile || cores <= 4 || mem <= 4;
    const dpr = window.devicePixelRatio || 1;
    // desktop forte: até 1.5× acima da tela (supersampling = bordas nítidas).
    // Leve: até 1.5× (numa tela DPR 3 já é 4× menos pixels que o nativo).
    // Piso de 1×: abaixo disso a cena fica visivelmente borrada.
    this.maxPR = this.lite ? Math.min(dpr, 1.5) : Math.min(2, Math.max(1.5, dpr));
    this.minPR = 1;
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

    this.sky = buildSky(this.renderer, { count: this.lite ? 7000 : 16000 });
    this.galaxy = buildGalaxy(this.renderer, { count: this.lite ? 50000 : 140000, mobile: this.mobile, lite: this.lite });
    this.dust = buildDust({ count: this.lite ? 500 : 1400, reduced: this.reduced });
    this.scene.add(this.sky.group, this.galaxy.group, this.dust.group);

    this.systems = buildSystems(PROJECTS, { reduced: this.reduced, lite: this.lite });
    this.systems.systems.forEach((s) => this.galaxy.group.add(s.group));
    this.path = buildPath(this.systems.systems, this.mobile);
    this._pos = new THREE.Vector3();
    this._tmpV = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._right = new THREE.Vector3();
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

  // Passa o loop para um relógio externo (o ticker do GSAP que move o Lenis):
  // scroll e 3D no mesmo quadro, sem um quadro de atraso entre eles.
  useExternalLoop(add) {
    this.renderer.setAnimationLoop(null);
    add(this._loop);
  }

  _initPost() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new ShaderPass(SanitizeShader));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.32, 0.74);
    if (this.lite) {
      // brilho é borrado por natureza: calculado em meia resolução, fica igual e custa 1/4
      const setSize = this.bloom.setSize.bind(this.bloom);
      this.bloom.setSize = (w, h) => setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
    }
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
    this.lens.uniforms.uTexel.value.set(1 / (w * this.pr), 1 / (h * this.pr));
    this.galaxy.setPixelScale(h, this.pr);
    this.sky.setPixelRatio(this.pr);
    this.dust.setPixelScale(h, this.pr);
  }

  // Qualidade adaptativa: só REDUZ a resolução, e só com travamento de verdade
  // (< 40 FPS por ~1.5 s seguidos). Engasgos isolados (troca de aba,
  // carregamento) são ignorados e nunca há sobe-e-desce — cada troca de
  // resolução é um "pulo" visível.
  _adapt(dt) {
    if (dt >= 0.1 || document.hidden) { this._frameTimes.length = 0; return; }
    this._frameTimes.push(dt);
    if (this._frameTimes.length < 30) return;
    const avg = this._frameTimes.reduce((a, b) => a + b, 0) / this._frameTimes.length;
    this._frameTimes.length = 0;
    this._slow = avg > 1 / 40 ? (this._slow || 0) + 1 : 0;
    if (this._slow >= 3 && this.pr > this.minPR) {
      this._slow = 0;
      this.pr = Math.max(this.minPR, this.pr - 0.25);
      this._resize();
    }
  }

  setProgress(p) { this.progress = p; }

  // Abertura: a câmera nasce dentro do núcleo (tudo luz) e recua em espiral
  // até a vista geral; os planetas surgem um a um no caminho.
  startIntro(duration = 4.6) {
    if (this.reduced) return;
    this.intro = { start: performance.now(), dur: duration };
    this.systems.systems.forEach((s) => s.group.scale.setScalar(0.001));
  }

  _applyIntro(now) {
    const it = this.intro;
    const t = Math.min(1, (now - it.start) / 1000 / it.dur);
    const e = t === 1 ? 1 : 1 - Math.pow(2, -9 * t); // expo out: arranque rápido, pouso longo
    // distância ao alvo cresce de forma exponencial (sensação de "sair" do núcleo)
    this._iv ??= new THREE.Vector3();
    const d1 = this._pos.distanceTo(this._look);
    const d0 = 2.2;
    this._iv.subVectors(this._pos, this._look).normalize();
    this._iv.applyAxisAngle(UP, (1 - e) * 1.6); // espiral: gira enquanto recua
    const d = d0 * Math.pow(d1 / d0, e);
    this._pos.copy(this._look).addScaledVector(this._iv, d);
    this._look.multiplyScalar(e); // começa olhando o centro exato do núcleo
    // exposição: começa estourada (dentro da luz) e assenta
    this.renderer.toneMappingExposure = 0.9 + Math.pow(1 - e, 2) * 4.0;
    // planetas surgem em sequência, com um leve "pop"
    this.systems.systems.forEach((s, i) => {
      const k = THREE.MathUtils.clamp((t - 0.32 - i * 0.07) / 0.28, 0, 1);
      const back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // easeOutBack
      s.group.scale.setScalar(Math.max(0.001, k === 0 ? 0 : back));
    });
    if (t >= 1) {
      this.intro = null;
      this.renderer.toneMappingExposure = 0.9;
      this.systems.systems.forEach((s) => s.group.scale.setScalar(1));
    }
    return e;
  }

  // Voo direto até uma parada (cliques na navegação): a câmera sai de onde
  // está e faz um arco até o destino, sem passar pelas paradas do meio.
  // Cliques seguidos emendam a partir da posição atual — nunca há salto.
  flyTo(index, duration) {
    const from = { pos: this.camera.position.clone(), look: this._look.clone(), fov: this.camera.fov };
    if (this.travel) from.look.copy(this._look);
    this.travel = { index, t: 0, dur: duration, from, start: performance.now() };
    return duration;
  }

  // Bolha sem estrelas em volta do sistema mais próximo da câmera.
  _focus(p) {
    // as duas paradas de planeta mais próximas ganham cada uma sua bolha,
    // com raio proporcional à proximidade: sem troca brusca entre planetas
    const near = [];
    this.path.stops.forEach((s, i) => {
      if (!s.sys) return;
      const w = THREE.MathUtils.clamp(1 - Math.abs(p - i) * 1.15, 0, 1);
      if (w > 0) near.push([w, s.sys.group.position]);
    });
    near.sort((a, b) => b[0] - a[0]);
    const [a, b] = near;
    if (!a) return this.galaxy.setFocus(this._pos, 0);
    this.galaxy.setFocus(a[1], 5.5 * a[0], b && b[1], b ? 5.5 * b[0] : 0);
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
    // modo leve em tela de 120 Hz ou mais: pula quadros que chegam em menos
    // de 10 ms — 120 Hz vira 60 (metade do trabalho da GPU e menos aquecimento),
    // 90 Hz e 60 Hz ficam intactos. A rolagem da página segue na taxa da tela.
    if (this.lite && now - this._last < 10) return;
    const dt = Math.min((now - this._last) / 1000, 0.1);
    this._last = now;
    const t = (this._elapsed += dt);
    this._adapt(dt);

    // amortecimento independente de FPS
    const k = this.reduced ? 1 : 1 - Math.exp(-dt * 8); // o Lenis já suaviza; aqui só absorve saltos
    this.smooth += (this.progress - this.smooth) * k;
    this.pointerSmooth.lerp(this.pointer, this.reduced ? 0 : 1 - Math.exp(-dt * 2.5));

    const anim = this.reduced ? 0 : t;
    // a galáxia gira como corpo rígido, bem devagar
    this.galaxy.group.rotation.y = anim * 0.0012; // bem lento: os planetas quase não saem do lugar; a vida vem da torção diferencial
    this.galaxy.group.updateMatrixWorld();
    this.systems.update(anim, this.camera);
    this.path.update();
    this._focus(this.smooth);

    const p = dwell(this.smooth);
    let fov = this.path.sample(p, this._pos, this._look);
    const tr = this.travel;
    if (tr) {
      tr.t = Math.min(1, (now - tr.start) / 1000 / tr.dur); // pelo relógio, igual ao scroll do Lenis
      const e = tr.t < 0.5 ? 4 * tr.t ** 3 : 1 - (-2 * tr.t + 2) ** 3 / 2; // easeInOutCubic
      const s = this.path.stops[tr.index];
      this._tp ??= new THREE.Vector3();
      this.path.sample(tr.index, this._tp, this._look); // destino já com o planeta onde está agora
      const dist = tr.from.pos.distanceTo(this._tp);
      this._pos.lerpVectors(tr.from.pos, this._tp, e);
      this._pos.y += Math.sin(Math.PI * e) * dist * 0.16;
      this._look.lerpVectors(tr.from.look, this._look, e * e * (3 - 2 * e));
      this.path.avoid(this._pos);
      fov = THREE.MathUtils.lerp(tr.from.fov, s.fov, e);
      if (tr.t >= 1) { this.travel = null; this.smooth = tr.index; } // o scroll chega ao mesmo índice
    }
    if (this.intro) {
      const e = (this._introE = this._applyIntro(now));
      fov = THREE.MathUtils.lerp(72, fov, e); // lente abre no começo e fecha ao pousar
    }
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();

    // intensidade do "hiperespaço": forte no começo da abertura, nos voos
    // acompanha a velocidade; rolagem normal ganha só um toque
    let warp = (this._speed || 0) * 0.12;
    if (this.intro) warp = Math.max(warp, Math.pow(1 - this._introE, 1.4) * 1.1);
    if (this.travel) warp = Math.max(warp, Math.sin(Math.PI * this.travel.t) * 0.55);
    this._warp = THREE.MathUtils.lerp(this._warp || 0, this.reduced ? 0 : warp, 1 - Math.exp(-dt * 10));
    this.lens.uniforms.uWarp.value = this._warp;

    // encerramento: no Contato a câmera balança devagar em órbita da galáxia
    const endW = THREE.MathUtils.clamp(p - (this.path.count - 2), 0, 1);
    if (endW > 0 && !this.reduced) this._pos.applyAxisAngle(UP, endW * Math.sin(t * 0.045) * 0.45);

    // flutuação sutil + parallax do ponteiro, proporcionais à distância do alvo
    const amp = this.reduced ? 0 : this._pos.distanceTo(this._look) * 0.02;
    this._pos.x += (Math.sin(t * 0.13) * 0.4 + this.pointerSmooth.x) * amp;
    this._pos.y += (Math.sin(t * 0.11 + 1.3) * 0.3 + this.pointerSmooth.y * 0.6) * amp;

    // Movimento orgânico: o olhar segue o alvo com um leve atraso (inércia)
    // e a câmera inclina nas curvas, como uma nave, proporcional à velocidade lateral.
    this._lookS ??= this._look.clone();
    this._prev ??= this._pos.clone();
    this._vel ??= new THREE.Vector3();
    // salto (recarga no meio da página, atalho): encaixa direto, sem inércia nem inclinação
    const jump = this._pos.distanceTo(this._prev) > Math.max(2, this._pos.distanceTo(this._look) * 0.25);
    if (jump) { this._lookS.copy(this._look); this._vel.set(0, 0, 0); this._bank = 0; }
    this._lookS.lerp(this._look, this.reduced ? 1 : 1 - Math.exp(-dt * 6));
    if (dt > 0 && !jump) this._vel.lerp(this._tmpV.subVectors(this._pos, this._prev).divideScalar(dt), 1 - Math.exp(-dt * 4));
    this._prev.copy(this._pos);
    this.camera.position.copy(this._pos);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._lookS);
    this.camera.getWorldDirection(this._fwd);
    this._right.crossVectors(this._fwd, this.camera.up).normalize();
    const scale = Math.max(4, this._pos.distanceTo(this._look));
    const lateral = this._vel.dot(this._right) / scale;
    const bank = this.reduced ? 0 : THREE.MathUtils.clamp(-lateral * 0.35, -0.12, 0.12);
    this._bank = THREE.MathUtils.lerp(this._bank || 0, bank, 1 - Math.exp(-dt * 3));
    this.camera.rotateZ(this._bank);
    // velocidade normalizada (0..1) para a poeira de primeiro plano
    this._speed = THREE.MathUtils.lerp(this._speed || 0, Math.min(1, this._vel.length() / scale * 1.5), 1 - Math.exp(-dt * 3));

    this.sky.update(this.camera);
    this.galaxy.update(anim, this.camera);
    this.dust.update(t, dt, this.camera, this._speed);
    this.lens.uniforms.uTime.value = t;
    this.composer.render(dt);
    this.onFrame?.(this);

    if (this.onFirstFrame) { const f = this.onFirstFrame; this.onFirstFrame = null; requestAnimationFrame(f); }
  }
}
