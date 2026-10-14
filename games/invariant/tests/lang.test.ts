import { describe, expect, it } from 'vitest';
import { show } from '../src/lang/ast';
import { evaluate, euclidMod, floorDiv, step } from '../src/lang/eval';
import { LangError, parseFormula, parseProgram } from '../src/lang/parser';
import { checkCondition, checkProgram } from '../src/lang/typecheck';

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

describe('types', () => {
  const scope = new Set(['x', 'y']);
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
