import type * as THREE from 'three';
import { freeVars, rangeBounds, type Expr, type Quant } from '../../lang/ast';
import { MAX_LEN, type Inputs } from '../../levels/inputs';
import type { CompiledLevel } from '../../levels/level';

const ident = (name: string) => `v_${name}`;
const inputUniform = (name: string) => `uIn_${name}`;
const arrayUniform = (name: string) => `uArr_${name}`;

const INT_MAX = 2147483647n;

class Compiler {
  fns: string[] = [];
  private n = 0;
  constructor(private level: CompiledLevel) {}

  expr(e: Expr): string {
    switch (e.kind) {
      case 'num':
        return (e.value > INT_MAX ? INT_MAX : e.value < -INT_MAX ? -INT_MAX : e.value).toString();
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

  private quant(e: Quant): string {
    const free = [...freeVars(e)].filter((n) => !this.level.arrays[n]);
    const name = `Q${this.n++}`;
    const all = e.q === 'forall';
    const { from, to } = rangeBounds(e);
    let inner = `if (${all ? '!' : ''}(${this.expr(e.body)})) return ${all ? 'false' : 'true'};`;
    for (let k = e.vars.length - 1; k >= 0; k--) {
      const v = ident(e.vars[k]);
      const start = k === 0 ? 'first' : this.expr(from[k]);
      // GLSL ES 1.0 loops need a constant bound
      inner = `for (int i${k} = 0; i${k} <= ${MAX_LEN}; i${k}++) { int ${v} = ${start} + i${k}; if (${v} > last) break; ${inner} }`;
    }
    const params = free.map((n) => `int ${ident(n)}`).join(', ');
    this.fns.push(`bool ${name}(${params}) { int first = ${this.expr(from[0])}; int last = ${this.expr(to)}; ${inner} return ${all}; }`);
    return `${name}(${free.map(ident).join(', ')})`;
  }
}

const GLSL_INT_HELPERS = /* glsl */ `
int fdiv(int a, int k) { return int(floor(float(a) / float(k))); }
int emod(int a, int k) { return a - k * fdiv(a, k); }
`;

export function levelGlsl(level: CompiledLevel, areas?: { area: Expr | null; before: Expr | null }): string {
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
  const area = areas?.area ? c.expr(areas.area) : 'false';
  const before = areas?.before ? c.expr(areas.before) : 'false';
  const decls = [`int ${ident(level.view.x)} = t.x;`, `int ${ident(level.view.y)} = t.y;`, ...level.offAxis.filter((n) => !level.arrays[n]).map((n) => `int ${ident(n)} = ${inputUniform(n)};`)].join(' ');
  return `
${GLSL_INT_HELPERS}
uniform bool uExists;
${uniforms}
${cells}
${c.fns.join('\n')}
bool L_exists(ivec2 t) { ${decls} return ${exists}; }
bool L_stop(ivec2 t) { ${decls} return !(${stop}); }
bool L_goal(ivec2 t) { ${decls} return ${goal}; }
${areas ? `bool L_area(ivec2 t) { ${decls} return ${area}; }\nbool L_before(ivec2 t) { ${decls} return ${before}; }\nbool L_egg(ivec2 t) { ${decls} return ${c.expr(level.eggAt)}; }` : ''}
`;
}

export function inputUniforms(level: CompiledLevel): Record<string, THREE.IUniform> {
  const out: Record<string, THREE.IUniform> = { uExists: { value: true } };
  for (const n of level.offAxis) out[level.arrays[n] ? arrayUniform(n) : inputUniform(n)] = { value: level.arrays[n] ? new Array(MAX_LEN).fill(0) : 0 };
  return out;
}

export function setInputUniforms(u: Record<string, THREE.IUniform>, level: CompiledLevel, inputs: Inputs, exists: boolean): void {
  u.uExists.value = exists;
  for (const n of level.offAxis) {
    const v = inputs[n];
    if (level.arrays[n]) {
      const arr = u[arrayUniform(n)].value as number[];
      const src = v as number[];
      for (let k = 0; k < MAX_LEN; k++) arr[k] = k < src.length ? src[k] : 0;
    } else u[inputUniform(n)].value = v as number;
  }
}
