// ============================================================
// Texturas geradas na inicialização — zero download de imagem.
// Sprites simples via canvas 2D; disco e nuvens "assados" na GPU.
// ============================================================
import * as THREE from "three";
import { GALAXY } from "../data.js";

// Ruído fbm compartilhado pelos shaders de bake.
export const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y);
  }
  float fbm(vec2 p){
    float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<7;i++){ v+=a*noise(p); p=m*p; a*=.5; }
    return v;
  }
  // fbm "turbulento" — filamentos parecidos com poeira real
  float ridged(vec2 p){
    float v=0., a=.5; mat2 m=mat2(1.6,1.2,-1.2,1.6);
    for(int i=0;i<6;i++){ v+=a*(1.-abs(noise(p)*2.-1.)); p=m*p; a*=.5; }
    return v;
  }
`;

function canvasTexture(size, draw) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Brilho radial suave (núcleo, halos).
export function glowTexture() {
  return canvasTexture(256, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.15, "rgba(255,255,255,0.55)");
    g.addColorStop(0.4, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

// Estrela com pontas de difração no padrão do James Webb (6 + 2).
export function spikeStarTexture() {
  return canvasTexture(512, (ctx, s) => {
    const c = s / 2;
    ctx.globalCompositeOperation = "lighter";
    const spike = (angle, len, width, alpha) => {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(angle);
      const g = ctx.createLinearGradient(0, 0, len, 0);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.25, `rgba(255,255,255,${alpha * 0.35})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -width);
      ctx.lineTo(len, 0);
      ctx.lineTo(0, width);
      ctx.fill();
      ctx.restore();
    };
    for (let i = 0; i < 6; i++) spike((i * Math.PI) / 3 + Math.PI / 2, c * 0.98, 2.2, 0.9);
    spike(0, c * 0.6, 1.2, 0.5);
    spike(Math.PI, c * 0.6, 1.2, 0.5);
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.35);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.08, "rgba(255,255,255,0.9)");
    g.addColorStop(0.3, "rgba(255,255,255,0.18)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}

// Renderiza um fragment shader numa textura, uma única vez.
// `hdr` guarda em meia precisão: brilhos acima de 1 sem faixas.
function bake(renderer, size, fragmentShader, { hdr = false, uniforms = {} } = {}) {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    colorSpace: THREE.NoColorSpace,
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    anisotropy: 4,
  });
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: "varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }",
    fragmentShader,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(quad);
  const prevTarget = renderer.getRenderTarget();
  const prevTone = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevTarget);
  renderer.toneMapping = prevTone;
  quad.geometry.dispose();
  mat.dispose();
  return rt.texture;
}

const ARM_GLSL = /* glsl */ `
  const float PI = 3.14159265;
  const float PITCH = ${GALAXY.pitch.toFixed(4)};
  const float R = ${GALAXY.radius.toFixed(1)};
  // coordenada espiral: constante ao longo de um braço logarítmico
  float spiral(vec2 p){ return atan(p.y, p.x) - log(length(p) + 1e-3) / PITCH; }
  // domínio deformado: braços orgânicos, nunca uma espiral de régua
  vec2 warpP(vec2 p){
    return p + (vec2(fbm(p * 0.07 + 1.7), fbm(p * 0.07 + 9.2)) - 0.5) * 5.0;
  }
  // células de Voronoi: nós de formação estelar
  vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
  vec3 voronoi(vec2 x){
    vec2 n = floor(x), f = fract(x); float md = 8.0; vec2 id = vec2(0.0);
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)); vec2 o = hash2(n + g);
      vec2 r = g + o - f; float d = dot(r, r);
      if (d < md) { md = d; id = n + g; }
    }
    return vec3(sqrt(md), id);
  }
  // rampa de cor por raio: creme → laranja → magenta → violeta → azul
  vec3 ramp(float r){
    vec3 c = vec3(1.0, 0.82, 0.55);
    c = mix(c, vec3(1.0, 0.46, 0.16), smoothstep(1.5, 5.0, r));
    c = mix(c, vec3(0.9, 0.24, 0.42), smoothstep(5.0, 10.0, r));
    c = mix(c, vec3(0.46, 0.26, 0.95), smoothstep(10.0, 16.0, r));
    c = mix(c, vec3(0.22, 0.38, 1.0), smoothstep(15.0, 25.0, r));
    return c;
  }
`;

// Luz difusa do disco, em HDR. É a "fotografia" da galáxia:
// bojo quente, braços com nós rosados (HII) e aglomerados azuis.
export function bakeDiskGlow(renderer, size = 2048) {
  return bake(renderer, size, /* glsl */ `
    varying vec2 vUv;
    ${NOISE_GLSL}
    ${ARM_GLSL}
    void main(){
      vec2 p = (vUv - 0.5) * 2.0 * R * 1.15;
      p.y = -p.y; // o eixo v do plano deitado aponta para -z no mundo
      float r = length(p);
      vec2 q = warpP(p);
      float s = spiral(q);
      float armA = pow(0.5 + 0.5 * cos(2.0 * s), 2.6);
      // ramificações (spurs) entre os braços principais
      float spur = pow(0.5 + 0.5 * cos(2.0 * s + 2.1 + (fbm(p * 0.18) - 0.5) * 3.0), 7.0) * smoothstep(6.0, 12.0, r);
      float arm = max(armA, spur * 0.55);
      float clumps = smoothstep(0.32, 0.9, fbm(p * 0.55 + 3.0));
      float disk = exp(-r / 7.8);
      // bojo: centro creme compacto + halo laranja largo; levemente oval (barra)
      vec2 pb = vec2(p.x * 0.8 + p.y * 0.35, p.y * 1.15 - p.x * 0.2);
      float rb = length(pb);
      float bulgeHot = exp(-rb * rb / 1.6) * 1.8;
      float bulgeWarm = exp(-rb / 2.6) * 0.9;
      vec3 col = ramp(r);
      float armLight = arm * (0.35 + 1.25 * clumps) * disk * smoothstep(1.2, 4.5, r);
      vec3 c = col * (disk * 0.28 + armLight * 1.9);
      c += vec3(1.0, 0.86, 0.66) * bulgeHot + vec3(1.0, 0.5, 0.2) * bulgeWarm;
      // nós HII: pontos rosados brilhantes nas cristas
      vec3 v1 = voronoi(p * 1.35);
      float k1 = exp(-v1.x * v1.x * 42.0) * step(0.84, hash2(v1.yz).x);
      c += vec3(1.0, 0.32, 0.55) * k1 * armA * smoothstep(3.5, 8.0, r) * exp(-r / 14.0) * 1.8;
      // aglomerados jovens azuis
      vec3 v2 = voronoi(p * 2.4 + 17.0);
      float k2 = exp(-v2.x * v2.x * 60.0) * step(0.88, hash2(v2.yz).y);
      c += vec3(0.55, 0.7, 1.0) * k2 * arm * smoothstep(5.0, 12.0, r) * exp(-r / 16.0) * 1.2;
      // grão fino de estrelas não resolvidas
      float grain = pow(hash(floor(vUv * ${size.toFixed(1)})), 18.0);
      c += col * grain * disk * (0.6 + arm) * 0.8;
      c *= smoothstep(R * 1.12, R * 0.55, r);
      gl_FragColor = vec4(c, 1.0);
    }
  `, { hdr: true });
}

// Faixas de poeira: escuras, avermelhadas, na borda interna dos braços.
export function bakeDiskDust(renderer, size = 2048) {
  return bake(renderer, size, /* glsl */ `
    varying vec2 vUv;
    ${NOISE_GLSL}
    ${ARM_GLSL}
    void main(){
      vec2 p = (vUv - 0.5) * 2.0 * R * 1.15;
      p.y = -p.y;
      float r = length(p);
      vec2 q = warpP(p);
      float s = spiral(q);
      float lane = pow(0.5 + 0.5 * cos(2.0 * s + 0.55), 5.0);
      float fil = ridged(p * 0.32 + 11.0);
      float d = lane * smoothstep(0.5, 1.02, fil) * 1.35;
      // poeira fina e manchada entre os braços
      d += smoothstep(0.74, 1.08, ridged(p * 0.7 + 2.0)) * 0.5 * exp(-r / 10.0);
      d *= smoothstep(1.4, 4.5, r) * smoothstep(R * 0.95, R * 0.4, r);
      gl_FragColor = vec4(vec3(0.035, 0.014, 0.012), clamp(d * 1.15, 0.0, 0.94));
    }
  `);
}

// Nuvem de nebulosa genérica (alfa em fbm) — tingida por instância.
export function bakeCloud(renderer, size = 512) {
  return bake(renderer, size, /* glsl */ `
    varying vec2 vUv;
    ${NOISE_GLSL}
    void main(){
      vec2 p = vUv - 0.5;
      float r = length(p) * 2.0;
      float n = fbm(vUv * 4.0 + fbm(vUv * 3.0) * 1.5);
      float a = smoothstep(1.0, 0.1, r) * smoothstep(0.35, 0.85, n);
      gl_FragColor = vec4(vec3(1.0), a);
    }
  `);
}

// Pequena galáxia elíptica distante (fundo).
export function bakeFarGalaxy(renderer, size = 256) {
  return bake(renderer, size, /* glsl */ `
    varying vec2 vUv;
    ${NOISE_GLSL}
    void main(){
      vec2 p = (vUv - 0.5) * vec2(1.0, 2.6);
      float r = length(p) * 2.0;
      float th = atan(p.y, p.x);
      float spiral = 0.6 + 0.4 * cos(2.0 * (th - log(r + 0.05) * 3.0));
      float v = exp(-r * 4.0) * 1.5 + exp(-r * 2.2) * spiral * 0.5;
      v *= 0.8 + 0.4 * fbm(vUv * 12.0);
      gl_FragColor = vec4(vec3(1.0), clamp(v, 0.0, 1.0));
    }
  `);
}
