import { afterAll, describe, expect, it } from 'vitest';
import { checkFormula } from '../src/checker/check';
import { failureOnARun, smallestOnPlane } from '../src/checker/nearby';
import { RULES, type Counterexample, type Rule } from '../src/checker/types';
import { nodeZ3, shutdownZ3 } from '../src/checker/z3-node';
import { allLevels } from '../src/levels/catalog';
import { startInputs, type Inputs } from '../src/levels/inputs';
import { compileFormula, compileLevel, toNum } from '../src/levels/level';

const level = (id: string) => compileLevel(allLevels.find((l) => l.id === id)!);
const formula = (lvl: ReturnType<typeof compileLevel>, text: string) => {
  const f = compileFormula(lvl, text);
  if (!f.ok) throw f.error;
  return f;
};
const smallest = (id: string, text: string) => {
  const lvl = level(id);
  const f = formula(lvl, text);
  const inputs = startInputs(lvl);
  return Object.fromEntries(RULES.map((r) => [r, smallestOnPlane(lvl, f, r, inputs)])) as Record<Rule, Counterexample | undefined>;
};
const onRun = (id: string, text: string, inputs?: Inputs) => {
  const lvl = level(id);
  return failureOnARun(lvl, formula(lvl, text), inputs ?? startInputs(lvl));
};

describe('tutorial counterexamples match the design', () => {
  it('A: i == n fails initialization at the egg (0, 1)', () => {
    expect(toNum(smallest('tutorial', 'i == n').initialization!.state)).toEqual({ n: 1, i: 0 });
  });
  it('B: start-or-done fails maintenance (0, 2) → (1, 2), from an egg', () => {
    const c = onRun('tutorial', 'i == 0 || i == n')!;
    expect(toNum(c.state)).toEqual({ n: 2, i: 0 });
    expect(toNum(c.next!)).toEqual({ n: 2, i: 1 });
    const s = smallest('tutorial', 'i == 0 || i == n');
    expect(s.initialization).toBeUndefined();
    expect(s.exit).toBeUndefined();
  });
  it('C: i >= 0 fails exit at i = 1, n = 0', () => {
    const c = smallest('tutorial', 'i >= 0');
    expect(c.initialization).toBeUndefined();
    expect(c.maintenance).toBeUndefined();
    expect(toNum(c.exit!.state)).toEqual({ n: 0, i: 1 });
  });
  it('D passes nearby', () => {
    expect(smallest('tutorial', '0 <= i <= n')).toEqual({});
    expect(onRun('tutorial', '0 <= i <= n')).toBeUndefined();
  });
});

describe('failures on a run are picked first', () => {
  it('sum to n: a bound that is too tight fails on the run, not on the smaller tile off it', () => {
    const c = onRun('sum-to-n', 'i <= 3')!;
    expect(toNum(c.state)).toEqual({ n: 4, i: 3, s: 6 });
    expect(toNum(smallest('sum-to-n', 'i <= 3').maintenance!.state)).toEqual({ n: 4, i: 3, s: 0 });
  });
  it('a failure on a run far from the origin is still found', () => {
    const c = onRun('sum-to-n', 'i <= 20', { n: 30 })!;
    expect(toNum(c.state)).toEqual({ n: 30, i: 20, s: 210 });
  });
  it('tag along: true of real frogs but not kept by a hop, so no run fails', () => {
    expect(onRun('tag-along', 'i <= n && s >= 0')).toBeUndefined();
    const c = smallest('tag-along', 'i <= n && s >= 0').maintenance!;
    expect(toNum(c.state)).toEqual({ n: 4, i: -2, s: 0 });
    expect(c.broken).toBe('s >= 0');
  });
});

describe('levels', () => {
  it('parity: the smallest tile is (-1, 1)', () => {
    expect(toNum(smallest('parity', '(x + y) % 2 == 0').exit!.state)).toEqual({ x: -1, y: 1 });
  });
  it('even out: names the broken conjunct', () => {
    const c = smallest('even-out', 'x >= 0 && x == x');
    expect(c.maintenance).toBeDefined();
    expect(c.maintenance!.broken).toBe('x >= 0');
  });
  it('biggest so far: the goal copied fails initialization on the array in view', () => {
    const c = smallest('biggest-so-far', 'forall 0 <= k < n: A[k] <= m');
    expect(c.initialization).toBeDefined();
    expect(toNum(c.initialization!.state)).toMatchObject({ i: 1, m: 3 });
    expect(smallest('biggest-so-far', 'forall 0 <= k < i: A[k] <= m')).toEqual({});
  });
});

describe('check', () => {
  afterAll(shutdownZ3);
  const check = async (id: string, text: string) => {
    const lvl = level(id);
    return (await checkFormula(await nodeZ3(), lvl, formula(lvl, text), startInputs(lvl))).verdicts;
  };
  it('a solution is proved', async () => {
    const v = await check('sum-to-n', '2 * s == i * (i + 1) && i <= n');
    expect(Object.values(v).map((r) => r.status)).toEqual(['pass', 'pass', 'pass']);
  });
  it('a failure only Z3 finds is far', async () => {
    const v = await check('sum-to-n', '2 * s == i * (i + 1)');
    expect(v.maintenance!.status).toBe('pass');
    const t = v.exit!;
    expect(t.status === 'fail' && t.cex.far).toBe(true);
  });
  it('a failure on a run is the one Check shows', async () => {
    const m = (await check('sum-to-n', 'i <= 3')).maintenance!;
    expect(m.status === 'fail' && toNum(m.cex.state)).toEqual({ n: 4, i: 3, s: 6 });
  });
});
