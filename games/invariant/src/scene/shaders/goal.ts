import * as THREE from 'three';
import { COLORS } from '../constants';
import { goalEvents, MAX_EVENTS } from '../goalEvents';

export const GLSL_GOAL_PULSE = /* glsl */ `
uniform vec3 uEvents[${MAX_EVENTS}];
float tilePulse(vec2 tile, float dur, float rise, float fall) {
  float acc = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float age = uTime - e.z;
    if (age < 0.0 || age > dur) continue;
    if (abs(e.x - tile.x) > 0.5 || abs(e.y - tile.y) > 0.5) continue;
    float u = age / dur;
    acc = max(acc, smoothstep(0.0, rise, u) * pow(1.0 - u, fall));
  }
  return acc;
}
`;

export const GLSL_GOAL = /* glsl */ `
uniform vec3 uGoal;
uniform vec3 uPoolLight;
uniform vec3 uPoolDeep;
uniform float uTime;
uniform float uLastEvent;
${GLSL_GOAL_PULSE}

float sq(float x) {
  return x * x;
}

float rippleAt(vec2 p) {
  float acc = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float age = uTime - e.z;
    if (age < 0.0 || age > 1.6) continue;
    float d = length(p - e.xy);
    for (int k = 0; k < 2; k++) {
      float a = age - float(k) * 0.3;
      if (a < 0.0) continue;
      float rr = 0.03 + a * 0.5;
      float fade = pow(max(0.0, 1.0 - a / 1.25), 1.5);
      acc = max(acc, exp(-sq((d - rr) / 0.022)) * fade * (k == 0 ? 1.0 : 0.6));
    }
  }
  return acc;
}

float splashAt(vec2 p) {
  if (uTime - uLastEvent > 0.8) return 0.0;
  float acc = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float a = uTime - e.z;
    if (a < 0.0 || a > 0.8) continue;
    float d = length(p - e.xy);
    if (d > 1.0) continue;
    float rr = 0.3 + 0.45 * (1.0 - exp(-a * 4.0));
    float w = 0.02 + 0.02 * a;
    float fade = pow(max(0.0, 1.0 - a / 0.8), 2.0);
    acc = max(acc, exp(-sq((d - rr) / w)) * fade);
  }
  return acc;
}

const vec3 SPLASH = vec3(1.0, 0.8, 0.36);

vec3 drawGoal(vec3 col, vec2 f, float fwr, vec2 tc) {
  float aa = fwr * 1.3;
  float r = length(f);
  float pool = 1.0 - smoothstep(0.3 - aa, 0.3 + aa, r);
  vec2 n = r > 0.0 ? f / r : vec2(0.0);
  vec3 water = mix(uPoolLight, uPoolDeep, smoothstep(0.0, 0.3, r));
  float shade = smoothstep(0.12, 0.3, r) * max(dot(n, vec2(0.0, 1.0)), 0.0);
  water *= 1.0 - 0.12 * shade;
  water = mix(water, vec3(1.0, 0.98, 0.92), rippleAt(tc + f) * 0.75);
  float flash = tilePulse(tc, 0.8, 0.08, 2.0);
  water = mix(water, vec3(1.0, 0.97, 0.82), flash * 0.85);
  col = mix(col, SPLASH, flash * 0.55 * (1.0 - smoothstep(0.3, 0.46, r)));
  col = mix(col, water, pool);
  float edge = 1.0 - smoothstep(0.011 - aa, 0.011 + aa, abs(r - 0.3));
  col = mix(col, vec3(1.0, 0.98, 0.93), edge * max(-dot(n, vec2(0.0, 1.0)), 0.0) * 0.85);
  col = mix(col, mix(col, uGoal, 0.55) * 0.92, edge * max(dot(n, vec2(0.0, 1.0)), 0.0) * 0.55);
  return col;
}
`;

export function goalUniforms(): Record<string, THREE.IUniform> {
  return {
    uGoal: { value: new THREE.Color(COLORS.goal) },
    uPoolLight: { value: new THREE.Color(COLORS.poolLight) },
    uPoolDeep: { value: new THREE.Color(COLORS.poolDeep) },
    ...goalEvents.uniforms,
  };
}
