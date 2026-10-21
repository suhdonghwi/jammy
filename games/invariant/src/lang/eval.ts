import { mk, NO_SPAN, subst, type Expr, type Span, type State, type Stmt } from './ast';

export function floorDiv(a: bigint, k: bigint): bigint {
  const q = a / k;
  return a % k !== 0n && a < 0n ? q - 1n : q;
}

export function euclidMod(a: bigint, k: bigint): bigint {
  const r = a % k;
  return r < 0n ? r + k : r;
}

export const EVAL_BUDGET = 4096;

export class OverBudget extends Error {
  constructor() {
    super('over budget');
  }
}

type Value = bigint | boolean;

function cell(arr: bigint[], k: bigint): bigint {
  return k >= 0n && k < BigInt(arr.length) ? arr[Number(k)] : 0n;
}

export function evaluate(e: Expr, s: State): Value {
  return ev(e, s, { left: EVAL_BUDGET });
}

function ev(e: Expr, s: State, meter: { left: number }): Value {
  switch (e.kind) {
    case 'num': return e.value;
    case 'bool': return e.value;
    case 'var': {
      const v = s[e.name];
      if (v === undefined) throw new Error(`unbound variable ${e.name}`);
      return v as bigint;
    }
    case 'index': {
      const arr = s[e.array];
      if (!Array.isArray(arr)) throw new Error(`unbound array ${e.array}`);
      return cell(arr, ev(e.index, s, meter) as bigint);
    }
    case 'quant': {
      const lo = ev(e.lo, s, meter) as bigint;
      const hi = ev(e.hi, s, meter) as bigint;
      const first = e.ops[0] === '<' ? lo + 1n : lo;
      const last = e.ops[e.ops.length - 1] === '<' ? hi - 1n : hi;
      const inner: State = { ...s };
      const go = (k: number, prev: bigint): boolean => {
        if (k === e.vars.length) {
          if (!(e.ops[k] === '<' ? prev < hi : prev <= hi)) return e.q === 'forall';
          return ev(e.body, inner, meter) === true;
        }
        const from = k === 0 ? first : e.ops[k] === '<' ? prev + 1n : prev;
        for (let v = from; v <= last; v++) {
          if (--meter.left < 0) throw new OverBudget();
          inner[e.vars[k]] = v;
          const r = go(k + 1, v);
          if (e.q === 'forall' ? !r : r) return r;
        }
        return e.q === 'forall';
      };
      return go(0, lo);
    }
    case 'unary': {
      const a = ev(e.arg, s, meter);
      return e.op === '-' ? -(a as bigint) : !(a as boolean);
    }
    case 'call': {
      const a = e.args.map((x) => ev(x, s, meter) as bigint);
      if (e.fn === 'abs') return a[0] < 0n ? -a[0] : a[0];
      if (e.fn === 'min') return a[0] < a[1] ? a[0] : a[1];
      return a[0] > a[1] ? a[0] : a[1];
    }
    case 'ite':
      return ev(e.cond, s, meter) ? ev(e.then, s, meter) : ev(e.else, s, meter);
    case 'binary': {
      if (e.op === '&&') return (ev(e.left, s, meter) as boolean) && (ev(e.right, s, meter) as boolean);
      if (e.op === '||') return (ev(e.left, s, meter) as boolean) || (ev(e.right, s, meter) as boolean);
      const l = ev(e.left, s, meter);
      const r = ev(e.right, s, meter);
      switch (e.op) {
        case '+': return (l as bigint) + (r as bigint);
        case '-': return (l as bigint) - (r as bigint);
        case '*': return (l as bigint) * (r as bigint);
        case '/': return floorDiv(l as bigint, r as bigint);
        case '%': return euclidMod(l as bigint, r as bigint);
        case '==': return l === r;
        case '!=': return l !== r;
        case '<': return l < r;
        case '<=': return l <= r;
        case '>': return l > r;
        case '>=': return l >= r;
      }
    }
  }
}

export function holds(e: Expr, s: State): boolean {
  return evaluate(e, s) === true;
}

export function step(body: Stmt[], s: State): State {
  const out: State = { ...s };
  const run = (stmts: Stmt[]) => {
    for (const st of stmts) {
      if (st.kind === 'assign') out[st.name] = evaluate(st.value, out) as bigint;
      else run(evaluate(st.cond, out) ? st.then : st.else);
    }
  };
  run(body);
  return out;
}

export function trace(body: Stmt[], s: State): Span[] {
  const out: State = { ...s };
  const ran: Span[] = [];
  const run = (stmts: Stmt[]) => {
    for (const st of stmts) {
      ran.push(st.span);
      if (st.kind === 'assign') out[st.name] = evaluate(st.value, out) as bigint;
      else run(evaluate(st.cond, out) ? st.then : st.else);
    }
  };
  run(body);
  return ran;
}

export function symbolicStep(body: Stmt[], vars: string[]): Record<string, Expr> {
  const exec = (stmts: Stmt[], env: Record<string, Expr>): Record<string, Expr> => {
    let cur = { ...env };
    for (const st of stmts) {
      if (st.kind === 'assign') {
        cur = { ...cur, [st.name]: subst(st.value, cur) };
      } else {
        const c = subst(st.cond, cur);
        const t = exec(st.then, cur);
        const f = exec(st.else, cur);
        const merged: Record<string, Expr> = {};
        for (const v of vars) merged[v] = t[v] === f[v] ? t[v] : mk.ite(c, t[v], f[v]);
        cur = merged;
      }
    }
    return cur;
  };
  const init: Record<string, Expr> = {};
  for (const v of vars) init[v] = { kind: 'var', name: v, span: NO_SPAN };
  return exec(body, init);
}

export type FastState = Record<string, number | number[]>;
export type FastFn = (s: FastState) => number | boolean;

const fastCell = (arr: number[], k: number): number => (k >= 0 && k < arr.length ? arr[k] : 0);

export function compileFast(e: Expr): FastFn {
  let tmp = 0;
  const go = (e: Expr): string => {
    switch (e.kind) {
      case 'num': return `(${e.value.toString()})`;
      case 'bool': return String(e.value);
      case 'var': return `s[${JSON.stringify(e.name)}]`;
      case 'index': return `cell(s[${JSON.stringify(e.array)}],${go(e.index)})`;
      case 'quant': {
        const id = tmp++;
        const lo = `lo${id}`;
        const hi = `hi${id}`;
        const all = e.q === 'forall';
        let inner = `if(${all ? '!' : ''}(${go(e.body)}))return ${!all};`;
        for (let k = e.vars.length - 1; k >= 0; k--) {
          const v = `s[${JSON.stringify(e.vars[k])}]`;
          const from = k === 0 ? (e.ops[0] === '<' ? `${lo}+1` : lo) : e.ops[k] === '<' ? `s[${JSON.stringify(e.vars[k - 1])}]+1` : `s[${JSON.stringify(e.vars[k - 1])}]`;
          const to = e.ops[e.ops.length - 1] === '<' ? `${hi}-1` : hi;
          inner = `for(let k=${from};k<=${to};k++){if(--m.left<0)throw over;${v}=k;${inner}}`;
        }
        return `((s)=>{const ${lo}=${go(e.lo)},${hi}=${go(e.hi)};s={...s};${inner}return ${all};})(s)`;
      }
      case 'unary': return `(${e.op}${go(e.arg)})`;
      case 'call':
        if (e.fn === 'abs') return `Math.abs(${go(e.args[0])})`;
        return `Math.${e.fn}(${go(e.args[0])},${go(e.args[1])})`;
      case 'ite': return `(${go(e.cond)}?${go(e.then)}:${go(e.else)})`;
      case 'binary': {
        const l = go(e.left);
        const r = go(e.right);
        switch (e.op) {
          case '/': return `Math.floor(${l}/${r})`;
          case '%': return `((${l}%${r})+${r})%${r}`;
          case '==': return `(${l}===${r})`;
          case '!=': return `(${l}!==${r})`;
          default: return `(${l}${e.op}${r})`;
        }
      }
    }
  };
  const body = go(e);
  if (tmp === 0) {
    const f = new Function('cell', 's', `return ${body};`) as (cell: typeof fastCell, s: FastState) => number | boolean;
    return (s) => f(fastCell, s);
  }
  const f = new Function('cell', 'm', 'over', 's', `return ${body};`) as (cell: typeof fastCell, m: { left: number }, over: OverBudget, s: FastState) => number | boolean;
  const meter = { left: 0 };
  const over = new OverBudget();
  return (s) => {
    meter.left = EVAL_BUDGET;
    try {
      return f(fastCell, meter, over, s);
    } catch (err) {
      if (err === over) return NaN;
      throw err;
    }
  };
}
