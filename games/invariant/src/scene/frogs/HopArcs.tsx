import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { planeKey } from '../../levels/level';
import { field } from '../area/field';
import { clamp01 } from '../easing';
import { SLAB_H } from '../constants';
import { APPEAR, ringPop } from '../labels/Region';
import { ringGeometry, TONE_COLORS, washGeometry } from '../labels/TileTag';
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
  const washes = useRef<THREE.InstancedMesh>(null);
  const plane = useGame((s) => planeKey(s.inputs));
  const parts = useMemo(() => ({ ring: instancedParts(ringGeometry, MAX), wash: instancedParts(washGeometry, MAX) }), []);

  useFrame(() => {
    const r = rings.current;
    const w = washes.current;
    if (!r || !w) return;
    const t = sceneNow();
    const ghosts = new Map(frogWorld.frogs.map((f) => [f.id, f]));
    if (arcs.some((a) => !ghosts.has(a.frog))) {
      arcs = arcs.filter((a) => ghosts.has(a.frog));
      changed();
    }
    let nr = 0;
    for (const a of arcs) {
      if (a.plane !== plane) continue;
      const shown = clamp01((t - a.t0 - ARC_DRAW) / APPEAR);
      if (shown <= 0) continue;
      const { scale, alpha } = ringPop(shown);
      const h1 = field.heightAt(a.tx, a.ty) * SLAB_H;
      m.compose(pos.set(a.tx, h1 + 0.012, -a.ty), q, scl.set(scale, 1, scale));
      const fade = alpha * a.fade * fading(ghosts.get(a.frog), t);
      for (const [mesh, p, opacity] of [
        [r, parts.ring, 0.85],
        [w, parts.wash, 0.3],
      ] as const) {
        mesh.setMatrixAt(nr, m);
        p.color.setXYZ(nr, RING.r, RING.g, RING.b);
        p.alpha.setX(nr, opacity * fade);
      }
      nr++;
    }
    for (const [mesh, p] of [
      [r, parts.ring],
      [w, parts.wash],
    ] as const) {
      mesh.count = nr;
      mesh.instanceMatrix.needsUpdate = true;
      p.color.needsUpdate = true;
      p.alpha.needsUpdate = true;
    }
  });

  return (
    <>
      {list.map((a) => (
        <GhostHop key={a.frog} arc={a} plane={plane} />
      ))}
      <instancedMesh ref={washes} args={[parts.wash.g, parts.wash.mat, MAX]} count={0} frustumCulled={false} renderOrder={8} />
      <instancedMesh ref={rings} args={[parts.ring.g, parts.ring.mat, MAX]} count={0} frustumCulled={false} renderOrder={9} />
    </>
  );
}
