import type { FastFn, FastState } from '../../lang/eval';
import type { Inputs } from '../../levels/inputs';
import type { CompiledLevel, Formula } from '../../levels/level';
import { tilesNear, tileState, type TileWindow } from '../../levels/tiles';
import { BASE } from '../../motion';
import { SLAB_H } from '../constants';
import { clamp01, smoothstep } from '../easing';
import { planeShift } from '../planeShift';
import { sceneNow } from '../sceneTime';

const RISE_DUR = BASE;

class AreaField {
  level: CompiledLevel | null = null;
  inputs: Inputs = {};
  area: Formula | null = null;
  before: Formula | null = null;
  private since = -Infinity;

  reset() {
    this.level = null;
    this.area = null;
    this.before = null;
    this.since = -Infinity;
  }

  show(level: CompiledLevel, area: Formula | null) {
    this.before = level === this.level ? this.area : null;
    this.level = level;
    this.area = area;
    this.since = sceneNow();
  }

  risen(): number {
    return smoothstep(clamp01((sceneNow() - this.since) / RISE_DUR));
  }

  heightAt(x: number, y: number): number {
    const level = this.level;
    if (!level) return 0;
    const tx = Math.round(x);
    const ty = Math.round(y);
    const h = this.heightOn(level, this.inputs, tx, ty);
    const t = sceneNow();
    const before = planeShift.before;
    if (!before || !planeShift.shifting(t)) return h;
    const k = planeShift.mixAt(tx, ty, t);
    return k >= 1 ? h : this.heightOn(level, before, tx, ty) * (1 - k) + h * k;
  }

  private heightOn(level: CompiledLevel, inputs: Inputs, x: number, y: number): number {
    const s = tileState(level, x, y, inputs);
    if (level.fast.planeReq(s) !== true) return 0;
    const covers = (f: FastFn | undefined) => (f?.(s) === true ? 1 : 0);
    const to = covers(this.area?.fast);
    const risen = this.risen();
    if (risen >= 1) return to;
    const from = covers(this.before?.fast);
    return from + (to - from) * risen;
  }

  planeMovedNear(near: TileWindow, before: Inputs): { rising: number; sinking: number } {
    const level = this.level;
    if (!level) return { rising: 0, sinking: 0 };
    const on = (inputs: Inputs) => new Set(tilesNear(level, inputs, near, (s, x, y) => (level.fast.planeReq(s) === true && this.area?.fast(s) === true ? `${x},${y}` : undefined)));
    const now = on(this.inputs);
    const was = on(before);
    return { rising: [...now].filter((k) => !was.has(k)).length, sinking: [...was].filter((k) => !now.has(k)).length };
  }

  groundAt(x: number, y: number): number {
    return this.heightAt(x, y) * SLAB_H;
  }

  movedNear(near: TileWindow): { rising: number; sinking: number } {
    const level = this.level;
    if (!level) return { rising: 0, sinking: 0 };
    const covers = (f: Formula | null, s: FastState) => (f?.fast(s) === true ? 1 : 0);
    const moved = tilesNear(level, this.inputs, near, (s) => (level.fast.planeReq(s) === true ? covers(this.area, s) - covers(this.before, s) : 0));
    return { rising: moved.filter((m) => m > 0).length, sinking: moved.filter((m) => m < 0).length };
  }
}

export const field = new AreaField();
