import * as THREE from 'three';
import { SHORT } from '../../motion';
import { GLSL_BOARD } from '../planeShift';
import { MASK_SIZE } from './mask';

export const GLSL_MASK = /* glsl */ `
uniform highp sampler2D uMask;
uniform vec2 uMaskOrigin;
uniform highp sampler2D uMaskPrev;
uniform vec2 uMaskPrevOrigin;
uniform float uRise;
${GLSL_BOARD}
vec4 fetchMask(highp sampler2D mask, vec2 origin, vec2 tile) {
  ivec2 at = ivec2(floor(tile - origin + 0.5));
  if (at.x < 0 || at.y < 0 || at.x >= ${MASK_SIZE} || at.y >= ${MASK_SIZE}) return vec4(0.0);
  return texelFetch(mask, at, 0);
}
vec4 maskAt(vec2 tile) {
  return fetchMask(uMask, uMaskOrigin, tile);
}
vec4 maskPrevAt(vec2 tile) {
  return fetchMask(uMaskPrev, uMaskPrevOrigin, tile);
}
float heightOf(vec4 m) {
  return mix(m.g, m.r, uRise);
}
float maskBits(vec4 m) {
  return floor(m.a * 3.0 + 0.5);
}
float goalOf(vec4 m) {
  return mod(maskBits(m), 2.0);
}
float eggOf(vec4 m) {
  return step(1.5, maskBits(m));
}
vec4 maskShown(vec2 tile) {
  return uBoardPrev > 0.5 ? maskPrevAt(tile) : maskAt(tile);
}
float heightAt(vec2 tile) {
  return uBoardPrev > 0.5 ? maskPrevAt(tile).r : heightOf(maskAt(tile));
}
`;

export const GLSL_HEIGHT = /* glsl */ `
${GLSL_MASK}
attribute vec2 aTile;
uniform float uTime;
float heightNow() {
  return heightAt(aTile);
}
float eggNow() {
  return eggOf(maskShown(aTile));
}
float goalNow() {
  return goalOf(maskShown(aTile));
}
`;

export const SLOT_DUR = SHORT;
export const GLSL_SLOT = /* glsl */ `
attribute vec4 aSlot;
attribute vec3 aSlotAnim;
vec3 slotNow() {
  float u = smoothstep(0.0, 1.0, (uTime - aSlotAnim.z) / ${SLOT_DUR.toFixed(3)});
  return vec3(mix(aSlot.xy, aSlot.zw, u), mix(aSlotAnim.x, aSlotAnim.y, u));
}
`;

export const EGG_REGROW = SHORT;
export const GLSL_BACK = /* glsl */ `
attribute float aBack;
float backNow() {
  float b = clamp((uTime - aBack) / ${EGG_REGROW.toFixed(2)}, 0.0, 1.0);
  return 1.0 - pow(1.0 - b, 3.0);
}
`;

const APPEAR_OVERSHOOT = 1.70158;
export const GLSL_APPEAR = /* glsl */ `
uniform float uAppearT0;
uniform vec2 uAppearCenter;
float easeOutBack(float a) {
  float c1 = ${APPEAR_OVERSHOOT};
  float c3 = c1 + 1.0;
  return a <= 0.0 ? 0.0 : 1.0 + c3 * (a - 1.0) * (a - 1.0) * (a - 1.0) + c1 * (a - 1.0) * (a - 1.0);
}
float appearNow() {
  float delay = min(length(aTile - uAppearCenter) * 0.035, 0.7);
  float a = clamp((uTime - uAppearT0 - delay) / 0.38, 0.0, 1.0);
  return easeOutBack(a);
}
`;

export function instanced(base: THREE.BufferGeometry, count: number, attrs: Record<string, readonly [Float32Array, number]>) {
  const g = new THREE.InstancedBufferGeometry().copy(base as unknown as THREE.InstancedBufferGeometry);
  g.instanceCount = count;
  for (const [name, [array, size]] of Object.entries(attrs)) g.setAttribute(name, new THREE.InstancedBufferAttribute(array, size));
  return g;
}
