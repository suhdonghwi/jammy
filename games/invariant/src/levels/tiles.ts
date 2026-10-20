import type { FastState } from '../lang/eval';
import type { CompiledLevel, Inputs } from './level';

export interface TileWindow {
  cx: number;
  cy: number;
  R: number;
}

export function tileState(level: CompiledLevel, x: number, y: number, inputs: Inputs): FastState {
  return { ...inputs, [level.view.x]: x, [level.view.y]: y };
}

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

export function tilesNear<T>(level: CompiledLevel, inputs: Inputs, { cx, cy, R }: TileWindow, pick: (s: FastState, x: number, y: number) => T | undefined): T[] {
  const out: T[] = [];
  for (let y = cy - R; y <= cy + R; y++) {
    for (let x = cx - R; x <= cx + R; x++) {
      const v = pick(tileState(level, x, y, inputs), x, y);
      if (v !== undefined) out.push(v);
    }
  }
  return out;
}
