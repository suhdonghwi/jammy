import type { CameraControls } from '@react-three/drei';
import * as THREE from 'three';

export type Tile = readonly [number, number];
export type View = readonly [number, number, number];

export interface Shot {
  at?: View;
  focus?: readonly Tile[];
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

let controls: CameraControls | null = null;
let size = { width: 1, height: 1 };
let current: Shot | null = null;
let userMoved = false;
let reach = 60;

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
const TILE_RADIUS = 0.5;
const MAX_DISTANCE = 60;
const TOO_FAR = 1.4;
const ZOOM_OUT = 1.6;
const MIN_FREE = 150;
const FAR_TRAVEL = 2.2;

const area = (r: Rect) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);

function safeRect(): Rect {
  let r: Rect = { left: 0, top: 0, right: size.width, bottom: size.height };
  for (const el of document.querySelectorAll('[data-frame]')) {
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height || b.right <= r.left || b.left >= r.right || b.bottom <= r.top || b.top >= r.bottom) continue;
    const cuts: Rect[] = [
      { ...r, bottom: Math.min(r.bottom, b.top) },
      { ...r, top: Math.max(r.top, b.bottom) },
      { ...r, right: Math.min(r.right, b.left) },
      { ...r, left: Math.max(r.left, b.right) },
    ];
    r = cuts.reduce((best, c) => (area(c) > area(best) ? c : best));
  }
  const free = { left: r.left + MARGIN, top: r.top + MARGIN, right: r.right - MARGIN, bottom: r.bottom - MARGIN };
  free.bottom = Math.max(free.bottom, Math.min(size.height, free.top + MIN_FREE));
  free.right = Math.max(free.right, Math.min(size.width, free.left + MIN_FREE));
  return free;
}

function endView(): { x: number; y: number; d: number } {
  if (!controls) return { x: 0, y: 0, d: 14 };
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

function bounds(focus: readonly Tile[]): Rect | null {
  const b: Rect = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const [x, y] of focus) {
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const s = toScreen(x + dx * TILE_RADIUS, y + dy * TILE_RADIUS);
      if (!s) return null;
      b.left = Math.min(b.left, s[0]);
      b.right = Math.max(b.right, s[0]);
      b.bottom = Math.max(b.bottom, s[1]);
    }
    const c = toScreen(x, y);
    if (!c) return null;
    b.top = Math.min(b.top, c[1] - TAG_ROOM);
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

function fits(x: number, y: number, d: number, focus: readonly Tile[], r: Rect): boolean {
  place(x, y, d);
  return inside(bounds(focus), r);
}

function solve(x: number, y: number, d: number, focus: readonly Tile[], r: Rect): { x: number; y: number; d: number } {
  const far = Math.max(d, reach);
  for (let i = 0; i < 8; i++) {
    place(x, y, d);
    let b = bounds(focus);
    if (inside(b, r)) break;
    const grow = b ? Math.max((b.right - b.left) / (r.right - r.left), (b.bottom - b.top) / (r.bottom - r.top)) : 1.5;
    if (grow > 1 && d < far) {
      d = Math.min(far, d * grow * 1.04);
      place(x, y, d);
      b = bounds(focus);
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
  const from = endView();
  if (smooth && Math.hypot(x - from.x, y - from.y) > FAR_TRAVEL * Math.max(d, from.d)) {
    await controls.dollyTo(Math.min(MAX_DISTANCE, Math.max(45, from.d)), true);
    await controls.moveTo(x, 0, -y, true);
    await controls.dollyTo(d, true);
    return;
  }
  await Promise.all([controls.moveTo(x, 0, -y, smooth), controls.dollyTo(d, smooth)]);
}

export const cameraRig = {
  attach(c: CameraControls | null) {
    controls = c;
  },
  get controls() {
    return controls;
  },
  resize(width: number, height: number) {
    size = { width, height };
  },
  target(): THREE.Vector3 {
    if (!controls) return tmp.set(0, 0, 0);
    return controls.getTarget(tmp);
  },
  distance(): number {
    return controls ? controls.distance : 14;
  },
  safeKey(): string {
    const r = safeRect();
    return `${Math.round(r.left / 8)},${Math.round(r.top / 8)},${Math.round(r.right / 8)},${Math.round(r.bottom / 8)}`;
  },
  viewCenter(): { x: number; y: number } {
    const v = endView();
    if (!controls) return v;
    place(v.x, v.y, v.d);
    const r = safeRect();
    return ground((r.left + r.right) / 2, (r.top + r.bottom) / 2) ?? v;
  },
  async frame(shot: Shot, smooth = true) {
    current = shot;
    userMoved = false;
    if (!controls) return;
    const focus = shot.focus ?? [];
    const r = safeRect();
    const now = endView();
    const at = shot.at ? { x: shot.at[0], y: shot.at[1], d: shot.at[2] } : null;
    reach = Math.min(MAX_DISTANCE, (at ?? now).d * ZOOM_OUT);
    const stay = focus.length > 0 && (!at || now.d <= at.d * TOO_FAR) && fits(now.x, now.y, now.d, focus, r);
    if (smooth && stay) return;
    if (at && (!focus.length || fits(at.x, at.y, at.d, focus, r))) return glide(at.x, at.y, at.d, smooth);
    if (!focus.length) return;
    const start = at ?? now;
    const to = solve(start.x, start.y, start.d, focus, r);
    return glide(to.x, to.y, to.d, smooth);
  },
  include(tiles: readonly Tile[]) {
    if (!tiles.length) return;
    void cameraRig.frame({ at: current?.at, focus: [...(current?.focus ?? []), ...tiles] });
  },
  reframe() {
    if (!controls || !current?.focus?.length || userMoved) return;
    const now = endView();
    if (fits(now.x, now.y, now.d, current.focus, safeRect())) return;
    const to = solve(now.x, now.y, now.d, current.focus, safeRect());
    void glide(to.x, to.y, to.d, true);
  },
  userMoved() {
    userMoved = true;
  },
  async zoomTo(distance: number) {
    if (!controls) return;
    await controls.dollyTo(distance, true);
  },
  async resetAngle(smooth = true) {
    if (!controls) return;
    await controls.rotateTo(VIEW.azimuth, VIEW.polar, smooth);
  },
};
