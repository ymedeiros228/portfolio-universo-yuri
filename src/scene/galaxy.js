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

// Rotação diferencial: o centro gira mais rápido que a borda (curva de
// rotação de uma galáxia real). uTwist cresce com o tempo; o ângulo extra
// de cada ponto cai com o raio. Aplicado igual em estrelas, disco e sprites.
const TWIST_R = 6.0;
export const twistAngle = (twist, r) => twist * Math.exp(-r / TWIST_R);

const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aPhase;
  uniform float uTime;
  uniform float uScale;
  uniform vec4 uFocus;  // xyz: centro (local), w: raio da bolha livre de estrelas
  uniform vec4 uFocus2; // segunda bolha: a do planeta vizinho (transições sem salto)
  uniform float uTwist;
  varying vec3 vColor;
  void main(){
    float ta = uTwist * exp(-length(position.xz) / ${TWIST_R.toFixed(1)});
    float cs = cos(ta), sn = sin(ta);
    vec3 pos = vec3(cs * position.x - sn * position.z, position.y, sn * position.x + cs * position.z);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aSize * uScale / -mv.z;
    float tw = 0.9 + 0.1 * sin(uTime * (0.5 + aPhase * 0.8) + aPhase * 40.0); // cintilar lento e discreto
    // perto demais da câmera: some antes de virar borrão
    float near = smoothstep(1.2, 4.0, -mv.z);
    // bolha de foco: abre espaço em volta do sistema visitado
    float bubble = uFocus.w > 0.0 ? smoothstep(uFocus.w * 0.45, uFocus.w, distance(pos, uFocus.xyz)) : 1.0;
    bubble *= uFocus2.w > 0.0 ? smoothstep(uFocus2.w * 0.45, uFocus2.w, distance(pos, uFocus2.xyz)) : 1.0;
    // ponto mínimo de 1.8px com a energia conservada: estrelas pequenas
    // viram um brilho suave e arredondado, não um pixel duro ("areia")
    float ps = clamp(size, 1.8, 4.5);
    vColor = aColor * tw * min(1.0, (size * size) / (ps * ps)) * near * bubble;
    gl_PointSize = ps;
  }
`;

const STAR_FRAG = /* glsl */ `
  varying vec3 vColor;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float r2 = dot(d, d) * 4.0;
    // sem discard: em GPU de celular ele desliga otimizações do chip; com
    // mistura aditiva, a borda (a ~ 0) já não soma nada visível
    float a = exp(-r2 * 4.0);
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

export function buildGalaxy(renderer, { count, mobile, lite = mobile }) {
  const group = new THREE.Group();
  const R = GALAXY.radius;
  const rand = rng(2026);
  const diskSize = R * 2 * 1.15;
  const twistU = { value: 0 }; // compartilhado por todos os planos do disco

  /* ---------- disco difuso (HDR) + poeira ----------
     Planos com a textura assada. Perto da câmera eles se dissolvem:
     de perto a textura viraria borrão, então o espaço fica limpo. */
  const planeMat = (map, { gain = 1, additive = true, core = 0 } = {}) => new THREE.ShaderMaterial({
    uniforms: { map: { value: map }, uGain: { value: gain }, uCore: { value: core }, uTwist: twistU, uSize: { value: diskSize } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vDist; varying float vFacing; varying vec2 vXZ;
      void main(){
        vUv = uv;
        vXZ = vec2(position.x, -position.y); // plano deitado: y local = -z da galáxia
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDist = distance(wp.xyz, cameraPosition);
        // o quanto o disco está "de frente" para a câmera (normal = +y do mundo)
        vFacing = abs(normalize(cameraPosition - wp.xyz).y);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform float uGain; uniform float uCore; uniform float uTwist; uniform float uSize; varying vec2 vUv; varying float vDist; varying float vFacing; varying vec2 vXZ;
      void main(){
        // o que aparece aqui é a textura original "desgirada" pelo mesmo ângulo das estrelas
        float ta = -uTwist * exp(-length(vXZ) / ${TWIST_R.toFixed(1)});
        float cs = cos(ta), sn = sin(ta);
        vec2 xz = vec2(cs * vXZ.x - sn * vXZ.y, sn * vXZ.x + cs * vXZ.y);
        vec4 t = texture2D(map, vec2(xz.x / uSize + 0.5, -xz.y / uSize + 0.5));
        float fade = smoothstep(2.0, 10.0, vDist);
        // de perfil, uma folha vira um risco estourado: ela se apaga e as
        // estrelas (que têm volume de verdade) carregam a forma
        fade *= smoothstep(0.04, 0.4, vFacing);
        // camadas fora do plano: só a região central tem espessura (o disco afina na borda)
        if (uCore > 0.0) { float q = length(vUv - 0.5) / uCore; fade *= exp(-q * q); }
        ${additive ? "gl_FragColor = vec4(t.rgb * uGain * fade, 1.0);" : "gl_FragColor = vec4(t.rgb, t.a * fade);"}
      }
    `,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    transparent: true, depthWrite: false,
  });
  // Volume: o disco não é uma folha. Fatias de luz e poeira empilhadas em
  // alturas diferentes, cada vez mais restritas ao centro — vistas de lado,
  // formam um disco que engrossa até o bojo.
  const glowTex = bakeDiskGlow(renderer, lite ? 1024 : 2048);
  const dustTex = bakeDiskDust(renderer, lite ? 1024 : 2048);
  // cada fatia é um plano transparente que pode cobrir a tela inteira;
  // no modo leve ficam só 3 (o ganho das que saem vai para as de perto)
  const slices = lite ? [
    [0, 0.46, 0],
    [0.45, 0.1, 0.18], [-0.45, 0.1, 0.18],
  ] : [
    // [altura, ganho, raio da região com espessura (em UV)]
    [0, 0.46, 0],
    [0.35, 0.065, 0.2], [-0.35, 0.065, 0.2],
    [0.8, 0.045, 0.11], [-0.8, 0.045, 0.11],
    [1.4, 0.03, 0.06], [-1.4, 0.03, 0.06],
  ];
  slices.forEach(([y, gain, core]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(diskSize, diskSize), planeMat(glowTex, { gain, core }));
    m.rotation.x = -Math.PI / 2;
    m.position.y = y;
    m.renderOrder = 0;
    group.add(m);
  });

  (lite ? [[0.04, 0]] : [[0.04, 0], [0.22, 0.22], [-0.18, 0.22]]).forEach(([y, core]) => {
    const dust = new THREE.Mesh(new THREE.PlaneGeometry(diskSize, diskSize), planeMat(dustTex, { additive: false, core }));
    dust.rotation.x = -Math.PI / 2;
    dust.position.y = y;
    dust.renderOrder = 2;
    group.add(dust);
  });

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
    const lum = 0.5 + Math.pow(rand(), 4) * 2.1;
    if (roll < 0.09) {
      // bojo: elipsoide quente e denso
      r = Math.abs(gauss(rand)) * 2.6;
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(2 * rand() - 1);
      x = r * Math.sin(ph) * Math.cos(th);
      z = r * Math.sin(ph) * Math.sin(th);
      y = r * Math.cos(ph) * 0.62;
      temp = 0.05 + rand() * 0.22;
      sz = 0.5 + rand() * 0.5;
      bright = 0.12 * lum;
    } else if (roll < 0.84) {
      // braços: raio exponencial, espalhamento que abre com o raio
      r = 1.8 + -Math.log(1 - rand() * 0.985) * 7.5;
      while (r > R * 1.05) r = 1.8 + -Math.log(1 - rand() * 0.985) * 7.5;
      const arm = rand() < 0.5 ? 0 : 1;
      const spread = gauss(rand) * (0.16 + r * 0.011);
      const th = armAngle(arm, r) + spread / Math.max(0.35, r * 0.06);
      x = Math.cos(th) * r;
      z = Math.sin(th) * r;
      y = gauss(rand) * (0.14 + 0.55 * Math.exp(-r / 7));
      const crest = Math.exp(-spread * spread * 18);
      temp = 0.5 + 0.45 * crest * rand() + 0.08 * rand();
      // perto do núcleo: população velha, dourada e menos densa (evita a "mancha branca")
      const inner = THREE.MathUtils.smoothstep(r, 2.5, 8);
      temp = THREE.MathUtils.lerp(0.14 + rand() * 0.18, temp, inner);
      sz = 0.5 + rand() * 0.6;
      bright = (0.18 + 0.42 * crest) * lum * (0.4 + 0.6 * inner);
    } else if (roll > 0.955) {
      // halo: esfera ampla e tênue de estrelas velhas — dá profundidade quando a câmera se move
      r = 3 + Math.pow(rand(), 0.7) * R * 1.1;
      const th = rand() * Math.PI * 2;
      const ph = Math.acos(2 * rand() - 1);
      x = r * Math.sin(ph) * Math.cos(th);
      z = r * Math.sin(ph) * Math.sin(th);
      y = r * Math.cos(ph) * 0.55;
      temp = 0.1 + rand() * 0.35;
      sz = 0.5 + rand() * 0.5;
      bright = 0.16 * lum * (0.6 + 0.4 * Math.exp(-r / 12));
    } else {
      // entre braços: população velha e difusa
      r = 2 + -Math.log(1 - rand() * 0.97) * 7.5;
      while (r > R * 1.05) r = 2 + -Math.log(1 - rand() * 0.97) * 7.5;
      const th = rand() * Math.PI * 2;
      x = Math.cos(th) * r;
      z = Math.sin(th) * r;
      y = gauss(rand) * (0.3 + 0.5 * Math.exp(-r / 8));
      temp = 0.15 + rand() * 0.45;
      sz = 0.45 + rand() * 0.4;
      bright = 0.2 * lum;
    }
    if (roll <= 0.955) bright *= edge(r); // a borda se dissolve, sem contorno
    const t = y < 0 ? below : above;
    starColor(temp, c);
    t.pos.push(x, y, z);
    t.col.push(c[0] * bright, c[1] * bright, c[2] * bright);
    t.size.push(sz);
    t.phase.push(rand());
  }

  const starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG,
    uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uFocus: { value: new THREE.Vector4(0, 0, 0, 0) }, uFocus2: { value: new THREE.Vector4(0, 0, 0, 0) }, uTwist: { value: 0 } },
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
    sp.userData.p0 = sp.position.clone();
    sp.scale.setScalar(0.35 + Math.pow(rand(), 3) * 1.1);
    sp.userData.base = sp.material.opacity;
    sp.renderOrder = 4;
    bright.add(sp);
  }
  group.add(bright);

  /* ---------- núcleo: brilho quente em camadas ---------- */
  const glowMap = glowTexture();
  [
    [1.1, 0xfff4e0, 0.34],
    [3.2, 0xffc680, 0.1],
    [8, 0xff8a4a, 0.08],
    [20, 0xff6a3a, 0.035],
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
  const clouds = [];
  const palette = [0xff4f8a, 0x7a8cff, 0xb070ff, 0xff6a5c, 0x5fc8ff];
  for (let i = 0; i < 34; i++) {
    const arm = i % 2;
    const r = 5 + rand() * 20;
    const th = armAngle(arm, r) + gauss(rand) * 0.1;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: cloudTex, color: palette[Math.floor(rand() * palette.length)], opacity: 0.05 + rand() * 0.09,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, rotation: rand() * Math.PI * 2,
    }));
    sp.position.set(Math.cos(th) * r, gauss(rand) * 0.45, Math.sin(th) * r);
    const p0 = sp.position.clone();
    sp.scale.setScalar(2 + rand() * 4);
    sp.renderOrder = 3;
    sp.userData = { p0, base: sp.material.opacity, phase: rand() * 6.28, speed: 0.08 + rand() * 0.12, rot: (rand() - 0.5) * 0.02 };
    clouds.push(sp);
    group.add(sp);
  }

  return {
    group,
    update(t, camera) {
      starMat.uniforms.uTime.value = t;
      // o núcleo dá ~1 volta extra a cada 17 min; a borda quase não se mexe
      const twist = t * 0.006;
      starMat.uniforms.uTwist.value = twist;
      twistU.value = twist;
      const place = (sp) => {
        const p = sp.userData.p0, a = twistAngle(twist, Math.hypot(p.x, p.z));
        const c = Math.cos(a), s = Math.sin(a);
        sp.position.set(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
      };
      bright.children.forEach(place);
      clouds.forEach(place);
      // nebulosas respiram: brilho pulsando devagar e giro quase imperceptível
      clouds.forEach((c) => {
        const u = c.userData;
        c.material.opacity = u.base * (0.75 + 0.25 * Math.sin(t * u.speed + u.phase));
        c.material.rotation += u.rot * 0.016;
      });
      // estrelas com difração somem quando a câmera passa perto demais
      bright.children.forEach((sp) => {
        sp.getWorldPosition(_w);
        const d = _w.distanceTo(camera.position);
        sp.material.opacity = sp.userData.base * THREE.MathUtils.smoothstep(d, 4, 12);
      });
    },
    // foco em coordenadas locais do grupo; raio 0 desliga a bolha
    setFocus(localPos, radius, localPos2, radius2 = 0) {
      starMat.uniforms.uFocus.value.set(localPos.x, localPos.y, localPos.z, radius);
      if (localPos2) starMat.uniforms.uFocus2.value.set(localPos2.x, localPos2.y, localPos2.z, radius2);
      else starMat.uniforms.uFocus2.value.w = 0;
    },
    setPixelScale(h, pixelRatio) { starMat.uniforms.uScale.value = h * pixelRatio * 0.16; },
  };
}
