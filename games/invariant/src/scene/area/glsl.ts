import * as THREE from 'three';
import { RISE_DUR } from './field';

// Per-instance snippets for the area's instanced meshes. Every instance has
// its tile (aTile) and the rise animation of the slab under it (aAnim: from,
// to, t0), so slabs, eggs and goal columns all rise and sink together.

/** heightNow(): the slab height under this instance right now (0..1). */
export const GLSL_HEIGHT = /* glsl */ `
attribute vec2 aTile;
attribute vec3 aAnim;
uniform float uTime;
float heightNow() {
  float u = smoothstep(0.0, 1.0, (uTime - aAnim.z) / ${RISE_DUR.toFixed(3)});
  return mix(aAnim.x, aAnim.y, u);
}
`;

// Eggs make room when a frog shares their tile: offset and scale glide from
// (from) to (to) over SLOT_DUR seconds, starting at t0.
export const SLOT_DUR = 0.3;
export const GLSL_SLOT = /* glsl */ `
attribute vec4 aSlot;      // from.xy, to.xy
attribute vec3 aSlotAnim;  // from scale, to scale, t0
vec3 slotNow() {
  float u = smoothstep(0.0, 1.0, (uTime - aSlotAnim.z) / ${SLOT_DUR.toFixed(3)});
  return vec3(mix(aSlot.xy, aSlot.zw, u), mix(aSlotAnim.x, aSlotAnim.y, u));
}
`;

// Eggs pop in when revealed, rippling out from the centre of the view.
export const GLSL_APPEAR = /* glsl */ `
uniform float uAppearT0;
uniform vec2 uAppearCenter;
float appearNow() {
  float delay = min(length(aTile - uAppearCenter) * 0.035, 0.7);
  float a = clamp((uTime - uAppearT0 - delay) / 0.38, 0.0, 1.0);
  // ease out with a little overshoot
  float c1 = 1.70158;
  float c3 = c1 + 1.0;
  return a <= 0.0 ? 0.0 : 1.0 + c3 * pow(a - 1.0, 3.0) + c1 * pow(a - 1.0, 2.0);
}
`;

/** An instanced copy of `base` with `count` instances and the given per-instance attributes ([array, item size]). */
export function instanced(base: THREE.BufferGeometry, count: number, attrs: Record<string, readonly [Float32Array, number]>) {
  const g = new THREE.InstancedBufferGeometry().copy(base as unknown as THREE.InstancedBufferGeometry);
  g.instanceCount = count;
  for (const [name, [array, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.InstancedBufferAttribute(array, size));
  return g;
}
