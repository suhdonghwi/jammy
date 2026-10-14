import { clock } from './constants';

// Animated heights of the area's slabs, per tile. Slabs rise and sink on the
// GPU from (from, to, t0); the same function gives frogs and eggs their base
// height on the CPU, so everything stays in sync without per-frame loops.

export const RISE_DUR = 0.42;

export interface TileFlags {
  x: number;
  y: number;
  stop: boolean;
  goal: boolean;
}

export interface SlabAnim extends TileFlags {
  from: number;
  to: number;
  t0: number;
}

const key = (x: number, y: number) => `${x},${y}`;
const ease = (u: number) => u * u * (3 - 2 * u);

export function animValue(a: { from: number; to: number; t0: number }, t: number): number {
  const u = Math.min(1, Math.max(0, (t - a.t0) / RISE_DUR));
  return a.from + (a.to - a.from) * ease(u);
}

export class AreaField {
  anims = new Map<string, SlabAnim>();
  version = 0;

  reset() {
    this.anims.clear();
    this.version++;
  }

  /** 0..1 slab height at a tile right now. */
  heightAt(x: number, y: number, t = clock.now()): number {
    const a = this.anims.get(key(Math.round(x), Math.round(y)));
    return a ? animValue(a, t) : 0;
  }

  /**
   * Set the area to exactly `tiles` (within the window). With `animate`,
   * new tiles rise and removed tiles sink; otherwise they appear instantly.
   */
  update(tiles: TileFlags[], animate: boolean) {
    const now = clock.now();
    const next = new Map<string, SlabAnim>();
    for (const tile of tiles) {
      const k = key(tile.x, tile.y);
      const cur = this.anims.get(k);
      if (cur && cur.to === 1) next.set(k, { ...cur, ...tile });
      else if (!animate) next.set(k, { ...tile, from: 1, to: 1, t0: 0 });
      else next.set(k, { ...tile, from: cur ? animValue(cur, now) : 0, to: 1, t0: now });
    }
    if (animate) {
      for (const [k, cur] of this.anims) {
        if (next.has(k)) continue;
        const h = animValue(cur, now);
        if (h < 0.002) continue;
        next.set(k, cur.to === 0 ? cur : { ...cur, from: h, to: 0, t0: now });
      }
    }
    this.anims = next;
    this.version++;
  }

  /** Drop slabs that have finished sinking. Returns true if anything changed. */
  prune(): boolean {
    const now = clock.now();
    let changed = false;
    for (const [k, a] of this.anims) {
      if (a.to === 0 && now - a.t0 > RISE_DUR) {
        this.anims.delete(k);
        changed = true;
      }
    }
    if (changed) this.version++;
    return changed;
  }
}

/** The field for the focused pond. */
export const field = new AreaField();
