import { conjuncts, type Expr, type State } from '../lang/ast';
import { compileFast, holds, type FastFn } from '../lang/eval';
import { hop, startState, toBig, type CompiledLevel, type Rule } from '../levels/level';
import type { Counterexample } from './types';

export interface Box {
  cx: number;
  cy: number;
  /** Half-size of the tile box. */
  r: number;
  /** Focused pond (if the level has ponds). */
  pond?: number;
  /** How many ponds to search on each side of the focused one. */
  pondR: number;
}

/** Which conjunct of `inv` is false in state s (source text). */
export function brokenConjunct(inv: Expr, src: string, s: State): string | undefined {
  const cs = conjuncts(inv);
  if (cs.length < 2) return undefined;
  const bad = cs.find((c) => !holds(c, s));
  return bad ? src.slice(bad.span.from, bad.span.to) : undefined;
}

type NumState = Record<string, number>;

function ranges(level: CompiledLevel, box: Box): Record<string, number[]> {
  const span = (c: number, r: number) => Array.from({ length: 2 * r + 1 }, (_, k) => c - r + k);
  const out: Record<string, number[]> = {
    [level.view.x]: span(Math.round(box.cx), box.r),
    [level.view.y]: span(Math.round(box.cy), box.r),
  };
  if (level.pond) {
    const p = box.pond ?? 0;
    // nearest ponds first
    const ps = [p];
    for (let d = 1; d <= box.pondR; d++) ps.push(p - d, p + d);
    out[level.pond] = ps;
  }
  return out;
}

function* product(dims: string[], rs: Record<string, number[]>): Generator<NumState> {
  const s: NumState = {};
  function* go(k: number): Generator<NumState> {
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
 * nearest pond first, then smallest values, then closest to the camera.
 */
export function boxSearch(
  level: CompiledLevel,
  inv: { expr: Expr; fast: FastFn; text: string },
  box: Box,
  rules: Rule[] = ['init', 'pres', 'exit'],
): Partial<Record<Rule, Counterexample>> {
  const rs = ranges(level, box);
  const f = level.fast;
  const focus = box.pond ?? 0;
  const score = (s: NumState) => {
    const pd = level.pond ? Math.abs(s[level.pond] - focus) : 0;
    const x = s[level.view.x];
    const y = s[level.view.y];
    const mag = Math.abs(x) + Math.abs(y);
    const cam = Math.abs(x - box.cx) + Math.abs(y - box.cy);
    return pd * 1e8 + mag * 1e4 + cam;
  };
  const best: Partial<Record<Rule, { s: NumState; next?: NumState; score: number }>> = {};
  const offer = (rule: Rule, s: NumState, next?: NumState) => {
    const sc = score(s);
    const cur = best[rule];
    if (!cur || sc < cur.score) best[rule] = { s: { ...s }, next: next && { ...next }, score: sc };
  };

  if (rules.includes('init')) {
    // Enumerate free dims; free dims are always on an axis or the pond.
    for (const free of product(level.freeDims, rs)) {
      if (!f.pondReq(free)) continue;
      const start: NumState = { ...free };
      for (const v in f.init) start[v] = f.init[v](free) as number;
      if (!f.eggReq(start)) continue;
      if (!inv.fast(start)) offer('init', start);
    }
  }
  if (rules.includes('pres') || rules.includes('exit')) {
    for (const s of product(level.names, rs)) {
      if (!f.pondReq(s)) continue;
      if (!inv.fast(s)) continue;
      if (f.guard(s)) {
        if (!rules.includes('pres')) continue;
        const n: NumState = { ...s };
        for (const v in f.next) n[v] = f.next[v](s) as number;
        if (!inv.fast(n)) offer('pres', s, n);
      } else if (rules.includes('exit') && !f.post(s)) {
        offer('exit', s);
      }
    }
  }

  // Confirm with exact arithmetic and build counterexamples.
  const out: Partial<Record<Rule, Counterexample>> = {};
  for (const rule of rules) {
    const b = best[rule];
    if (!b) continue;
    const state = toBig(b.s);
    if (rule === 'init') {
      const free: State = {};
      for (const d of level.freeDims) free[d] = state[d];
      const st = startState(level, free);
      if (holds(inv.expr, st)) continue;
      out.init = { rule, state: st, broken: brokenConjunct(inv.expr, inv.text, st) };
    } else if (rule === 'pres') {
      const n = hop(level, state);
      if (!holds(inv.expr, state) || holds(inv.expr, n)) continue;
      out.pres = { rule, state, next: n, broken: brokenConjunct(inv.expr, inv.text, n) };
    } else {
      if (!holds(inv.expr, state) || holds(level.guard, state) || holds(level.post, state)) continue;
      out.exit = { rule, state };
    }
  }
  return out;
}

/** Truth table of a formula over a box — used to cheaply rule out equivalence. */
export function sameOnBox(level: CompiledLevel, a: FastFn, b: Expr, box: Box): boolean {
  const fb = compileFast(b);
  const rs = ranges(level, { ...box, r: Math.min(box.r, 8), pondR: Math.min(box.pondR, 6) });
  for (const s of product(level.names, rs)) {
    if (!level.fast.pondReq(s)) continue;
    if (a(s) !== fb(s)) return false;
  }
  return true;
}
