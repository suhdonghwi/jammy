import type { Expr, Program, Stmt } from './ast';
import { t as messages } from '../i18n/i18n';
import { LangError } from './parser';

// Type checking: every name is an int; conditions must be true/false.

export type Type = 'int' | 'bool';

const ARITH = new Set(['+', '-', '*', '/', '%']);
const REL = new Set(['<', '<=', '>', '>=']);

/** Type-check an expression; every name in `scope` is an int. */
function typeOf(e: Expr, scope: ReadonlySet<string>, src: string): Type {
  const E = messages().langErrors;
  const text = (x: Expr) => src.slice(x.span.from, x.span.to);
  const want = (x: Expr, t: Type, ctx: string): void => {
    const got = typeOf(x, scope, src);
    if (got !== t) {
      throw new LangError(
        t === 'int' ? E.needsNumber(text(x), ctx) : E.needsCondition(text(x), ctx),
        x.span,
      );
    }
  };
  switch (e.kind) {
    case 'num':
      return 'int';
    case 'bool':
      return 'bool';
    case 'var':
      if (!scope.has(e.name)) {
        const names = [...scope].join(', ');
        throw new LangError(E.unknownName(e.name, names), e.span);
      }
      return 'int';
    case 'unary':
      if (e.op === '-') {
        want(e.arg, 'int', "'-'");
        return 'int';
      }
      want(e.arg, 'bool', "'!'");
      return 'bool';
    case 'call': {
      const arity = e.fn === 'abs' ? 1 : 2;
      if (e.args.length !== arity) {
        throw new LangError(E.arity(e.fn, arity), e.span);
      }
      e.args.forEach((a) => want(a, 'int', e.fn));
      return 'int';
    }
    case 'ite':
      want(e.cond, 'bool', E.aCondition);
      want(e.else, typeOf(e.then, scope, src), E.bothBranches);
      return typeOf(e.then, scope, src);
    case 'binary': {
      if (ARITH.has(e.op)) {
        want(e.left, 'int', `'${e.op}'`);
        want(e.right, 'int', `'${e.op}'`);
        if (e.op === '/' || e.op === '%') {
          if (e.right.kind !== 'num' || e.right.value <= 0n) {
            throw new LangError(E.positiveDivisor(e.op), e.right.span);
          }
        }
        return 'int';
      }
      if (REL.has(e.op)) {
        want(e.left, 'int', `'${e.op}'`);
        want(e.right, 'int', `'${e.op}'`);
        return 'bool';
      }
      if (e.op === '==' || e.op === '!=') {
        const l = typeOf(e.left, scope, src);
        want(e.right, l, `'${e.op}'`);
        return 'bool';
      }
      // && ||
      want(e.left, 'bool', `'${e.op}'`);
      want(e.right, 'bool', `'${e.op}'`);
      return 'bool';
    }
  }
}

export function checkCondition(e: Expr, scope: ReadonlySet<string>, src: string, what: string): void {
  const E = messages().langErrors;
  const t = typeOf(e, scope, src);
  if (t !== 'bool') {
    const text = src.slice(e.span.from, e.span.to);
    throw new LangError(E.didYouMean(text, what), e.span);
  }
}

export function checkProgram(p: Program): void {
  const src = p.source;
  const names = new Set<string>();
  const declare = (n: string, span = { from: 0, to: 0 }) => {
    if (names.has(n)) throw new LangError(`'${n}' is declared twice`, span);
    names.add(n);
  };
  p.inputs.forEach((n) => declare(n));
  const scope = new Set<string>(p.inputs);
  for (const v of p.vars) {
    declare(v.name, v.span);
    if (v.init) {
      const t = typeOf(v.init, scope, src);
      if (t !== 'int') throw new LangError(`'${v.name}' must start as a number`, v.init.span);
    }
    scope.add(v.name);
  }
  for (const r of p.requires) checkCondition(r, scope, src, 'requires');
  for (const r of p.ensures) checkCondition(r, scope, src, 'ensures');
  checkCondition(p.loop.guard, scope, src, 'the loop condition');
  const inputs = new Set(p.inputs);
  const stmt = (s: Stmt): void => {
    if (s.kind === 'assign') {
      if (inputs.has(s.name)) throw new LangError(`'${s.name}' is an input and can't be changed`, s.span);
      if (!scope.has(s.name)) throw new LangError(`Unknown variable '${s.name}'`, s.span);
      const t = typeOf(s.value, scope, src);
      if (t !== 'int') throw new LangError(`'${s.name}' must be a number`, s.value.span);
    } else {
      checkCondition(s.cond, scope, src, 'if');
      s.then.forEach(stmt);
      s.else.forEach(stmt);
    }
  };
  p.loop.body.forEach(stmt);
}
