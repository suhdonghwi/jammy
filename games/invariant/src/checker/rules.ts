import { conjuncts, type Expr, type State } from '../lang/ast';
import { holds } from '../lang/eval';
import { hop, startState, type CompiledLevel, type Formula } from '../levels/level';
import type { Counterexample, Rule } from './types';

// A rule on one state, exactly: does the state break it, and the
// counterexample it makes. The box search and the solver both end here.

/** Does this state break the rule, exactly? (A model of an unrolled query is checked with this.) */
export function breaksRule(level: CompiledLevel, inv: Expr, rule: Rule, s: State): boolean {
  if (rule === 'initialization') {
    const start = startState(level, s);
    return holds(level.planeReq, start) && holds(level.eggReq, start) && !holds(inv, start);
  }
  if (!holds(level.planeReq, s) || !holds(inv, s)) return false;
  if (rule === 'maintenance') return holds(level.guard, s) && !holds(inv, hop(level, s));
  return !holds(level.guard, s) && !holds(level.post, s);
}

/** The counterexample a state breaking the rule makes; `far`: found by the solver, outside the box. */
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

/** Which conjunct of `inv` is false in state s (source text). */
function brokenConjunct(inv: Formula, s: State): string | undefined {
  const cs = conjuncts(inv.expr);
  if (cs.length < 2) return undefined;
  const bad = cs.find((c) => !holds(c, s));
  return bad ? inv.text.slice(bad.span.from, bad.span.to) : undefined;
}
