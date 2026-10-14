import * as THREE from 'three';
import { clock } from './constants';
import { MAX_EVENTS } from './shaders';

// Frogs arriving on a goal send out a ripple. The floor and slab shaders read
// the most recent arrivals as a small uniform array of (x, y, time).

interface GoalEvent {
  x: number;
  y: number;
  pond: number | undefined;
  t: number;
}

const events: GoalEvent[] = [];

export const goalEvents = {
  push(x: number, y: number, pond: number | undefined) {
    const t = clock.now();
    // several frogs landing on the same goal at once make one ripple
    if (events.some((e) => e.x === x && e.y === y && e.pond === pond && t - e.t < 0.15)) return;
    events.push({ x, y, pond, t });
    if (events.length > MAX_EVENTS) events.shift();
  },
  /** Copy recent events for a pond into a shader uniform array. */
  fill(out: THREE.Vector3[], pond: number | undefined) {
    let k = 0;
    for (let i = events.length - 1; i >= 0 && k < out.length; i--) {
      const e = events[i];
      if (e.pond !== pond) continue;
      out[k++].set(e.x, e.y, e.t);
    }
    for (; k < out.length; k++) out[k].set(0, 0, -100);
  },
  clear() {
    events.length = 0;
  },
};
