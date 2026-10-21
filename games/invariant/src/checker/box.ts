import type { Expr } from '../lang/ast';
import { compileFast, type FastFn, type FastState } from '../lang/eval';
import { toBig, type CompiledLevel, type Formula, type Inputs } from '../levels/level';
import { breaksRule, counterexample } from './rules';
import { RULES, type Counterexample, type Rule } from './types';

export interface Box {
  cx: number;
  cy: number;
  r: number;
  inputs: Inputs;
  planeR: number;
}

type Ranges = Record<string, (number | number[])[]>;

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
  const free = freeInputs(level);
  const planeR = free.length > 2 ? Math.min(box.planeR, 3) : free.length === 2 ? Math.min(box.planeR, 6) : box.planeR;
  for (const n of free) {
    const p = Number(box.inputs[n] ?? 0);
    const ps = [p];
    for (let d = 1; d <= planeR; d++) ps.push(p - d, p + d);
    out[n] = ps;
  }
  return out;
}

function product(dims: string[], rs: Ranges, visit: (s: FastState) => boolean | void): boolean {
  const s: FastState = {};
  const go = (k: number): boolean => {
    if (k === dims.length) return visit(s) !== false;
    for (const v of rs[dims[k]]) {
      s[dims[k]] = v;
      if (!go(k + 1)) return false;
    }
    return true;
  };
  return go(0);
}

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
    product(level.freeDims, rs, (free) => {
      if (!f.planeReq(free)) return;
      const start: FastState = { ...free };
      for (const v in f.init) start[v] = f.init[v](free) as number;
      if (!f.eggReq(start)) return;
      if (!inv.fast(start)) offer('initialization', start);
    });
  }
  if (rules.includes('maintenance') || rules.includes('termination')) {
    product(level.names, rs, (s) => {
      if (!f.planeReq(s)) return;
      if (!inv.fast(s)) return;
      if (f.guard(s)) {
        if (!rules.includes('maintenance')) return;
        const n: FastState = { ...s };
        for (const v in f.next) n[v] = f.next[v](s) as number;
        if (!inv.fast(n)) offer('maintenance', s);
      } else if (rules.includes('termination') && !f.post(s)) {
        offer('termination', s);
      }
    });
  }

  const out: Partial<Record<Rule, Counterexample>> = {};
  for (const rule of rules) {
    const b = best[rule];
    const s = b && toBig(b.s);
    if (s && breaksRule(level, inv.expr, rule, s)) out[rule] = counterexample(level, inv, rule, s, false);
  }
  return out;
}

export function sameOnBox(level: CompiledLevel, a: FastFn, b: Expr, box: Box): boolean {
  const fb = compileFast(b);
  const rs = ranges(level, { ...box, r: Math.min(box.r, 8), planeR: Math.min(box.planeR, 6) });
  return product(level.names, rs, (s) => !level.fast.planeReq(s) || a(s) === fb(s));
}
