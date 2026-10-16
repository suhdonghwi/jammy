// AST shared by the program language and the formula language.
// The formula language is exactly the expression part of the program language.

export interface Span {
  from: number;
  to: number;
}

export type BinOp =
  | '+' | '-' | '*' | '/' | '%'
  | '==' | '!=' | '<' | '<=' | '>' | '>='
  | '&&' | '||';

export type BuiltinFn = 'abs' | 'min' | 'max';

/** A bound in a quantifier's range: strict or not. */
export type RangeOp = '<' | '<=';

export type Expr =
  | { kind: 'num'; value: bigint; span: Span }
  | { kind: 'bool'; value: boolean; span: Span }
  | { kind: 'var'; name: string; span: Span }
  | { kind: 'unary'; op: '-' | '!'; arg: Expr; span: Span }
  | { kind: 'binary'; op: BinOp; left: Expr; right: Expr; span: Span }
  | { kind: 'call'; fn: BuiltinFn; args: Expr[]; span: Span }
  /** `A[index]`: a cell of an array input; outside the array it reads as 0. */
  | { kind: 'index'; array: string; index: Expr; span: Span }
  /**
   * `forall lo <= j <= k < hi: body` (or `exists`): the bound names run over
   * the integers, and `body` is tested wherever the chain of comparisons
   * `lo ops[0] vars[0] ops[1] vars[1] … ops[n] hi` holds.
   */
  | { kind: 'quant'; q: 'forall' | 'exists'; vars: string[]; ops: RangeOp[]; lo: Expr; hi: Expr; body: Expr; span: Span }
  // Internal only (never parsed): produced by symbolic execution of `if`.
  | { kind: 'ite'; cond: Expr; then: Expr; else: Expr; span: Span };

export type Stmt =
  | { kind: 'assign'; name: string; value: Expr; span: Span }
  | { kind: 'if'; cond: Expr; then: Stmt[]; else: Stmt[]; span: Span };

export interface VarDecl {
  name: string;
  init?: Expr;
  span: Span;
}

export interface InputDecl {
  name: string;
  span: Span;
  /** An array input: the name of the (integer) input that is its length. */
  length?: string;
}

export interface Program {
  source: string;
  /** Every input's name, arrays included, in declaration order. */
  inputs: string[];
  inputDecls: InputDecl[];
  /** Array inputs: name → the input that is its length. */
  arrays: Record<string, string>;
  vars: VarDecl[];
  requires: Expr[];
  ensures: Expr[];
  loop: {
    guard: Expr;
    body: Stmt[];
    span: Span;
    /** Span of `while (...)` — highlighted when frogs land. */
    headerSpan: Span;
  };
}

/** A program state: every integer name's value, and every array input's cells. */
export type State = Record<string, bigint | bigint[]>;

export const COMPARISON_OPS: ReadonlySet<BinOp> = new Set(['==', '!=', '<', '<=', '>', '>=']);

export function spanOf(a: { span: Span }, b: { span: Span }): Span {
  return { from: Math.min(a.span.from, b.span.from), to: Math.max(a.span.to, b.span.to) };
}

/** Split a formula at its top-level `&&` into conjuncts. */
export function conjuncts(e: Expr): Expr[] {
  if (e.kind === 'binary' && e.op === '&&') return [...conjuncts(e.left), ...conjuncts(e.right)];
  return [e];
}

/** Names an expression reads: variables and arrays, but not a quantifier's own bound names. */
export function freeVars(e: Expr, out: Set<string> = new Set()): Set<string> {
  switch (e.kind) {
    case 'var': out.add(e.name); break;
    case 'unary': freeVars(e.arg, out); break;
    case 'binary': freeVars(e.left, out); freeVars(e.right, out); break;
    case 'call': e.args.forEach((a) => freeVars(a, out)); break;
    case 'index': out.add(e.array); freeVars(e.index, out); break;
    case 'quant': {
      freeVars(e.lo, out);
      freeVars(e.hi, out);
      const inner = freeVars(e.body);
      for (const v of e.vars) inner.delete(v);
      for (const v of inner) out.add(v);
      break;
    }
    case 'ite': freeVars(e.cond, out); freeVars(e.then, out); freeVars(e.else, out); break;
  }
  return out;
}

/** Does the expression use a quantifier anywhere? */
export function hasQuantifier(e: Expr): boolean {
  switch (e.kind) {
    case 'quant': return true;
    case 'unary': return hasQuantifier(e.arg);
    case 'binary': return hasQuantifier(e.left) || hasQuantifier(e.right);
    case 'call': return e.args.some(hasQuantifier);
    case 'index': return hasQuantifier(e.index);
    case 'ite': return hasQuantifier(e.cond) || hasQuantifier(e.then) || hasQuantifier(e.else);
    default: return false;
  }
}

const NO_SPAN: Span = { from: 0, to: 0 };

export const mk = {
  and(a: Expr, b: Expr): Expr {
    return { kind: 'binary', op: '&&', left: a, right: b, span: NO_SPAN };
  },
  andAll(es: Expr[]): Expr {
    if (es.length === 0) return { kind: 'bool', value: true, span: NO_SPAN };
    return es.reduce((a, b) => mk.and(a, b));
  },
  not(a: Expr): Expr {
    return { kind: 'unary', op: '!', arg: a, span: NO_SPAN };
  },
  ite(cond: Expr, then: Expr, els: Expr): Expr {
    return { kind: 'ite', cond, then, else: els, span: NO_SPAN };
  },
};

/** Substitute variables by expressions (simultaneously). A quantifier's bound names are never substituted. */
export function subst(e: Expr, map: Record<string, Expr>): Expr {
  switch (e.kind) {
    case 'num':
    case 'bool':
      return e;
    case 'var':
      return map[e.name] ?? e;
    case 'unary':
      return { ...e, arg: subst(e.arg, map) };
    case 'binary':
      return { ...e, left: subst(e.left, map), right: subst(e.right, map) };
    case 'call':
      return { ...e, args: e.args.map((a) => subst(a, map)) };
    case 'index':
      return { ...e, index: subst(e.index, map) };
    case 'quant': {
      const inner = { ...map };
      for (const v of e.vars) delete inner[v];
      return { ...e, lo: subst(e.lo, map), hi: subst(e.hi, map), body: subst(e.body, inner) };
    }
    case 'ite':
      return { ...e, cond: subst(e.cond, map), then: subst(e.then, map), else: subst(e.else, map) };
  }
}

/** Pretty-print an expression back to source form (used in captions). */
export function show(e: Expr): string {
  const prec: Record<BinOp, number> = {
    '||': 1, '&&': 2,
    '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3,
    '+': 4, '-': 4, '*': 5, '/': 5, '%': 5,
  };
  const go = (e: Expr, ctx: number): string => {
    switch (e.kind) {
      case 'num': return e.value.toString();
      case 'bool': return String(e.value);
      case 'var': return e.name;
      case 'unary': return e.op + go(e.arg, 6);
      case 'call': return `${e.fn}(${e.args.map((a) => go(a, 0)).join(', ')})`;
      case 'index': return `${e.array}[${go(e.index, 0)}]`;
      case 'quant': {
        const chain = [go(e.lo, 4), ...e.vars.flatMap((v, i) => [e.ops[i], v]), e.ops[e.vars.length], go(e.hi, 4)].join(' ');
        // a quantifier binds like a primary (its body is one comparison), so it needs no parentheses of its own
        return `${e.q} ${chain}: ${go(e.body, 3)}`;
      }
      case 'ite': return `(${go(e.cond, 0)} ? ${go(e.then, 0)} : ${go(e.else, 0)})`;
      case 'binary': {
        const p = prec[e.op];
        const s = `${go(e.left, p)} ${e.op} ${go(e.right, p + 1)}`;
        return p < ctx ? `(${s})` : s;
      }
    }
  };
  return go(e, 0);
}
