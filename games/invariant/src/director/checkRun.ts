import { checkFormula, type CheckResult } from '../checker/check';
import type { Rule } from '../checker/types';
import { browserZ3 } from '../checker/z3-browser';
import { useGame } from '../game/store';
import { t as messages } from '../i18n/i18n';
import { beginCheck, caption } from './sequence';

let inFlight = 0;

export async function runChecker(rules: Rule[]): Promise<CheckResult | null> {
  const g = useGame.getState();
  const inv = g.valid;
  if (!g.level || !inv || (g.formula && !g.formula.ok)) return null;
  const keep = { ...g.verdicts };
  for (const r of rules) delete keep[r];
  const run = beginCheck();
  const current = () => {
    const now = useGame.getState();
    return run.alive && now.level === g.level && now.mode === g.mode && now.valid === inv;
  };
  inFlight++;
  useGame.setState({ checking: true, verdicts: keep, pending: rules, failMark: null, region: null });
  let res: CheckResult | null = null;
  try {
    const ctx = await browserZ3();
    const checked = await checkFormula(ctx, g.level, inv, g.inputs, { rules, timeout: 4000 });
    if (current()) res = checked;
  } catch (e) {
    if (current()) caption(messages().verdicts.solverFailed((e as Error).message), 'fail');
  } finally {
    inFlight--;
    const dropPending = !res && run.alive;
    useGame.setState((now) => ({
      checking: inFlight > 0,
      pending: dropPending ? now.pending.filter((r) => !rules.includes(r)) : now.pending,
      ...(res ? { pitfallMessage: res.pitfall?.message ?? null } : {}),
    }));
  }
  return res;
}
