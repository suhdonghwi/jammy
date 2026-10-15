import { conjuncts, freeVars, mk, subst, type Expr, type Program, type State } from '../lang/ast';
import { compileFast, evaluate, holds, step, symbolicStep, type FastFn } from '../lang/eval';
import { LangError, parseFormula, parseProgram } from '../lang/parser';
import { checkCondition, checkProgram } from '../lang/typecheck';

// The level format, compiling a level's program for play (exact and fast
// evaluation), and helpers for program states.

export type Rule = 'initialization' | 'maintenance' | 'termination';
export const RULES: Rule[] = ['initialization', 'maintenance', 'termination'];
export const RULE_NAMES: Record<Rule, string> = { initialization: 'Initialization', maintenance: 'Maintenance', termination: 'Termination' };

export interface Pitfall {
  formula: string;
  message: string;
}

export interface LevelDef {
  id: string;
  title: string;
  source: string;
  /** Which variables go on the plane's axes. A leftover input becomes the plane slider: one plane per value. */
  view: { x: string; y: string };
  solutions: string[];
  pitfalls?: Pitfall[];
  /** Caption shown when the level opens (and its line in the level list). */
  intro?: string;
  /** For a stuck learner, revealed one at a time: from what to look at, to the shape of the area. Never the formula itself. */
  hints?: string[];
  /** Camera target tile and distance. */
  camera?: { x: number; y: number; distance?: number };
  /** Slider range and starting plane. */
  planes?: { min: number; max: number; start: number };
}

export interface CompiledLevel extends LevelDef {
  program: Program;
  inputs: string[];
  vars: string[];
  names: string[];
  plane?: string;
  /** Inputs + variables without an initializer: what a start state is chosen from. */
  freeDims: string[];
  /** Initial value of each initialized variable, in terms of free dims. */
  initExprs: Record<string, Expr>;
  /** Input-only part of `requires`: which planes / rows exist. */
  planeReq: Expr;
  /** The rest of `requires`, evaluated after initialization. */
  eggReq: Expr;
  guard: Expr;
  post: Expr;
  /** Symbolic next-state expressions. */
  next: Record<string, Expr>;
  fast: {
    planeReq: FastFn;
    eggReq: FastFn;
    guard: FastFn;
    post: FastFn;
    next: Record<string, FastFn>;
    init: Record<string, FastFn>;
  };
}

export function compileLevel(def: LevelDef): CompiledLevel {
  const program = parseProgram(def.source);
  checkProgram(program);
  const inputs = program.inputs;
  const vars = program.vars.map((v) => v.name);
  const names = [...inputs, ...vars];
  const { x, y } = def.view;
  for (const a of [x, y]) {
    if (!names.includes(a)) throw new Error(`[${def.id}] view axis '${a}' is not a variable`);
  }
  const rest = names.filter((n) => n !== x && n !== y);
  if (rest.length > 1) throw new Error(`[${def.id}] at most one name may be off-axis`);
  const plane = rest[0];
  if (plane && !inputs.includes(plane)) throw new Error(`[${def.id}] off-axis '${plane}' must be an input`);

  const initExprs: Record<string, Expr> = {};
  const freeDims = [...inputs];
  for (const v of program.vars) {
    if (v.init) initExprs[v.name] = subst(v.init, initExprs);
    else freeDims.push(v.name);
  }
  const inputSet = new Set(inputs);
  const reqs = program.requires.flatMap(conjuncts);
  const isInputOnly = (e: Expr) => [...freeVars(e)].every((n) => inputSet.has(n));
  const planeReq = mk.andAll(reqs.filter(isInputOnly));
  const eggReq = mk.andAll(reqs.filter((e) => !isInputOnly(e)));
  const guard = program.loop.guard;
  const post = mk.andAll(program.ensures);
  const next = symbolicStep(program.loop.body, vars);

  const fastMap = (m: Record<string, Expr>) =>
    Object.fromEntries(Object.entries(m).map(([k, e]) => [k, compileFast(e)]));

  return {
    ...def,
    program,
    inputs,
    vars,
    names,
    plane,
    freeDims,
    initExprs,
    planeReq,
    eggReq,
    guard,
    post,
    next,
    fast: {
      planeReq: compileFast(planeReq),
      eggReq: compileFast(eggReq),
      guard: compileFast(guard),
      post: compileFast(post),
      next: fastMap(next),
      init: fastMap(initExprs),
    },
  };
}

export type FormulaResult =
  | { ok: true; expr: Expr; fast: FastFn; text: string }
  | { ok: false; error: LangError; text: string };

export function compileFormula(level: CompiledLevel, text: string): FormulaResult {
  try {
    const expr = parseFormula(text);
    checkCondition(expr, new Set(level.names), text, 'an area');
    return { ok: true, expr, fast: compileFast(expr), text };
  } catch (e) {
    if (e instanceof LangError) return { ok: false, error: e, text };
    throw e;
  }
}

// ---- state helpers (exact, BigInt) ----

/** Build the start state from values of the free dims. */
export function startState(level: CompiledLevel, free: State): State {
  const s: State = { ...free };
  for (const [v, e] of Object.entries(level.initExprs)) s[v] = evaluate(e, free) as bigint;
  return s;
}

export function isEgg(level: CompiledLevel, start: State): boolean {
  return holds(level.planeReq, start) && holds(level.eggReq, start);
}

export function hop(level: CompiledLevel, s: State): State {
  return step(level.program.loop.body, s);
}

export function running(level: CompiledLevel, s: State): boolean {
  return holds(level.guard, s);
}

export function toNum(s: State): Record<string, number> {
  const o: Record<string, number> = {};
  for (const k in s) o[k] = Number(s[k]);
  return o;
}

export function toBig(s: Record<string, number>): State {
  const o: State = {};
  for (const k in s) o[k] = BigInt(Math.round(s[k]));
  return o;
}

/** Where the camera starts on a level: the tile it centres and how far back it sits. */
export function startView(level: CompiledLevel): { x: number; y: number; distance: number } {
  const cam = level.camera ?? { x: 0, y: 0 };
  return { x: cam.x, y: cam.y, distance: (cam.distance ?? 15) * 1.2 };
}

/** Variable names in display order: the plotted axes first, then the rest. */
export function displayNames(level: CompiledLevel): string[] {
  const { x, y } = level.view;
  return [x, y, ...level.names.filter((n) => n !== x && n !== y)];
}

export function showState(level: CompiledLevel, s: State): string {
  return displayNames(level).filter((n) => n in s).map((n) => `${n} = ${s[n]}`).join(', ');
}
