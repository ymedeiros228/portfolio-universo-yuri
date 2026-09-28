// ============================================================
// Um planeta por projeto, flutuando sobre um braço da galáxia.
// O tamanho é o peso do projeto; a luz vem do núcleo galáctico.
// Cada destaque do projeto vira uma lua em órbita do planeta.
// Os planetas são filhos do grupo da galáxia (giram com ela).
// ============================================================
import * as THREE from "three";
import { systemPosition } from "../data.js";
import { rng } from "./galaxy.js";
import { PLANET_VERT, PLANET_FRAG, ATMO_FRAG, RING_FRAG } from "./bodies.js";

const TYPE = { gas: 0, ocean: 1, ice: 2, rock: 3, lava: 4 };
// luas: rochosas e geladas, em tons neutros
const MOONS = [
  { type: "rock", colors: ["#b8aea4", "#6e655e", "#e2dbd2"], atmo: "#d8cfc4" },
  { type: "ice", colors: ["#c9d6e8", "#7d8fa8", "#f2f6fb"], atmo: "#cfe0ff" },
  { type: "rock", colors: ["#a89684", "#5a4a3e", "#d9c6b0"], atmo: "#e6c9a8" },
];

function body(size, look, seed, light, lite) {
  const [a, b, c] = look.colors.map((x) => new THREE.Color(x));
  const atmo = new THREE.Color(look.atmo || look.atmosphere);
  const uniforms = {
    uSun: { value: light }, uA: { value: a }, uB: { value: b }, uC: { value: c },
    uAtmo: { value: atmo }, uType: { value: TYPE[look.type] }, uSeed: { value: seed }, uTime: { value: 0 },
  };
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 96, 64), new THREE.ShaderMaterial({ vertexShader: PLANET_VERT, fragmentShader: PLANET_FRAG, uniforms, defines: { FBM_OCT: lite ? 4 : 6 } }));
  const atmoMesh = new THREE.Mesh(new THREE.SphereGeometry(size * 1.12, 64, 48), new THREE.ShaderMaterial({
    vertexShader: PLANET_VERT, fragmentShader: ATMO_FRAG,
    uniforms: { uSun: { value: light }, uAtmo: { value: atmo }, uCenter: { value: new THREE.Vector3() } },
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.BackSide,
  }));
  return { mesh, atmoMesh, uniforms, colors: [a, b, c] };
}

function makeRing(size, color, light) {
  const inner = size * 1.35, outer = size * 2.35;
  const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 160, 1), new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorldPos; varying float vR;
      void main(){ vUv = uv; vR = length(position.xy) / ${outer.toFixed(4)};
        vec4 wp = modelMatrix * vec4(position, 1.0); vWorldPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
    `,
    fragmentShader: RING_FRAG,
    uniforms: { uSun: { value: light }, uColor: { value: color }, uCenter: { value: new THREE.Vector3() }, uPlanetR: { value: size } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.rotation.x = -Math.PI / 2 + 0.42;
  return mesh;
}

// órbita: anel fino com borda suavizada no shader (a linha de 1px sem
// antisserrilhamento "tremia" com a galáxia girando)
const ORBIT_VERT = /* glsl */ `
  varying float vR;
  void main(){ vR = length(position.xy); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const ORBIT_FRAG = /* glsl */ `
  uniform vec3 uColor; uniform float uOpacity; uniform float uOrbit; uniform float uMargin;
  varying float vR;
  void main(){
    float w = max(fwidth(vR), 1e-6);          // tamanho de 1 pixel, em unidades do mundo
    float d = abs(vR - uOrbit) / w;           // distância até a órbita, em pixels
    float a = clamp(1.1 - d, 0.0, 1.0);       // traço de ~1,2px com borda macia
    a *= clamp(uMargin / (w * 1.5), 0.0, 1.0); // de muito longe, apaga em vez de serrilhar
    if (a <= 0.001) discard;
    gl_FragColor = vec4(uColor * uOpacity * a, 1.0);
  }
`;
function makeOrbit(orbit, color) {
  const margin = orbit * 0.05;
  const geo = new THREE.RingGeometry(orbit - margin, orbit + margin, 256, 1);
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: ORBIT_VERT, fragmentShader: ORBIT_FRAG,
    uniforms: { uColor: { value: color }, uOpacity: { value: 0.2 }, uOrbit: { value: orbit }, uMargin: { value: margin } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  mesh.rotation.x = -Math.PI / 2; // deita o anel no plano das luas
  return mesh;
}

export function buildSystems(projects, { reduced, lite = false }) {
  const rand = rng(77);
  // a luz de todos os planetas: o núcleo da galáxia, um pouco acima do disco
  const light = new THREE.Vector3(0, 1.2, 0);

  const systems = projects.map((proj, si) => {
    const cfg = proj.planet;
    const r = cfg.size;
    const group = new THREE.Group();
    const [x, , z] = systemPosition(proj.system);
    group.position.set(x, r + 0.9, z); // flutua acima do disco
    const center = new THREE.Vector3();

    /* planeta (eixo inclinado) + atmosfera */
    const tilt = new THREE.Group();
    tilt.rotation.z = (rand() - 0.5) * 0.5;
    group.add(tilt);
    const planet = body(r, cfg, si * 3.1, light, lite);
    tilt.add(planet.mesh);
    group.add(planet.atmoMesh);
    let ring = null;
    if (cfg.rings) {
      const [a, , c] = planet.colors;
      ring = makeRing(r, c.clone().lerp(a, 0.5), light);
      tilt.add(ring);
    }

    /* luas: uma por destaque */
    const accent = new THREE.Color(proj.system.star);
    const orbitColor = accent.clone().lerp(new THREE.Color("#ffffff"), 0.5);
    const start = cfg.rings ? 2.8 : 1.9;
    const plane = new THREE.Group();
    plane.rotation.x = 0.22 + rand() * 0.12;
    plane.rotation.z = (rand() - 0.5) * 0.2;
    group.add(plane);
    const moons = proj.highlights.slice(0, 3).map((h, i) => {
      const orbit = r * (start + i * 0.75);
      const size = r * (0.15 - i * 0.02);
      plane.add(makeOrbit(orbit, orbitColor));
      const holder = new THREE.Group();
      plane.add(holder);
      const moon = body(size, MOONS[i % MOONS.length], si * 5.3 + i * 1.9, light, lite);
      holder.add(moon.mesh, moon.atmoMesh);
      return {
        label: h, holder, size, orbit, ...moon,
        angle: (i / 3) * Math.PI * 2 + rand() * 1.2,
        speed: 0.05 / Math.pow(orbit / r, 1.5),
        world: new THREE.Vector3(),
      };
    });

    return {
      proj, group, center, radius: r, reach: r * (start + 1.5), planet, ring, moons,
      spin: 0.03 + rand() * 0.03,
    };
  });

  return {
    systems,
    update(t) {
      const a = reduced ? 0 : t;
      systems.forEach((s) => {
        s.group.updateWorldMatrix(true, false);
        s.group.getWorldPosition(s.center);
        s.planet.mesh.rotation.y = a * s.spin;
        s.planet.uniforms.uTime.value = a;
        s.planet.atmoMesh.material.uniforms.uCenter.value.copy(s.center);
        if (s.ring) s.ring.material.uniforms.uCenter.value.copy(s.center);
        s.moons.forEach((m) => {
          const ang = m.angle + a * m.speed;
          m.holder.position.set(Math.cos(ang) * m.orbit, 0, Math.sin(ang) * m.orbit);
          m.holder.updateMatrixWorld(true);
          m.holder.getWorldPosition(m.world);
          m.mesh.rotation.y = a * 0.1;
          m.atmoMesh.material.uniforms.uCenter.value.copy(m.world);
        });
      });
    },
  };
}
