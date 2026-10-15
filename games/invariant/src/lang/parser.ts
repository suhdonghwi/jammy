import { COMPARISON_OPS, spanOf, type BinOp, type BuiltinFn, type Expr, type Program, type Span, type Stmt, type VarDecl } from './ast';

// Tokenizer and recursive-descent parser for programs and area formulas,
// with friendly errors that point at a span of the source.

export class LangError extends Error {
  constructor(message: string, public span: Span) {
    super(message);
  }
}

type TokKind = 'num' | 'ident' | 'op' | 'eof';
interface Token {
  kind: TokKind;
  text: string;
  span: Span;
}

const OPS = [
  '==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '++', '--',
  '<', '>', '+', '-', '*', '/', '%', '!', '=', '(', ')', '{', '}', ',', ';',
];

const KEYWORDS = new Set(['input', 'var', 'requires', 'ensures', 'while', 'if', 'else', 'true', 'false']);
const BUILTINS: ReadonlySet<string> = new Set<BuiltinFn>(['abs', 'min', 'max']);

export function tokenize(src: string): Token[] {
  const toks: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      const s = i;
      while (i < src.length && /[0-9]/.test(src[i])) i++;
      toks.push({ kind: 'num', text: src.slice(s, i), span: { from: s, to: i } });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const s = i;
      while (i < src.length && /[A-Za-z0-9_]/.test(src[i])) i++;
      toks.push({ kind: 'ident', text: src.slice(s, i), span: { from: s, to: i } });
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) {
      throw new LangError(`Unexpected character '${c}'`, { from: i, to: i + 1 });
    }
    toks.push({ kind: 'op', text: op, span: { from: i, to: i + op.length } });
    i += op.length;
  }
  toks.push({ kind: 'eof', text: '', span: { from: src.length, to: src.length } });
  return toks;
}

class Parser {
  toks: Token[];
  pos = 0;
  constructor(public src: string) {
    this.toks = tokenize(src);
  }

  peek(o = 0): Token {
    return this.toks[Math.min(this.pos + o, this.toks.length - 1)];
  }
  next(): Token {
    return this.toks[this.pos++];
  }
  isOp(text: string, o = 0): boolean {
    const t = this.peek(o);
    return t.kind === 'op' && t.text === text;
  }
  isKw(text: string): boolean {
    const t = this.peek();
    return t.kind === 'ident' && t.text === text;
  }
  expectOp(text: string): Token {
    const t = this.peek();
    if (t.kind === 'op' && t.text === text) return this.next();
    throw new LangError(t.kind === 'eof' ? `Expected '${text}' but the input ended` : `Expected '${text}' but found '${t.text}'`, t.span);
  }
  expectKw(text: string): Token {
    if (this.isKw(text)) return this.next();
    const t = this.peek();
    throw new LangError(`Expected '${text}'`, t.span);
  }
  ident(): Token {
    const t = this.peek();
    if (t.kind !== 'ident' || KEYWORDS.has(t.text)) {
      throw new LangError(t.kind === 'eof' ? 'Expected a name but the input ended' : `Expected a name but found '${t.text}'`, t.span);
    }
    return this.next();
  }

  // ---- expressions ----
  expr(): Expr {
    return this.or();
  }
  or(): Expr {
    let l = this.and();
    while (this.isOp('||')) {
      this.next();
      const r = this.and();
      l = { kind: 'binary', op: '||', left: l, right: r, span: spanOf(l, r) };
    }
    return l;
  }
  and(): Expr {
    let l = this.cmp();
    while (this.isOp('&&')) {
      this.next();
      const r = this.cmp();
      l = { kind: 'binary', op: '&&', left: l, right: r, span: spanOf(l, r) };
    }
    return l;
  }
  // Chained comparisons: `0 <= i <= n` means `0 <= i && i <= n`.
  cmp(): Expr {
    const first = this.add();
    const operands: Expr[] = [first];
    const ops: BinOp[] = [];
    while (this.peek().kind === 'op' && COMPARISON_OPS.has(this.peek().text as BinOp)) {
      ops.push(this.next().text as BinOp);
      operands.push(this.add());
    }
    if (ops.length === 0) return first;
    let result: Expr | null = null;
    for (let k = 0; k < ops.length; k++) {
      const l = operands[k];
      const r = operands[k + 1];
      const c: Expr = { kind: 'binary', op: ops[k], left: l, right: r, span: spanOf(l, r) };
      result = result ? { kind: 'binary', op: '&&', left: result, right: c, span: spanOf(result, c) } : c;
    }
    return result!;
  }
  add(): Expr {
    let l = this.mul();
    while (this.isOp('+') || this.isOp('-')) {
      const op = this.next().text as BinOp;
      const r = this.mul();
      l = { kind: 'binary', op, left: l, right: r, span: spanOf(l, r) };
    }
    return l;
  }
  mul(): Expr {
    let l = this.unary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      const op = this.next().text as BinOp;
      const r = this.unary();
      l = { kind: 'binary', op, left: l, right: r, span: spanOf(l, r) };
    }
    return l;
  }
  unary(): Expr {
    if (this.isOp('-') || this.isOp('!')) {
      const t = this.next();
      const arg = this.unary();
      return { kind: 'unary', op: t.text as '-' | '!', arg, span: { from: t.span.from, to: arg.span.to } };
    }
    return this.primary();
  }
  primary(): Expr {
    const t = this.peek();
    if (t.kind === 'num') {
      this.next();
      return { kind: 'num', value: BigInt(t.text), span: t.span };
    }
    if (t.kind === 'ident') {
      if (t.text === 'true' || t.text === 'false') {
        this.next();
        return { kind: 'bool', value: t.text === 'true', span: t.span };
      }
      if (KEYWORDS.has(t.text)) throw new LangError(`'${t.text}' can't be used here`, t.span);
      this.next();
      if (this.isOp('(')) {
        if (!BUILTINS.has(t.text)) throw new LangError(`Unknown function '${t.text}'. Available: abs, min, max`, t.span);
        this.next();
        const args: Expr[] = [];
        if (!this.isOp(')')) {
          args.push(this.expr());
          while (this.isOp(',')) {
            this.next();
            args.push(this.expr());
          }
        }
        const close = this.expectOp(')');
        return { kind: 'call', fn: t.text as BuiltinFn, args, span: { from: t.span.from, to: close.span.to } };
      }
      return { kind: 'var', name: t.text, span: t.span };
    }
    if (this.isOp('(')) {
      const open = this.next();
      const e = this.expr();
      const close = this.expectOp(')');
      return { ...e, span: { from: open.span.from, to: close.span.to } };
    }
    if (t.kind === 'eof') throw new LangError('The formula ends too early', t.span);
    throw new LangError(`Unexpected '${t.text}'`, t.span);
  }

  // ---- statements ----
  block(): Stmt[] {
    if (this.isOp('{')) {
      this.next();
      const stmts: Stmt[] = [];
      while (!this.isOp('}')) {
        if (this.peek().kind === 'eof') throw new LangError("Missing '}'", this.peek().span);
        stmts.push(this.stmt());
      }
      this.next();
      return stmts;
    }
    return [this.stmt()];
  }
  stmt(): Stmt {
    const start = this.peek().span.from;
    if (this.isKw('if')) {
      this.next();
      this.expectOp('(');
      const cond = this.expr();
      this.expectOp(')');
      const then = this.block();
      let els: Stmt[] = [];
      if (this.isKw('else')) {
        this.next();
        els = this.block();
      }
      return { kind: 'if', cond, then, else: els, span: { from: start, to: this.toks[this.pos - 1].span.to } };
    }
    if (this.isKw('while')) throw new LangError('Only one loop is supported', this.peek().span);
    const name = this.ident();
    const v: Expr = { kind: 'var', name: name.text, span: name.span };
    const one: Expr = { kind: 'num', value: 1n, span: name.span };
    let value: Expr;
    if (this.isOp('++') || this.isOp('--')) {
      const op = this.next().text === '++' ? '+' : '-';
      value = { kind: 'binary', op, left: v, right: one, span: name.span };
    } else if (this.isOp('+=') || this.isOp('-=')) {
      const op = this.next().text === '+=' ? '+' : '-';
      const rhs = this.expr();
      value = { kind: 'binary', op, left: v, right: rhs, span: spanOf(v, rhs) };
    } else {
      this.expectOp('=');
      value = this.expr();
    }
    const semi = this.expectOp(';');
    return { kind: 'assign', name: name.text, value, span: { from: start, to: semi.span.to } };
  }

  program(): Program {
    const inputs: string[] = [];
    const vars: VarDecl[] = [];
    const requires: Expr[] = [];
    const ensures: Expr[] = [];
    let loop: Program['loop'] | null = null;
    while (this.peek().kind !== 'eof') {
      if (this.isKw('input')) {
        this.next();
        inputs.push(this.ident().text);
        while (this.isOp(',')) {
          this.next();
          inputs.push(this.ident().text);
        }
        this.expectOp(';');
      } else if (this.isKw('var')) {
        if (loop) throw new LangError('Declare variables before the loop', this.peek().span);
        this.next();
        do {
          if (this.isOp(',')) this.next();
          const n = this.ident();
          let init: Expr | undefined;
          if (this.isOp('=')) {
            this.next();
            init = this.expr();
          }
          vars.push({ name: n.text, init, span: n.span });
        } while (this.isOp(','));
        this.expectOp(';');
      } else if (this.isKw('requires')) {
        this.next();
        requires.push(this.expr());
        this.expectOp(';');
      } else if (this.isKw('ensures')) {
        this.next();
        ensures.push(this.expr());
        this.expectOp(';');
      } else if (this.isKw('while')) {
        if (loop) throw new LangError('Only one loop is supported', this.peek().span);
        const w = this.next();
        this.expectOp('(');
        const guard = this.expr();
        const close = this.expectOp(')');
        const body = this.block();
        loop = {
          guard,
          body,
          span: { from: w.span.from, to: this.toks[this.pos - 1].span.to },
          headerSpan: { from: w.span.from, to: close.span.to },
        };
      } else {
        throw new LangError(`Unexpected '${this.peek().text}'`, this.peek().span);
      }
    }
    if (!loop) throw new LangError('The program needs a while loop', { from: 0, to: 0 });
    return { source: this.src, inputs, vars, requires, ensures, loop };
  }
}

export function parseFormula(src: string): Expr {
  const p = new Parser(src);
  if (p.peek().kind === 'eof') throw new LangError('Type a condition', { from: 0, to: 0 });
  const e = p.expr();
  const t = p.peek();
  if (t.kind !== 'eof') throw new LangError(`Unexpected '${t.text}'`, t.span);
  return e;
}

export function parseProgram(src: string): Program {
  return new Parser(src).program();
}
