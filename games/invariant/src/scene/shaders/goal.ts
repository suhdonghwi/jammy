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
uniform vec3 uGoalGround;
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

// A goal is a kind of ground: plain amber, the same on the floor and in a slab's window.
// p is the point in plane coordinates, tc its tile. A frog stopping here flashes it and rings it.
vec3 goalGround(vec2 p, vec2 tc) {
  vec3 g = uGoalGround;
  g = mix(g, vec3(1.0, 0.97, 0.86), rippleAt(p) * 0.55);
  float flash = tilePulse(tc, 0.8, 0.08, 2.0);
  return mix(g, vec3(1.0, 0.96, 0.8), flash * 0.8);
}
`;

export function goalUniforms(): Record<string, THREE.IUniform> {
  return {
    uGoal: { value: new THREE.Color(COLORS.goal) },
    uGoalGround: { value: new THREE.Color(COLORS.goalGround) },
    ...goalEvents.uniforms,
  };
}
