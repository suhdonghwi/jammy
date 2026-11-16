import { describe, expect, it } from 'vitest';
import { hasQuantifier, show } from '../src/lang/ast';
import { compileFast, evaluate, euclidMod, floorDiv, OverBudget, step } from '../src/lang/eval';
import { LangError, parseFormula, parseProgram } from '../src/lang/parser';
import { checkCondition, checkProgram, type Scope } from '../src/lang/typecheck';
import { unroll } from '../src/lang/unroll';

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
    expect(p.inputs.map((d) => d.name)).toEqual(['n']);
    const s = step(p.loop.body, { n: 10n, i: 2n });
    expect(s.i).toBe(5n);
  });
  it('refuses // in a formula, which would round down twice', () => {
    expect(() => parseFormula('i <= n//2')).toThrow(/Use `\/`/);
    expect(() => parseFormula('i <= n // 2')).toThrow(LangError);
    expect(show(parseFormula('i <= n / 2'))).toBe('i <= n / 2');
  });
  it('still skips // comments in programs', () => {
    const p = parseProgram(`input n; // the input\nvar i = 0; while (i < n) { i++; } ensures i == n;`);
    expect(p.inputs.map((d) => d.name)).toEqual(['n']);
  });
  it('only chains orderings, not == or !=', () => {
    expect(() => parseFormula('x >= 0 == y >= 0')).toThrow(/parentheses/);
    expect(() => parseFormula('a == b == c')).toThrow(LangError);
    expect(() => parseFormula('0 <= i != n')).toThrow(/'!='/);
    expect(show(parseFormula('a == b'))).toBe('a == b');
    expect(show(parseFormula('(x >= 0) == (y >= 0)'))).toBe('(x >= 0) == (y >= 0)');
    expect(show(parseFormula('0 <= i < n'))).toBe('0 <= i && i < n');
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
    expect(checkProgram(p)).toEqual(new Map([['n', 'int'], ['A', 'array'], ['i', 'int']]));
    expect(p.inputs.map((d) => d.length)).toEqual([undefined, 'n']);
    expect(() => checkProgram(parseProgram(`input A[n]; input n; var i = 0; while (i < n) { i++; }`))).toThrow(/before the array/);
  });
});

describe('quantifier ranges', () => {
  const scope: Scope = new Map([
    ['A', 'array'],
    ['n', 'int'],
    ['i', 'int'],
    ['m', 'int'],
  ]);
  const s = { A: [3n, 1n, 4n], n: 3n, i: 2n, m: 5n };
  const fs = { A: [3, 1, 4], n: 3, i: 2, m: 5 };
  const check = (src: string) => checkCondition(parseFormula(src), scope, src, 'an area');
  it('refuses constant ranges too wide to check', () => {
    expect(() => check('forall 0 <= k < 200000: A[k] <= m')).toThrow(/too wide/);
    expect(() => check('forall -5000 <= k <= 5000: A[k] <= m')).toThrow(/too wide/);
    expect(() => check('forall 0 <= k < 1000: A[k] <= m')).not.toThrow();
    expect(() => check('forall 0 <= k < n * 100000: A[k] <= m')).not.toThrow();
  });
  it('stops a wide range at a total budget instead of throwing or hanging', () => {
    const wide = parseFormula('forall 0 <= k < n * 100000: A[k] <= m');
    expect(Number.isNaN(compileFast(wide)(fs))).toBe(true);
    expect(() => evaluate(wide, s)).toThrow(OverBudget);
    const nested = parseFormula('forall 0 <= j < k < n * 100: A[j] <= A[k] + m');
    expect(Number.isNaN(compileFast(nested)(fs))).toBe(true);
    expect(() => evaluate(nested, s)).toThrow(OverBudget);
  });
  it('shares one budget across every quantifier in a formula', () => {
    const one = 'forall 0 <= k < n * 1000: A[k] <= m';
    expect(compileFast(parseFormula(one))(fs)).toBe(true);
    expect(Number.isNaN(compileFast(parseFormula(`${one} && ${one}`))(fs))).toBe(true);
  });
  it('gives the same answers within the budget', () => {
    const f = parseFormula('forall 0 <= j < k < n: A[j] <= A[k] + m');
    expect(compileFast(f)(fs)).toBe(true);
    expect(evaluate(f, s)).toBe(true);
  });
});

describe('unrolling quantifiers', () => {
  it('writes one instance per value within the bound, guarded by the range', () => {
    expect(show(unroll(parseFormula('forall 0 <= k < n: A[k] > 0'), 1))).toBe('(!(0 <= -1 && -1 < n) || A[-1] > 0) && (!(0 <= 0 && 0 < n) || A[0] > 0) && (!(0 <= 1 && 1 < n) || A[1] > 0)');
    expect(show(unroll(parseFormula('i >= 0 && exists 0 <= k < n: A[k] == i'), 0))).toBe('i >= 0 && (0 <= 0 && 0 < n && A[0] == i)');
  });
  it('agrees with the quantifier when the range is within the bound', () => {
    for (const f of ['forall 0 <= j <= k < n: A[j] <= A[k]', 'exists 0 <= j < k < n: A[j] > A[k]']) {
      const e = parseFormula(f);
      const u = unroll(e, 4);
      expect(hasQuantifier(u)).toBe(false);
      for (const A of [[], [1n], [1n, 2n, 2n], [3n, 1n, 4n, 1n]]) {
        const s = { A, n: BigInt(A.length) };
        expect(evaluate(u, s), `${f} on [${A}]`).toBe(evaluate(e, s));
      }
    }
  });
  it('is vacuous when no tuple fits the bound', () => {
    expect(show(unroll(parseFormula('forall 0 <= j < k < n: A[j] <= A[k]'), 0))).toBe('true');
    expect(show(unroll(parseFormula('exists 0 <= j < k < n: A[j] <= A[k]'), 0))).toBe('false');
  });
  it('keeps the quantifier when the unrolling would be too large', () => {
    expect(hasQuantifier(unroll(parseFormula('forall 0 <= k < n: A[k] > 0'), 64))).toBe(false);
    expect(hasQuantifier(unroll(parseFormula('forall 0 <= k < n: A[k] > 0'), 1024))).toBe(true);
    expect(hasQuantifier(unroll(parseFormula('forall 0 <= j < k < n: A[j] <= A[k]'), 64))).toBe(true);
  });
});

describe('types', () => {
  const scope: Scope = new Map([
    ['x', 'int'],
    ['y', 'int'],
  ]);
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
