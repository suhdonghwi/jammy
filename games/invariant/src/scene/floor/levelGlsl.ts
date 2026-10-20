import type * as THREE from 'three';
import { freeVars, type Expr } from '../../lang/ast';
import { MAX_LEN, type CompiledLevel, type Inputs } from '../../levels/level';

const ident = (name: string) => `v_${name}`;
const inputUniform = (name: string) => `uIn_${name}`;
const arrayUniform = (name: string) => `uArr_${name}`;

class Compiler {
  fns: string[] = [];
  private n = 0;
  constructor(private level: CompiledLevel) {}

  expr(e: Expr): string {
    switch (e.kind) {
      case 'num':
        return e.value.toString();
      case 'bool':
        return e.value ? 'true' : 'false';
      case 'var':
        return ident(e.name);
      case 'index':
        return `cell_${e.array}(${this.expr(e.index)})`;
      case 'quant':
        return this.quant(e);
      case 'unary':
        return e.op === '-' ? `(-(${this.expr(e.arg)}))` : `(!(${this.expr(e.arg)}))`;
      case 'call': {
        const a = e.args.map((x) => this.expr(x));
        return `${e.fn}(${a.join(', ')})`;
      }
      case 'ite':
        return `((${this.expr(e.cond)}) ? (${this.expr(e.then)}) : (${this.expr(e.else)}))`;
      case 'binary': {
        const l = this.expr(e.left);
        const r = this.expr(e.right);
        if (e.op === '/') return `fdiv(${l}, ${r})`;
        if (e.op === '%') return `emod(${l}, ${r})`;
        return `(${l} ${e.op} ${r})`;
      }
    }
  }

  private quant(e: Expr & { kind: 'quant' }): string {
    const free = [...freeVars(e)].filter((n) => !this.level.arrays[n]);
    const name = `Q${this.n++}`;
    const all = e.q === 'forall';
    const last = e.ops[e.ops.length - 1] === '<' ? 'hi - 1' : 'hi';
    let inner = `if (${all ? '!' : ''}(${this.expr(e.body)})) return ${all ? 'false' : 'true'};`;
    for (let k = e.vars.length - 1; k >= 0; k--) {
      const v = ident(e.vars[k]);
      const from = k === 0 ? (e.ops[0] === '<' ? 'lo + 1' : 'lo') : e.ops[k] === '<' ? `${ident(e.vars[k - 1])} + 1` : ident(e.vars[k - 1]);
      // GLSL ES 1.0 loops need a constant bound
      inner = `for (int i${k} = 0; i${k} <= ${MAX_LEN}; i${k}++) { int ${v} = ${from} + i${k}; if (${v} > ${last}) break; ${inner} }`;
    }
    const params = free.map((n) => `int ${ident(n)}`).join(', ');
    this.fns.push(`bool ${name}(${params}) { int lo = ${this.expr(e.lo)}; int hi = ${this.expr(e.hi)}; ${inner} return ${all}; }`);
    return `${name}(${free.map(ident).join(', ')})`;
  }
}

export const GLSL_INT_HELPERS = /* glsl */ `
int fdiv(int a, int k) { return int(floor(float(a) / float(k))); }
int emod(int a, int k) { return a - k * fdiv(a, k); }
`;

export function levelGlsl(level: CompiledLevel | null): string {
  if (!level) {
    return `
uniform bool uExists;
bool L_exists(ivec2 t) { return true; }
bool L_stop(ivec2 t) { return false; }
bool L_goal(ivec2 t) { return false; }
`;
  }
  const c = new Compiler(level);
  const uniforms = level.offAxis
    .map((n) => (level.arrays[n] ? `uniform int ${arrayUniform(n)}[${MAX_LEN}];` : `uniform int ${inputUniform(n)};`))
    .join('\n');
  const cells = Object.entries(level.arrays)
    .map(([a, len]) => `int cell_${a}(int k) { return (k >= 0 && k < ${inputUniform(len)}) ? ${arrayUniform(a)}[k] : 0; }`)
    .join('\n');
  const exists = c.expr(level.axisReq);
  const stop = c.expr(level.guard);
  const goal = c.expr(level.post);
  const decls = [`int ${ident(level.view.x)} = t.x;`, `int ${ident(level.view.y)} = t.y;`, ...level.offAxis.filter((n) => !level.arrays[n]).map((n) => `int ${ident(n)} = ${inputUniform(n)};`)].join(' ');
  return `
uniform bool uExists;
${uniforms}
${cells}
${c.fns.join('\n')}
bool L_exists(ivec2 t) { ${decls} return ${exists}; }
bool L_stop(ivec2 t) { ${decls} return !(${stop}); }
bool L_goal(ivec2 t) { ${decls} return ${goal}; }
`;
}

export function inputUniforms(level: CompiledLevel | null): Record<string, THREE.IUniform> {
  const out: Record<string, THREE.IUniform> = { uExists: { value: true } };
  if (!level) return out;
  for (const n of level.offAxis) out[level.arrays[n] ? arrayUniform(n) : inputUniform(n)] = { value: level.arrays[n] ? new Array(MAX_LEN).fill(0) : 0 };
  return out;
}

export function setInputUniforms(u: Record<string, THREE.IUniform>, level: CompiledLevel | null, inputs: Inputs, exists: boolean): void {
  u.uExists.value = exists;
  if (!level) return;
  for (const n of level.offAxis) {
    const v = inputs[n];
    if (level.arrays[n]) {
      const arr = u[arrayUniform(n)].value as number[];
      const src = v as number[];
      for (let k = 0; k < MAX_LEN; k++) arr[k] = k < src.length ? src[k] : 0;
    } else u[inputUniform(n)].value = v as number;
  }
}
