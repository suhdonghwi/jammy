import { field } from '../area/field';
import { SLAB_H } from '../constants';
import { bump, clamp01, popIn, smoothstep } from '../easing';
import type { FrogSim } from './frogWorld';

const baseAt = (x: number, y: number) => field.heightAt(x, y) * SLAB_H;

interface Pose {
  x: number;
  y: number;
  z: number;
  ground: number;
  sx: number;
  sy: number;
  yaw: number;
  pitch: number;
  landed: boolean;
  emerged: number;
}

const angleDelta = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const TAKEOFF = 0.22;
const TOUCH = 0.84;
const PUSH = 0.1;

function keyed(u: number, keys: readonly (readonly [number, number])[]) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [u1, v1] = keys[i];
    if (u <= u1) {
      const [u0, v0] = keys[i - 1];
      return v0 + (v1 - v0) * smoothstep((u - u0) / (u1 - u0));
    }
  }
  return keys[keys.length - 1][1];
}
const SQUASH_KEYS = [
  [0, 0],
  [TAKEOFF - PUSH, -0.2],
  [TAKEOFF, 0.14],
  [0.5, 0],
  [TOUCH, 0.05],
  [TOUCH + 0.06, -0.17],
  [1, 0],
] as const;

function hopAt(u: number, h0: number, h1: number, H: number) {
  const span = TOUCH - TAKEOFF;
  const k = PUSH / (3 * span);
  const vx = 1 / (span + (2 * PUSH) / 3);
  const gx = (vx * PUSH) / 3;
  let g: number;
  if (u <= TAKEOFF - PUSH) g = 0;
  else if (u < TAKEOFF) g = gx * Math.pow((u - (TAKEOFF - PUSH)) / PUSH, 3);
  else if (u < TOUCH) g = gx + vx * (u - TAKEOFF);
  else if (u < TOUCH + PUSH) g = 1 - gx * Math.pow(1 - (u - TOUCH) / PUSH, 3);
  else g = 1;
  const d = (h1 - h0) / (1 + 2 * k);
  const e0 = k * (d + 4 * H);
  const e1 = k * (4 * H - d);
  let h: number;
  if (u <= TAKEOFF - PUSH) h = h0;
  else if (u < TAKEOFF) h = h0 + e0 * Math.pow((u - (TAKEOFF - PUSH)) / PUSH, 3);
  else if (u < TOUCH) {
    const f = (u - TAKEOFF) / span;
    h = h0 + e0 + (h1 + e1 - h0 - e0) * f + 4 * H * f * (1 - f);
  } else if (u < TOUCH + PUSH) h = h1 + e1 * Math.pow(1 - (u - TOUCH) / PUSH, 3);
  else h = h1;
  return { g, h };
}
const CHEER_DUR = 0.62;
const CHEER_KEYS = [
  [0, 0],
  [0.12, 0],
  [0.27, -0.16],
  [0.38, 0.13],
  [0.7, 0],
  [0.85, -0.12],
  [1, 0],
] as const;
const TURN_DUR = 0.2;
export const hopHeight = (dist: number) => 0.3 + 0.14 * dist;
const RISE_DEPTH = 0.85;

export function pose(f: FrogSim, t: number): Pose {
  const dt = f.lastT === undefined ? 0 : Math.min(0.1, t - f.lastT);
  f.lastT = t;
  let x = f.x;
  let ty = f.y;
  let h = baseAt(x, ty);
  let ground = h;
  let squash = 0;
  let pitch = 0;
  let landed = false;

  const off = angleDelta(f.yaw, f.face);
  if (!f.turn && !f.hop && !f.rise && Math.abs(off) > 0.35) {
    f.turn = { t0: t, from: f.yaw, delta: off };
  }
  if (f.turn && (f.hop || Math.abs(angleDelta(f.turn.from + f.turn.delta, f.face)) > 0.35)) {
    f.turn = undefined;
  }
  let turnLift = 0;
  if (f.turn) {
    const u = clamp01((t - f.turn.t0) / TURN_DUR);
    f.yaw = f.turn.from + f.turn.delta * smoothstep(u);
    turnLift = bump(u);
    if (u >= 1) f.turn = undefined;
  } else {
    f.yaw += off * (1 - Math.exp(-dt * 16));
  }

  if (f.hop) {
    const u = clamp01((t - f.hop.t0) / f.hop.dur);
    const h0 = baseAt(f.hop.fx, f.hop.fy);
    const h1 = baseAt(f.hop.tx, f.hop.ty);
    const dist = Math.hypot(f.hop.tx - f.hop.fx, f.hop.ty - f.hop.fy);
    const H = hopHeight(dist);
    const { g, h: hh } = hopAt(u, h0, h1, H);
    x = f.hop.fx + (f.hop.tx - f.hop.fx) * g;
    ty = f.hop.fy + (f.hop.ty - f.hop.fy) * g;
    h = hh;
    ground = baseAt(x, ty);
    squash = keyed(u, SQUASH_KEYS);
    const vy = (hopAt(Math.min(1, u + 0.01), h0, h1, H).h - hopAt(Math.max(0, u - 0.01), h0, h1, H).h) / 0.02;
    pitch = -Math.max(-0.35, Math.min(0.35, vy * 0.07)) * Math.min(1, dist);
  }
  if (f.cheerT0 !== undefined && !f.hop) {
    const u = (t - f.cheerT0) / CHEER_DUR;
    if (u >= 1) f.cheerT0 = undefined;
    else if (u > 0) {
      h += 0.22 * bump(clamp01((u - 0.3) / 0.55));
      squash += keyed(u, CHEER_KEYS);
    }
  }
  if (turnLift > 0) {
    h += 0.09 * turnLift;
    squash += 0.06 * turnLift;
  }
  let emerged = 1;
  if (f.rise) {
    const raw = (t - f.rise.t0) / f.rise.dur;
    const u = clamp01(raw);
    h -= RISE_DEPTH * (1 - popIn(u, 1.1));
    f.yaw = f.face - f.rise.turns * Math.PI * 2 * Math.pow(1 - u, 3);
    squash += 0.22 * bump(u) - 0.18 * bump(clamp01((raw - 1) / 0.3));
    emerged = smoothstep(clamp01(u * 1.6 - 0.2));
    if (raw >= 1 && !f.touched) {
      f.touched = true;
      landed = true;
    }
    if (raw >= 1.3) f.rise = undefined;
  }
  const breath = 0.022 * Math.sin(t * 2.4 + f.phase);
  let s = 1;
  if (f.hatchT0 !== undefined) {
    const raw = (t - f.hatchT0) / 0.45;
    s = raw <= 0 ? 0 : raw >= 1 ? 1 : 0.15 + 0.85 * (1 - Math.pow(1 - raw, 3)) + Math.sin(raw * Math.PI) * 0.12;
    h += 0.16 * bump(raw);
  }
  if (f.leave) {
    const u = clamp01((t - f.leave.t0) / f.leave.dur);
    s *= 1 - smoothstep(u);
    h += 0.12 * bump(Math.min(u * 2, 1));
  }
  const sy = (1 + squash + breath) * s;
  const sx = (1 - squash * 0.45 - breath * 0.5) * s;
  return { x, y: h, z: -ty, ground, sx, sy, yaw: f.yaw, pitch, landed, emerged };
}
