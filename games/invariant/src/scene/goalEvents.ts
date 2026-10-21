import * as THREE from 'three';
import { sceneNow } from './sceneTime';

export const MAX_EVENTS = 24;

interface GoalEvent {
  x: number;
  y: number;
  plane: string;
  t: number;
}

const events: GoalEvent[] = [];
let synced: string | null = null;

const uniforms = {
  uEvents: { value: Array.from({ length: MAX_EVENTS }, () => new THREE.Vector3(0, 0, -100)) },
  uLastEvent: { value: -100 },
};

export const goalEvents = {
  uniforms,
  push(x: number, y: number, plane: string) {
    const t = sceneNow();
    if (events.some((e) => e.x === x && e.y === y && e.plane === plane && t - e.t < 0.15)) return;
    events.push({ x, y, plane, t });
    if (events.length > MAX_EVENTS) events.shift();
    synced = null;
  },
  sync(plane: string) {
    if (synced === plane) return;
    const out = uniforms.uEvents.value;
    let k = 0;
    let last = -100;
    for (let i = events.length - 1; i >= 0 && k < out.length; i--) {
      const e = events[i];
      if (e.plane !== plane) continue;
      out[k++].set(e.x, e.y, e.t);
      last = Math.max(last, e.t);
    }
    for (; k < out.length; k++) out[k].set(0, 0, -100);
    uniforms.uLastEvent.value = last;
    synced = plane;
  },
  clear() {
    events.length = 0;
    synced = null;
  },
};
