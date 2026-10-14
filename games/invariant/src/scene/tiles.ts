import type { FastFn } from '../lang/eval';
import type { CompiledLevel } from '../levels/level';

/** Per-tile data for the window of tiles around the camera, in the focused pond. */
export interface WindowData {
  cx: number;
  cy: number;
  R: number;
  size: number;
  exists: Uint8Array;
  stop: Uint8Array;
  goal: Uint8Array;
  area: Uint8Array;
  egg: Uint8Array;
}

export function windowIndex(w: WindowData, x: number, y: number): number {
  const i = x - (w.cx - w.R);
  const j = y - (w.cy - w.R);
  if (i < 0 || j < 0 || i >= w.size || j >= w.size) return -1;
  return j * w.size + i;
}

export function tileState(level: CompiledLevel, x: number, y: number, pond: number): Record<string, number> {
  const s: Record<string, number> = { [level.view.x]: x, [level.view.y]: y };
  if (level.pond) s[level.pond] = pond;
  return s;
}

export function computeWindow(
  level: CompiledLevel,
  pond: number,
  inv: FastFn | null,
  cx: number,
  cy: number,
  R: number,
): WindowData {
  const size = 2 * R + 1;
  const n = size * size;
  const w: WindowData = {
    cx, cy, R, size,
    exists: new Uint8Array(n),
    stop: new Uint8Array(n),
    goal: new Uint8Array(n),
    area: new Uint8Array(n),
    egg: new Uint8Array(n),
  };
  const f = level.fast;
  const s = tileState(level, 0, 0, pond);
  const X = level.view.x;
  const Y = level.view.y;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const k = j * size + i;
      s[X] = cx - R + i;
      s[Y] = cy - R + j;
      if (!f.pondReq(s)) continue;
      w.exists[k] = 1;
      if (!f.guard(s)) {
        w.stop[k] = 1;
        if (f.post(s)) w.goal[k] = 1;
      }
      if (inv && inv(s) === true) w.area[k] = 1;
    }
  }
  // Eggs: enumerate the free dims (each is an axis or the pond).
  const dims = level.freeDims;
  const values = (d: string): number[] => {
    if (d === X) return Array.from({ length: size }, (_, i) => cx - R + i);
    if (d === Y) return Array.from({ length: size }, (_, j) => cy - R + j);
    return [pond];
  };
  const free: Record<string, number> = {};
  const go = (k: number) => {
    if (k === dims.length) {
      if (!f.pondReq(free)) return;
      const st: Record<string, number> = { ...free };
      for (const v in f.init) st[v] = f.init[v](free) as number;
      if (!f.eggReq(st)) return;
      const idx = windowIndex(w, st[X], st[Y]);
      if (idx >= 0) w.egg[idx] = 1;
      return;
    }
    for (const v of values(dims[k])) {
      free[dims[k]] = v;
      go(k + 1);
    }
  };
  go(0);
  return w;
}

/** Shared mutable scene state read inside render loops (not React state). */
export const sceneShared: {
  win: WindowData | null;
  /** Current (animated) slab heights, aligned with `win`. */
  heights: Float32Array | null;
} = { win: null, heights: null };

export function baseHeightAt(x: number, y: number): number {
  const w = sceneShared.win;
  const h = sceneShared.heights;
  if (!w || !h) return 0;
  const k = windowIndex(w, Math.round(x), Math.round(y));
  return k >= 0 ? h[k] : 0;
}
