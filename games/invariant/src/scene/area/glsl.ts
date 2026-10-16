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
  float u = clamp((uTime - aAnim.z) / ${RISE_DUR.toFixed(3)}, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  return mix(aAnim.x, aAnim.y, u);
}
`;

// Eggs make room when a frog shares their tile: offset and scale glide from
// (from) to (to) starting at t0.
export const GLSL_SLOT = /* glsl */ `
attribute vec4 aSlot;      // from.xy, to.xy
attribute vec3 aSlotAnim;  // from scale, to scale, t0
vec3 slotNow() {
  float u = clamp((uTime - aSlotAnim.z) / 0.3, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
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
