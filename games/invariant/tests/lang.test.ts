import { describe, expect, it } from 'vitest';
import { show } from '../src/lang/ast';
import { compileFast, evaluate, euclidMod, floorDiv, step } from '../src/lang/eval';
import { LangError, parseFormula, parseProgram } from '../src/lang/parser';
import { checkCondition, checkProgram, intScope, type Scope } from '../src/lang/typecheck';

describe('parser', () => {
  it('desugars chained comparisons', () => {
    expect(show(parseFormula('0 <= i <= n'))).toBe('0 <= i && i <= n');
  });
  it('respects precedence', () => {
    expect(show(parseFormula('x + y % 2 == 0 || !b && c'))).toBe('x + y % 2 == 0 || !b && c');
    expect(show(parseFormula('(x + y) % 2'))).toBe('(x + y) % 2');
  });
  it('reports positions', () => {
    try {
      parseFormula('x >= ');
      throw new Error('should fail');
    } catch (e) {
      expect(e).toBeInstanceOf(LangError);
    }
  });
  it('parses programs with sugar', () => {
    const p = parseProgram(`input n; var i = 0; while (i < n) { i++; if (i > 2) { i += 2; } else i -= 0; } ensures i >= n;`);
    checkProgram(p);
    expect(p.inputs).toEqual(['n']);
    const s = step(p.loop.body, { n: 10n, i: 2n });
    expect(s.i).toBe(5n);
  });
  it('forbids assigning inputs', () => {
    const p = parseProgram(`input n; var i = 0; while (i < n) { n = n - 1; }`);
    expect(() => checkProgram(p)).toThrow(/input/);
  });
});

describe('arrays and quantifiers', () => {
  const scope: Scope = new Map([
    ['A', 'array'],
    ['n', 'int'],
    ['i', 'int'],
  ]);
  const s = { A: [3n, 1n, 4n], n: 3n, i: 2n };
  it('parses a range chain into bound names', () => {
    expect(show(parseFormula('forall 0 <= j <= k < n: A[j] <= A[k]'))).toBe('forall 0 <= j <= k < n: A[j] <= A[k]');
    expect(show(parseFormula('forall 0 <= k < i: A[k] <= 4 && i <= n'))).toBe('forall 0 <= k < i: A[k] <= 4 && i <= n');
  });
  it('reads cells, 0 outside the array', () => {
    expect(evaluate(parseFormula('A[1] + A[7] + A[-1]'), s)).toBe(1n);
    expect(compileFast(parseFormula('A[2] + A[3]'))({ A: [3, 1, 4], n: 3, i: 2 })).toBe(4);
  });
  it('evaluates forall and exists the same way exactly and fast', () => {
    for (const f of ['forall 0 <= k < i: A[k] <= 3', 'forall 0 <= k < n: A[k] <= 3', 'exists 0 <= k < n: A[k] == 4', 'exists 0 <= k < i: A[k] == 4', 'forall 0 <= j <= k < n: A[j] <= A[k]', 'forall 0 <= j < k < 2: A[j] >= A[k]']) {
      const e = parseFormula(f);
      checkCondition(e, scope, f, 'an area');
      expect(compileFast(e)({ A: [3, 1, 4], n: 3, i: 2 }), f).toBe(evaluate(e, s));
    }
    expect(evaluate(parseFormula('forall 0 <= k < i: A[k] <= 3'), s)).toBe(true);
    expect(evaluate(parseFormula('forall 0 <= k < n: A[k] <= 3'), s)).toBe(false);
    expect(evaluate(parseFormula('exists 0 <= k < i: A[k] == 4'), s)).toBe(false);
    expect(evaluate(parseFormula('forall 0 <= j < k < 2: A[j] >= A[k]'), s)).toBe(true);
  });
  it('type-checks arrays', () => {
    const bad = (src: string, re: RegExp) => expect(() => checkCondition(parseFormula(src), scope, src, 'an area')).toThrow(re);
    bad('A > 0', /is an array/);
    bad('n[0] > 0', /not an array/);
    bad('forall 0 <= i < n: A[i] > 0', /already a name/);
    bad('forall k: A[k] > 0', /needs a range/);
  });
  it('declares array inputs with a length declared first', () => {
    const p = parseProgram(`input n; input A[n]; var i = 0; while (i < n) { i = i + 1; } ensures i == n;`);
    checkProgram(p);
    expect(p.arrays).toEqual({ A: 'n' });
    expect(() => checkProgram(parseProgram(`input A[n]; input n; var i = 0; while (i < n) { i++; }`))).toThrow(/before the array/);
  });
});

describe('types', () => {
  const scope = intScope(['x', 'y']);
  it('explains number-vs-condition', () => {
    const src = 'x + y';
    expect(() => checkCondition(parseFormula(src), scope, src, 'an area')).toThrow(/Did you mean `x \+ y == 0`/);
  });
  it('only divides by positive literals', () => {
    const src = 'x % y == 0';
    expect(() => checkCondition(parseFormula(src), scope, src, 'an area')).toThrow(/positive number/);
  });
  it('rejects unknown names', () => {
    const src = 'z > 0';
    expect(() => checkCondition(parseFormula(src), scope, src, 'an area')).toThrow(/Unknown name 'z'/);
  });
});

describe('integer semantics', () => {
  it('uses Euclidean mod and floor division', () => {
    expect(euclidMod(-3n, 2n)).toBe(1n);
    expect(floorDiv(-3n, 2n)).toBe(-2n);
    for (let a = -10n; a <= 10n; a++) expect(3n * floorDiv(a, 3n) + euclidMod(a, 3n)).toBe(a);
    expect(evaluate(parseFormula('(-1 + 0) % 2 == 1'), {})).toBe(true);
  });
});
