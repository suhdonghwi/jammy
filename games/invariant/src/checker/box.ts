import type { Expr } from '../lang/ast';
import { compileFast, type FastFn, type FastState } from '../lang/eval';
import { toBig, type CompiledLevel, type Formula, type Inputs } from '../levels/level';
import { breaksRule, counterexample } from './rules';
import { RULES, type Counterexample, type Rule } from './types';

// Brute-force search of the states around the camera: finds the nicest
// counterexamples quickly, before the solver has to. It looks through the
// plane in view and the planes of nearby integer inputs; an array is only
// ever the one in view (other arrays are the solver's job).

export interface Box {
  cx: number;
  cy: number;
  /** Half-size of the tile box. */
  r: number;
  /** The plane in view: the off-axis inputs. */
  inputs: Inputs;
  /** How many values of an integer input to search on each side of the one in view. */
  planeR: number;
}

type Ranges = Record<string, (number | number[])[]>;

/** The integer inputs the search varies: not on an axis, and not an array's length (which follows its array). */
function freeInputs(level: CompiledLevel): string[] {
  const lengths = new Set(Object.values(level.arrays));
  return level.offAxis.filter((n) => !level.arrays[n] && !lengths.has(n));
}

function ranges(level: CompiledLevel, box: Box): Ranges {
  const span = (c: number, r: number) => Array.from({ length: 2 * r + 1 }, (_, k) => c - r + k);
  const out: Ranges = {
    [level.view.x]: span(Math.round(box.cx), box.r),
    [level.view.y]: span(Math.round(box.cy), box.r),
  };
  for (const n of level.offAxis) out[n] = [box.inputs[n]];
  // several integer inputs multiply the search: fewer planes each
  const free = freeInputs(level);
  const planeR = free.length > 2 ? Math.min(box.planeR, 3) : free.length === 2 ? Math.min(box.planeR, 6) : box.planeR;
  for (const n of free) {
    const p = Number(box.inputs[n] ?? 0);
    // nearest planes first
    const ps = [p];
    for (let d = 1; d <= planeR; d++) ps.push(p - d, p + d);
    out[n] = ps;
  }
  return out;
}

function* product(dims: string[], rs: Ranges): Generator<FastState> {
  const s: FastState = {};
  function* go(k: number): Generator<FastState> {
    if (k === dims.length) {
      yield s;
      return;
    }
    for (const v of rs[dims[k]]) {
      s[dims[k]] = v;
      yield* go(k + 1);
    }
  }
  yield* go(0);
}

/**
 * Search a box of states for the nicest counterexample to each rule:
 * nearest plane first, then smallest values, then closest to the camera.
 */
export function boxSearch(
  level: CompiledLevel,
  inv: Formula,
  box: Box,
  rules: Rule[] = RULES,
): Partial<Record<Rule, Counterexample>> {
  const rs = ranges(level, box);
  const f = level.fast;
  const free = freeInputs(level);
  const score = (s: FastState) => {
    let pd = 0;
    for (const n of free) pd += Math.abs(Number(s[n]) - Number(box.inputs[n] ?? 0));
    const x = s[level.view.x] as number;
    const y = s[level.view.y] as number;
    const mag = Math.abs(x) + Math.abs(y);
    const cam = Math.abs(x - box.cx) + Math.abs(y - box.cy);
    return pd * 1e8 + mag * 1e4 + cam;
  };
  const best: Partial<Record<Rule, { s: FastState; score: number }>> = {};
  const offer = (rule: Rule, s: FastState) => {
    const sc = score(s);
    const cur = best[rule];
    if (!cur || sc < cur.score) best[rule] = { s: { ...s }, score: sc };
  };

  if (rules.includes('initialization')) {
    // Enumerate free dims; free dims are always on an axis or in the inputs card.
    for (const free of product(level.freeDims, rs)) {
      if (!f.planeReq(free)) continue;
      const start: FastState = { ...free };
      for (const v in f.init) start[v] = f.init[v](free) as number;
      if (!f.eggReq(start)) continue;
      if (!inv.fast(start)) offer('initialization', start);
    }
  }
  if (rules.includes('maintenance') || rules.includes('termination')) {
    for (const s of product(level.names, rs)) {
      if (!f.planeReq(s)) continue;
      if (!inv.fast(s)) continue;
      if (f.guard(s)) {
        if (!rules.includes('maintenance')) continue;
        const n: FastState = { ...s };
        for (const v in f.next) n[v] = f.next[v](s) as number;
        if (!inv.fast(n)) offer('maintenance', s);
      } else if (rules.includes('termination') && !f.post(s)) {
        offer('termination', s);
      }
    }
  }

  // Confirm with exact arithmetic and build counterexamples.
  const out: Partial<Record<Rule, Counterexample>> = {};
  for (const rule of rules) {
    const b = best[rule];
    const s = b && toBig(b.s);
    if (s && breaksRule(level, inv.expr, rule, s)) out[rule] = counterexample(level, inv, rule, s, false);
  }
  return out;
}

/** Truth table of a formula over a box — used to cheaply rule out equivalence. */
export function sameOnBox(level: CompiledLevel, a: FastFn, b: Expr, box: Box): boolean {
  const fb = compileFast(b);
  const rs = ranges(level, { ...box, r: Math.min(box.r, 8), planeR: Math.min(box.planeR, 6) });
  for (const s of product(level.names, rs)) {
    if (!level.fast.planeReq(s)) continue;
    if (a(s) !== fb(s)) return false;
  }
  return true;
}
