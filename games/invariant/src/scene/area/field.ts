import type { FastFn, FastState } from '../../lang/eval';
import type { Inputs } from '../../levels/inputs';
import type { CompiledLevel, Formula } from '../../levels/level';
import { tilesNear, tileState, type TileWindow } from '../../levels/tiles';
import { SLAB_H } from '../constants';
import { clamp01, smoothstep } from '../easing';
import { sceneNow } from '../sceneTime';

const RISE_DUR = 0.26;

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
    const s = tileState(level, Math.round(x), Math.round(y), this.inputs);
    if (level.fast.planeReq(s) !== true) return 0;
    const covers = (f: FastFn | undefined) => (f?.(s) === true ? 1 : 0);
    const to = covers(this.area?.fast);
    const risen = this.risen();
    if (risen >= 1) return to;
    const from = covers(this.before?.fast);
    return from + (to - from) * risen;
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
