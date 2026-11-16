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
    const before = planeShift.before;
    const inputs = before && planeShift.showingPrev(sceneNow()) ? before : this.inputs;
    return this.heightOn(level, inputs, Math.round(x), Math.round(y));
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
    return this.heightAt(x, y) * SLAB_H + planeShift.board(sceneNow()).y;
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
