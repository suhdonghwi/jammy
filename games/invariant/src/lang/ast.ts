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

export type Expr =
  | { kind: 'num'; value: bigint; span: Span }
  | { kind: 'bool'; value: boolean; span: Span }
  | { kind: 'var'; name: string; span: Span }
  | { kind: 'unary'; op: '-' | '!'; arg: Expr; span: Span }
  | { kind: 'binary'; op: BinOp; left: Expr; right: Expr; span: Span }
  | { kind: 'call'; fn: BuiltinFn; args: Expr[]; span: Span }
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

export interface Program {
  source: string;
  inputs: string[];
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

export type State = Record<string, bigint>;

export const COMPARISON_OPS: ReadonlySet<BinOp> = new Set(['==', '!=', '<', '<=', '>', '>=']);

export function spanOf(a: { span: Span }, b: { span: Span }): Span {
  return { from: Math.min(a.span.from, b.span.from), to: Math.max(a.span.to, b.span.to) };
}

/** Split a formula at its top-level `&&` into conjuncts. */
export function conjuncts(e: Expr): Expr[] {
  if (e.kind === 'binary' && e.op === '&&') return [...conjuncts(e.left), ...conjuncts(e.right)];
  return [e];
}

export function freeVars(e: Expr, out: Set<string> = new Set()): Set<string> {
  switch (e.kind) {
    case 'var': out.add(e.name); break;
    case 'unary': freeVars(e.arg, out); break;
    case 'binary': freeVars(e.left, out); freeVars(e.right, out); break;
    case 'call': e.args.forEach((a) => freeVars(a, out)); break;
    case 'ite': freeVars(e.cond, out); freeVars(e.then, out); freeVars(e.else, out); break;
  }
  return out;
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

/** Substitute variables by expressions (simultaneously). */
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
