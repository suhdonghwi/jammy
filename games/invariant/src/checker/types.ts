import type { State } from '../lang/ast';
import type { Rule } from '../levels/level';

// What a check reports for each rule.

export interface Counterexample {
  rule: Rule;
  /** The frog's state (for init: the start state). */
  state: State;
  /** For preservation: where the hop lands. */
  next?: State;
  /** Source text of the conjunct that is false (after the hop / at the egg). */
  broken?: string;
  /** Found outside the visible box (by the solver). */
  far?: boolean;
}

export type RuleVerdict =
  | { status: 'pass'; how: 'proved' | 'equivalent' }
  | { status: 'fail'; cex: Counterexample }
  | { status: 'undecided' };

export type Verdicts = Record<Rule, RuleVerdict>;
