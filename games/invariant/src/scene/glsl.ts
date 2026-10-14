import type { Expr } from '../lang/ast';
import type { CompiledLevel } from '../levels/level';

// Compiles level formulas to GLSL so the floor can be drawn per pixel —
// an infinite plane with no per-tile geometry. Only used for visuals; the
// checker always uses exact arithmetic.

const ident = (name: string) => `v_${name}`;

export function exprToGlsl(e: Expr): string {
  switch (e.kind) {
    case 'num':
      return e.value.toString();
    case 'bool':
      return e.value ? 'true' : 'false';
    case 'var':
      return ident(e.name);
    case 'unary':
      return e.op === '-' ? `(-(${exprToGlsl(e.arg)}))` : `(!(${exprToGlsl(e.arg)}))`;
    case 'call': {
      const a = e.args.map(exprToGlsl);
      return `${e.fn}(${a.join(', ')})`;
    }
    case 'ite':
      return `((${exprToGlsl(e.cond)}) ? (${exprToGlsl(e.then)}) : (${exprToGlsl(e.else)}))`;
    case 'binary': {
      const l = exprToGlsl(e.left);
      const r = exprToGlsl(e.right);
      if (e.op === '/') return `fdiv(${l}, ${r})`;
      if (e.op === '%') return `emod(${l}, ${r})`;
      return `(${l} ${e.op} ${r})`;
    }
  }
}

export const GLSL_INT_HELPERS = /* glsl */ `
int fdiv(int a, int k) { return int(floor(float(a) / float(k))); }
int emod(int a, int k) { return a - k * fdiv(a, k); }
`;

/**
 * Functions over a tile (X, Y) in pond P:
 *   bool L_exists(ivec3 t), bool L_stop(ivec3 t), bool L_goal(ivec3 t)
 */
export function levelGlsl(level: CompiledLevel | null): string {
  if (!level) {
    return `
bool L_exists(ivec3 t) { return true; }
bool L_stop(ivec3 t) { return false; }
bool L_goal(ivec3 t) { return false; }
`;
  }
  const decls = [
    `int ${ident(level.view.x)} = t.x;`,
    `int ${ident(level.view.y)} = t.y;`,
    level.pond ? `int ${ident(level.pond)} = t.z;` : '',
  ].join(' ');
  return `
bool L_exists(ivec3 t) { ${decls} return ${exprToGlsl(level.pondReq)}; }
bool L_stop(ivec3 t) { ${decls} return !(${exprToGlsl(level.guard)}); }
bool L_goal(ivec3 t) { ${decls} return ${exprToGlsl(level.post)}; }
`;
}
