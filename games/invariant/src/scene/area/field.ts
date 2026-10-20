import { clamp01, smoothstep } from '../easing';
import { sceneNow } from '../sceneTime';

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
  return a.from + (a.to - a.from) * smoothstep(clamp01((t - a.t0) / RISE_DUR));
}

class AreaField {
  anims = new Map<string, SlabAnim>();

  reset() {
    this.anims.clear();
  }

  heightAt(x: number, y: number): number {
    const a = this.anims.get(key(Math.round(x), Math.round(y)));
    return a ? animValue(a, sceneNow()) : 0;
  }

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
    return { rose, sank };
  }

  prune(): boolean {
    const now = sceneNow();
    let changed = false;
    for (const [k, a] of this.anims) {
      if (a.to === 0 && now - a.t0 > RISE_DUR) {
        this.anims.delete(k);
        changed = true;
      }
    }
    return changed;
  }
}

export const field = new AreaField();
