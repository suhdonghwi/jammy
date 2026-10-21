import { t as messages } from '../i18n/i18n';
import { freeVars, type Expr, type Program, type Span, type Stmt } from './ast';
import { evaluate } from './eval';
import { LangError } from './parser';

type Type = 'int' | 'bool';

export type Scope = ReadonlyMap<string, 'int' | 'array'>;

export const intScope = (names: Iterable<string>): Scope => new Map([...names].map((n) => [n, 'int' as const]));

const ARITH = new Set(['+', '-', '*', '/', '%']);
const REL = new Set(['<', '<=', '>', '>=']);
const MAX_CONSTANT_RANGE = 1000;

function constantWidth(e: Extract<Expr, { kind: 'quant' }>): bigint | null {
  if (freeVars(e.lo).size > 0 || freeVars(e.hi).size > 0) return null;
  const lo = evaluate(e.lo, {}) as bigint;
  const hi = evaluate(e.hi, {}) as bigint;
  const first = e.ops[0] === '<' ? lo + 1n : lo;
  const last = e.ops[e.ops.length - 1] === '<' ? hi - 1n : hi;
  return last - first + 1n;
}

function typeOf(e: Expr, scope: Scope, src: string): Type {
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
  const names = () => [...scope.keys()].join(', ');
  switch (e.kind) {
    case 'num':
      return 'int';
    case 'bool':
      return 'bool';
    case 'var': {
      const kind = scope.get(e.name);
      if (!kind) throw new LangError(E.unknownName(e.name, names()), e.span);
      if (kind === 'array') throw new LangError(E.isArray(e.name), e.span);
      return 'int';
    }
    case 'index': {
      const kind = scope.get(e.array);
      if (!kind) throw new LangError(E.unknownName(e.array, names()), e.span);
      if (kind !== 'array') throw new LangError(E.notArray(e.array), e.span);
      want(e.index, 'int', E.anIndex);
      return 'int';
    }
    case 'quant': {
      const inner = new Map(scope);
      for (const v of e.vars) {
        if (inner.has(v)) throw new LangError(E.nameTaken(v), e.span);
        inner.set(v, 'int');
      }
      want(e.lo, 'int', E.aBound);
      want(e.hi, 'int', E.aBound);
      const width = constantWidth(e);
      if (width !== null && width > BigInt(MAX_CONSTANT_RANGE)) {
        throw new LangError(E.rangeTooWide(MAX_CONSTANT_RANGE), { from: e.lo.span.from, to: e.hi.span.to });
      }
      const got = typeOf(e.body, inner, src);
      if (got !== 'bool') throw new LangError(E.needsCondition(text(e.body), e.q), e.body.span);
      return 'bool';
    }
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
      want(e.left, 'bool', `'${e.op}'`);
      want(e.right, 'bool', `'${e.op}'`);
      return 'bool';
    }
  }
}

export function checkCondition(e: Expr, scope: Scope, src: string, what: string): void {
  const E = messages().langErrors;
  const t = typeOf(e, scope, src);
  if (t !== 'bool') {
    const text = src.slice(e.span.from, e.span.to);
    throw new LangError(E.didYouMean(text, what), e.span);
  }
}

export function programScope(p: Program): Scope {
  const scope = new Map<string, 'int' | 'array'>();
  for (const d of p.inputDecls) scope.set(d.name, d.length ? 'array' : 'int');
  for (const v of p.vars) scope.set(v.name, 'int');
  return scope;
}

export function checkProgram(p: Program): void {
  const src = p.source;
  const names = new Set<string>();
  const declare = (n: string, span: Span) => {
    if (names.has(n)) throw new LangError(`'${n}' is declared twice`, span);
    names.add(n);
  };
  const scope = new Map<string, 'int' | 'array'>();
  for (const d of p.inputDecls) {
    declare(d.name, d.span);
    if (d.length) {
      if (scope.get(d.length) !== 'int') throw new LangError(`Declare the length '${d.length}' as an input before the array '${d.name}'`, d.span);
      if (p.inputDecls.some((o) => o !== d && o.length === d.length)) throw new LangError(`'${d.length}' is already the length of another array`, d.span);
    }
    scope.set(d.name, d.length ? 'array' : 'int');
  }
  for (const v of p.vars) {
    declare(v.name, v.span);
    if (v.init) {
      const t = typeOf(v.init, scope, src);
      if (t !== 'int') throw new LangError(`'${v.name}' must start as a number`, v.init.span);
    }
    scope.set(v.name, 'int');
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
