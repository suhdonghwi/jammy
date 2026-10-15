import type { Arith, Bool, Context, FuncDecl, Model } from 'z3-solver';
import { hasQuantifier, subst, type Expr, type State } from '../lang/ast';
import { holds } from '../lang/eval';
import { hop, MAX_LEN, startState, type CompiledLevel, type Rule } from '../levels/level';
import { brokenConjunct } from './box';
import type { Counterexample } from './types';

// Rules and formulas as Z3 queries: proving rules, finding counterexamples
// anywhere, and checking two formulas are equivalent. An array input is an
// uninterpreted function from index to value, read as 0 outside 0..length-1;
// `forall` and `exists` are Z3's own quantifiers.

type Ctx = Context<'main'>;
type Z = Arith<'main'> | Bool<'main'>;

interface Env {
  ints: Record<string, Arith<'main'>>;
  arrays: Record<string, { fn: FuncDecl<'main'>; len: Arith<'main'> }>;
}

let fresh = 0;

function toZ3(ctx: Ctx, e: Expr, env: Env): Z {
  const A = (x: Expr) => toZ3(ctx, x, env) as Arith<'main'>;
  const B = (x: Expr) => toZ3(ctx, x, env) as Bool<'main'>;
  switch (e.kind) {
    case 'num': return ctx.Int.val(e.value);
    case 'bool': return ctx.Bool.val(e.value);
    case 'var': return env.ints[e.name];
    case 'index': {
      const { fn, len } = env.arrays[e.array];
      const k = A(e.index);
      return ctx.If(ctx.And(k.ge(0), k.lt(len)), fn.call(k) as Arith<'main'>, ctx.Int.val(0)) as Arith<'main'>;
    }
    case 'quant': {
      const inner: Env = { ...env, ints: { ...env.ints } };
      const vars = e.vars.map((v) => (inner.ints[v] = ctx.Int.const(`${v}!${fresh++}`)));
      const lo = toZ3(ctx, e.lo, env) as Arith<'main'>;
      const hi = toZ3(ctx, e.hi, env) as Arith<'main'>;
      const chain = [lo, ...vars, hi];
      const links = e.ops.map((op, i) => (op === '<' ? chain[i].lt(chain[i + 1]) : chain[i].le(chain[i + 1])));
      const range = ctx.And(...links);
      const body = toZ3(ctx, e.body, inner) as Bool<'main'>;
      return e.q === 'forall'
        ? ctx.ForAll(vars as [Arith<'main'>, ...Arith<'main'>[]], ctx.Implies(range, body))
        : ctx.Exists(vars as [Arith<'main'>, ...Arith<'main'>[]], ctx.And(range, body));
    }
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

/** The most instances a quantifier is unrolled into for a bounded search. */
const MAX_UNROLL = 1200;

/**
 * Quantifiers over the integers -b..b, written out as a conjunction (or
 * disjunction) of instances, so a bounded search is a quantifier-free query.
 * Beyond MAX_UNROLL instances the quantifier is kept. A model found this way
 * is checked exactly before it is trusted (a bound name outside -b..b is not
 * tested).
 */
function unroll(e: Expr, b: number): Expr {
  const go = (e: Expr): Expr => {
    switch (e.kind) {
      case 'unary': return { ...e, arg: go(e.arg) };
      case 'binary': return { ...e, left: go(e.left), right: go(e.right) };
      case 'call': return { ...e, args: e.args.map(go) };
      case 'index': return { ...e, index: go(e.index) };
      case 'ite': return { ...e, cond: go(e.cond), then: go(e.then), else: go(e.else) };
      case 'quant': {
        const width = 2 * b + 1;
        if (width ** e.vars.length > MAX_UNROLL * 2) return { ...e, lo: go(e.lo), hi: go(e.hi), body: go(e.body) };
        const lo = go(e.lo);
        const hi = go(e.hi);
        const body = go(e.body);
        const span = e.span;
        const num = (v: number): Expr => ({ kind: 'num', value: BigInt(v), span });
        const cmp = (op: '<' | '<=', l: Expr, r: Expr): Expr => ({ kind: 'binary', op, left: l, right: r, span });
        const instances: Expr[] = [];
        const tuple: number[] = [];
        const emit = () => {
          const map: Record<string, Expr> = {};
          e.vars.forEach((v, i) => (map[v] = num(tuple[i])));
          const range: Expr[] = [cmp(e.ops[0], lo, num(tuple[0])), cmp(e.ops[e.ops.length - 1], num(tuple[tuple.length - 1]), hi)];
          const inRange = range.reduce((a, c) => ({ kind: 'binary', op: '&&', left: a, right: c, span }));
          const inst = subst(body, map);
          instances.push(
            e.q === 'forall'
              ? { kind: 'binary', op: '||', left: { kind: 'unary', op: '!', arg: inRange, span }, right: inst, span }
              : { kind: 'binary', op: '&&', left: inRange, right: inst, span },
          );
        };
        const walk = (k: number, from: number) => {
          if (instances.length > MAX_UNROLL) return;
          if (k === e.vars.length) return emit();
          for (let v = from; v <= b; v++) {
            tuple[k] = v;
            // the links between bound names are between constants here, so they prune
            walk(k + 1, e.ops[k + 1] === '<' ? v + 1 : v);
          }
        };
        walk(0, -b);
        if (instances.length > MAX_UNROLL) return { ...e, lo, hi, body };
        const join = e.q === 'forall' ? '&&' : '||';
        if (instances.length === 0) return { kind: 'bool', value: e.q === 'forall', span };
        return instances.reduce((a, c) => ({ kind: 'binary', op: join, left: a, right: c, span }));
      }
      default: return e;
    }
  };
  return go(e);
}

type SolveResult = { kind: 'sat'; state: State } | { kind: 'unsat' } | { kind: 'unknown' };

interface SolveOptions {
  /** Per-query timeout in ms. */
  timeout: number;
  /** Try bounded queries first so counterexamples are small. */
  bounds?: number[];
  /** Does this state really satisfy the query? A model from an unrolled query is only trusted if it does. */
  verify?: (s: State) => boolean;
}

/**
 * Is there a state (over `dims`) satisfying `query`? Tries growing bounds
 * first so that counterexamples come out small (and arrays short).
 */
export async function solve(ctx: Ctx, level: CompiledLevel, dims: string[], query: Expr, opts: SolveOptions): Promise<SolveResult> {
  const env: Env = { ints: {}, arrays: {} };
  for (const d of dims) {
    if (level.arrays[d]) continue;
    env.ints[d] = ctx.Int.const(d);
  }
  for (const d of dims) {
    const len = level.arrays[d];
    if (!len) continue;
    if (!env.ints[len]) env.ints[len] = ctx.Int.const(len);
    env.arrays[d] = { fn: ctx.Function.declare(d, ctx.Int.sort(), ctx.Int.sort()), len: env.ints[len] };
  }
  const readModel = (m: Model<'main'>): State => {
    const s: State = {};
    const int = (v: Arith<'main'>): bigint => {
      const r = m.eval(v, true);
      return ctx.isIntVal(r) ? r.value() : 0n;
    };
    for (const d of dims) if (env.ints[d]) s[d] = int(env.ints[d]);
    for (const d of dims) {
      const a = env.arrays[d];
      if (!a) continue;
      const n = Number(int(a.len));
      s[d] = Array.from({ length: Math.max(0, Math.min(n, MAX_LEN)) }, (_, k) => int(a.fn.call(ctx.Int.val(k)) as Arith<'main'>));
    }
    return s;
  };
  const quantified = hasQuantifier(query);
  const arrayLens = Object.values(env.arrays).map((a) => a.len);
  const check = async (form: Expr, logic: string | undefined, bound: (solver: InstanceType<Ctx['Solver']>) => void): Promise<SolveResult> => {
    const solver = logic ? new ctx.Solver(logic) : new ctx.Solver();
    solver.set('timeout', opts.timeout);
    solver.add(toZ3(ctx, form, env) as Bool<'main'>);
    bound(solver);
    const r = await solver.check();
    if (r === 'sat') return { kind: 'sat', state: readModel(solver.model()) };
    return { kind: r === 'unsat' ? 'unsat' : 'unknown' };
  };
  const bounds = opts.bounds ?? [8, 64, 1024];
  for (const b of bounds) {
    // a bounded search is quantifier-free: the quantifiers are unrolled, and a bound too wide to unroll is skipped
    const form = quantified ? unroll(query, b) : query;
    if (hasQuantifier(form)) continue;
    const r = await check(form, undefined, (solver) => {
      for (const d of Object.values(env.ints)) solver.add(d.ge(-b), d.le(b));
      // the cells in view are small too
      for (const a of Object.values(env.arrays)) {
        for (let k = 0; k < Math.min(b, MAX_LEN); k++) {
          const c = a.fn.call(ctx.Int.val(k)) as Arith<'main'>;
          solver.add(c.ge(-b), c.le(b));
        }
      }
    });
    // a model of an unrolled query is only trusted if it holds up exactly; otherwise widen
    if (r.kind === 'sat' && (!opts.verify || opts.verify(r.state))) return r;
  }
  // unbounded: first what the inputs card can show (arrays up to MAX_LEN), then arrays of any length
  const passes: ((solver: InstanceType<Ctx['Solver']>) => void)[] = arrayLens.length ? [(solver) => arrayLens.forEach((len) => solver.add(len.le(MAX_LEN))), () => {}] : [() => {}];
  for (const bound of passes) {
    // QF_NIA is only right without quantifiers and arrays
    const logics = !quantified && arrayLens.length === 0 ? [undefined, 'QF_NIA'] : [undefined];
    let r: SolveResult = { kind: 'unknown' };
    for (const logic of logics) {
      r = await check(query, logic, bound);
      if (r.kind !== 'unknown') break;
    }
    if (r.kind !== 'unsat') return r;
  }
  return { kind: 'unsat' };
}

const not = (e: Expr): Expr => ({ kind: 'unary', op: '!', arg: e, span: e.span });
const and = (...es: Expr[]): Expr =>
  es.reduce((a, b) => ({ kind: 'binary', op: '&&', left: a, right: b, span: a.span }));

/** The negation of each rule, as a query over the right dims. */
export function ruleQuery(level: CompiledLevel, inv: Expr, rule: Rule): { dims: string[]; query: Expr } {
  if (rule === 'initialization') {
    return {
      dims: level.freeDims,
      query: and(subst(level.planeReq, level.initExprs), subst(level.eggReq, level.initExprs), not(subst(inv, level.initExprs))),
    };
  }
  if (rule === 'maintenance') {
    return { dims: level.names, query: and(level.planeReq, inv, level.guard, not(subst(inv, level.next))) };
  }
  return { dims: level.names, query: and(level.planeReq, inv, not(level.guard), not(level.post)) };
}

/** Does this state break the rule, exactly? (A model of an unrolled query is checked with this.) */
export function breaksRule(level: CompiledLevel, inv: Expr, rule: Rule, s: State): boolean {
  if (rule === 'initialization') {
    const start = startState(level, s);
    return holds(level.planeReq, start) && holds(level.eggReq, start) && !holds(inv, start);
  }
  if (!holds(level.planeReq, s) || !holds(inv, s)) return false;
  if (rule === 'maintenance') return holds(level.guard, s) && !holds(inv, hop(level, s));
  return !holds(level.guard, s) && !holds(level.post, s);
}

export function cexFromModel(level: CompiledLevel, inv: Expr, invText: string, rule: Rule, s: State): Counterexample {
  if (rule === 'initialization') {
    const start = startState(level, s);
    return { rule, state: start, broken: brokenConjunct(inv, invText, start), far: true };
  }
  if (rule === 'maintenance') {
    const n = hop(level, s);
    return { rule, state: s, next: n, broken: brokenConjunct(inv, invText, n), far: true };
  }
  return { rule, state: s, far: true };
}

/** Is `a` equivalent to `b` on every existing state? */
export async function equivalent(ctx: Ctx, level: CompiledLevel, a: Expr, b: Expr, timeout: number): Promise<boolean> {
  return (await sameArea(ctx, level, a, b, timeout)) === true;
}

/** Do `a` and `b` describe the same area on every existing state? `undefined` when the solver can't tell. */
export async function sameArea(ctx: Ctx, level: CompiledLevel, a: Expr, b: Expr, timeout: number): Promise<boolean | undefined> {
  const differ: Expr = { kind: 'binary', op: '!=', left: a, right: b, span: a.span };
  const r = await solve(ctx, level, level.names, and(level.planeReq, differ), { timeout, bounds: [] });
  return r.kind === 'unsat' ? true : r.kind === 'sat' ? false : undefined;
}
