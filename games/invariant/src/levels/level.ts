import { t } from '../i18n/i18n';
import { conjuncts, freeVars, mk, subst, type Expr, type Program, type State } from '../lang/ast';
import { compileFast, evaluate, holds, step, symbolicStep, type FastFn, type FastState } from '../lang/eval';
import { LangError, parseFormula, parseProgram } from '../lang/parser';
import { checkCondition, checkProgram, programScope, type Scope } from '../lang/typecheck';

export type Inputs = Record<string, number | number[]>;

export const MAX_LEN = 32;

interface Dice {
  length: [number, number];
  values: [number, number];
  sorted?: boolean;
}

export interface Pitfall {
  formula: string;
  message: string;
}

export interface LevelDef {
  id: string;
  title: string;
  source: string;
  view: { x: string; y: string };
  solutions: string[];
  pitfalls?: Pitfall[];
  intro?: string;
  hints?: string[];
  camera?: { x: number; y: number; distance?: number };
  start?: Inputs;
  dice?: Record<string, Dice>;
}

export interface CompiledLevel extends LevelDef {
  program: Program;
  names: string[];
  scope: Scope;
  arrays: Record<string, string>;
  offAxis: string[];
  freeDims: string[];
  initExprs: Record<string, Expr>;
  planeReq: Expr;
  axisReq: Expr;
  inputsReq: Expr;
  eggReq: Expr;
  guard: Expr;
  post: Expr;
  next: Record<string, Expr>;
  fast: {
    planeReq: FastFn;
    inputsReq: FastFn;
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
  const onAxis = (e: Expr) => [...freeVars(e)].some((n) => n === x || n === y);
  const axisReq = mk.andAll(reqs.filter((e) => isInputOnly(e) && onAxis(e)));
  const inputsReq = mk.andAll(reqs.filter((e) => isInputOnly(e) && !onAxis(e)));
  const eggReq = mk.andAll(reqs.filter((e) => !isInputOnly(e)));
  const guard = program.loop.guard;
  const post = mk.andAll(program.ensures);
  const next = symbolicStep(program.loop.body, vars);

  const fastMap = (m: Record<string, Expr>) =>
    Object.fromEntries(Object.entries(m).map(([k, e]) => [k, compileFast(e)]));

  return {
    ...def,
    program,
    names,
    scope,
    arrays,
    offAxis,
    freeDims,
    initExprs,
    planeReq,
    axisReq,
    inputsReq,
    eggReq,
    guard,
    post,
    next,
    fast: {
      planeReq: compileFast(planeReq),
      inputsReq: compileFast(inputsReq),
      eggReq: compileFast(eggReq),
      guard: compileFast(guard),
      post: compileFast(post),
      next: fastMap(next),
      init: fastMap(initExprs),
    },
  };
}

export interface Formula {
  expr: Expr;
  fast: FastFn;
  text: string;
}

export type FormulaResult = ({ ok: true } & Formula) | { ok: false; error: LangError; text: string };

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

export function startInputs(level: CompiledLevel): Inputs {
  const out: Inputs = {};
  for (const n of level.offAxis) out[n] = level.arrays[n] ? [] : 0;
  Object.assign(out, level.start);
  return withLengths(level, out);
}

export function withLengths(level: CompiledLevel, inputs: Inputs): Inputs {
  const out = { ...inputs };
  for (const [arr, len] of Object.entries(level.arrays)) out[len] = (out[arr] as number[]).length;
  return out;
}

export function inputsOf(level: CompiledLevel, s: State | FastState): Inputs {
  const out: Inputs = {};
  for (const n of level.offAxis) {
    const v = s[n];
    out[n] = Array.isArray(v) ? v.map(Number) : Number(v);
  }
  return out;
}

export function planeKey(inputs: Inputs): string {
  return Object.keys(inputs)
    .sort()
    .map((k) => `${k}=${String(inputs[k])}`)
    .join(';');
}

export function planeExists(level: CompiledLevel, inputs: Inputs): boolean {
  return level.fast.inputsReq(inputs) === true;
}

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

export function startView(level: CompiledLevel): { x: number; y: number; distance: number } {
  const cam = level.camera ?? { x: 0, y: 0 };
  return { x: cam.x, y: cam.y, distance: (cam.distance ?? 15) * 1.2 };
}

export function displayNames(level: CompiledLevel): string[] {
  const { x, y } = level.view;
  return [x, y, ...level.names.filter((n) => n !== x && n !== y)];
}

export function scalarNames(level: CompiledLevel): string[] {
  return displayNames(level).filter((n) => !level.arrays[n]);
}

export function showState(level: CompiledLevel, s: State): string {
  return scalarNames(level).filter((n) => n in s).map((n) => `${n} = ${s[n]}`).join(', ');
}
