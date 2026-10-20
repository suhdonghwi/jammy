import * as THREE from 'three';
import { RISE_DUR } from './field';

export const GLSL_HEIGHT = /* glsl */ `
attribute vec2 aTile;
attribute vec3 aAnim;
uniform float uTime;
float heightNow() {
  float u = smoothstep(0.0, 1.0, (uTime - aAnim.z) / ${RISE_DUR.toFixed(3)});
  return mix(aAnim.x, aAnim.y, u);
}
`;

export const SLOT_DUR = 0.3;
export const GLSL_SLOT = /* glsl */ `
attribute vec4 aSlot;
attribute vec3 aSlotAnim;
vec3 slotNow() {
  float u = smoothstep(0.0, 1.0, (uTime - aSlotAnim.z) / ${SLOT_DUR.toFixed(3)});
  return vec3(mix(aSlot.xy, aSlot.zw, u), mix(aSlotAnim.x, aSlotAnim.y, u));
}
`;

export const GLSL_APPEAR = /* glsl */ `
uniform float uAppearT0;
uniform vec2 uAppearCenter;
float appearNow() {
  float delay = min(length(aTile - uAppearCenter) * 0.035, 0.7);
  float a = clamp((uTime - uAppearT0 - delay) / 0.38, 0.0, 1.0);
  // easeOutBack
  float c1 = 1.70158;
  float c3 = c1 + 1.0;
  return a <= 0.0 ? 0.0 : 1.0 + c3 * pow(a - 1.0, 3.0) + c1 * pow(a - 1.0, 2.0);
}
`;

export function instanced(base: THREE.BufferGeometry, count: number, attrs: Record<string, readonly [Float32Array, number]>) {
  const g = new THREE.InstancedBufferGeometry().copy(base as unknown as THREE.InstancedBufferGeometry);
  g.instanceCount = count;
  for (const [name, [array, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.InstancedBufferAttribute(array, size));
  return g;
}
