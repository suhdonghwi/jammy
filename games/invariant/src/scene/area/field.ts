import { sceneNow } from '../sceneTime';
import { smoothstep } from '../easing';

// Animated heights of the area's slabs, per tile. Slabs rise and sink on the
// GPU from (from, to, t0); the same function gives frogs and eggs their base
// height on the CPU, so everything stays in sync without per-frame loops.

/** Seconds a slab takes to rise or sink: about as long as its sound (rise.m4a, sink.m4a). */
export const RISE_DUR = 0.26;

export interface TileFlags {
  x: number;
  y: number;
  stop: boolean;
  goal: boolean;
}

interface SlabAnim extends TileFlags {
  from: number;
  to: number;
  t0: number;
}

const key = (x: number, y: number) => `${x},${y}`;

function animValue(a: { from: number; to: number; t0: number }, t: number): number {
  const u = Math.min(1, Math.max(0, (t - a.t0) / RISE_DUR));
  return a.from + (a.to - a.from) * smoothstep(u);
}

class AreaField {
  anims = new Map<string, SlabAnim>();
  version = 0;

  reset() {
    this.anims.clear();
    this.version++;
  }

  /** 0..1 slab height at a tile right now. */
  heightAt(x: number, y: number, t = sceneNow()): number {
    const a = this.anims.get(key(Math.round(x), Math.round(y)));
    return a ? animValue(a, t) : 0;
  }

  /**
   * Set the area to exactly `tiles` (within the window). With `animate`,
   * new tiles rise and removed tiles sink; otherwise they appear instantly.
   * Returns how many started rising and sinking.
   */
  update(tiles: TileFlags[], animate: boolean): { rose: number; sank: number } {
    let rose = 0;
    let sank = 0;
    const now = sceneNow();
    const next = new Map<string, SlabAnim>();
    for (const tile of tiles) {
      const k = key(tile.x, tile.y);
      const cur = this.anims.get(k);
      if (cur && cur.to === 1) next.set(k, { ...cur, ...tile });
      else if (!animate) next.set(k, { ...tile, from: 1, to: 1, t0: 0 });
      else {
        next.set(k, { ...tile, from: cur ? animValue(cur, now) : 0, to: 1, t0: now });
        rose++;
      }
    }
    if (animate) {
      for (const [k, cur] of this.anims) {
        if (next.has(k)) continue;
        const h = animValue(cur, now);
        if (h < 0.002) continue;
        if (cur.to !== 0) sank++;
        next.set(k, cur.to === 0 ? cur : { ...cur, from: h, to: 0, t0: now });
      }
    }
    this.anims = next;
    this.version++;
    return { rose, sank };
  }

  /** Drop slabs that have finished sinking. Returns true if anything changed. */
  prune(): boolean {
    const now = sceneNow();
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

/** The field for the focused plane. */
export const field = new AreaField();
