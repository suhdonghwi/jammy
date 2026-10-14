import { describe, expect, it } from 'vitest';
import { boxSearch } from '../src/checker/box';
import { tutorialLevel, levels } from '../src/levels/defs';
import { compileFormula, compileLevel } from '../src/levels/level';

const tut = compileLevel(tutorialLevel);
const box = { cx: 0, cy: 0, r: 20, pondR: 20 };
const search = (lvl: ReturnType<typeof compileLevel>, f: string, b = box) => {
  const r = compileFormula(lvl, f);
  if (!r.ok) throw r.error;
  return boxSearch(lvl, r, b);
};
const num = (s: Record<string, bigint>) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Number(v)]));

describe('tutorial counterexamples match the design', () => {
  it('A: i == n fails init at the egg (0, 1)', () => {
    expect(num(search(tut, 'i == n').init!.state)).toEqual({ n: 1, i: 0 });
  });
  it('B: start-or-done fails preservation (0, 2) → (1, 2)', () => {
    const c = search(tut, 'i == 0 || i == n');
    expect(c.init).toBeUndefined();
    expect(num(c.pres!.state)).toEqual({ n: 2, i: 0 });
    expect(num(c.pres!.next!)).toEqual({ n: 2, i: 1 });
    expect(c.exit).toBeUndefined();
  });
  it('C: i >= 0 fails exit at i = 1, n = 0', () => {
    const c = search(tut, 'i >= 0');
    expect(c.init).toBeUndefined();
    expect(c.pres).toBeUndefined();
    expect(num(c.exit!.state)).toEqual({ n: 0, i: 1 });
  });
  it('D passes the box', () => {
    expect(search(tut, '0 <= i <= n')).toEqual({});
  });
});

describe('levels', () => {
  it('parity: hand finds (-1, 1)', () => {
    const lvl = compileLevel(levels.find((l) => l.id === '1-2')!);
    expect(num(search(lvl, '(x + y) % 2 == 0', { ...box, cx: 2, cy: 2 }).exit!.state)).toEqual({ x: -1, y: 1 });
  });
  it('abs: prefers the focused pond and names the broken conjunct', () => {
    const lvl = compileLevel(levels.find((l) => l.id === '3-2')!);
    const c = search(lvl, 'x >= 0 && x == x');
    expect(c.pres).toBeDefined();
    expect(c.pres!.broken).toBe('x >= 0');
  });
});
