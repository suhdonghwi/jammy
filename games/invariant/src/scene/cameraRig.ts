import type { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CompiledLevel } from '../levels/level';
import { EXIT_MS, reducedMotion } from '../motion';
import { HIGHEST, plan, sample, STILL, travel, velocity, type Flight, type Pose } from './flight';
import { followKeyboard, freeRect, overlaps, softBlocks, type Rect } from './freeRect';
import { sceneNow, sceneStarted, sleep } from './sceneTime';

export type Tile = readonly [number, number];

export interface Shot {
  focus?: readonly Tile[];
  labels?: readonly Tile[];
  centre?: boolean;
}

let controls: CameraControls | null = null;
let size = { width: 1, height: 1 };
let current: Shot | null = null;
let layout = { key: '', changed: 0, settled: true };
let pending: { shot: Shot; since: number; lead: number; done: () => void; settled: Promise<void> } | null = null;
let flight: { plan: Flight; t0: number; waiters: { at: number; done: () => void }[] } | null = null;
let unfollowKeyboard = () => {};

const tmp = new THREE.Vector3();
const point = new THREE.Vector3();
const sph = new THREE.Spherical();
const probe = new THREE.PerspectiveCamera();
const ray = new THREE.Raycaster();
const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();

const MARGIN = 20;
const TAG_ROOM = 46;
const TAG_HALF = 64;
const TILE_RADIUS = 0.5;
export const FOV = 36;
export const MAX_DISTANCE = HIGHEST;
const DEFAULT_DISTANCE = 14;
const MIN_DISTANCE = 15;
const TOO_FAR = 1.5;
const FIT_SLACK = 1.04;
const ASPECT_PROBE = 20;
const ARRIVE_LEAD = 0.12;
const ARRIVE_CAP_MS = 2400;
const LAYOUT_BEAT_MS = 60;
const STAY = 0.01;
const SETTLE_MS = EXIT_MS + 100;
const CENTRE_ZONE = 0.22;

function safeRect(aspect = 0, padding = 0, margin = MARGIN, soft = true): Rect {
  const r = freeRect(size.width, size.height, aspect, soft);
  const px = margin + (r.right - r.left) * padding;
  const py = margin + (r.bottom - r.top) * padding;
  return { left: r.left + px, top: r.top + py, right: r.right - px, bottom: r.bottom - py };
}

function endView(): { x: number; y: number; d: number } {
  if (!controls) return { x: 0, y: 0, d: DEFAULT_DISTANCE };
  if (flight) return { x: flight.plan.to.x, y: flight.plan.to.y, d: flight.plan.to.d };
  controls.getTarget(tmp, true);
  return { x: tmp.x, y: -tmp.z, d: controls.getSpherical(sph, true).radius };
}

type Angle = Pick<Pose, 'az' | 'po'>;

const ANGLE: Angle = { az: 0.26, po: 0.8 };

function currentAngle(): Angle {
  if (flight) return { az: flight.plan.to.az, po: flight.plan.to.po };
  if (!controls) return ANGLE;
  controls.getSpherical(sph, true);
  return { az: sph.theta, po: sph.phi };
}

function place(x: number, y: number, d: number, angle: Angle) {
  probe.copy(controls!.camera as THREE.PerspectiveCamera);
  sph.set(d, angle.po, angle.az);
  probe.position.setFromSpherical(sph).add(point.set(x, 0, -y));
  probe.lookAt(x, 0, -y);
  probe.updateMatrixWorld();
  probe.updateProjectionMatrix();
}

function toScreen(x: number, y: number): [number, number] | null {
  const p = point.set(x, 0, -y).project(probe);
  if (p.z > 1) return null;
  return [((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height];
}

const tilesOf = (shot: Shot) => [...(shot.focus ?? []), ...(shot.labels ?? [])];

function bounds(shot: Shot): Rect | null {
  const b: Rect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const [x, y] of tilesOf(shot)) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const s = toScreen(x + dx * TILE_RADIUS, y + dy * TILE_RADIUS);
      if (!s) return null;
      b.left = Math.min(b.left, s[0]);
      b.right = Math.max(b.right, s[0]);
      b.top = Math.min(b.top, s[1]);
      b.bottom = Math.max(b.bottom, s[1]);
    }
  }
  for (const [x, y] of shot.labels ?? []) {
    const c = toScreen(x, y);
    if (!c) return null;
    b.top = Math.min(b.top, c[1] - TAG_ROOM);
    b.left = Math.min(b.left, c[0] - TAG_HALF);
    b.right = Math.max(b.right, c[0] + TAG_HALF);
  }
  return b;
}

const inside = (b: Rect | null, r: Rect) => !!b && b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom;

function ground(sx: number, sy: number): { x: number; y: number } | null {
  ndc.set((sx / size.width) * 2 - 1, 1 - (sy / size.height) * 2);
  ray.setFromCamera(ndc, probe);
  const hit = ray.ray.intersectPlane(floor, point);
  return hit ? { x: hit.x, y: -hit.z } : null;
}

function middle(shot: Shot): { x: number; y: number } | null {
  const tiles = tilesOf(shot);
  if (!tiles.length) return null;
  return { x: tiles.reduce((s, t) => s + t[0], 0) / tiles.length, y: tiles.reduce((s, t) => s + t[1], 0) / tiles.length };
}

function zone(r: Rect, shot: Shot): Rect {
  if (!shot.centre) return r;
  const w = (r.right - r.left) * CENTRE_ZONE;
  const h = (r.bottom - r.top) * CENTRE_ZONE;
  return { left: r.left + w, top: r.top + h, right: r.right - w, bottom: r.bottom - h };
}

function shape(shot: Shot, angle: Angle): number {
  const { x, y } = middle(shot) ?? { x: 0, y: 0 };
  place(x, y, ASPECT_PROBE, angle);
  const b = bounds(shot);
  return b ? (b.right - b.left) / Math.max(1, b.bottom - b.top) : 0;
}

function fit(shot: Shot, r: Rect, angle: Angle): { x: number; y: number; d: number } {
  let { x, y } = middle(shot) ?? { x: 0, y: 0 };
  let d = MIN_DISTANCE;
  for (let i = 0; i < 10; i++) {
    place(x, y, d, angle);
    let b = bounds(shot);
    if (!b) {
      d = Math.min(MAX_DISTANCE, d * 1.5);
      continue;
    }
    const grow = Math.max((b.right - b.left) / (r.right - r.left), (b.bottom - b.top) / (r.bottom - r.top));
    d = THREE.MathUtils.clamp(d * grow, MIN_DISTANCE, MAX_DISTANCE);
    place(x, y, d, angle);
    b = bounds(shot);
    if (!b) continue;
    const at = ground((b.left + b.right) / 2, (b.top + b.bottom) / 2);
    const to = ground((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    if (!at || !to) break;
    x += at.x - to.x;
    y += at.y - to.y;
  }
  return { x, y, d: Math.min(MAX_DISTANCE, d * FIT_SLACK) };
}

function tagsClear(shot: Shot): boolean {
  const soft = softBlocks();
  return (shot.labels ?? []).every(([x, y]) => {
    const c = toScreen(x, y);
    if (!c) return false;
    const tag = { left: c[0] - TAG_HALF, right: c[0] + TAG_HALF, top: c[1] - TAG_ROOM, bottom: c[1] };
    return !soft.some((b) => overlaps(tag, b));
  });
}

function placement(shot: Shot, angle: Angle): { x: number; y: number; d: number } {
  const sh = shape(shot, angle);
  const over = fit(shot, safeRect(sh, 0, MARGIN, false), angle);
  place(over.x, over.y, over.d, angle);
  return tagsClear(shot) ? over : fit(shot, safeRect(sh), angle);
}

function needsMove(shot: Shot, fitted: number): boolean {
  const view = endView();
  if (view.d > fitted * TOO_FAR) return true;
  const angle = currentAngle();
  const r = zone(safeRect(shape(shot, angle), 0, 0, false), shot);
  place(view.x, view.y, view.d, angle);
  return !inside(bounds(shot), r) || !tagsClear(shot);
}

function poseNow(c: CameraControls): Pose {
  c.getTarget(tmp, false);
  c.getSpherical(sph, false);
  return { x: tmp.x, y: -tmp.z, d: sph.radius, az: sph.theta, po: sph.phi };
}

function put(c: CameraControls, p: Pose) {
  void c.moveTo(p.x, 0, -p.y, false);
  void c.rotateTo(p.az, p.po, false);
  void c.dollyTo(p.d, false);
}

function land() {
  const f = flight;
  flight = null;
  f?.waiters.forEach((w) => w.done());
}

function fly(to: Partial<Pose>, lead = 0): Promise<void> {
  const c = controls;
  if (!c) return Promise.resolve();
  const now = sceneNow();
  const v0 = flight ? velocity(flight.plan, now - flight.t0) : STILL;
  const from = flight ? sample(flight.plan, now - flight.t0).pose : poseNow(c);
  land();
  const goal = { ...from, ...to };
  if (travel(from, goal) < STAY && Math.hypot(v0.x, v0.y, v0.d) < STAY) {
    put(c, goal);
    return Promise.resolve();
  }
  const next = { plan: plan(from, goal, v0, reducedMotion()), t0: now, waiters: [] as { at: number; done: () => void }[] };
  flight = next;
  return new Promise((done) => next.waiters.push({ at: next.plan.dur - lead, done }));
}

function steer() {
  const c = controls;
  if (!c || !flight) return;
  const elapsed = sceneNow() - flight.t0;
  const s = sample(flight.plan, elapsed);
  put(c, s.pose);
  const ready = flight.waiters.filter((w) => elapsed >= w.at);
  flight.waiters = flight.waiters.filter((w) => elapsed < w.at);
  ready.forEach((w) => w.done());
  if (s.done) land();
}

function snap(to: Partial<Pose>) {
  const c = controls;
  if (!c) return;
  land();
  put(c, { ...poseNow(c), ...to });
}

function glide(to: Partial<Pose>, smooth: boolean, lead = 0): Promise<void> {
  if (!smooth) {
    snap(to);
    return Promise.resolve();
  }
  return fly(to, lead);
}

function apply(shot: Shot, smooth: boolean, lead = 0, angle?: Angle): Promise<void> {
  if (!tilesOf(shot).length) return Promise.resolve();
  const a = angle ?? currentAngle();
  const to = placement(shot, a);
  if (!angle && smooth && !needsMove(shot, to.d)) return Promise.resolve();
  return glide({ ...to, ...angle }, smooth, lead);
}

function keyOf(r: Rect): string {
  return `${Math.round(r.left / 8)},${Math.round(r.top / 8)},${Math.round(r.right / 8)},${Math.round(r.bottom / 8)}`;
}

function retarget(shot: Shot) {
  current = shot;
  pending?.done();
  pending = null;
}

const OPENING: readonly [Tile, Tile] = [[0, 0], [4, 4]];

function box([[x0, y0], [x1, y1]]: readonly [Tile, Tile]): Tile[] {
  return [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
}

const release = () => {
  current = null;
};

const takeOver = () => {
  land();
  release();
};

export const cameraRig = {
  attach(c: CameraControls | null) {
    controls?.removeEventListener('controlstart', takeOver);
    document.removeEventListener('pointerdown', release, true);
    unfollowKeyboard();
    land();
    controls = c;
    if (!c) return;
    c.addEventListener('controlstart', takeOver);
    document.addEventListener('pointerdown', release, true);
    unfollowKeyboard = followKeyboard();
  },
  get controls() {
    return controls;
  },
  userMoved: takeOver,
  get flying() {
    return flight !== null;
  },
  target(): THREE.Vector3 {
    if (!controls) return tmp.set(0, 0, 0);
    return controls.getTarget(tmp);
  },
  distance(): number {
    return controls ? controls.distance : DEFAULT_DISTANCE;
  },
  viewCenter(): { x: number; y: number } {
    const v = endView();
    if (!controls) return v;
    place(v.x, v.y, v.d, currentAngle());
    const r = safeRect();
    return ground((r.left + r.right) / 2, (r.top + r.bottom) / 2) ?? v;
  },
  frame(shot: Shot, smooth = true, lead = 0): Promise<void> {
    retarget(shot);
    if (!controls) return Promise.resolve();
    if (!smooth || !sceneStarted()) return apply(shot, false);
    let done = () => {};
    const settled = new Promise<void>((resolve) => (done = resolve));
    pending = { shot, since: performance.now(), lead, done, settled };
    return settled;
  },
  async arrive(shot: Shot) {
    await Promise.race([cameraRig.frame(shot, true, ARRIVE_LEAD), sleep(ARRIVE_CAP_MS)]);
  },
  include(labels: readonly Tile[]) {
    if (!labels.length) return;
    void cameraRig.frame({ ...current, labels: [...(current?.labels ?? []), ...labels] });
  },
  tick(width: number, height: number, framing: boolean) {
    size = { width, height };
    if (!controls) return;
    if (!framing) {
      if (flight) land();
      return;
    }
    steer();
    const now = performance.now();
    const key = keyOf(safeRect());
    if (key !== layout.key) {
      const shown = sceneStarted();
      layout = { key, changed: now, settled: !shown };
      if (!shown) {
        if (current) void apply(current, false);
        return;
      }
    }
    if (pending && now - pending.since >= LAYOUT_BEAT_MS && now - layout.changed >= SETTLE_MS) {
      const { shot, lead, done } = pending;
      pending = null;
      current = shot;
      layout.settled = true;
      void apply(shot, true, lead).then(done);
    } else if (!pending && !layout.settled && now - layout.changed >= SETTLE_MS) {
      layout.settled = true;
      if (current) void apply(current, true);
    }
  },
  async zoomTo(distance: number) {
    if (pending) await pending.settled;
    await fly({ d: distance });
  },
  async resetAngle(smooth = true) {
    await glide(ANGLE, smooth);
  },
  opening(level: CompiledLevel, smooth: boolean) {
    const shot: Shot = { focus: box(level.frame ?? OPENING) };
    retarget(shot);
    if (!controls) return;
    void apply(shot, smooth && sceneStarted(), 0, ANGLE);
  },
  fitInto(shot: Shot, angle: Angle, viewport: { width: number; height: number }, padding: number): { x: number; y: number; d: number } | null {
    size = viewport;
    return controls ? fit(shot, safeRect(shape(shot, angle), padding), angle) : null;
  },
};
