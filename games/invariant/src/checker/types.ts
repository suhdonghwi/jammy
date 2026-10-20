import type { State } from '../lang/ast';

export type Rule = 'initialization' | 'maintenance' | 'termination';
export const RULES: Rule[] = ['initialization', 'maintenance', 'termination'];

export interface Counterexample {
  rule: Rule;
  state: State;
  next?: State;
  broken?: string;
  far?: boolean;
}

export type RuleVerdict =
  | { status: 'pass'; how: 'proved' | 'equivalent' }
  | { status: 'fail'; cex: Counterexample }
  | { status: 'undecided' };

export type Verdicts = Record<Rule, RuleVerdict>;
