import * as THREE from 'three';
import { cameraRig } from '../cameraRig';
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

export const fadeRadius = () => Math.max(26, cameraRig.distance() * 2.6);

const VIEW_MARGIN = 3;
const corner = new THREE.Vector3();

export function viewRadius(): number {
  const R = fadeRadius();
  const camera = cameraRig.controls?.camera;
  if (!camera) return R;
  camera.updateMatrixWorld();
  const { x: tx, z: tz } = cameraRig.target();
  const eye = camera.position;
  let reach = 0;
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    corner.set(sx, sy, 0.5).unproject(camera).sub(eye);
    if (corner.y > -1e-4) return R;
    const k = -eye.y / corner.y;
    reach = Math.max(reach, Math.hypot(eye.x + corner.x * k - tx, eye.z + corner.z * k - tz));
  }
  return Math.min(R, reach + VIEW_MARGIN);
}

export function updateFade(u: Record<string, THREE.IUniform>): number {
  const t = cameraRig.target();
  const R = fadeRadius();
  (u.uCenter.value as THREE.Vector2).set(t.x, t.z);
  (u.uFade.value as THREE.Vector2).set(R * 0.62, R);
  return R;
}
