import type { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CompiledLevel } from '../levels/level';
import { EXIT_MS } from '../timing';
import { freeRect, type Rect } from './freeRect';
import { sceneStarted, sleep } from './sceneTime';

export type Tile = readonly [number, number];
export type View = readonly [number, number, number];

export interface Shot {
  at?: View;
  focus?: readonly Tile[];
  labels?: readonly Tile[];
}

let controls: CameraControls | null = null;
let size = { width: 1, height: 1 };
let current: Shot | null = null;
let base: number | null = null;
let layout = { key: '', changed: 0, settled: true };
let pending: { shot: Shot; since: number; done: () => void; settled: Promise<void> } | null = null;

const tmp = new THREE.Vector3();
const point = new THREE.Vector3();
const sph = new THREE.Spherical();
const probe = new THREE.PerspectiveCamera();
const ray = new THREE.Raycaster();
const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();

const VIEW = { polar: 0.8, azimuth: 0.26 };
const MARGIN = 14;
const TAG_ROOM = 46;
const TAG_HALF = 64;
const TILE_RADIUS = 0.5;
export const FOV = 36;
export const MAX_DISTANCE = 60;
const DEFAULT_DISTANCE = 14;
const ZOOM_OUT = 1.6;
const ARRIVING_MS = 1500;
const SWIFT_SMOOTH_TIME = 0.16;
const SETTLE_MS = EXIT_MS + 100;

function safeRect(): Rect {
  const r = freeRect(size.width, size.height);
  return { left: r.left + MARGIN, top: r.top + MARGIN, right: r.right - MARGIN, bottom: r.bottom - MARGIN };
}

function endView(): { x: number; y: number; d: number } {
  if (!controls) return { x: 0, y: 0, d: DEFAULT_DISTANCE };
  controls.getTarget(tmp, true);
  return { x: tmp.x, y: -tmp.z, d: controls.getSpherical(sph, true).radius };
}

function place(x: number, y: number, d: number) {
  const cam = controls!.camera as THREE.PerspectiveCamera;
  probe.copy(cam);
  controls!.getSpherical(sph, true);
  sph.radius = d;
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

function fits(x: number, y: number, d: number, shot: Shot, r: Rect): boolean {
  place(x, y, d);
  return inside(bounds(shot), r);
}

function solve(x: number, y: number, d: number, shot: Shot, r: Rect): { x: number; y: number; d: number } {
  const far = Math.min(MAX_DISTANCE, d * ZOOM_OUT);
  for (let i = 0; i < 8; i++) {
    place(x, y, d);
    let b = bounds(shot);
    if (inside(b, r)) break;
    const grow = b ? Math.max((b.right - b.left) / (r.right - r.left), (b.bottom - b.top) / (r.bottom - r.top)) : 1.5;
    if (grow > 1 && d < far) {
      d = Math.min(far, d * grow * 1.04);
      place(x, y, d);
      b = bounds(shot);
    }
    if (!b) continue;
    const from = ground((b.left + b.right) / 2, (b.top + b.bottom) / 2);
    const to = ground((r.left + r.right) / 2, (r.top + r.bottom) / 2);
    if (!from || !to) break;
    x += from.x - to.x;
    y += from.y - to.y;
  }
  return { x, y, d };
}

async function glide(x: number, y: number, d: number, smooth: boolean) {
  if (!controls) return;
  await Promise.all([controls.moveTo(x, 0, -y, smooth), controls.dollyTo(d, smooth)]);
}

function apply(shot: Shot, smooth: boolean): Promise<void> {
  const r = safeRect();
  if (shot.at) base = shot.at[2];
  const view = endView();
  if (!shot.at && fits(view.x, view.y, view.d, shot, r)) return Promise.resolve();
  const from = shot.at ? { x: shot.at[0], y: shot.at[1] } : view;
  const to = solve(from.x, from.y, base ?? view.d, shot, r);
  return glide(to.x, to.y, to.d, smooth);
}

function keyOf(r: Rect): string {
  return `${Math.round(r.left / 8)},${Math.round(r.top / 8)},${Math.round(r.right / 8)},${Math.round(r.bottom / 8)}`;
}

let swift = 0;
let usualSmoothTime = 0;

async function swiftly(move: () => Promise<unknown>) {
  if (!controls) return;
  if (swift++ === 0) usualSmoothTime = controls.smoothTime;
  controls.smoothTime = SWIFT_SMOOTH_TIME;
  try {
    await move();
  } finally {
    if (--swift === 0 && controls) controls.smoothTime = usualSmoothTime;
  }
}

function retarget(shot: Shot) {
  current = shot;
  pending?.done();
  pending = null;
}

function startView(level: CompiledLevel): { x: number; y: number; distance: number } {
  const cam = level.camera ?? { x: 0, y: 0 };
  return { x: cam.x, y: cam.y, distance: (cam.distance ?? 15) * 1.2 };
}

export const cameraRig = {
  attach(c: CameraControls | null) {
    controls = c;
  },
  get controls() {
    return controls;
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
    place(v.x, v.y, v.d);
    const r = safeRect();
    return ground((r.left + r.right) / 2, (r.top + r.bottom) / 2) ?? v;
  },
  frame(shot: Shot, smooth = true): Promise<void> {
    retarget(shot);
    if (!controls) return Promise.resolve();
    if (!smooth || !sceneStarted()) return apply(shot, false);
    let done = () => {};
    const settled = new Promise<void>((resolve) => (done = resolve));
    pending = { shot, since: performance.now(), done, settled };
    return settled;
  },
  async arrive(shot: Shot) {
    await Promise.race([swiftly(() => cameraRig.frame(shot)), sleep(ARRIVING_MS)]);
  },
  include(labels: readonly Tile[]) {
    if (!labels.length) return;
    void cameraRig.frame({ ...current, labels: [...(current?.labels ?? []), ...labels] });
  },
  tick(width: number, height: number, framing: boolean) {
    size = { width, height };
    if (!controls || !framing) return;
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
    if (pending && now - Math.max(pending.since, layout.changed) >= SETTLE_MS) {
      const { shot, done } = pending;
      pending = null;
      layout.settled = true;
      void apply(shot, true).then(done);
    } else if (!pending && !layout.settled && now - layout.changed >= SETTLE_MS) {
      layout.settled = true;
      if (current && tilesOf(current).length) void apply({ ...current, at: undefined }, true);
    }
  },
  async zoomTo(distance: number) {
    if (pending) await pending.settled;
    if (!controls) return;
    await controls.dollyTo(distance, true);
  },
  async resetAngle(smooth = true) {
    if (!controls) return;
    await controls.rotateTo(VIEW.azimuth, VIEW.polar, smooth);
  },
  opening(level: CompiledLevel, smooth: boolean) {
    const v = startView(level);
    const shot: Shot = { at: [v.x, v.y, v.distance], focus: [[v.x, v.y]] };
    if (!smooth || !controls) {
      void cameraRig.resetAngle(false);
      void cameraRig.frame(shot, false);
      return;
    }
    retarget(shot);
    void swiftly(() => Promise.all([cameraRig.resetAngle(), apply(shot, true)]));
  },
};
