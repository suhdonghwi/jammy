import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { COLORS, SLAB_H } from './constants';
import { field } from './field';
import { frogWorld, now, type FrogSim } from './frogSim';
import { frogGeometry, frogMaterial } from './models';
import { getBlobTexture } from './shaders';

const MAX_FROGS = 400;

const dummy = new THREE.Object3D();
const col = new THREE.Color();
const C = {
  real: new THREE.Color(COLORS.frog),
  test: new THREE.Color(COLORS.testFrog),
  fail: new THREE.Color(COLORS.fail),
};

const baseAt = (x: number, y: number) => field.heightAt(x, y) * SLAB_H;

interface Pose {
  x: number;
  y: number;
  z: number;
  /** ground height under the frog (for the shadow) */
  ground: number;
  sx: number;
  sy: number;
  yaw: number;
  pitch: number;
  roll: number;
}

/** Shortest signed angle from a to b. */
const angleDelta = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

/** A bump that is 0 at both ends of [0, 1] and 1 in the middle. */
const bump = (u: number) => (u <= 0 || u >= 1 ? 0 : Math.sin(Math.PI * u));
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));

// Hop timeline (fractions of the hop): crouch on the spot, fly, absorb the landing.
const CROUCH = 0.18;
const LAND = 0.84;

/**
 * Every term below is continuous: each effect is a bump that starts and ends at
 * zero, so nothing pops at the start or end of a hop, or between its phases.
 */
function pose(f: FrogSim, t: number): Pose {
  const dt = f.lastT === undefined ? 0 : Math.min(0.1, t - f.lastT);
  f.lastT = t;
  let x = f.x;
  let ty = f.y;
  let h = baseAt(x, ty);
  let ground = h;
  let squash = 0; // + stretch, − squash
  let pitch = 0;

  // turn smoothly toward the next hop (or the viewer, once stopped)
  const rate = f.hop ? 16 : 7;
  f.yaw += angleDelta(f.yaw, f.face) * (1 - Math.exp(-dt * rate));

  if (f.hop) {
    const u = clamp01((t - f.hop.t0) / f.hop.dur);
    const crouch = clamp01(u / CROUCH);
    const fly = clamp01((u - CROUCH) / (LAND - CROUCH));
    const land = clamp01((u - LAND) / (1 - LAND));
    const e = fly * fly * (3 - 2 * fly);
    x = f.hop.fx + (f.hop.tx - f.hop.fx) * e;
    ty = f.hop.fy + (f.hop.ty - f.hop.fy) * e;
    const h0 = baseAt(f.hop.fx, f.hop.fy);
    const h1 = baseAt(f.hop.tx, f.hop.ty);
    const dist = Math.hypot(f.hop.tx - f.hop.fx, f.hop.ty - f.hop.fy);
    h = h0 + (h1 - h0) * e + bump(fly) * (0.38 + 0.16 * dist);
    ground = baseAt(x, ty);
    squash = -0.2 * bump(crouch) + 0.14 * bump(fly) - 0.17 * bump(land);
    // nose up while rising, nose down while falling — zero at take-off and touch-down
    pitch = -0.3 * Math.sin(2 * Math.PI * fly) * Math.min(1, dist);
  }
  if (f.drop) {
    // fall, then a short squash once on the ground
    const raw = (t - f.drop.t0) / f.drop.dur;
    const u = clamp01(raw);
    h += f.drop.from * (1 - u * u);
    squash += -0.2 * bump(clamp01((raw - 1) / 0.3));
    if (raw >= 1.3) f.drop = undefined;
  }
  if (f.carried !== undefined) h += f.carried;
  // gentle breathing, always on, so it never switches abruptly
  const breath = 0.022 * Math.sin(t * 2.4 + f.phase);
  let s = 1;
  if (f.hatchT0 !== undefined) {
    const raw = (t - f.hatchT0) / 0.45;
    // invisible until it hatches, then pops out with a little overshoot
    s = raw <= 0 ? 0 : raw >= 1 ? 1 : 0.15 + 0.85 * (1 - Math.pow(1 - raw, 3)) + Math.sin(raw * Math.PI) * 0.12;
  }
  const sy = (1 + squash + breath) * s;
  const sx = (1 - squash * 0.45 - breath * 0.5) * s;
  return { x, y: h, z: -ty, ground, sx, sy, yaw: f.yaw, pitch, roll: 0 };
}

export function Frogs() {
  const body = useRef<THREE.InstancedMesh>(null);
  const shadows = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => frogGeometry(), []);
  const mat = useMemo(() => frogMaterial(), []);
  const shadowGeom = useMemo(() => new THREE.PlaneGeometry(0.62, 0.62).rotateX(-Math.PI / 2), []);
  const shadowMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false }),
    [],
  );
  const pond = useGame((s) => s.pond);
  const hasPonds = useGame((s) => !!s.level?.pond);
  const visibleList = useRef<FrogSim[]>([]);
  // nothing renders until the first frame has placed every instance
  useLayoutEffect(() => {
    for (const r of [body, shadows]) if (r.current) r.current.count = 0;
  }, []);

  useFrame(() => {
    const b = body.current;
    const sh = shadows.current;
    if (!b || !sh) return;
    const t = now();
    let n = 0;
    const list: FrogSim[] = [];
    for (const f of frogWorld.frogs) {
      if (hasPonds && f.pond !== pond) continue;
      if (n >= MAX_FROGS) break;
      const p = pose(f, t);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
      dummy.scale.set(p.sx, p.sy, p.sx);
      dummy.updateMatrix();
      b.setMatrixAt(n, dummy.matrix);
      col.copy(f.red ? C.fail : f.kind === 'real' ? C.real : C.test);
      b.setColorAt(n, col);
      // the shadow shrinks as the frog rises
      const air = Math.max(0, p.y - p.ground);
      const ss = p.sx <= 0 ? 0 : Math.max(0.35, 1 - air * 0.5) * Math.min(p.sx, 1.2);
      dummy.position.set(p.x, p.ground + 0.008, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(ss, 1, ss);
      dummy.updateMatrix();
      sh.setMatrixAt(n, dummy.matrix);
      list.push(f);
      n++;
    }
    visibleList.current = list;
    b.count = sh.count = n;
    b.instanceMatrix.needsUpdate = true;
    sh.instanceMatrix.needsUpdate = true;
    if (b.instanceColor) b.instanceColor.needsUpdate = true;
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const f = e.instanceId !== undefined ? visibleList.current[e.instanceId] : undefined;
    if (f) useGame.getState().patch({ selected: f.state });
  };

  return (
    <group>
      <instancedMesh ref={shadows} args={[shadowGeom, shadowMat, MAX_FROGS]} frustumCulled={false} renderOrder={3} />
      <instancedMesh ref={body} args={[geom, mat, MAX_FROGS]} frustumCulled={false} onClick={onClick} />
    </group>
  );
}
