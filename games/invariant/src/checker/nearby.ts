import type { State } from '../lang/ast';
import { holds, OverBudget } from '../lang/eval';
import { hop, isEgg, running, startState, toBig, type CompiledLevel, type Formula, type Inputs } from '../levels/level';
import { breaksRule, counterexample } from './rules';
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

function within(run: () => boolean): boolean {
  try {
    return run();
  } catch (e) {
    if (e instanceof OverBudget) return false;
    throw e;
  }
}

function eggs(level: CompiledLevel, fixed: State): State[] {
  const free = level.freeDims.filter((d) => !(d in fixed));
  const starts = ranging(free, fixed).map((s) => startState(level, s));
  return smallestFirst(level, starts.filter((s) => within(() => isEgg(level, s))));
}

function tiles(level: CompiledLevel, plane: State): State[] {
  return smallestFirst(level, ranging([level.view.x, level.view.y], plane));
}

function sameTile(level: CompiledLevel, a: State, b: State): boolean {
  return level.program.vars.every((v) => a[v.name] === b[v.name]);
}

export function realFailure(level: CompiledLevel, inv: Formula, inputs: Inputs): Counterexample | undefined {
  for (const egg of eggs(level, toBig(inputs))) {
    if (!within(() => holds(inv.expr, egg))) continue;
    const run = [egg];
    let s = egg;
    for (let k = 0; k < RUN_LIMIT && running(level, s); k++) {
      if (breaksRule(level, inv.expr, 'maintenance', s)) return { ...counterexample(level, inv, 'maintenance', s, false), run };
      s = hop(level, s);
      run.push(s);
    }
  }
}

export function smallestOnPlane(level: CompiledLevel, inv: Formula, rule: Rule, inputs: Inputs): Counterexample | undefined {
  const plane = toBig(inputs);
  const candidates = rule === 'initialization' ? eggs(level, plane) : tiles(level, plane);
  const s = candidates.find((c) => breaksRule(level, inv.expr, rule, c));
  return s && counterexample(level, inv, rule, s, false);
}

export function realRunTo(level: CompiledLevel, s: State): State[] | undefined {
  const inputs: State = {};
  for (const n of level.program.inputs) inputs[n] = s[n];
  let shortest: State[] | undefined;
  for (const egg of eggs(level, inputs)) {
    const run = [egg];
    let cur = egg;
    for (let k = 0; k <= RUN_LIMIT && (!shortest || run.length < shortest.length); k++) {
      if (sameTile(level, cur, s)) {
        shortest = run;
        break;
      }
      if (!running(level, cur)) break;
      cur = hop(level, cur);
      run.push(cur);
    }
  }
  return shortest;
}
