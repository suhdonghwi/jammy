import type { Context } from 'z3-solver';
import type { Expr } from '../lang/ast';
import type { FastFn } from '../lang/eval';
import { compileFormula, RULES, type CompiledLevel, type Pitfall, type Rule } from '../levels/level';
import { boxSearch, sameOnBox, type Box } from './box';
import { cexFromModel, equivalent, ruleQuery, solve } from './smt';
import type { RuleVerdict, Verdicts } from './types';

// Checking an area against the three rules.

export interface Formula {
  expr: Expr;
  fast: FastFn;
  text: string;
}

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
    const r = await solve(ctx, dims, query, { timeout });
    verdicts[rule] =
      r.kind === 'unsat'
        ? { status: 'pass', how: 'proved' }
        : r.kind === 'sat'
          ? { status: 'fail', cex: cexFromModel(level, inv.expr, inv.text, rule, r.state) }
          : { status: 'undecided' };
  }

  // Undecided: if the formula is equivalent to a known solution, the proof carries over.
  const undecided = rules.filter((r) => verdicts[r]?.status === 'undecided');
  if (undecided.length > 0 && rules.every((r) => verdicts[r]?.status !== 'fail')) {
    for (const solText of level.solutions) {
      const sol = compileFormula(level, solText);
      if (!sol.ok || !sameOnBox(level, inv.fast, sol.expr, box)) continue;
      if (await equivalent(ctx, level, inv.expr, sol.expr, timeout * 2)) {
        for (const r of undecided) verdicts[r] = { status: 'pass', how: 'equivalent' } satisfies RuleVerdict;
        break;
      }
    }
  }

  let pitfall: Pitfall | undefined;
  if (rules.some((r) => verdicts[r]?.status === 'fail')) {
    for (const p of level.pitfalls ?? []) {
      const pf = compileFormula(level, p.formula);
      if (!pf.ok || !sameOnBox(level, inv.fast, pf.expr, box)) continue;
      if (await equivalent(ctx, level, inv.expr, pf.expr, 1000)) {
        pitfall = p;
        break;
      }
    }
  }
  return { verdicts, pitfall };
}
