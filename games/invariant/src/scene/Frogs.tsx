import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGame } from '../store/game';
import { COLORS } from './constants';
import { frogWorld, now, type FrogSim } from './frogSim';
import { baseHeightAt } from './tiles';

const MAX_FROGS = 600;

/** A round, minimal frog built from spheres. Vertex colors: 1 = body (tinted), dark = pupils. */
export function makeFrogGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const paint = (g: THREE.BufferGeometry, shade: number) => {
    const c = new Float32Array(g.attributes.position.count * 3).fill(shade);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    return g;
  };
  const body = new THREE.SphereGeometry(0.26, 24, 18);
  body.scale(1, 0.72, 1.05);
  body.translate(0, 0.19, 0);
  parts.push(paint(body, 1));
  const belly = new THREE.SphereGeometry(0.2, 18, 12);
  belly.scale(1, 0.55, 0.9);
  belly.translate(0, 0.14, 0.09);
  parts.push(paint(belly, 1.18));
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.095, 16, 12);
    eye.translate(sx * 0.13, 0.36, 0.1);
    parts.push(paint(eye, 1));
    const white = new THREE.SphereGeometry(0.07, 14, 10);
    white.translate(sx * 0.14, 0.38, 0.15);
    parts.push(paint(white, 2.4));
    const pupil = new THREE.SphereGeometry(0.038, 12, 8);
    pupil.translate(sx * 0.145, 0.39, 0.205);
    parts.push(paint(pupil, 0.06));
    const leg = new THREE.SphereGeometry(0.11, 14, 10);
    leg.scale(1, 0.55, 1.4);
    leg.translate(sx * 0.21, 0.07, -0.08);
    parts.push(paint(leg, 0.92));
    const hand = new THREE.SphereGeometry(0.06, 12, 8);
    hand.scale(1.2, 0.5, 1.2);
    hand.translate(sx * 0.14, 0.03, 0.2);
    parts.push(paint(hand, 0.92));
  }
  const merged = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  return merged!;
}

const dummy = new THREE.Object3D();
const col = new THREE.Color();
const green = new THREE.Color(COLORS.frog);
const purple = new THREE.Color(COLORS.testFrog);
const red = new THREE.Color(COLORS.fail);

function frogTransform(f: FrogSim, t: number, landedPulse: () => void): { x: number; y: number; z: number; sx: number; sy: number; yaw: number } {
  let x = f.x;
  let y = f.y;
  let h = baseHeightAt(x, y);
  let sy = 1;
  let sx = 1;
  let yaw = 0;
  if (f.hop) {
    const u = Math.min(1, (t - f.hop.t0) / f.hop.dur);
    const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    x = f.hop.fx + (f.hop.tx - f.hop.fx) * e;
    y = f.hop.fy + (f.hop.ty - f.hop.fy) * e;
    const h0 = baseHeightAt(f.hop.fx, f.hop.fy);
    const h1 = baseHeightAt(f.hop.tx, f.hop.ty);
    const dist = Math.hypot(f.hop.tx - f.hop.fx, f.hop.ty - f.hop.fy);
    h = h0 + (h1 - h0) * u + Math.sin(Math.PI * u) * (0.45 + 0.18 * dist);
    sy = 1 + 0.25 * Math.sin(Math.PI * u);
    sx = 1 - 0.1 * Math.sin(Math.PI * u);
    yaw = Math.atan2(f.hop.tx - f.hop.fx, -(f.hop.ty - f.hop.fy));
    if (u >= 1) landedPulse();
  } else {
    const dx = f.lastDir ?? 0;
    yaw = dx;
    // idle breathing
    sy = 1 + 0.03 * Math.sin(t * 2.2 + f.phase);
  }
  if (f.drop) {
    const u = Math.min(1, (t - f.drop.t0) / f.drop.dur);
    h += f.drop.from * (1 - u * u);
    if (u >= 1) {
      f.drop = undefined;
      sy = 0.75;
    }
  }
  if (f.carried !== undefined) h += f.carried;
  let s = 1;
  if (f.hatchT0 !== undefined) {
    const u = Math.min(1, (t - f.hatchT0) / 0.35);
    s = u < 1 ? 0.2 + 0.8 * (1 - Math.pow(1 - u, 3)) * (1 + 0.15 * Math.sin(u * Math.PI)) : 1;
  }
  if (f.fadeT0 !== undefined) s *= Math.max(0, 1 - (t - f.fadeT0) / 0.3);
  return { x, y: h, z: -y, sx: sx * s, sy: sy * s, yaw };
}

declare module './frogSim' {
  interface FrogSim {
    lastDir?: number;
  }
}

export function Frogs() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => makeFrogGeometry(), []);
  const pond = useGame((s) => s.pond);
  const hasPonds = useGame((s) => !!s.level?.pond);
  const blink = useRef(new Map<number, number>());
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = now();
    let n = 0;
    for (const f of frogWorld.frogs) {
      if (hasPonds && f.pond !== pond) continue;
      if (n >= MAX_FROGS) break;
      const tr = frogTransform(f, t, () => {});
      if (f.hop) f.lastDir = tr.yaw;
      dummy.position.set(tr.x, tr.y, tr.z);
      dummy.rotation.set(0, tr.yaw, 0);
      // blink: squash eyes is hard on a merged mesh; a tiny vertical squash reads as a blink
      let by = 1;
      const nextBlink = blink.current.get(f.id) ?? t + 2 + Math.random() * 4;
      if (t > nextBlink) {
        by = 0.9;
        if (t > nextBlink + 0.12) blink.current.set(f.id, t + 2 + Math.random() * 5);
      } else blink.current.set(f.id, nextBlink);
      dummy.scale.set(tr.sx, tr.sy * by, tr.sx);
      dummy.updateMatrix();
      m.setMatrixAt(n, dummy.matrix);
      col.copy(f.red ? red : f.kind === 'real' ? green : purple);
      m.setColorAt(n, col);
      n++;
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  return (
    <instancedMesh
      ref={ref}
      args={[geom, undefined, MAX_FROGS]}
      castShadow
      frustumCulled={false}
      onClick={(e) => {
        e.stopPropagation();
        const idx = e.instanceId;
        if (idx === undefined) return;
        const visible = frogWorld.frogs.filter((f) => !hasPonds || f.pond === pond);
        const f = visible[idx];
        if (f) useGame.getState().patch({ selected: f.state });
      }}
    >
      <meshStandardMaterial vertexColors roughness={0.55} />
    </instancedMesh>
  );
}
