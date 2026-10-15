import { t } from '../i18n/i18n';
import { conjuncts, freeVars, mk, subst, type Expr, type Program, type State } from '../lang/ast';
import { compileFast, evaluate, holds, step, symbolicStep, type FastFn, type FastState } from '../lang/eval';
import { LangError, parseFormula, parseProgram } from '../lang/parser';
import { checkCondition, checkProgram, programScope, type Scope } from '../lang/typecheck';

// The level format, compiling a level's program for play (exact and fast
// evaluation), and helpers for program states.

/**
 * Values of the inputs that are not on an axis: one plane of the state space.
 * Arrays are at most MAX_LEN long (what the inputs card and the floor can show).
 */
export type Inputs = Record<string, number | number[]>;

/** The longest array the game shows; proofs are not bounded by it. */
export const MAX_LEN = 32;

/** How the dice button draws an array input: a length and cell values in these ranges, sorted when the level needs it. */
export interface Dice {
  length: [number, number];
  values: [number, number];
  sorted?: boolean;
}

export type Rule = 'initialization' | 'maintenance' | 'termination';
export const RULES: Rule[] = ['initialization', 'maintenance', 'termination'];
/** A rule's name in the current language. */
export const ruleName = (r: Rule): string => t().rules[r];

export interface Pitfall {
  formula: string;
  message: string;
}

export interface LevelDef {
  id: string;
  title: string;
  source: string;
  /** Which variables go on the plane's axes. The inputs left over are picked in the inputs card: one plane per choice. */
  view: { x: string; y: string };
  /** Known-good areas; after a proof, the success caption lists them (all but the one typed). */
  solutions: string[];
  pitfalls?: Pitfall[];
  /** Caption shown when the level opens. */
  intro?: string;
  /** For a stuck learner, revealed one at a time: from what to look at, to the shape of the area. Never the formula itself. */
  hints?: string[];
  /** Camera target tile and distance. */
  camera?: { x: number; y: number; distance?: number };
  /** Starting values of the off-axis inputs (0 and the empty array otherwise). */
  start?: Inputs;
  /** How the dice button draws each array input. */
  dice?: Record<string, Dice>;
}

export interface CompiledLevel extends LevelDef {
  program: Program;
  inputs: string[];
  vars: string[];
  /** Every name: inputs (arrays too), then variables. */
  names: string[];
  scope: Scope;
  /** Array inputs: name → the input that is its length. */
  arrays: Record<string, string>;
  /** The inputs that are not on an axis (arrays, their lengths, and other inputs): the plane. */
  offAxis: string[];
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
  const scope = programScope(program);
  const arrays = program.arrays;
  const { x, y } = def.view;
  for (const a of [x, y]) {
    if (scope.get(a) !== 'int') throw new Error(`[${def.id}] view axis '${a}' is not an integer variable`);
  }
  const offAxis = names.filter((n) => n !== x && n !== y);
  for (const n of offAxis) {
    if (!inputs.includes(n)) throw new Error(`[${def.id}] off-axis '${n}' must be an input`);
  }
  for (const len of Object.values(arrays)) {
    if (!offAxis.includes(len)) throw new Error(`[${def.id}] an array's length '${len}' can't be on an axis`);
  }
  for (const n of Object.keys(def.start ?? {})) {
    if (!offAxis.includes(n)) throw new Error(`[${def.id}] starting input '${n}' is not an off-axis input`);
  }

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
    scope,
    arrays,
    offAxis,
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
    checkCondition(expr, level.scope, text, t().langErrors.anArea);
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

export function toNum(s: State): FastState {
  const o: FastState = {};
  for (const k in s) {
    const v = s[k];
    o[k] = Array.isArray(v) ? v.map(Number) : Number(v);
  }
  return o;
}

export function toBig(s: FastState): State {
  const o: State = {};
  for (const k in s) {
    const v = s[k];
    o[k] = Array.isArray(v) ? v.map((x) => BigInt(Math.round(x))) : BigInt(Math.round(v));
  }
  return o;
}

// ---- the plane: the off-axis inputs ----

/** Where a level starts: its given inputs, 0 for the rest, and every array's length matching it. */
export function startInputs(level: CompiledLevel): Inputs {
  const out: Inputs = {};
  for (const n of level.offAxis) out[n] = level.arrays[n] ? [] : 0;
  Object.assign(out, level.start);
  return withLengths(level, out);
}

/** The same inputs with each array's length input set to the array's length. */
export function withLengths(level: CompiledLevel, inputs: Inputs): Inputs {
  const out = { ...inputs };
  for (const [arr, len] of Object.entries(level.arrays)) out[len] = (out[arr] as number[]).length;
  return out;
}

/** The plane a state is in: its off-axis inputs. */
export function inputsOf(level: CompiledLevel, s: State | FastState): Inputs {
  const out: Inputs = {};
  for (const n of level.offAxis) {
    const v = s[n];
    out[n] = Array.isArray(v) ? v.map(Number) : Number(v);
  }
  return out;
}

/** A key naming a plane, so frogs and effects know which plane they are on. */
export function planeKey(inputs: Inputs): string {
  return Object.keys(inputs)
    .sort()
    .map((k) => `${k}=${String(inputs[k])}`)
    .join(';');
}

/** The inputs' part of the precondition holds: there are states in this plane. */
export function planeExists(level: CompiledLevel, inputs: Inputs): boolean {
  return level.fast.planeReq({ ...inputs, [level.view.x]: 0, [level.view.y]: 0 }) === true;
}

/** Draw an array for the dice button: random cells that fit the level's precondition (a few tries, then the best effort). */
export function rollArray(level: CompiledLevel, inputs: Inputs, name: string): Inputs {
  const d = level.dice?.[name] ?? { length: [1, 6], values: [0, 9] };
  const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
  let next = inputs;
  for (let tries = 0; tries < 50; tries++) {
    const arr = Array.from({ length: Math.min(MAX_LEN, rand(d.length[0], d.length[1])) }, () => rand(d.values[0], d.values[1]));
    if (d.sorted) arr.sort((a, b) => a - b);
    next = withLengths(level, { ...inputs, [name]: arr });
    if (planeExists(level, next)) break;
  }
  return next;
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

/** The integer names, in display order: what a tile or a frog is labelled with (arrays are in the inputs card). */
export function scalarNames(level: CompiledLevel): string[] {
  return displayNames(level).filter((n) => !level.arrays[n]);
}

export function showState(level: CompiledLevel, s: State): string {
  return scalarNames(level).filter((n) => n in s).map((n) => `${n} = ${s[n]}`).join(', ');
}
