import type { State } from '../lang/ast';
import { holds, withinBudget } from '../lang/eval';
import type { Inputs } from '../levels/inputs';
import { hop, isEgg, running, startState, toBig, type CompiledLevel, type Formula } from '../levels/level';
import { breaksRule, counterexample, ruleQuery } from './rules';
import type { Counterexample, Rule } from './types';

export const NEAR = 8;
const RUN_LIMIT = 4096;

const SPAN = Array.from({ length: 2 * NEAR + 1 }, (_, k) => BigInt(k - NEAR));

function ranging(dims: string[], fixed: State): State[] {
  let out = [fixed];
  for (const d of dims) out = out.flatMap((s) => SPAN.map((v) => ({ ...s, [d]: v })));
  return out;
}

function smallestFirst(level: CompiledLevel, states: State[]): State[] {
  const { x, y } = level.view;
  const abs = (v: bigint) => (v < 0n ? -v : v);
  const size = (s: State) => abs(s[x] as bigint) + abs(s[y] as bigint);
  const cmp = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);
  return states.sort((a, b) => cmp(size(a), size(b)) || cmp(b[y] as bigint, a[y] as bigint) || cmp(b[x] as bigint, a[x] as bigint));
}

function eggs(level: CompiledLevel, fixed: State): State[] {
  const free = level.freeDims.filter((d) => !(d in fixed));
  const starts = ranging(free, fixed).map((s) => startState(level, s));
  return smallestFirst(level, starts.filter((s) => withinBudget(() => isEgg(level, s))));
}

function tiles(level: CompiledLevel, plane: State): State[] {
  return smallestFirst(level, ranging([level.view.x, level.view.y], plane));
}

// Only picks which Maintenance counterexample to show: one on the run of an
// egg in view comes first. The counterexample says nothing about runs, and
// Check shows it like any other (design.md, *The checker*).
export function failureOnARun(level: CompiledLevel, inv: Formula, inputs: Inputs): Counterexample | undefined {
  const maintenance = ruleQuery(level, inv.expr, 'maintenance');
  for (const egg of eggs(level, toBig(inputs))) {
    if (!withinBudget(() => holds(inv.expr, egg))) continue;
    let s = egg;
    for (let k = 0; k < RUN_LIMIT && running(level, s); k++) {
      if (breaksRule(maintenance, s)) return counterexample(level, inv, 'maintenance', s, false);
      s = hop(level, s);
    }
  }
}

export function smallestOnPlane(level: CompiledLevel, inv: Formula, rule: Rule, inputs: Inputs): Counterexample | undefined {
  const plane = toBig(inputs);
  const candidates = rule === 'initialization' ? eggs(level, plane) : tiles(level, plane);
  const query = ruleQuery(level, inv.expr, rule);
  const s = candidates.find((c) => breaksRule(query, c));
  return s && counterexample(level, inv, rule, s, false);
}
