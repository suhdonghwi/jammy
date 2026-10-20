import * as THREE from 'three';
import { sceneNow } from './sceneTime';
import { MAX_EVENTS } from './shaders/common';

interface GoalEvent {
  x: number;
  y: number;
  plane: string;
  t: number;
}

const events: GoalEvent[] = [];

export const goalEvents = {
  push(x: number, y: number, plane: string) {
    const t = sceneNow();
    if (events.some((e) => e.x === x && e.y === y && e.plane === plane && t - e.t < 0.15)) return;
    events.push({ x, y, plane, t });
    if (events.length > MAX_EVENTS) events.shift();
  },
  fill(out: THREE.Vector3[], plane: string): number {
    let k = 0;
    let last = -100;
    for (let i = events.length - 1; i >= 0 && k < out.length; i--) {
      const e = events[i];
      if (e.plane !== plane) continue;
      out[k++].set(e.x, e.y, e.t);
      last = Math.max(last, e.t);
    }
    for (; k < out.length; k++) out[k].set(0, 0, -100);
    return last;
  },
  clear() {
    events.length = 0;
  },
};
