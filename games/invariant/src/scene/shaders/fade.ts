import * as THREE from 'three';
import { cameraFog, cameraRig } from '../cameraRig';
import { colorUniform } from './common';

export const GLSL_FADE = /* glsl */ `
uniform vec2 uCenter;
uniform vec2 uFade;
uniform vec3 uHorizon;
vec3 applyFade(vec3 col, vec3 world) {
  float r = length(world.xz - uCenter);
  return mix(col, uHorizon, smoothstep(uFade.x, uFade.y, r));
}
`;

export function fadeUniforms(): Record<string, THREE.IUniform> {
  return {
    uCenter: { value: new THREE.Vector2() },
    uFade: { value: new THREE.Vector2(20, 30) },
    uHorizon: colorUniform('horizon'),
  };
}

const FOGGED = 0.04;

export const clearRadius = () => Math.max(26, cameraRig.distance() * 2.6);

export const fadeRadius = () => clearRadius() * (FOGGED + (1 - FOGGED) * cameraFog());

export function updateFade(u: Record<string, THREE.IUniform>): number {
  const t = cameraRig.target();
  const R = fadeRadius();
  (u.uCenter.value as THREE.Vector2).set(t.x, t.z);
  (u.uFade.value as THREE.Vector2).set(R * 0.62, R);
  return R;
}
