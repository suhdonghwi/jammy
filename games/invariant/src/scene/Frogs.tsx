import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { COLORS, SLAB_H } from './constants';
import { field } from './field';
import { frogWorld, now, type FrogSim } from './frogSim';
import { frogGeometry, frogMaterial } from './models';
import { getBlobTexture } from './shaders';
import { MAX_SHOWN, occupancy, slotFor } from './occupancy';
import { goalEvents } from './goalEvents';
import { toNum } from '../levels/level';

const MAX_FROGS = 400;
const BADGES = 24;

/** Frogs that touched down this frame after being dropped (for goal ripples). */
const dropLandings: FrogSim[] = [];

// "×n" badges over crowded tiles
const badgeTextures = new Map<number, THREE.Texture>();
function badgeTexture(n: number): THREE.Texture {
  const hit = badgeTextures.get(n);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(28, 35, 51, 0.9)';
  g.beginPath();
  g.roundRect(4, 8, 152, 80, 40);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = '600 52px Fredoka, ui-rounded, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`×${n}`, 80, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  badgeTextures.set(n, t);
  return t;
}
function placeBadge(sp: THREE.Sprite | null | undefined, x: number, y: number, ground: number, n: number) {
  if (!sp) return;
  sp.visible = true;
  sp.position.set(x, ground + 0.78, -y);
  const m = sp.material as THREE.SpriteMaterial;
  const tex = badgeTexture(n);
  if (m.map !== tex) {
    m.map = tex;
    m.needsUpdate = true;
  }
}

const dummy = new THREE.Object3D();
const col = new THREE.Color();
const C = {
  real: new THREE.Color(COLORS.frog),
  test: new THREE.Color(COLORS.testFrog),
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
/** A turn on the spot (seconds). */
const TURN_DUR = 0.2;

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

  // Facing. A sitting frog whose next hop goes another way turns with a tiny
  // hop on the spot; small corrections (and turns mid-air) just ease in.
  const off = angleDelta(f.yaw, f.face);
  if (!f.turn && !f.hop && !f.drop && f.carried === undefined && Math.abs(off) > 0.35) {
    f.turn = { t0: t, from: f.yaw, delta: off };
  }
  if (f.turn && (f.hop || Math.abs(angleDelta(f.turn.from + f.turn.delta, f.face)) > 0.35)) {
    // interrupted by a hop, or the target moved: fall back to easing
    f.turn = undefined;
  }
  let turnLift = 0;
  if (f.turn) {
    const u = clamp01((t - f.turn.t0) / TURN_DUR);
    const e = u * u * (3 - 2 * u);
    f.yaw = f.turn.from + f.turn.delta * e;
    turnLift = bump(u);
    if (u >= 1) f.turn = undefined;
  } else {
    f.yaw += off * (1 - Math.exp(-dt * 16));
  }

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
  if (turnLift > 0) {
    h += 0.09 * turnLift;
    squash += 0.06 * turnLift;
  }
  if (f.drop) {
    // fall, then a short squash once on the ground
    const raw = (t - f.drop.t0) / f.drop.dur;
    const u = clamp01(raw);
    h += f.drop.from * (1 - u * u) + (f.drop.arc ?? 0) * bump(u);
    const e = u * u * (3 - 2 * u);
    x += (f.drop.dx ?? 0) * (1 - e);
    ty += (f.drop.dy ?? 0) * (1 - e);
    if (raw >= 1 && !f.touched) {
      f.touched = true;
      dropLandings.push(f);
    }
    squash += -0.2 * bump(clamp01((raw - 1) / 0.3));
    if (raw >= 1.3) f.drop = undefined;
  }
  if (f.carried !== undefined) {
    h += f.carried;
    if (f.carryOff) {
      x += f.carryOff.dx;
      ty += f.carryOff.dy;
    }
  }
  // gentle breathing, always on, so it never switches abruptly
  const breath = 0.022 * Math.sin(t * 2.4 + f.phase);
  let s = 1;
  if (f.hatchT0 !== undefined) {
    const raw = (t - f.hatchT0) / 0.45;
    // invisible until it hatches, then pops out with a little overshoot
    s = raw <= 0 ? 0 : raw >= 1 ? 1 : 0.15 + 0.85 * (1 - Math.pow(1 - raw, 3)) + Math.sin(raw * Math.PI) * 0.12;
    // climbs up out of the shell and drops onto the tile
    h += 0.16 * bump(raw);
  }
  const sy = (1 + squash + breath) * s;
  const sx = (1 - squash * 0.45 - breath * 0.5) * s;
  return { x, y: h, z: -ty, ground, sx, sy, yaw: f.yaw, pitch, roll: 0 };
}

/** The tile a frog is on, or is landing on. */
const tileOf = (f: FrogSim) => (f.hop ? `${f.hop.tx},${f.hop.ty}` : `${f.x},${f.y}`);

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
  const lastT = useRef<number | undefined>(undefined);
  const badgeRefs = useRef<(THREE.Sprite | null)[]>([]);
  // nothing renders until the first frame has placed every instance
  useLayoutEffect(() => {
    for (const r of [body, shadows]) if (r.current) r.current.count = 0;
  }, []);

  useFrame(() => {
    const b = body.current;
    const sh = shadows.current;
    if (!b || !sh) return;
    const t = now();
    // Which frogs share which tile (for slot layout). A hopping frog already
    // counts on the tile it is landing on, so the frogs there make room while
    // it is in the air and it touches down straight into its own slot.
    const visible = frogWorld.frogs.filter((f) => !hasPonds || f.pond === pond);
    const groups = new Map<string, FrogSim[]>();
    for (const f of visible) {
      if (f.carried !== undefined) continue;
      const key = tileOf(f);
      const g = groups.get(key);
      if (g) g.push(f);
      else groups.set(key, [f]);
    }
    const sig = [...groups].map(([k, g]) => `${k}:${g.length}`).join('|');
    if (sig !== occupancy.signature) {
      occupancy.signature = sig;
      occupancy.frogs = new Map([...groups].map(([k, g]) => [k, g.length]));
      occupancy.version++;
    }
    let n = 0;
    const list: FrogSim[] = [];
    const dt = Math.min(0.1, t - (lastT.current ?? t));
    const k = 1 - Math.exp(-dt * 11);
    lastT.current = t;
    let badges = 0;
    for (const f of visible) {
      if (n >= MAX_FROGS) break;
      const p = pose(f, t);
      // slot within a shared tile; glide toward it so nothing pops
      let target = { dx: 0, dy: 0, scale: 1 };
      if (f.carried === undefined) {
        const key = tileOf(f);
        const g = groups.get(key)!;
        const count = g.length + (occupancy.eggs.has(key) ? 1 : 0);
        target = slotFor(g.indexOf(f), count);
        if (g.length > MAX_SHOWN && g.indexOf(f) === 0 && badges < BADGES) {
          placeBadge(badgeRefs.current[badges++], f.x, f.y, p.ground, g.length);
        }
      }
      if (f.ox === undefined) {
        f.ox = target.dx;
        f.oy = target.dy;
        f.os = target.scale;
      } else {
        // in the air: arrive at the slot exactly on landing; otherwise glide
        const left = f.hop ? f.hop.t0 + f.hop.dur - t : 0;
        const kk = left > 0 ? Math.min(1, dt / left) : k;
        f.ox += (target.dx - f.ox) * kk;
        f.oy! += (target.dy - f.oy!) * kk;
        f.os! += (target.scale - f.os!) * kk;
      }
      const os = f.os!;
      const px = p.x + f.ox;
      const pz = p.z - f.oy!;
      if (f.drawn) {
        f.drawn.x = px;
        f.drawn.ground = p.ground;
        f.drawn.z = pz;
      } else f.drawn = { x: px, ground: p.ground, z: pz };
      dummy.position.set(px, p.y, pz);
      dummy.rotation.set(p.pitch, p.yaw, p.roll, 'YXZ');
      dummy.scale.set(p.sx * os, p.sy * os, p.sx * os);
      dummy.updateMatrix();
      b.setMatrixAt(n, dummy.matrix);
      col.copy(f.kind === 'real' ? C.real : C.test);
      b.setColorAt(n, col);
      // the shadow shrinks as the frog rises
      const air = Math.max(0, p.y - p.ground);
      const ss = p.sx <= 0 ? 0 : Math.max(0.35, 1 - air * 0.5) * Math.min(p.sx, 1.2) * os;
      dummy.position.set(px, p.ground + 0.008, pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(ss, 1, ss);
      dummy.updateMatrix();
      sh.setMatrixAt(n, dummy.matrix);
      list.push(f);
      n++;
    }
    const level = useGame.getState().level;
    if (level) {
      for (const f of dropLandings) {
        if (level.fast.guard(toNum(f.state)) !== true && level.fast.post(toNum(f.state)) === true) goalEvents.push(f.x, f.y, f.pond);
      }
    }
    dropLandings.length = 0;
    for (let i = badges; i < BADGES; i++) {
      const sp = badgeRefs.current[i];
      if (sp) sp.visible = false;
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
      {Array.from({ length: BADGES }, (_, i) => (
        <sprite key={i} ref={(el) => void (badgeRefs.current[i] = el)} visible={false} scale={[0.5, 0.3, 1]} renderOrder={10}>
          <spriteMaterial depthTest={false} transparent />
        </sprite>
      ))}
    </group>
  );
}
