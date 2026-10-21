import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { useGame } from '../../game/store';
import { planeKey } from '../../levels/level';
import { field } from '../area/field';
import { COLORS, SLAB_H } from '../constants';
import { clamp01, smoothstep } from '../easing';
import { uploadInstances } from '../instances';
import { sceneNow } from '../sceneTime';

const CHIPS = 9;
const LIFE = 0.7;
const GRAVITY = 9;
const MAX = 200;

interface Chip {
  dir: number;
  speed: number;
  up: number;
  spin: THREE.Vector3;
  size: number;
}

interface BurstFx {
  x: number;
  y: number;
  plane: string;
  t0: number;
  chips: Chip[];
}

const active: BurstFx[] = [];

export const burstFx = {
  push(x: number, y: number, plane: string, t0: number, fade = 1) {
    const chips = Array.from({ length: CHIPS }, (_, k) => ({
      dir: ((k + Math.random() * 0.6) / CHIPS) * Math.PI * 2,
      speed: 0.9 + Math.random() * 0.9,
      up: 1.8 + Math.random() * 1.6,
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(14),
      size: (0.6 + Math.random() * 0.6) * fade,
    }));
    active.push({ x, y, plane, t0, chips });
    if (active.length > MAX) active.shift();
  },
  clear() {
    active.length = 0;
  },
};

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const e = new THREE.Euler();
const pos = new THREE.Vector3();
const scl = new THREE.Vector3();

export function GroundBursts() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => new RoundedBoxGeometry(0.11, 0.06, 0.09, 2, 0.02), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.slabTop, roughness: 0.6 }), []);
  useEffect(() => () => geom.dispose(), [geom]);
  const plane = useGame((s) => planeKey(s.inputs));

  useFrame(() => {
    const g = mesh.current;
    if (!g) return;
    const t = sceneNow();
    while (active.length && t - active[0].t0 > LIFE) active.shift();
    let n = 0;
    for (const fx of active) {
      const u = t - fx.t0;
      if (fx.plane !== plane || u < 0) continue;
      const base = field.heightAt(fx.x, fx.y) * SLAB_H;
      const k = 1 - smoothstep(clamp01((u - LIFE * 0.45) / (LIFE * 0.55)));
      for (const c of fx.chips) {
        if (n >= g.instanceMatrix.count) break;
        const r = 0.12 + c.speed * u;
        pos.set(fx.x + Math.cos(c.dir) * r, base + c.up * u - GRAVITY * 0.5 * u * u, -fx.y - Math.sin(c.dir) * r);
        if (pos.y < 0) pos.y = 0;
        q.setFromEuler(e.set(c.spin.x * u, c.spin.y * u, c.spin.z * u));
        m.compose(pos, q, scl.setScalar(c.size * k));
        g.setMatrixAt(n++, m);
      }
    }
    g.count = n;
    uploadInstances(n, g.instanceMatrix);
  });

  return <instancedMesh ref={mesh} args={[geom, mat, MAX * CHIPS]} frustumCulled={false} count={0} />;
}
