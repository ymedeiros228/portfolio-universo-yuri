// ============================================================
// A galáxia: disco "fotográfico" assado na GPU + poeira +
// estrelas em partículas + estrelas brilhantes com difração.
// Tudo mora num grupo que gira como corpo rígido (Universe).
// ============================================================
import * as THREE from "three";
import { GALAXY, armAngle } from "../data.js";
import { bakeDiskGlow, bakeDiskDust, bakeCloud, glowTexture, spikeStarTexture } from "./textures.js";

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const gauss = (rand) => {
  const u = Math.max(1e-9, rand()), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform vec4 uFocus; // xyz: centro (local), w: raio da bolha livre de estrelas
  varying vec3 vColor;
  void main(){
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aSize * uScale / -mv.z;
    float tw = 0.85 + 0.15 * sin(uTime * (1.2 + aPhase * 2.0) + aPhase * 40.0);
    // perto demais da câmera: some antes de virar borrão
    float near = smoothstep(1.2, 4.0, -mv.z);
    // bolha de foco: abre espaço em volta do sistema visitado
    float bubble = uFocus.w > 0.0 ? smoothstep(uFocus.w * 0.45, uFocus.w, distance(position, uFocus.xyz)) : 1.0;
    // abaixo de 1px vira brilho proporcional (sem aliasing)
    vColor = aColor * tw * min(1.0, size * size) * near * bubble;
    gl_PointSize = clamp(size, 1.0, 4.5);
  }
`;

const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d) * 4.0;
    float a = exp(-r2 * 5.0);
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor * a, 1.0);
  }
`;

// Cor aproximada de estrela por "temperatura" 0 (fria/vermelha) .. 1 (quente/azul)
export function starColor(t, out) {
  const stops = [
    [1.0, 0.5, 0.24],
    [1.0, 0.7, 0.42],
    [1.0, 0.9, 0.78],
    [0.7, 0.8, 1.0],
    [0.45, 0.6, 1.0],
  ];
  const x = Math.min(0.999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x), f = x - i;
  for (let k = 0; k < 3; k++) out[k] = stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f;
  return out;
}

const _w = new THREE.Vector3();

export function buildGalaxy(renderer, { count, mobile }) {
  const group = new THREE.Group();
  const R = GALAXY.radius;
  const rand = rng(2026);
  const diskSize = R * 2 * 1.15;

  /* ---------- disco difuso (HDR) + poeira ----------
     Planos com a textura assada. Perto da câmera eles se dissolvem:
     de perto a textura viraria borrão, então o espaço fica limpo. */
  const planeMat = (map, { gain = 1, additive = true } = {}) => new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uGain: { value: gain } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vDist;
      void main(){
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDist = distance(wp.xyz, cameraPosition);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uGain; varying vec2 vUv; varying float vDist;
      void main(){
        vec4 t = texture2D(map, vUv);
        float fade = smoothstep(4.0, 17.0, vDist);
        ${additive ? "gl_FragColor = vec4(t.rgb * uGain * fade, 1.0);" : "gl_FragColor = vec4(t.rgb, t.a * fade);"}
      }
    `,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    transparent: true, depthWrite: false,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(diskSize, diskSize), planeMat(bakeDiskGlow(renderer, mobile ? 1536 : 2048), { gain: 0.55 }));
  glow.rotation.x = -Math.PI / 2;
  glow.renderOrder = 0;
  group.add(glow);

  const dust = new THREE.Mesh(new THREE.PlaneGeometry(diskSize, diskSize), planeMat(bakeDiskDust(renderer, mobile ? 1536 : 2048), { additive: false }));
  dust.rotation.x = -Math.PI / 2;
  dust.position.y = 0.04;
  dust.renderOrder = 2;
  group.add(dust);

  /* ---------- estrelas ----------
     Separadas em duas nuvens pelo plano do disco: as de baixo são
     desenhadas antes da poeira (ficam cobertas por ela), as de cima
     depois — assim a poeira nunca escurece o que está à frente dela. */
  const below = { pos: [], col: [], size: [], phase: [] };
  const above = { pos: [], col: [], size: [], phase: [] };
  const c = [0, 0, 0];
  const edge = (r) => 1 - THREE.MathUtils.smoothstep(r, R * 0.62, R * 1.04); // borda se dissolve

  for (let i = 0; i < count; i++) {
    const roll = rand();
    let x, y, z, temp, sz, bright, r;
    // brilho com cauda longa: muitas estrelas tênues, poucas muito brilhantes
    const lum = 0.75 + Math.pow(rand(), 5) * 1.4;
    if (roll < 0.14) {
      // bojo: elipsoide quente e denso
      r = Math.abs(gauss(rand)) * 2.2;
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(2 * rand() - 1);
      x = r * Math.sin(ph) * Math.cos(th);
      z = r * Math.sin(ph) * Math.sin(th);
      y = r * Math.cos(ph) * 0.45;
      temp = 0.05 + rand() * 0.3;
      sz = 0.5 + rand() * 0.5;
      bright = 0.3 * lum;
    } else if (roll < 0.84) {
      // braços: raio exponencial, espalhamento que abre com o raio
      r = 1.8 + -Math.log(1 - rand() * 0.985) * 7.5;
      while (r > R * 1.05) r = 1.8 + -Math.log(1 - rand() * 0.985) * 7.5;
      const arm = rand() < 0.5 ? 0 : 1;
      const spread = gauss(rand) * (0.16 + r * 0.011);
      const th = armAngle(arm, r) + spread / Math.max(0.35, r * 0.06);
      x = Math.cos(th) * r;
      z = Math.sin(th) * r;
      y = gauss(rand) * (0.08 + 0.28 * Math.exp(-r / 6));
      const crest = Math.exp(-spread * spread * 18);
      temp = 0.5 + 0.45 * crest * rand() + 0.08 * rand();
      sz = 0.5 + rand() * 0.6;
      bright = (0.18 + 0.42 * crest) * lum;
    } else {
      // entre braços: população velha e difusa
      r = 2 + -Math.log(1 - rand() * 0.97) * 7.5;
      while (r > R * 1.05) r = 2 + -Math.log(1 - rand() * 0.97) * 7.5;
      const th = rand() * Math.PI * 2;
      x = Math.cos(th) * r;
      z = Math.sin(th) * r;
      y = gauss(rand) * 0.22;
      temp = 0.15 + rand() * 0.45;
      sz = 0.45 + rand() * 0.4;
      bright = 0.2 * lum;
    }
    bright *= edge(r); // a borda se dissolve, sem contorno
    const t = y < 0 ? below : above;
    starColor(temp, c);
    t.pos.push(x, y, z);
    t.col.push(c[0] * bright, c[1] * bright, c[2] * bright);
    t.size.push(sz);
    t.phase.push(rand());
  }

  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uFocus: { value: new THREE.Vector4(0, 0, 0, 0) } },
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  [[below, 1], [above, 3]].forEach(([t, order]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(t.pos, 3));
    geo.setAttribute("aColor", new THREE.Float32BufferAttribute(t.col, 3));
    geo.setAttribute("aSize", new THREE.Float32BufferAttribute(t.size, 1));
    geo.setAttribute("aPhase", new THREE.Float32BufferAttribute(t.phase, 1));
    const pts = new THREE.Points(geo, starMat);
    pts.renderOrder = order;
    group.add(pts);
  });

  /* ---------- estrelas brilhantes com difração ---------- */
  const spikeTex = spikeStarTexture();
  const bright = new THREE.Group();
  const tints = [0xffc38a, 0xffe2c0, 0xbfd4ff, 0xff9f7a, 0xffffff];
  for (let i = 0; i < (mobile ? 50 : 90); i++) {
    const r = 3 + rand() * 24;
    const arm = rand() < 0.5 ? 0 : 1;
    const th = armAngle(arm, r) + gauss(rand) * 0.12;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: spikeTex, color: tints[Math.floor(rand() * tints.length)], opacity: 0.5 + rand() * 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, rotation: 0.2,
    }));
    sp.position.set(Math.cos(th) * r, gauss(rand) * 0.15, Math.sin(th) * r);
    sp.scale.setScalar(0.35 + Math.pow(rand(), 3) * 1.1);
    sp.userData.base = sp.material.opacity;
    sp.renderOrder = 4;
    bright.add(sp);
  }
  group.add(bright);

  /* ---------- núcleo: brilho quente em camadas ---------- */
  const glowMap = glowTexture();
  [
    [2, 0xfff1d6, 0.3],
    [6, 0xff9a4a, 0.16],
    [18, 0xff6a3a, 0.05],
  ].forEach(([s, color, opacity]) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowMap, color, opacity, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    sp.scale.setScalar(s);
    sp.renderOrder = 5;
    group.add(sp);
  });

  /* ---------- nebulosas ao longo dos braços ---------- */
  const cloudTex = bakeCloud(renderer);
  const palette = [0xff4f8a, 0x7a8cff, 0xb070ff, 0xff6a5c, 0x5fc8ff];
  for (let i = 0; i < 34; i++) {
    const arm = i % 2;
    const r = 5 + rand() * 20;
    const th = armAngle(arm, r) + gauss(rand) * 0.1;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, color: palette[Math.floor(rand() * palette.length)], opacity: 0.05 + rand() * 0.09,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, rotation: rand() * Math.PI * 2,
    }));
    sp.position.set(Math.cos(th) * r, gauss(rand) * 0.3, Math.sin(th) * r);
    sp.scale.setScalar(2 + rand() * 4);
    sp.renderOrder = 3;
    group.add(sp);
  }

  return {
    group,
    update(t, camera) {
      starMat.uniforms.uTime.value = t;
      // estrelas com difração somem quando a câmera passa perto demais
      bright.children.forEach((sp) => {
        sp.getWorldPosition(_w);
        const d = _w.distanceTo(camera.position);
        sp.material.opacity = sp.userData.base * THREE.MathUtils.smoothstep(d, 4, 12);
      });
    },
    // foco em coordenadas locais do grupo; raio 0 desliga a bolha
    setFocus(localPos, radius) { starMat.uniforms.uFocus.value.set(localPos.x, localPos.y, localPos.z, radius); },
    setPixelScale(h, pixelRatio) { starMat.uniforms.uScale.value = h * pixelRatio * 0.16; },
  };
}
