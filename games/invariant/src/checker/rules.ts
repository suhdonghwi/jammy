import { conjuncts, mk, subst, type Expr, type State } from '../lang/ast';
import { holds, withinBudget } from '../lang/eval';
import { hop, startState, type CompiledLevel, type Formula } from '../levels/level';
import type { Counterexample, Rule } from './types';

export interface RuleQuery {
  dims: string[];
  parts: Expr[];
}

export function ruleQuery(level: CompiledLevel, inv: Expr, rule: Rule): RuleQuery {
  if (rule === 'initialization') {
    const atStart = (e: Expr) => subst(e, level.initExprs);
    return { dims: level.freeDims, parts: [atStart(level.planeReq), atStart(level.eggReq), mk.not(atStart(inv))] };
  }
  if (rule === 'maintenance') return { dims: level.names, parts: [level.planeReq, inv, level.guard, mk.not(subst(inv, level.next))] };
  return { dims: level.names, parts: [level.planeReq, inv, mk.not(level.guard), mk.not(level.post)] };
}

export function breaksRule(q: RuleQuery, s: State): boolean {
  return withinBudget(() => q.parts.every((p) => holds(p, s)));
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
  const bad = cs.find((c) => withinBudget(() => !holds(c, s)));
  return bad ? inv.text.slice(bad.span.from, bad.span.to) : undefined;
}
