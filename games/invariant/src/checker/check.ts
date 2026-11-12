import type { Context } from 'z3-solver';
import { compileFormula, type CompiledLevel, type Formula, type Inputs, type Pitfall } from '../levels/level';
import { realFailure, realRunTo, smallestOnPlane } from './nearby';
import { breaksRule, counterexample } from './rules';
import { equivalent, ruleQuery, solve } from './smt';
import { RULES, type Counterexample, type Rule, type RuleVerdict, type Verdicts } from './types';

interface CheckOptions {
  timeout?: number;
  rules?: Rule[];
}

export interface CheckResult {
  verdicts: Partial<Verdicts>;
  pitfall?: Pitfall;
}

function withRun(level: CompiledLevel, cex: Counterexample): Counterexample {
  if (cex.run) return cex;
  return { ...cex, run: cex.rule === 'initialization' ? [cex.state] : realRunTo(level, cex.state) };
}

export async function checkFormula(
  ctx: Context<'main'>,
  level: CompiledLevel,
  inv: Formula,
  inputs: Inputs,
  opts: CheckOptions = {},
): Promise<CheckResult> {
  const timeout = opts.timeout ?? 3000;
  const rules = opts.rules ?? RULES;
  const verdicts: Partial<Verdicts> = {};
  for (const rule of rules) {
    const near = (rule === 'maintenance' ? realFailure(level, inv, inputs) : undefined) ?? smallestOnPlane(level, inv, rule, inputs);
    if (near) {
      verdicts[rule] = { status: 'fail', cex: withRun(level, near) };
      continue;
    }
    const { dims, query } = ruleQuery(level, inv.expr, rule);
    const r = await solve(ctx, level, dims, query, { timeout, verify: (s) => breaksRule(level, inv.expr, rule, s) });
    verdicts[rule] =
      r.kind === 'unsat'
        ? { status: 'pass', how: 'proved' }
        : r.kind === 'sat'
          ? { status: 'fail', cex: withRun(level, counterexample(level, inv, rule, r.state, true)) }
          : { status: 'undecided' };
  }

  const firstEquivalent = async <T>(items: T[], formula: (x: T) => string, timeout: number) => {
    for (const x of items) {
      const f = compileFormula(level, formula(x));
      if (f.ok && (await equivalent(ctx, level, inv.expr, f.expr, timeout))) return x;
    }
  };

  const undecided = rules.filter((r) => verdicts[r]?.status === 'undecided');
  const failed = rules.some((r) => verdicts[r]?.status === 'fail');
  if (undecided.length > 0 && !failed && (await firstEquivalent(level.solutions, (s) => s, timeout * 2)) !== undefined) {
    for (const r of undecided) verdicts[r] = { status: 'pass', how: 'equivalent' } satisfies RuleVerdict;
  }
  const pitfall = failed ? await firstEquivalent(level.pitfalls ?? [], (p) => p.formula, 1000) : undefined;
  return { verdicts, pitfall };
}
