import type { Arith, Bool, Context, Model } from 'z3-solver';
import { subst, type Expr, type State } from '../lang/ast';
import { hop, startState, type CompiledLevel, type Rule } from '../levels/level';
import { brokenConjunct } from './box';
import type { Counterexample } from './types';

type Ctx = Context<'main'>;
type Z = Arith<'main'> | Bool<'main'>;

function toZ3(ctx: Ctx, e: Expr, env: Record<string, Arith<'main'>>): Z {
  const A = (x: Expr) => toZ3(ctx, x, env) as Arith<'main'>;
  const B = (x: Expr) => toZ3(ctx, x, env) as Bool<'main'>;
  switch (e.kind) {
    case 'num': return ctx.Int.val(e.value);
    case 'bool': return ctx.Bool.val(e.value);
    case 'var': return env[e.name];
    case 'unary': return e.op === '-' ? A(e.arg).neg() : ctx.Not(B(e.arg));
    case 'call': {
      const a = A(e.args[0]);
      if (e.fn === 'abs') return ctx.If(a.ge(0), a, a.neg()) as Arith<'main'>;
      const b = A(e.args[1]);
      return (e.fn === 'min' ? ctx.If(a.le(b), a, b) : ctx.If(a.ge(b), a, b)) as Arith<'main'>;
    }
    case 'ite': return ctx.If(B(e.cond), toZ3(ctx, e.then, env) as never, toZ3(ctx, e.else, env) as never) as Z;
    case 'binary': {
      switch (e.op) {
        case '&&': return ctx.And(B(e.left), B(e.right));
        case '||': return ctx.Or(B(e.left), B(e.right));
        case '+': return A(e.left).add(A(e.right));
        case '-': return A(e.left).sub(A(e.right));
        case '*': return A(e.left).mul(A(e.right));
        // SMT-LIB div/mod: Euclidean, which for a positive divisor is our floor/mod.
        case '/': return A(e.left).div(A(e.right));
        case '%': return A(e.left).mod(A(e.right));
        case '<': return A(e.left).lt(A(e.right));
        case '<=': return A(e.left).le(A(e.right));
        case '>': return A(e.left).gt(A(e.right));
        case '>=': return A(e.left).ge(A(e.right));
        case '==':
        case '!=': {
          const l = toZ3(ctx, e.left, env);
          const r = toZ3(ctx, e.right, env);
          const eq = (l as Arith<'main'>).eq(r as never);
          return e.op === '==' ? eq : ctx.Not(eq);
        }
      }
    }
  }
}

type SolveResult = { kind: 'sat'; state: State } | { kind: 'unsat' } | { kind: 'unknown' };

interface SolveOptions {
  /** Per-query timeout in ms. */
  timeout: number;
  /** Try bounded queries first so counterexamples are small. */
  bounds?: number[];
}

/**
 * Is there a state (over `dims`) satisfying `query`? Tries growing bounds
 * first so that counterexamples come out small.
 */
export async function solve(ctx: Ctx, dims: string[], query: Expr, opts: SolveOptions): Promise<SolveResult> {
  const env: Record<string, Arith<'main'>> = {};
  for (const d of dims) env[d] = ctx.Int.const(d);
  const q = toZ3(ctx, query, env) as Bool<'main'>;
  const readModel = (m: Model<'main'>): State => {
    const s: State = {};
    for (const d of dims) {
      const v = m.eval(env[d], true);
      s[d] = ctx.isIntVal(v) ? v.value() : 0n;
    }
    return s;
  };
  const bounds = opts.bounds ?? [8, 64, 1024];
  for (const b of [...bounds, Infinity]) {
    for (const logic of b === Infinity ? [undefined, 'QF_NIA'] : [undefined]) {
      const solver = logic ? new ctx.Solver(logic) : new ctx.Solver();
      solver.set('timeout', opts.timeout);
      solver.add(q);
      if (b !== Infinity) for (const d of dims) solver.add(env[d].ge(-b), env[d].le(b));
      const r = await solver.check();
      if (r === 'sat') return { kind: 'sat', state: readModel(solver.model()) };
      if (r === 'unsat' && b === Infinity) return { kind: 'unsat' };
      if (r === 'unsat') break; // no counterexample within this bound; widen
      // unknown: within bounds, widen; unbounded, try the next logic
    }
  }
  return { kind: 'unknown' };
}

const not = (e: Expr): Expr => ({ kind: 'unary', op: '!', arg: e, span: e.span });
const and = (...es: Expr[]): Expr =>
  es.reduce((a, b) => ({ kind: 'binary', op: '&&', left: a, right: b, span: a.span }));

/** The negation of each rule, as a query over the right dims. */
export function ruleQuery(level: CompiledLevel, inv: Expr, rule: Rule): { dims: string[]; query: Expr } {
  if (rule === 'init') {
    return {
      dims: level.freeDims,
      query: and(subst(level.pondReq, level.initExprs), subst(level.eggReq, level.initExprs), not(subst(inv, level.initExprs))),
    };
  }
  if (rule === 'pres') {
    return { dims: level.names, query: and(level.pondReq, inv, level.guard, not(subst(inv, level.next))) };
  }
  return { dims: level.names, query: and(level.pondReq, inv, not(level.guard), not(level.post)) };
}

export function cexFromModel(level: CompiledLevel, inv: Expr, invText: string, rule: Rule, s: State): Counterexample {
  if (rule === 'init') {
    const start = startState(level, s);
    return { rule, state: start, broken: brokenConjunct(inv, invText, start), far: true };
  }
  if (rule === 'pres') {
    const n = hop(level, s);
    return { rule, state: s, next: n, broken: brokenConjunct(inv, invText, n), far: true };
  }
  return { rule, state: s, far: true };
}

/** Is `a` equivalent to `b` on every existing state? */
export async function equivalent(ctx: Ctx, level: CompiledLevel, a: Expr, b: Expr, timeout: number): Promise<boolean> {
  const differ: Expr = { kind: 'binary', op: '!=', left: a, right: b, span: a.span };
  const r = await solve(ctx, level.names, and(level.pondReq, differ), { timeout, bounds: [] });
  return r.kind === 'unsat';
}

