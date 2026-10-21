import { conjuncts, type Expr, type State } from '../lang/ast';
import { holds, OverBudget } from '../lang/eval';
import { hop, startState, type CompiledLevel, type Formula } from '../levels/level';
import type { Counterexample, Rule } from './types';

export function breaksRule(level: CompiledLevel, inv: Expr, rule: Rule, s: State): boolean {
  try {
    return breaks(level, inv, rule, s);
  } catch (e) {
    if (e instanceof OverBudget) return false;
    throw e;
  }
}

function breaks(level: CompiledLevel, inv: Expr, rule: Rule, s: State): boolean {
  if (rule === 'initialization') {
    const start = startState(level, s);
    return holds(level.planeReq, start) && holds(level.eggReq, start) && !holds(inv, start);
  }
  if (!holds(level.planeReq, s) || !holds(inv, s)) return false;
  if (rule === 'maintenance') return holds(level.guard, s) && !holds(inv, hop(level, s));
  return !holds(level.guard, s) && !holds(level.post, s);
}

export function counterexample(level: CompiledLevel, inv: Formula, rule: Rule, s: State, far: boolean): Counterexample {
  if (rule === 'initialization') {
    const start = startState(level, s);
    return { rule, state: start, broken: brokenConjunct(inv, start), far };
  }
  if (rule === 'maintenance') {
    const n = hop(level, s);
    return { rule, state: s, next: n, broken: brokenConjunct(inv, n), far };
  }
  return { rule, state: s, far };
}

function brokenConjunct(inv: Formula, s: State): string | undefined {
  const cs = conjuncts(inv.expr);
  if (cs.length < 2) return undefined;
  const bad = cs.find((c) => {
    try {
      return !holds(c, s);
    } catch (e) {
      if (e instanceof OverBudget) return false;
      throw e;
    }
  });
  return bad ? inv.text.slice(bad.span.from, bad.span.to) : undefined;
}
