import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { planeKey } from '../../levels/level';
import { field } from '../area/field';
import { SLAB_H } from '../constants';
import { eggGeometry } from '../models';
import { sceneNow } from '../sceneTime';
import { colorUniform, GLSL_COMMON } from '../shaders/common';
import { clamp01, smoothstep } from '../easing';

const HATCH_WOBBLE = 0.16;
export const HATCH_EMERGE = HATCH_WOBBLE + 0.05;
const CAP_LIFE = 0.5;
const CUP_LIFE = 0.55;
const MAX = 256;

interface HatchFx {
  x: number;
  y: number;
  plane: string;
  t0: number;
  dx: number;
  dy: number;
  s: number;
  dir: number;
}

const active: HatchFx[] = [];

export const hatchFx = {
  push(fx: Omit<HatchFx, 't0' | 'dir'>) {
    active.push({ ...fx, t0: sceneNow(), dir: Math.random() * Math.PI * 2 });
    if (active.length > MAX) active.shift();
  },
  clear() {
    active.length = 0;
  },
};

const vertex = /* glsl */ `
varying vec3 vN;
varying vec3 vLocal;
void main() {
  vLocal = position;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const fragment = /* glsl */ `
uniform vec3 uEgg;
uniform float uPart;
varying vec3 vN;
varying vec3 vLocal;
${GLSL_COMMON}
void main() {
  float a = atan(vLocal.z, vLocal.x) / 6.2831853 * 9.0;
  float tri = abs(fract(a) * 2.0 - 1.0) * 2.0 - 1.0;
  float crack = 0.2 + 0.024 * tri;
  if ((uPart < 0.5) == (vLocal.y > crack)) discard;
  vec3 n = normalize(vN);
  vec3 col = uEgg;
  if (!gl_FrontFacing) {
    n = -n;
    col = mix(uEgg, vec3(1.0), 0.35) * 0.9;
  }
  gl_FragColor = vec4(shadeLit(col, n), 1.0);
  #include <colorspace_fragment>
}
`;

const m = new THREE.Matrix4();
const r = new THREE.Matrix4();
const q = new THREE.Quaternion();
const axis = new THREE.Vector3();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const pivot = new THREE.Matrix4();
const unpivot = new THREE.Matrix4();
const NO_ROT = new THREE.Quaternion();

export function HatchShells() {
  const cup = useRef<THREE.InstancedMesh>(null);
  const cap = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => eggGeometry(), []);
  const [cupMat, capMat] = useMemo(
    () =>
      [0, 1].map(
        (part) =>
          new THREE.ShaderMaterial({
            vertexShader: vertex,
            fragmentShader: fragment,
            side: THREE.DoubleSide,
            uniforms: { uEgg: colorUniform('egg'), uPart: { value: part } },
          }),
      ),
    [],
  );
  const plane = useGame((s) => planeKey(s.inputs));

  useFrame(() => {
    const a = cup.current;
    const b = cap.current;
    if (!a || !b) return;
    const t = sceneNow();
    while (active.length && t - active[0].t0 > HATCH_WOBBLE + Math.max(CAP_LIFE, CUP_LIFE)) active.shift();
    let na = 0;
    let nb = 0;
    for (const fx of active) {
      if (fx.plane !== plane) continue;
      const u = t - fx.t0;
      const base = field.heightAt(fx.x, fx.y) * SLAB_H;
      const bx = fx.x + fx.dx;
      const bz = -fx.y - fx.dy;
      if (u < HATCH_WOBBLE) {
        const w = u / HATCH_WOBBLE;
        const tilt = Math.sin(w * Math.PI * 4) * 0.22 * w;
        q.setFromAxisAngle(axis.set(Math.cos(fx.dir), 0, -Math.sin(fx.dir)), tilt);
        m.compose(pos.set(bx, base, bz), q, scl.setScalar(fx.s));
        a.setMatrixAt(na++, m);
        b.setMatrixAt(nb++, m);
        continue;
      }
      const v = u - HATCH_WOBBLE;
      if (v < CUP_LIFE) {
        const k = 1 - smoothstep(clamp01((v - 0.15) / (CUP_LIFE - 0.15)));
        q.identity();
        m.compose(pos.set(bx, base - 0.03 * (1 - k), bz), q, scl.set(fx.s * k, fx.s * k * k, fx.s * k));
        a.setMatrixAt(na++, m);
      }
      if (v < CAP_LIFE) {
        const k = 1 - smoothstep(clamp01((v - 0.22) / (CAP_LIFE - 0.22)));
        const side = 0.9 * v;
        const lift = 2.8 * v - 6.5 * v * v;
        pos.set(bx + Math.cos(fx.dir) * side, base + Math.max(lift, -0.05), bz - Math.sin(fx.dir) * side);
        q.setFromAxisAngle(axis.set(Math.sin(fx.dir), 0, Math.cos(fx.dir)), -7 * v);
        pivot.makeTranslation(0, 0.2 * fx.s, 0);
        unpivot.makeTranslation(0, -0.2 * fx.s, 0);
        r.makeRotationFromQuaternion(q);
        m.compose(pos, NO_ROT, scl.setScalar(fx.s * k));
        m.multiply(pivot).multiply(r).multiply(unpivot);
        b.setMatrixAt(nb++, m);
      }
    }
    a.count = na;
    b.count = nb;
    a.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={cup} args={[geom, cupMat, MAX]} frustumCulled={false} count={0} />
      <instancedMesh ref={cap} args={[geom, capMat, MAX]} frustumCulled={false} count={0} />
    </>
  );
}
