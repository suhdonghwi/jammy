import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { planeKey } from '../../levels/level';
import { field } from '../area/field';
import { clamp01 } from '../easing';
import { SLAB_H } from '../constants';
import { ringGeometry, TONE_COLORS } from '../labels/TileTag';
import { sceneNow } from '../sceneTime';
import { frogWorld, type FrogSim } from './frogWorld';
import { HopLine } from './HopLine';

export const ARC_DRAW = 0.45;
const MAX = 80;

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
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export const hopArcs = {
  add(a: Arc) {
    arcs = [...arcs, a].slice(-MAX);
    changed();
  },
  clear() {
    arcs = [];
    changed();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
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

function instancedRings(count: number) {
  const g = ringGeometry.clone();
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
const RING = new THREE.Color(TONE_COLORS.good);

const fading = (frog: FrogSim | undefined, t: number) => (frog?.leave ? 1 - clamp01((t - frog.leave.t0) / frog.leave.dur) : 1);

function GhostHop({ arc, plane }: { arc: Arc; plane: string }) {
  return (
    <HopLine
      path={() => {
        if (arc.plane !== plane) return null;
        const frog = frogWorld.frogs.find((f) => f.id === arc.frog);
        if (!frog) return null;
        const t = sceneNow();
        const fx = frog.drawn ? frog.drawn.x : arc.fx;
        const fy = frog.drawn ? -frog.drawn.z : arc.fy;
        return {
          from: [fx, fy, field.heightAt(arc.fx, arc.fy) * SLAB_H],
          to: [arc.tx, arc.ty, field.heightAt(arc.tx, arc.ty) * SLAB_H],
          drawn: (t - arc.t0) / ARC_DRAW,
          opacity: arc.fade * fading(frog, t),
        };
      }}
    />
  );
}

export function HopArcs() {
  const list = useSyncExternalStore(hopArcs.subscribe, () => arcs);
  const rings = useRef<THREE.InstancedMesh>(null);
  const plane = useGame((s) => planeKey(s.inputs));
  const parts = useMemo(() => instancedRings(MAX), []);

  useFrame(() => {
    const r = rings.current;
    if (!r) return;
    const t = sceneNow();
    const ghosts = new Map(frogWorld.frogs.map((f) => [f.id, f]));
    if (arcs.some((a) => !ghosts.has(a.frog))) {
      arcs = arcs.filter((a) => ghosts.has(a.frog));
      changed();
    }
    let nr = 0;
    for (const a of arcs) {
      if (a.plane !== plane) continue;
      const ring = clamp01((t - a.t0 - ARC_DRAW) / 0.25);
      if (ring <= 0) continue;
      const h1 = field.heightAt(a.tx, a.ty) * SLAB_H;
      m.compose(pos.set(a.tx, h1 + 0.014, -a.ty), q, scl.setScalar(0.9 + 0.1 * ring));
      r.setMatrixAt(nr, m);
      parts.color.setXYZ(nr, RING.r, RING.g, RING.b);
      parts.alpha.setX(nr, 0.85 * ring * a.fade * fading(ghosts.get(a.frog), t));
      nr++;
    }
    r.count = nr;
    r.instanceMatrix.needsUpdate = true;
    parts.color.needsUpdate = true;
    parts.alpha.needsUpdate = true;
  });

  return (
    <>
      {list.map((a) => (
        <GhostHop key={a.frog} arc={a} plane={plane} />
      ))}
      <instancedMesh ref={rings} args={[parts.g, parts.mat, MAX]} count={0} frustumCulled={false} renderOrder={9} />
    </>
  );
}
