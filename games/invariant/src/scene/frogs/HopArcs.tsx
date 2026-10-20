import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { planeKey } from '../../levels/level';
import { field } from '../area/field';
import { clamp01 } from '../easing';
import { SLAB_H } from '../constants';
import { ringGeometry, TONE_COLORS } from '../labels/TileTag';
import { sceneNow } from '../sceneTime';
import { frogWorld } from './frogWorld';
import { hopHeight } from './motion';

const DOTS = 16;
export const ARC_DRAW = 0.45;
const MAX = 80;
const LIFT = 0.22;

interface Arc {
  frog: number;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  plane: string;
  t0: number;
  fade: number;
}

let arcs: Arc[] = [];

export const hopArcs = {
  add(a: Arc) {
    arcs.push(a);
    if (arcs.length > MAX) arcs.shift();
  },
  clear() {
    arcs = [];
  },
};

const vertex = /* glsl */ `
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;
const fragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  gl_FragColor = vec4(vColor, vAlpha);
  #include <colorspace_fragment>
}
`;

function instancedParts(base: THREE.BufferGeometry, count: number) {
  const g = base.clone();
  const color = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  g.setAttribute('aColor', color);
  g.setAttribute('aAlpha', alpha);
  const mat = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false });
  return { g, mat, color, alpha };
}

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();
const DOT = new THREE.Color('#ffffff');
const RING = new THREE.Color(TONE_COLORS.good);

export function HopArcs() {
  const dots = useRef<THREE.InstancedMesh>(null);
  const rings = useRef<THREE.InstancedMesh>(null);
  const plane = useGame((s) => planeKey(s.inputs));
  const parts = useMemo(
    () => ({ dot: instancedParts(new THREE.SphereGeometry(0.045, 10, 8), MAX * DOTS), ring: instancedParts(ringGeometry, MAX) }),
    [],
  );

  useFrame(() => {
    const d = dots.current;
    const r = rings.current;
    if (!d || !r) return;
    const t = sceneNow();
    const ghosts = new Map(frogWorld.frogs.map((f) => [f.id, f]));
    if (arcs.some((a) => !ghosts.has(a.frog))) arcs = arcs.filter((a) => ghosts.has(a.frog));
    let nd = 0;
    let nr = 0;
    for (const a of arcs) {
      if (a.plane !== plane) continue;
      const frog = ghosts.get(a.frog);
      const drawn = frog?.drawn;
      const gone = frog?.leave ? 1 - clamp01((t - frog.leave.t0) / frog.leave.dur) : 1;
      const fx = drawn ? drawn.x : a.fx;
      const fy = drawn ? -drawn.z : a.fy;
      const h0 = field.heightAt(a.fx, a.fy) * SLAB_H;
      const h1 = field.heightAt(a.tx, a.ty) * SLAB_H;
      const H = hopHeight(Math.hypot(a.tx - fx, a.ty - fy));
      for (let k = 0; k < DOTS; k++) {
        const f = (k + 0.5) / DOTS;
        const shown = clamp01((t - a.t0 - f * ARC_DRAW) / 0.08);
        if (shown <= 0) continue;
        pos.set(fx + (a.tx - fx) * f, h0 + (h1 - h0) * f + 4 * H * f * (1 - f) + LIFT, -(fy + (a.ty - fy) * f));
        m.compose(pos, q, scl.setScalar(0.6 + 0.4 * shown));
        d.setMatrixAt(nd, m);
        parts.dot.color.setXYZ(nd, DOT.r, DOT.g, DOT.b);
        parts.dot.alpha.setX(nd, 0.9 * shown * a.fade * gone);
        nd++;
      }
      const ring = clamp01((t - a.t0 - ARC_DRAW) / 0.25);
      if (ring > 0) {
        m.compose(pos.set(a.tx, h1 + 0.014, -a.ty), q, scl.setScalar(0.9 + 0.1 * ring));
        r.setMatrixAt(nr, m);
        parts.ring.color.setXYZ(nr, RING.r, RING.g, RING.b);
        parts.ring.alpha.setX(nr, 0.85 * ring * a.fade * gone);
        nr++;
      }
    }
    d.count = nd;
    r.count = nr;
    for (const [mesh, p] of [
      [d, parts.dot],
      [r, parts.ring],
    ] as const) {
      mesh.instanceMatrix.needsUpdate = true;
      p.color.needsUpdate = true;
      p.alpha.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={dots} args={[parts.dot.g, parts.dot.mat, MAX * DOTS]} count={0} frustumCulled={false} renderOrder={10} />
      <instancedMesh ref={rings} args={[parts.ring.g, parts.ring.mat, MAX]} count={0} frustumCulled={false} renderOrder={9} />
    </>
  );
}
