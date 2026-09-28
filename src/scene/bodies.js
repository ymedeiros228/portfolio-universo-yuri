// ============================================================
// Shaders dos corpos celestes: estrela (granulação), planetas
// por tipo (gasoso, oceânico, gelo, rochoso, lava), atmosfera
// e anéis com a sombra do planeta.
// ============================================================
// Ruído 3D (sem costura na esfera) + fbm.
const NOISE3 = /* glsl */ `
  float h3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); } // sem simetria espelhada
  float n3(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm3(vec3 p){ float v = 0., a = .5; for (int i = 0; i < 6; i++){ v += a * n3(p); p = p * 2.03 + 11.7; a *= .5; } return v; }
`;

/* ------------------------------ Sol ------------------------------ */
export const SUN_VERT = /* glsl */ `
  varying vec3 vPos; varying vec3 vN; varying vec3 vView;
  void main(){
    vPos = position; vN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
export const SUN_FRAG = /* glsl */ `
  uniform float uTime; uniform vec3 uTint; varying vec3 vPos; varying vec3 vN; varying vec3 vView;
  ${NOISE3}
  void main(){
    vec3 p = normalize(vPos);
    // granulação: células convectivas que fervem devagar
    float g = fbm3(p * 7.0 + vec3(0.0, uTime * 0.05, uTime * 0.03));
    float cells = fbm3(p * 22.0 - uTime * 0.08);
    float spots = smoothstep(0.66, 0.74, fbm3(p * 3.0 + 4.0));
    float mu = max(dot(vN, vView), 0.0);
    float limb = pow(mu, 0.45); // escurecimento de borda
    vec3 hot = mix(vec3(1.0, 0.95, 0.85), uTint, 0.25), mid = uTint, cool = uTint * vec3(0.55, 0.35, 0.3);
    vec3 c = mix(mid, hot, g * 0.9 + cells * 0.35);
    c = mix(c, cool, spots * 0.7);
    c *= mix(0.35, 1.0, limb);
    gl_FragColor = vec4(c * 1.15, 1.0); // HDR: alimenta o bloom
  }
`;

/* ---------------------------- planetas ---------------------------- */
export const PLANET_VERT = /* glsl */ `
  varying vec3 vObj; varying vec3 vWorldN; varying vec3 vWorldPos;
  void main(){
    vObj = position;
    vWorldN = normalize(mat3(modelMatrix) * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0); vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
export const PLANET_FRAG = /* glsl */ `
  uniform vec3 uSun; uniform vec3 uA; uniform vec3 uB; uniform vec3 uC; uniform vec3 uAtmo;
  uniform int uType; uniform float uSeed; uniform float uTime;
  varying vec3 vObj; varying vec3 vWorldN; varying vec3 vWorldPos;
  ${NOISE3}
  void main(){
    vec3 p = normalize(vObj) + uSeed;
    vec3 n = normalize(vWorldN);
    float lat = normalize(vObj).y;
    vec3 col; float spec = 0.0;
    if (uType == 0) {
      // gigante gasoso: faixas turbulentas por latitude
      float warp = fbm3(p * 3.0 + vec3(uTime * 0.01, 0.0, 0.0));
      float bands = sin(lat * 18.0 + warp * 4.0) * 0.5 + 0.5;
      float fine = fbm3(vec3(lat * 40.0, p.x * 2.0, p.z * 2.0));
      col = mix(uB, uA, bands);
      col = mix(col, uC, smoothstep(0.55, 0.9, fine) * 0.5);
      float storm = smoothstep(0.08, 0.0, length(vec2(atan(p.z - uSeed, p.x - uSeed) - 1.0, (lat + 0.25) * 3.0)) - 0.05);
      col = mix(col, uC * vec3(1.0, 0.8, 0.7), storm * 0.6);
    } else if (uType == 1) {
      // oceânico: continentes, gelo nos polos e nuvens
      float land = smoothstep(0.5, 0.56, fbm3(p * 2.2));
      col = mix(uA, uB, land);
      col = mix(col, uC, smoothstep(0.78, 0.92, abs(lat)));
      float clouds = smoothstep(0.52, 0.75, fbm3(p * 4.0 + vec3(uTime * 0.015, 0.0, 0.0)));
      col = mix(col, vec3(1.0), clouds * 0.85);
      spec = (1.0 - land) * (1.0 - clouds);
    } else if (uType == 2) {
      // gelo: planícies claras cortadas por fraturas
      float f = fbm3(p * 3.5);
      float cracks = 1.0 - smoothstep(0.0, 0.03, abs(fbm3(p * 6.0) - 0.5));
      col = mix(uB, uC, f);
      col = mix(col, uA, cracks * 0.8);
      spec = 0.3;
    } else if (uType == 3) {
      // rochoso: crateras e terreno árido
      float f = fbm3(p * 4.0);
      float craters = smoothstep(0.62, 0.66, fbm3(p * 9.0)) - smoothstep(0.66, 0.72, fbm3(p * 9.0)) * 0.6;
      col = mix(uB, uA, f);
      col = mix(col, uC, craters * 0.6);
    } else {
      // lava: crosta escura com rachaduras incandescentes
      float f = fbm3(p * 3.0);
      float veins = 1.0 - smoothstep(0.0, 0.022, abs(fbm3(p * 3.2 + uTime * 0.01) - 0.5));
      col = mix(uA, uA * 1.6, f);
      col += uB * veins * 1.3; // emissivo
    }
    vec3 L = normalize(uSun - vWorldPos);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float ndl = dot(n, L);
    float diff = smoothstep(-0.15, 0.6, ndl);
    vec3 H = normalize(L + V);
    float sp = pow(max(dot(n, H), 0.0), 60.0) * spec * step(0.0, ndl);
    float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
    vec3 lit = col * diff * 0.95 + sp * 0.45;
    lit += uAtmo * rim * smoothstep(-0.3, 0.4, ndl) * 1.2;
    // lado noturno quase preto, com um fio de luz ambiente
    lit += col * 0.045 + uAtmo * 0.012; // lado noturno com um fio de luz ambiente
    // lava: as veias brilham também no lado noturno
    if (uType == 4) lit += uB * (1.0 - smoothstep(0.0, 0.022, abs(fbm3(p * 3.2 + uTime * 0.01) - 0.5))) * 0.8 * (1.0 - diff);
    gl_FragColor = vec4(lit, 1.0);
  }
`;

// Halo atmosférico: esfera maior, só a borda, aditiva.
export const ATMO_FRAG = /* glsl */ `
  uniform vec3 uSun; uniform vec3 uAtmo; uniform vec3 uCenter;
  varying vec3 vObj; varying vec3 vWorldN; varying vec3 vWorldPos;
  void main(){
    vec3 n = normalize(vWorldN);
    vec3 V = normalize(cameraPosition - vWorldPos);
    // casca 1.12× o planeta: brilho máximo rente ao limbo (cos ≈ 0.446)
    // e zero na borda externa — um halo macio, sem contorno duro
    float c = abs(dot(n, V));
    float halo = smoothstep(0.0, 0.446, c);
    halo *= halo;
    float lit = smoothstep(-0.35, 0.55, dot(normalize(vWorldPos - uCenter), normalize(uSun - uCenter)));
    gl_FragColor = vec4(uAtmo * halo * lit * 0.9, 1.0);
  }
`;

export const RING_FRAG = /* glsl */ `
  uniform vec3 uSun; uniform vec3 uColor; uniform vec3 uCenter; uniform float uPlanetR;
  varying vec2 vUv; varying vec3 vWorldPos; varying float vR;
  float h(float x){ return fract(sin(x * 91.7) * 4375.5); }
  void main(){
    float r = vR;
    float bands = 0.55 + 0.45 * sin(r * 120.0) * sin(r * 37.0 + 1.3);
    float gap = smoothstep(0.0, 0.01, abs(r - 0.72)) * smoothstep(0.0, 0.006, abs(r - 0.86));
    float a = bands * gap * smoothstep(0.0, 0.05, r - 0.5) * smoothstep(0.0, 0.08, 1.0 - r);
    // sombra do planeta sobre o anel
    vec3 toSun = normalize(uSun - uCenter);
    vec3 rel = vWorldPos - uCenter;
    float along = dot(rel, toSun);
    float perp = length(rel - toSun * along);
    float shadow = along < 0.0 ? mix(0.1, 1.0, smoothstep(uPlanetR * 0.9, uPlanetR * 1.04, perp)) : 1.0; // penumbra suave
    gl_FragColor = vec4(uColor * shadow * 0.9, a * 0.75);
  }
`;

