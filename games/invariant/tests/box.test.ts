import { describe, expect, it } from 'vitest';
import { boxSearch } from '../src/checker/box';
import { tutorialLevel, levels } from '../src/levels/catalog';
import { compileFormula, compileLevel, startInputs, toNum } from '../src/levels/level';

const tut = compileLevel(tutorialLevel);
const box = { cx: 0, cy: 0, r: 20, planeR: 20 };
const search = (lvl: ReturnType<typeof compileLevel>, f: string, b = box) => {
  const r = compileFormula(lvl, f);
  if (!r.ok) throw r.error;
  return boxSearch(lvl, r, { ...b, inputs: startInputs(lvl) });
};

describe('tutorial counterexamples match the design', () => {
  it('A: i == n fails initialization at the egg (0, 1)', () => {
    expect(toNum(search(tut, 'i == n').initialization!.state)).toEqual({ n: 1, i: 0 });
  });
  it('B: start-or-done fails maintenance (0, 2) → (1, 2)', () => {
    const c = search(tut, 'i == 0 || i == n');
    expect(c.initialization).toBeUndefined();
    expect(toNum(c.maintenance!.state)).toEqual({ n: 2, i: 0 });
    expect(toNum(c.maintenance!.next!)).toEqual({ n: 2, i: 1 });
    expect(c.termination).toBeUndefined();
  });
  it('C: i >= 0 fails termination at i = 1, n = 0', () => {
    const c = search(tut, 'i >= 0');
    expect(c.initialization).toBeUndefined();
    expect(c.maintenance).toBeUndefined();
    expect(toNum(c.termination!.state)).toEqual({ n: 0, i: 1 });
  });
  it('D passes the box', () => {
    expect(search(tut, '0 <= i <= n')).toEqual({});
  });
});

describe('levels', () => {
  it('parity: hand finds (-1, 1)', () => {
    const lvl = compileLevel(levels.find((l) => l.id === 'parity')!);
    expect(toNum(search(lvl, '(x + y) % 2 == 0', { ...box, cx: 2, cy: 2 }).termination!.state)).toEqual({ x: -1, y: 1 });
  });
  it('even out: prefers the focused plane and names the broken conjunct', () => {
    const lvl = compileLevel(levels.find((l) => l.id === 'even-out')!);
    const c = search(lvl, 'x >= 0 && x == x');
    expect(c.maintenance).toBeDefined();
    expect(c.maintenance!.broken).toBe('x >= 0');
  });
  it('biggest so far: the goal copied fails initialization on the array in view', () => {
    const lvl = compileLevel(levels.find((l) => l.id === 'biggest-so-far')!);
    const c = search(lvl, 'forall 0 <= k < n: A[k] <= m');
    expect(c.initialization).toBeDefined();
    expect(toNum(c.initialization!.state)).toMatchObject({ i: 1, m: 3 });
    expect(search(lvl, 'forall 0 <= k < i: A[k] <= m')).toEqual({});
  });
});
