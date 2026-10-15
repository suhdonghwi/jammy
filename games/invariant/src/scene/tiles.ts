import type { FastFn, FastState } from '../lang/eval';
import type { CompiledLevel, Inputs } from '../levels/level';

// Tiles are the plane's integer points: tile (x, y) sits at world (x, 0, -y),
// so +y goes away from the camera.

/** A square of tiles: centre (cx, cy), half-size R. */
export interface TileWindow {
  cx: number;
  cy: number;
  R: number;
}

/** The state at tile (x, y) of the plane the inputs pick. */
export function tileState(level: CompiledLevel, x: number, y: number, inputs: Inputs): FastState {
  return { ...inputs, [level.view.x]: x, [level.view.y]: y };
}

/** Egg tiles (start states) within a square around (cx, cy), in the given plane. */
export function eggsNear(level: CompiledLevel, inputs: Inputs, cx: number, cy: number, R: number): [number, number][] {
  const out: [number, number][] = [];
  const f = level.fast;
  const dims = level.freeDims;
  const X = level.view.x;
  const Y = level.view.y;
  const values = (d: string): (number | number[])[] => {
    if (d === X) return Array.from({ length: 2 * R + 1 }, (_, i) => cx - R + i);
    if (d === Y) return Array.from({ length: 2 * R + 1 }, (_, j) => cy - R + j);
    return [inputs[d]];
  };
  const free: FastState = {};
  const go = (k: number) => {
    if (k === dims.length) {
      if (!f.planeReq(free)) return;
      const st: FastState = { ...free };
      for (const v in f.init) st[v] = f.init[v](free) as number;
      if (!f.eggReq(st)) return;
      const sx = st[X] as number;
      const sy = st[Y] as number;
      if (Math.abs(sx - cx) <= R && Math.abs(sy - cy) <= R) out.push([sx, sy]);
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
export function areaNear(level: CompiledLevel, inputs: Inputs, inv: FastFn, cx: number, cy: number, R: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = cy - R; y <= cy + R; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      const s = tileState(level, x, y, inputs);
      if (level.fast.planeReq(s) && inv(s) === true) out.push([x, y]);
    }
  }
  return out;
}
