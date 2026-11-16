import type { Arith, Bool, Context, FuncDecl, Model } from 'z3-solver';
import { hasQuantifier, mk, type Expr, type State } from '../lang/ast';
import { holds, withinBudget } from '../lang/eval';
import { unroll } from '../lang/unroll';
import { MAX_LEN } from '../levels/inputs';
import type { CompiledLevel } from '../levels/level';
import { NEAR } from './nearby';
import { whileSolving } from './z3-guard';

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
        // SMT-LIB's div/mod are Euclidean: for a positive divisor, our floor division and mod
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
  timeout: number;
  verify?: (s: State) => boolean;
}

const BOUNDS = [NEAR, 64, 1024];

function declare(ctx: Ctx, level: CompiledLevel, dims: string[]): { env: Env; readModel: (m: Model<'main'>) => State } {
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
  return { env, readModel };
}

export async function solve(ctx: Ctx, level: CompiledLevel, dims: string[], query: Expr, opts: SolveOptions): Promise<SolveResult> {
  const { env, readModel } = declare(ctx, level, dims);
  const quantified = hasQuantifier(query);
  const arrayLens = Object.values(env.arrays).map((a) => a.len);
  const check = async (form: Expr, logic: string | undefined, bound: (solver: InstanceType<Ctx['Solver']>) => void): Promise<SolveResult> => {
    const solver = logic ? new ctx.Solver(logic) : new ctx.Solver();
    solver.set('timeout', opts.timeout);
    solver.add(toZ3(ctx, form, env) as Bool<'main'>);
    bound(solver);
    const r = await whileSolving(() => solver.check());
    if (r === 'sat') return { kind: 'sat', state: readModel(solver.model()) };
    return { kind: r === 'unsat' ? 'unsat' : 'unknown' };
  };
  for (const b of BOUNDS) {
    const form = quantified ? unroll(query, b) : query;
    if (hasQuantifier(form)) continue;
    const r = await check(form, undefined, (solver) => {
      for (const d of Object.values(env.ints)) solver.add(d.ge(-b), d.le(b));
      for (const a of Object.values(env.arrays)) {
        for (let k = 0; k < Math.min(b, MAX_LEN); k++) {
          const c = a.fn.call(ctx.Int.val(k)) as Arith<'main'>;
          solver.add(c.ge(-b), c.le(b));
        }
      }
    });
    if (r.kind === 'sat' && (!opts.verify || opts.verify(r.state))) return r;
  }
  const passes: ((solver: InstanceType<Ctx['Solver']>) => void)[] = arrayLens.length ? [(solver) => arrayLens.forEach((len) => solver.add(len.le(MAX_LEN))), () => {}] : [() => {}];
  for (const bound of passes) {
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

export async function equivalent(ctx: Ctx, level: CompiledLevel, a: Expr, b: Expr, timeout: number): Promise<boolean> {
  const differ: Expr = { kind: 'binary', op: '!=', left: a, right: b, span: a.span };
  const query = mk.and(level.planeReq, differ);
  const r = await solve(ctx, level, level.names, query, { timeout, verify: (s) => withinBudget(() => holds(query, s)) });
  return r.kind === 'unsat';
}
