import { mk, NO_SPAN, subst, type Expr, type State, type Stmt } from './ast';

export function floorDiv(a: bigint, k: bigint): bigint {
  const q = a / k;
  return a % k !== 0n && a < 0n ? q - 1n : q;
}

export function euclidMod(a: bigint, k: bigint): bigint {
  const r = a % k;
  return r < 0n ? r + k : r;
}

const MAX_RANGE = 100_000;

type Value = bigint | boolean;

function cell(arr: bigint[], k: bigint): bigint {
  return k >= 0n && k < BigInt(arr.length) ? arr[Number(k)] : 0n;
}

export function evaluate(e: Expr, s: State): Value {
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
      return cell(arr, evaluate(e.index, s) as bigint);
    }
    case 'quant': {
      const lo = evaluate(e.lo, s) as bigint;
      const hi = evaluate(e.hi, s) as bigint;
      const first = e.ops[0] === '<' ? lo + 1n : lo;
      const last = e.ops[e.ops.length - 1] === '<' ? hi - 1n : hi;
      if (last - first > BigInt(MAX_RANGE)) throw new Error(`a range of more than ${MAX_RANGE} values`);
      const inner: State = { ...s };
      const go = (k: number, prev: bigint): boolean => {
        if (k === e.vars.length) {
          if (!(e.ops[k] === '<' ? prev < hi : prev <= hi)) return e.q === 'forall';
          return evaluate(e.body, inner) === true;
        }
        const from = k === 0 ? first : e.ops[k] === '<' ? prev + 1n : prev;
        for (let v = from; v <= last; v++) {
          inner[e.vars[k]] = v;
          const r = go(k + 1, v);
          if (e.q === 'forall' ? !r : r) return r;
        }
        return e.q === 'forall';
      };
      return go(0, lo);
    }
    case 'unary': {
      const a = evaluate(e.arg, s);
      return e.op === '-' ? -(a as bigint) : !(a as boolean);
    }
    case 'call': {
      const a = e.args.map((x) => evaluate(x, s) as bigint);
      if (e.fn === 'abs') return a[0] < 0n ? -a[0] : a[0];
      if (e.fn === 'min') return a[0] < a[1] ? a[0] : a[1];
      return a[0] > a[1] ? a[0] : a[1];
    }
    case 'ite':
      return evaluate(e.cond, s) ? evaluate(e.then, s) : evaluate(e.else, s);
    case 'binary': {
      if (e.op === '&&') return (evaluate(e.left, s) as boolean) && (evaluate(e.right, s) as boolean);
      if (e.op === '||') return (evaluate(e.left, s) as boolean) || (evaluate(e.right, s) as boolean);
      const l = evaluate(e.left, s);
      const r = evaluate(e.right, s);
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
          inner = `for(let k=${from};k<=${to};k++){${v}=k;${inner}}`;
        }
        return `((s)=>{const ${lo}=${go(e.lo)},${hi}=${go(e.hi)};if(${hi}-${lo}>${MAX_RANGE})throw new Error("range");s={...s};${inner}return ${all};})(s)`;
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
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const f = new Function('cell', 's', `return ${go(e)};`) as (cell: typeof fastCell, s: FastState) => number | boolean;
  return (s) => f(fastCell, s);
}
