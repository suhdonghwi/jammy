import { planeKey, type Inputs } from '../levels/inputs';
import { BASE, EXIT, reducedMotion } from '../motion';
import { clamp01, easeIn, easeOut } from './easing';

export const BOARD_OUT = EXIT;
export const BOARD_IN = BASE;
export const PLANE_SHIFT = BOARD_OUT + BOARD_IN;
const DROP = 1.6;

export interface Board {
  prev: boolean;
  y: number;
  fade: number;
}

const SETTLED: Board = { prev: false, y: 0, fade: 0 };

export function boardAt(age: number, dir: number, drop = DROP): Board {
  if (age >= PLANE_SHIFT || age < 0) return SETTLED;
  if (age < BOARD_OUT) {
    const k = easeIn(clamp01(age / BOARD_OUT));
    return { prev: true, y: -dir * drop * k, fade: k };
  }
  const k = 1 - easeOut(clamp01((age - BOARD_OUT) / BOARD_IN));
  return { prev: false, y: dir * drop * k, fade: k };
}

export const GLSL_BOARD = /* glsl */ `
uniform float uBoardY;
uniform float uBoardFade;
uniform float uBoardPrev;
`;

export function direction(before: Inputs, after: Inputs): number {
  let sum = 0;
  for (const [k, v] of Object.entries(after)) {
    const was = before[k];
    if (typeof v === 'number' && typeof was === 'number') sum += Math.sign(v - was);
  }
  return sum < 0 ? -1 : 1;
}

class PlaneShift {
  readonly uniforms = {
    uBoardY: { value: 0 },
    uBoardFade: { value: 0 },
    uBoardPrev: { value: 0 },
  };
  key: string | null = null;
  prevKey: string | null = null;
  before: Inputs | null = null;
  private owner: object | null = null;
  private last: Inputs | null = null;
  private t0 = -Infinity;
  private dir = 1;
  private drop = DROP;

  track(owner: object, inputs: Inputs, t: number): boolean {
    if (owner !== this.owner) {
      this.reset();
      this.owner = owner;
    }
    const key = planeKey(inputs);
    let changed = false;
    if (this.key === null) this.key = key;
    else if (key !== this.key) {
      this.before = this.last;
      this.prevKey = this.key;
      this.key = key;
      this.t0 = t;
      this.dir = this.before ? direction(this.before, inputs) : 1;
      this.drop = reducedMotion() ? 0 : DROP;
      changed = true;
    }
    if (!this.shifting(t)) this.prevKey = null;
    this.last = inputs;
    const b = this.board(t);
    this.uniforms.uBoardY.value = b.y;
    this.uniforms.uBoardFade.value = b.fade;
    this.uniforms.uBoardPrev.value = b.prev ? 1 : 0;
    return changed;
  }

  board(t: number): Board {
    return boardAt(t - this.t0, this.dir, this.drop);
  }

  shifting(t: number): boolean {
    return t - this.t0 < PLANE_SHIFT;
  }

  showingPrev(t: number): boolean {
    return this.prevKey !== null && this.board(t).prev;
  }

  visibility(plane: string, t: number): number {
    if (this.key === null) return 1;
    const shown = this.showingPrev(t) ? this.prevKey : this.key;
    return plane === shown ? 1 - this.board(t).fade : 0;
  }

  reset() {
    this.owner = null;
    this.last = null;
    this.key = null;
    this.prevKey = null;
    this.before = null;
    this.t0 = -Infinity;
    this.uniforms.uBoardY.value = 0;
    this.uniforms.uBoardFade.value = 0;
    this.uniforms.uBoardPrev.value = 0;
  }
}

export const planeShift = new PlaneShift();
