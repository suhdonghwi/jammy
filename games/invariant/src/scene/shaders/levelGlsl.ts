import type * as THREE from 'three';
import { freeVars, type Expr } from '../../lang/ast';
import { MAX_LEN, type CompiledLevel, type Inputs } from '../../levels/level';

// Compiles level formulas to GLSL so the floor can be drawn per pixel —
// an infinite plane with no per-tile geometry. Only used for visuals; the
// checker always uses exact arithmetic. The off-axis inputs are uniforms:
// an int per integer input, and an int array (MAX_LEN long) per array
// input, read as 0 outside its length. A quantifier becomes a function
// with a loop; a range wider than MAX_LEN + 1 is cut off (visual only).

const ident = (name: string) => `v_${name}`;
export const inputUniform = (name: string) => `uIn_${name}`;
export const arrayUniform = (name: string) => `uArr_${name}`;

/** The GLSL for a level's formulas: helper functions and an expression per formula. */
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

  /** A quantifier as a function of its free integer names: nested loops, one per bound name, that stop early. */
  private quant(e: Expr & { kind: 'quant' }): string {
    const free = [...freeVars(e)].filter((n) => !this.level.arrays[n]);
    const name = `Q${this.n++}`;
    const all = e.q === 'forall';
    const last = e.ops[e.ops.length - 1] === '<' ? 'hi - 1' : 'hi';
    let inner = `if (${all ? '!' : ''}(${this.expr(e.body)})) return ${all ? 'false' : 'true'};`;
    for (let k = e.vars.length - 1; k >= 0; k--) {
      const v = ident(e.vars[k]);
      const from = k === 0 ? (e.ops[0] === '<' ? 'lo + 1' : 'lo') : e.ops[k] === '<' ? `${ident(e.vars[k - 1])} + 1` : ident(e.vars[k - 1]);
      // GLSL ES 1.0 loops need a constant bound: count iterations and break
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

/**
 * Functions over a tile (X, Y) of the plane the input uniforms pick:
 *   bool L_stop(ivec2 t), bool L_goal(ivec2 t)
 * Whether the plane exists at all (the inputs' part of the precondition) is
 * the same for every tile, so it is the uniform uExists, set from the CPU.
 */
export function levelGlsl(level: CompiledLevel | null): string {
  if (!level) {
    return `
uniform bool uExists;
bool L_stop(ivec2 t) { return false; }
bool L_goal(ivec2 t) { return false; }
`;
  }
  const c = new Compiler(level);
  const uniforms = level.offAxis
    .map((n) => (level.arrays[n] ? `uniform int ${arrayUniform(n)}[${MAX_LEN}];` : `uniform int ${inputUniform(n)};`))
    .join('\n');
  // an array's cells, 0 outside 0..length-1
  const cells = Object.entries(level.arrays)
    .map(([a, len]) => `int cell_${a}(int k) { return (k >= 0 && k < ${inputUniform(len)}) ? ${arrayUniform(a)}[k] : 0; }`)
    .join('\n');
  const stop = c.expr(level.guard);
  const goal = c.expr(level.post);
  const decls = [`int ${ident(level.view.x)} = t.x;`, `int ${ident(level.view.y)} = t.y;`, ...level.offAxis.filter((n) => !level.arrays[n]).map((n) => `int ${ident(n)} = ${inputUniform(n)};`)].join(' ');
  // the quantifier functions take the names they use as parameters, so they need the tile's values in scope: inline them as globals set per call
  return `
uniform bool uExists;
${uniforms}
${cells}
${c.fns.join('\n')}
bool L_stop(ivec2 t) { ${decls} return !(${stop}); }
bool L_goal(ivec2 t) { ${decls} return ${goal}; }
`;
}

/** Uniforms for the off-axis inputs, with their starting values. */
export function inputUniforms(level: CompiledLevel | null): Record<string, THREE.IUniform> {
  const out: Record<string, THREE.IUniform> = { uExists: { value: true } };
  if (!level) return out;
  for (const n of level.offAxis) out[level.arrays[n] ? arrayUniform(n) : inputUniform(n)] = { value: level.arrays[n] ? new Array(MAX_LEN).fill(0) : 0 };
  return out;
}

/** Point the input uniforms at a plane. */
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
