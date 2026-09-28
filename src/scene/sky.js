// ============================================================
// Céu de fundo: cúpula de nebulosas tênues, faixa de estrelas
// ao longe, milhares de estrelas distantes e galáxias longínquas.
// ============================================================
import * as THREE from "three";
import { rng, gauss } from "./galaxy.js";
import { bakeFarGalaxy } from "./textures.js";

// Cúpula: ruído 3D na direção de visão → nebulosas sem costura.
const DOME_FRAG = /* glsl */ `
  varying vec3 vDir;
  float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * n3(p); p = p * 2.02 + 7.3; a *= .5; } return v; }
  void main(){
    vec3 d = normalize(vDir);
    vec3 q = d * 2.2 + vec3(fbm(d * 1.6), fbm(d * 1.6 + 4.1), fbm(d * 1.6 + 8.7)) * 1.4;
    float n = fbm(q);
    float m = smoothstep(0.42, 0.85, n);
    // faixa da Via Láctea: um grande círculo inclinado
    float bd = dot(d, normalize(vec3(0.25, 1.0, 0.35)));
    float band = exp(-bd * bd * 9.0); // bd*bd em vez de pow(bd, 2.0): pow com base negativa dá NaN no Direct3D
    vec3 deep = vec3(0.006, 0.008, 0.024);
    vec3 violet = vec3(0.09, 0.04, 0.16);
    vec3 blue = vec3(0.03, 0.07, 0.17);
    vec3 rose = vec3(0.14, 0.04, 0.08);
    vec3 c = deep;
    c += mix(blue, violet, smoothstep(0.3, 0.7, fbm(d * 3.0 + 2.0))) * m * (0.55 + band * 0.9);
    c += rose * smoothstep(0.62, 0.9, fbm(d * 4.0 + 11.0)) * band * 0.8;
    c += vec3(0.07, 0.065, 0.09) * band * (0.35 + 0.65 * fbm(d * 9.0));
    gl_FragColor = vec4(c * 0.22, 1.0); // bem sutil: o céu continua escuro
  }
`;

export function buildSky(renderer, { count }) {
  const group = new THREE.Group();
  const rand = rng(7);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 64, 32),
    new THREE.ShaderMaterial({
      vertexShader: "varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: DOME_FRAG, side: THREE.BackSide, depthWrite: false,
    }),
  );
  dome.renderOrder = -10;
  group.add(dome);

  // estrelas: parte espalhada, parte concentrada na faixa
  const bandN = new THREE.Vector3(0.25, 1.0, 0.35).normalize();
  const tmp = new THREE.Vector3();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const size = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const inBand = rand() < 0.45;
    let u = rand() * 2 - 1, th = rand() * Math.PI * 2;
    let s = Math.sqrt(1 - u * u);
    tmp.set(s * Math.cos(th), u, s * Math.sin(th));
    if (inBand) {
      // projeta perto do plano da faixa
      tmp.addScaledVector(bandN, -tmp.dot(bandN) * (1 - Math.abs(gauss(rand)) * 0.12)).normalize();
    }
    const d = 320 + rand() * 180;
    pos.set([tmp.x * d, tmp.y * d, tmp.z * d], i * 3);
    const warm = rand();
    const b = 0.25 + Math.pow(rand(), 7) * 2.2;
    col.set([b * (0.82 + warm * 0.18), b * (0.86 + rand() * 0.06), b * (1.06 - warm * 0.26)], i * 3);
    size[i] = 0.55 + Math.pow(rand(), 9) * 2.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uPR: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; uniform float uPR; varying vec3 vC;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        float s = aSize * uPR * 1.3;
        vC = aColor * min(1.0, s * s); // sub-pixel: brilho proporcional
        gl_PointSize = max(1.0, s);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main(){ vec2 d = gl_PointCoord - .5; float a = exp(-dot(d, d) * 16.); gl_FragColor = vec4(vC * a, 1.); }
    `,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = -9;
  group.add(stars);

  // Galáxias distantes: pequenas manchas elípticas, orientações variadas.
  const farTex = bakeFarGalaxy(renderer);
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: farTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        color: new THREE.Color().setHSL(0.05 + rand() * 0.6, 0.4, 0.55), opacity: 0.3 + rand() * 0.35,
      }),
    );
    const u = rand() * 1.6 - 0.8, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    m.position.set(s * Math.cos(th) * 280, u * 280, s * Math.sin(th) * 280);
    m.lookAt(0, 0, 0);
    m.rotateZ(rand() * Math.PI);
    m.scale.setScalar(3 + rand() * 8);
    m.renderOrder = -8;
    group.add(m);
  }

  return {
    group,
    // a cúpula acompanha a câmera: fica sempre "no infinito"
    update(camera) { group.position.copy(camera.position); },
    setPixelRatio(pr) { mat.uniforms.uPR.value = pr; },
  };
}
