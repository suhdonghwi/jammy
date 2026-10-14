import type { FastFn } from '../lang/eval';
import type { CompiledLevel } from '../levels/level';

/** Tile (X, Y) → world (x, z). +Y goes away from the camera. */
export function tileToWorld(x: number, y: number): [number, number] {
  return [x, -y];
}

export function tileState(level: CompiledLevel, x: number, y: number, pond: number): Record<string, number> {
  const s: Record<string, number> = { [level.view.x]: x, [level.view.y]: y };
  if (level.pond) s[level.pond] = pond;
  return s;
}

/** Egg tiles (start states) within a square around (cx, cy), in the given pond. */
export function eggsNear(level: CompiledLevel, pond: number, cx: number, cy: number, R: number): [number, number][] {
  const out: [number, number][] = [];
  const f = level.fast;
  const dims = level.freeDims;
  const X = level.view.x;
  const Y = level.view.y;
  const values = (d: string): number[] => {
    if (d === X) return Array.from({ length: 2 * R + 1 }, (_, i) => cx - R + i);
    if (d === Y) return Array.from({ length: 2 * R + 1 }, (_, j) => cy - R + j);
    return [pond];
  };
  const free: Record<string, number> = {};
  const go = (k: number) => {
    if (k === dims.length) {
      if (!f.pondReq(free)) return;
      const st: Record<string, number> = { ...free };
      for (const v in f.init) st[v] = f.init[v](free) as number;
      if (!f.eggReq(st)) return;
      if (Math.abs(st[X] - cx) <= R && Math.abs(st[Y] - cy) <= R) out.push([st[X], st[Y]]);
      return;
    }
    for (const v of values(dims[k])) {
      free[dims[k]] = v;
      go(k + 1);
    }
  };
  go(0);
  return out;
}

/** Tiles of the area within a square around (cx, cy). */
export function areaNear(level: CompiledLevel, pond: number, inv: FastFn, cx: number, cy: number, R: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = cy - R; y <= cy + R; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      const s = tileState(level, x, y, pond);
      if (level.fast.pondReq(s) && inv(s) === true) out.push([x, y]);
    }
  }
  return out;
}
