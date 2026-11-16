import type { State } from '../lang/ast';
import type { FastState } from '../lang/eval';
import type { CompiledLevel } from './level';

export type Inputs = Record<string, number | number[]>;

export const MAX_LEN = 32;

export interface Dice {
  length: [number, number];
  values: [number, number];
  sorted?: boolean;
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
