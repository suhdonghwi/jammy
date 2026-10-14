import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { COLORS, SLAB_H } from './constants';
import { field } from './field';
import { frogWorld, now, type FrogSim } from './frogSim';
import { frogGeometry, frogMaterial, outlineMaterial } from './models';
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
const easeInOut = (u: number) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

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

function pose(f: FrogSim, t: number): Pose {
  const dt = f.lastT === undefined ? 0 : Math.min(0.1, t - f.lastT);
  f.lastT = t;
  let x = f.x;
  let ty = f.y;
  let h = baseAt(x, ty);
  let ground = h;
  let sy = 1;
  let sx = 1;
  let pitch = 0;
  let roll = 0;

  // Turn smoothly toward where the frog is going (or toward the viewer once
  // it has stopped). Turning is quick while hopping, unhurried while sitting.
  const target = f.face;
  const rate = f.hop ? 18 : 7;
  f.yaw += angleDelta(f.yaw, target) * (1 - Math.exp(-dt * rate));

  if (f.hop) {
    const u = Math.min(1, (t - f.hop.t0) / f.hop.dur);
    const e = easeInOut(u);
    x = f.hop.fx + (f.hop.tx - f.hop.fx) * e;
    ty = f.hop.fy + (f.hop.ty - f.hop.fy) * e;
    const h0 = baseAt(f.hop.fx, f.hop.fy);
    const h1 = baseAt(f.hop.tx, f.hop.ty);
    const dist = Math.hypot(f.hop.tx - f.hop.fx, f.hop.ty - f.hop.fy);
    h = h0 + (h1 - h0) * u + Math.sin(Math.PI * u) * (0.42 + 0.16 * dist);
    ground = baseAt(x, ty);
    // crouch before take-off, stretch in the air, squash on landing
    const s =
      u < 0.12
        ? -Math.sin((u / 0.12) * Math.PI) * 0.24
        : u > 0.88
          ? -Math.sin(((u - 0.88) / 0.12) * Math.PI) * 0.2
          : Math.sin(Math.PI * u) * 0.16;
    sy = 1 + s;
    sx = 1 - s * 0.45;
    // nose up on the way up, nose down coming in
    pitch = -Math.cos(Math.PI * u) * 0.32 * Math.min(1, dist);
    // lean into turns
    roll = angleDelta(f.yaw, target) * -0.35;
  } else {
    sy = 1 + 0.025 * Math.sin(t * 2.4 + f.phase);
    sx = 1 - 0.012 * Math.sin(t * 2.4 + f.phase);
  }
  if (f.drop) {
    const u = Math.min(1, (t - f.drop.t0) / f.drop.dur);
    h += f.drop.from * (1 - u * u);
    if (u > 0.85) {
      sy *= 0.8;
      sx *= 1.1;
    }
    if (u >= 1) f.drop = undefined;
  }
  if (f.carried !== undefined) h += f.carried;
  let s = 1;
  if (f.hatchT0 !== undefined) {
    const raw = (t - f.hatchT0) / 0.45;
    // invisible until it hatches, then pops out with a little overshoot
    s = raw <= 0 ? 0 : raw >= 1 ? 1 : 0.15 + 0.85 * (1 - Math.pow(1 - raw, 3)) + Math.sin(raw * Math.PI) * 0.12;
  }
  return { x, y: h, z: -ty, ground, sx: sx * s, sy: sy * s, yaw: f.yaw, pitch, roll };
}

export function Frogs() {
  const body = useRef<THREE.InstancedMesh>(null);
  const outline = useRef<THREE.InstancedMesh>(null);
  const shadows = useRef<THREE.InstancedMesh>(null);
  const geom = useMemo(() => frogGeometry(), []);
  const mat = useMemo(() => frogMaterial(), []);
  const outMat = useMemo(() => outlineMaterial(0.011), []);
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
    for (const r of [body, outline, shadows]) if (r.current) r.current.count = 0;
  }, []);

  useFrame(() => {
    const b = body.current;
    const o = outline.current;
    const sh = shadows.current;
    if (!b || !o || !sh) return;
    if (o.instanceMatrix !== b.instanceMatrix) o.instanceMatrix = b.instanceMatrix;
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
    b.count = o.count = sh.count = n;
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
      <instancedMesh ref={outline} args={[geom, outMat, MAX_FROGS]} frustumCulled={false} />
      <instancedMesh ref={body} args={[geom, mat, MAX_FROGS]} frustumCulled={false} onClick={onClick} />
    </group>
  );
}
