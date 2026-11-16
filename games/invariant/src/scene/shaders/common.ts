import * as THREE from 'three';
import { COLORS } from '../constants';

export const GLSL_COMMON = /* glsl */ `
// The stop region's stripes: one pattern for the floor and for slab tops.
const float STOP_HATCH_FREQ = 3.0;
float stopHatch(float v, float fw) {
  float s = fract(v);
  float e = clamp(fw, 0.02, 0.25);
  float h = smoothstep(0.0, e, s) * (1.0 - smoothstep(0.5 - e, 0.5, s));
  return mix(h, 0.45, smoothstep(0.3, 0.7, fw));
}
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
vec3 shadeLit(vec3 base, vec3 n) {
  vec3 L = normalize(vec3(0.45, 0.9, 0.35));
  float hemi = 0.5 + 0.5 * n.y;
  float diff = max(dot(n, L), 0.0);
  return base * (0.58 + 0.17 * hemi + 0.33 * diff);
}
`;

let blobTexture: THREE.Texture | null = null;
export function getBlobTexture(): THREE.Texture {
  if (blobTexture) return blobTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(40,50,70,0.55)');
  grad.addColorStop(0.45, 'rgba(40,50,70,0.32)');
  grad.addColorStop(1, 'rgba(40,50,70,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  blobTexture = new THREE.CanvasTexture(c);
  return blobTexture;
}

export const colorUniform = (c: keyof typeof COLORS) => ({ value: new THREE.Color(COLORS[c]) });
