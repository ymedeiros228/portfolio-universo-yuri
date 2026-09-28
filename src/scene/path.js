// ============================================================
// Roteiro da câmera: uma parada por seção da página.
// Visão geral → um planeta por projeto → céu profundo (skills)
// → galáxia de perfil (sobre, stack) → recuo final (contato).
// As paradas dos sistemas são recalculadas a cada quadro porque
// a galáxia gira. Entre paradas a câmera faz um arco suave.
// ============================================================
import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3(), _fwd = new THREE.Vector3();
const _right = new THREE.Vector3(), _camUp = new THREE.Vector3();

// Enquadra um planeta em 3/4 de luz: a câmera fica girada em relação
// à direção do núcleo (a fonte de luz), com o terminador à vista,
// o planeta à direita da tela e as luas inteiras no quadro.
function frameSystem(stop, sys, mobile) {
  const S = sys.center;
  _d.set(S.x, 0, S.z).normalize().applyAxisAngle(UP, 1.95);
  const dist = sys.reach * (mobile ? 3.8 : 1.95);
  stop.pos.copy(S).addScaledVector(_d, dist * 0.9).addScaledVector(UP, dist * 0.36);
  _fwd.copy(S).sub(stop.pos).normalize();
  _right.crossVectors(_fwd, UP).normalize();
  _camUp.crossVectors(_right, _fwd).normalize();
  stop.look.copy(S);
  if (mobile) stop.look.addScaledVector(_camUp, -dist * 0.24);
  else stop.look.addScaledVector(_right, -dist * 0.3);
}

export function buildPath(systems, mobile) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const stops = [];
  // 0 — visão geral: a galáxia inteira, inclinada
  // no celular (tela em pé): mais de cima e com lente mais aberta para caber a galáxia inteira
  stops.push({ pos: mobile ? v(0, 96, 34) : v(0, 43, 45), look: v(0, 0, mobile ? 1 : 1.5).add(mobile ? v(0, 0, 0) : v(0, -4.5, 0)), fov: mobile ? 56 : 40 });
  // 1..n — um planeta por projeto
  systems.forEach((sys) => stops.push({ pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 40, sys }));
  // skills — de costas para a galáxia, céu profundo
  stops.push({ pos: v(4, 5, 44), look: v(10, 11, 110), fov: 46 });
  // sobre — galáxia quase de perfil
  stops.push({ pos: v(-46, 10, 26), look: v(2, -4, -2), fov: 38 });
  // stack + github — deriva lateral
  stops.push({ pos: v(-30, 9, 44), look: v(4, -4, 0), fov: 38 });
  // contato — recuo: a galáxia inteira ao longe
  // (desktop: galáxia inteira na metade de baixo, sob o painel; celular: vista mais alta)
  stops.push({ pos: mobile ? v(0, 80, 60) : v(6, 30, 88), look: mobile ? v(0, 6, 0) : v(0, 13, 0), fov: mobile ? 50 : 34 });

  const n = stops.length;
  // curvas Catmull-Rom (centrípetas) pelas paradas: velocidade contínua,
  // sem quinas nem "freadas" secas ao chegar e sair de cada parada
  const posCurve = new THREE.CatmullRomCurve3(stops.map((s) => s.pos), false, "centripetal");
  const lookCurve = new THREE.CatmullRomCurve3(stops.map((s) => s.look), false, "centripetal");
  const _tmp = new THREE.Vector3();
  const _core = new THREE.Vector3(0, -1, 0);
  return {
    count: n,
    stops,
    update() {
      stops.forEach((s) => s.sys && frameSystem(s, s.sys, mobile));
    },
    // nunca atravessar um planeta: empurra a câmera para fora da esfera de cada sistema
    avoid(pos) {
      systems.forEach((sys) => {
        const safe = sys.reach * 1.15;
        _tmp.subVectors(pos, sys.center);
        const d = _tmp.length();
        if (d < safe) pos.copy(sys.center).addScaledVector(_tmp.divideScalar(Math.max(d, 1e-4)), safe);
      });
    },
    // p: progresso em "paradas" (0..n-1), já com pausa em cada parada
    sample(p, outPos, outLook) {
      const q = THREE.MathUtils.clamp(p, 0, n - 1);
      const i = Math.min(n - 2, Math.floor(q));
      const f = q - i;
      const A = stops[i], B = stops[i + 1];
      posCurve.getPoint(q / (n - 1), outPos);
      lookCurve.getPoint(q / (n - 1), outLook);
      // durante a viagem entre dois planetas, o olhar puxa para o núcleo da
      // galáxia: sempre há luz em cena (antes, a câmera olhava para o vazio)
      if (A.sys && B.sys) {
        const w = Math.sin(Math.PI * f);
        outLook.lerp(_core, w * w * 0.75);
      }
      // arco leve: sobe no meio do trajeto, proporcional à distância percorrida
      outPos.y += Math.sin(Math.PI * f) * A.pos.distanceTo(B.pos) * 0.1;
      this.avoid(outPos);
      const e = f * f * (3 - 2 * f);
      return THREE.MathUtils.lerp(A.fov, B.fov, e);
    },
  };
}

// Transforma o scroll bruto em progresso com um "respiro" curto em cada parada.
// Mistura linear + smootherstep: a câmera desacelera ao chegar, mas nunca trava.
export function dwell(raw) {
  const i = Math.floor(raw);
  const f = raw - i;
  const hold = 0.1;
  const x = THREE.MathUtils.clamp((f - hold) / (1 - hold * 2), 0, 1);
  const s = x * x * x * (x * (x * 6 - 15) + 10);
  return i + x * 0.3 + s * 0.7;
}
