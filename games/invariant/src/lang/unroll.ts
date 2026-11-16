import { mk, subst, type Expr, type RangeOp } from './ast';

const MAX_UNROLL = 1200;

export function unroll(e: Expr, b: number): Expr {
  const go = (e: Expr): Expr => {
    switch (e.kind) {
      case 'unary': return { ...e, arg: go(e.arg) };
      case 'binary': return { ...e, left: go(e.left), right: go(e.right) };
      case 'call': return { ...e, args: e.args.map(go) };
      case 'index': return { ...e, index: go(e.index) };
      case 'ite': return { ...e, cond: go(e.cond), then: go(e.then), else: go(e.else) };
      case 'quant': {
        const lo = go(e.lo);
        const hi = go(e.hi);
        const body = go(e.body);
        if ((2 * b + 1) ** e.vars.length > MAX_UNROLL * 2) return { ...e, lo, hi, body };
        const num = (v: number): Expr => ({ kind: 'num', value: BigInt(v), span: e.span });
        const cmp = (op: RangeOp, l: Expr, r: Expr): Expr => ({ kind: 'binary', op, left: l, right: r, span: e.span });
        const instances: Expr[] = [];
        const tuple: number[] = [];
        const emit = () => {
          const map: Record<string, Expr> = {};
          e.vars.forEach((v, i) => (map[v] = num(tuple[i])));
          const inRange = mk.and(cmp(e.ops[0], lo, num(tuple[0])), cmp(e.ops[e.ops.length - 1], num(tuple[tuple.length - 1]), hi));
          const inst = subst(body, map);
          instances.push(e.q === 'forall' ? mk.or(mk.not(inRange), inst) : mk.and(inRange, inst));
        };
        const walk = (k: number, from: number) => {
          if (instances.length > MAX_UNROLL) return;
          if (k === e.vars.length) return emit();
          for (let v = from; v <= b; v++) {
            tuple[k] = v;
            walk(k + 1, e.ops[k + 1] === '<' ? v + 1 : v);
          }
        };
        walk(0, -b);
        if (instances.length > MAX_UNROLL) return { ...e, lo, hi, body };
        if (instances.length === 0) return { kind: 'bool', value: e.q === 'forall', span: e.span };
        return instances.reduce(e.q === 'forall' ? mk.and : mk.or);
      }
      default: return e;
    }
  };
  return go(e);
}
