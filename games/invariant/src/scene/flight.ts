import { clamp01, easeIn, easeOut, smootherstep, swell } from './easing';

export interface Pose {
  x: number;
  y: number;
  d: number;
  az: number;
  po: number;
}

const KEYS = ['x', 'y', 'd', 'az', 'po'] as const;

export const STILL: Pose = { x: 0, y: 0, d: 0, az: 0, po: 0 };

export const FLIGHT_MIN = 0.42;
export const FLIGHT_MAX = 1.05;
const PER_DOUBLING = 0.3;
const LIFT_FROM = 1.2;
const LIFT_PER_VIEW = 0.16;
const LIFT_MAX = 0.4;
const DIP_FROM = 7;
const REDUCED_DIP_FROM = 0.8;
export const DIP = 0.6;
const DIP_OUT = 0.4;

export interface Flight {
  from: Pose;
  to: Pose;
  v0: Pose;
  dur: number;
  lift: number;
  dip: boolean;
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function travel(from: Pose, to: Pose): number {
  const views = Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, (from.d + to.d) / 2);
  const zoom = Math.abs(Math.log2(Math.max(1e-3, to.d) / Math.max(1e-3, from.d)));
  const turn = Math.abs(wrap(to.az - from.az)) + Math.abs(to.po - from.po);
  return views + 0.8 * zoom + 0.6 * turn;
}

export function plan(from: Pose, to: Pose, v0: Pose = STILL, reduced = false): Flight {
  const target = { ...to, az: from.az + wrap(to.az - from.az) };
  const w = travel(from, target);
  const views = Math.hypot(to.x - from.x, to.y - from.y) / Math.max(1, (from.d + to.d) / 2);
  const dip = views > (reduced ? REDUCED_DIP_FROM : DIP_FROM);
  if (dip) return { from, to: target, v0: STILL, dur: DIP, lift: 0, dip };
  const dur = Math.min(FLIGHT_MAX, FLIGHT_MIN + PER_DOUBLING * Math.log2(1 + w));
  const lift = reduced ? 0 : Math.min(LIFT_MAX, Math.max(0, views - LIFT_FROM) * LIFT_PER_VIEW);
  return { from, to: target, v0, dur, lift, dip };
}

const carry = (u: number) => u - 6 * u ** 3 + 8 * u ** 4 - 3 * u ** 5;

export interface Sample {
  pose: Pose;
  fog: number;
  done: boolean;
}

export function sample(f: Flight, elapsed: number): Sample {
  const u = clamp01(elapsed / f.dur);
  const done = elapsed >= f.dur;
  if (f.dip) {
    const out = u < DIP_OUT;
    const fog = out ? 1 - easeIn(u / DIP_OUT) : easeOut((u - DIP_OUT) / (1 - DIP_OUT));
    return { pose: { ...(out ? f.from : f.to) }, fog: done ? 1 : fog, done };
  }
  const s = smootherstep(u);
  const c = carry(u) * f.dur;
  const pose = { ...f.to };
  for (const k of KEYS) pose[k] = f.from[k] + (f.to[k] - f.from[k]) * s + f.v0[k] * c;
  pose.d *= 1 + f.lift * swell(u);
  return { pose, fog: 1, done };
}

const EPS = 1 / 120;

export function velocity(f: Flight, elapsed: number): Pose {
  if (f.dip || elapsed >= f.dur) return { ...STILL };
  const a = sample(f, Math.max(0, elapsed - EPS)).pose;
  const b = sample(f, elapsed + EPS).pose;
  const span = elapsed + EPS - Math.max(0, elapsed - EPS);
  const v = { ...STILL };
  for (const k of KEYS) v[k] = (b[k] - a[k]) / span;
  return v;
}
