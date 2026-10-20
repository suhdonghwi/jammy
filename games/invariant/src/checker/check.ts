import type { Context } from 'z3-solver';
import { compileFormula, type CompiledLevel, type Formula, type Pitfall } from '../levels/level';
import { boxSearch, sameOnBox, type Box } from './box';
import { breaksRule, counterexample } from './rules';
import { equivalent, ruleQuery, solve } from './smt';
import { RULES, type Rule, type RuleVerdict, type Verdicts } from './types';

// Checking an area against the three rules.

interface CheckOptions {
  /** Per-query solver timeout (ms). */
  timeout?: number;
  rules?: Rule[];
}

export interface CheckResult {
  verdicts: Partial<Verdicts>;
  pitfall?: Pitfall;
}

/**
 * Box search finds nice counterexamples fast; Z3 decides the rest.
 * A rule passes only if Z3 proves it (or the formula is provably
 * equivalent to a known solution).
 */
export async function checkFormula(
  ctx: Context<'main'>,
  level: CompiledLevel,
  inv: Formula,
  box: Box,
  opts: CheckOptions = {},
): Promise<CheckResult> {
  const timeout = opts.timeout ?? 3000;
  const rules = opts.rules ?? RULES;
  const found = boxSearch(level, inv, box, rules);
  const verdicts: Partial<Verdicts> = {};
  for (const rule of rules) {
    const cex = found[rule];
    if (cex) {
      verdicts[rule] = { status: 'fail', cex };
      continue;
    }
    const { dims, query } = ruleQuery(level, inv.expr, rule);
    const r = await solve(ctx, level, dims, query, { timeout, verify: (s) => breaksRule(level, inv.expr, rule, s) });
    verdicts[rule] =
      r.kind === 'unsat'
        ? { status: 'pass', how: 'proved' }
        : r.kind === 'sat'
          ? { status: 'fail', cex: counterexample(level, inv, rule, r.state, true) }
          : { status: 'undecided' };
  }

  /** The first of `items` whose formula is provably equivalent to the area (a truth table on the box rules most out cheaply). */
  const firstEquivalent = async <T>(items: T[], formula: (x: T) => string, timeout: number) => {
    for (const x of items) {
      const f = compileFormula(level, formula(x));
      if (f.ok && sameOnBox(level, inv.fast, f.expr, box) && (await equivalent(ctx, level, inv.expr, f.expr, timeout))) return x;
    }
  };

  // Undecided: if the formula is equivalent to a known solution, the proof carries over.
  const undecided = rules.filter((r) => verdicts[r]?.status === 'undecided');
  const failed = rules.some((r) => verdicts[r]?.status === 'fail');
  if (undecided.length > 0 && !failed && (await firstEquivalent(level.solutions, (s) => s, timeout * 2)) !== undefined) {
    for (const r of undecided) verdicts[r] = { status: 'pass', how: 'equivalent' } satisfies RuleVerdict;
  }
  const pitfall = failed ? await firstEquivalent(level.pitfalls ?? [], (p) => p.formula, 1000) : undefined;
  return { verdicts, pitfall };
}
