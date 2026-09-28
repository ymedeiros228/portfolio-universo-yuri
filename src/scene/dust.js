// ============================================================
// Vida em volta da câmera:
// • poeira espacial em primeiro plano — partículas tênues num cubo que
//   acompanha a câmera (dá parallax e sensação de velocidade ao rolar);
// • estrelas cadentes raras cruzando o céu ao fundo.
// ============================================================
import * as THREE from "three";
import { rng } from "./galaxy.js";

const BOX = 16; // lado do cubo de poeira em volta da câmera

export function buildDust({ count, reduced }) {
  const group = new THREE.Group();
  const rand = rng(99);

  /* ---------- poeira ---------- */
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos.set([(rand() - 0.5) * BOX, (rand() - 0.5) * BOX, (rand() - 0.5) * BOX], i * 3);
    seed[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uScale: { value: 300 }, uSpeed: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      uniform vec3 uCam; uniform float uTime; uniform float uScale; uniform float uSpeed;
      varying float vA; varying vec3 vC;
      void main(){
        // deriva lenta e própria de cada grão
        vec3 p = position + vec3(sin(uTime * 0.05 + aSeed * 40.0), cos(uTime * 0.04 + aSeed * 23.0), sin(uTime * 0.045 + aSeed * 11.0)) * 0.6;
        // o cubo "dá a volta" em torno da câmera: poeira infinita
        p = mod(p - uCam + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        // aparece com a distância e some na borda do cubo (sem "estouro" de partículas)
        // a volta no cubo acontece nas faces (distância >= BOX/2 em algum eixo):
        // o grão some antes, pela distância 3D até a câmera — nunca "pula" à vista
        float r = length(p - uCam);
        vA = smoothstep(0.6, 2.5, d) * (1.0 - smoothstep(${(BOX * 0.22).toFixed(1)}, ${(BOX * 0.42).toFixed(1)}, r));
        vA *= 0.35 + 0.65 * uSpeed; // mais visível quando a câmera anda
        vC = mix(vec3(0.75, 0.8, 1.0), vec3(1.0, 0.8, 0.9), aSeed);
        gl_PointSize = clamp((0.6 + aSeed) * uScale / d, 1.5, 7.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA; varying vec3 vC;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float a = exp(-dot(d, d) * 14.0) * vA * 0.28;
        gl_FragColor = vec4(vC * a, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const dust = new THREE.Points(geo, mat);
  dust.frustumCulled = false;
  dust.renderOrder = 6;
  group.add(dust);

  /* ---------- estrelas cadentes ---------- */
  const trailMat = () => new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 } },
    vertexShader: "attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    // sem pow(0, x): no Direct3D (ANGLE) isso pode dar NaN, que o bloom espalha pela tela inteira (quadro preto)
    fragmentShader: "uniform float uA; varying float vT; void main(){ float t = clamp(vT, 0.0, 1.0); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * (t * t * sqrt(t)) * max(uA, 0.0), 1.0); }",
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const meteors = [0, 1].map(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    g.setAttribute("aT", new THREE.BufferAttribute(new Float32Array([0, 1]), 1));
    const line = new THREE.Line(g, trailMat());
    line.frustumCulled = false;
    line.renderOrder = -7;
    group.add(line);
    return { line, t: 1, dur: 1, next: 4 + rand() * 8, a: new THREE.Vector3(), b: new THREE.Vector3() };
  });
  const _fwd = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();

  return {
    group,
    setPixelScale(h, pr) { mat.uniforms.uScale.value = h * pr * 0.012; },
    update(t, dt, camera, speed) {
      mat.uniforms.uCam.value.copy(camera.position);
      mat.uniforms.uTime.value = t;
      mat.uniforms.uSpeed.value = speed;
      if (reduced) return;
      meteors.forEach((m) => {
        if (m.t >= 1) {
          m.line.material.uniforms.uA.value = 0;
          if ((m.next -= dt) > 0) return;
          // nasce num ponto aleatório do céu à frente da câmera, bem longe
          camera.getWorldDirection(_fwd);
          _r.crossVectors(_fwd, camera.up).normalize();
          _u.crossVectors(_r, _fwd).normalize();
          m.a.copy(camera.position).addScaledVector(_fwd, 300)
            .addScaledVector(_r, (rand() - 0.5) * 360).addScaledVector(_u, 40 + rand() * 120);
          const ang = -0.4 - rand() * 0.6;
          m.b.copy(_r).multiplyScalar(Math.cos(ang) * (rand() < 0.5 ? -1 : 1)).addScaledVector(_u, Math.sin(ang)).multiplyScalar(90 + rand() * 60);
          m.t = 0; m.dur = 0.7 + rand() * 0.6; m.next = 7 + rand() * 14;
        }
        m.t = Math.min(1, m.t + dt / m.dur);
        const head = m.t, tail = Math.max(0, m.t - 0.35);
        const p = m.line.geometry.attributes.position;
        p.setXYZ(0, m.a.x + m.b.x * tail, m.a.y + m.b.y * tail, m.a.z + m.b.z * tail);
        p.setXYZ(1, m.a.x + m.b.x * head, m.a.y + m.b.y * head, m.a.z + m.b.z * head);
        p.needsUpdate = true;
        m.line.material.uniforms.uA.value = Math.pow(Math.max(0, Math.sin(Math.PI * m.t)), 1.5) * 0.8; // acende e apaga suave
      });
    },
  };
}
