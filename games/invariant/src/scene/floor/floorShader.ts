import type { CompiledLevel } from '../../levels/level';
import { GLSL_AXIS_LABELS } from '../shaders/axisLabels';
import { GLSL_COMMON } from '../shaders/common';
import { GLSL_GOAL } from '../shaders/goal';
import { levelGlsl } from './levelGlsl';

export const floorVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export function floorFragment(level: CompiledLevel) {
  return /* glsl */ `
precision highp float;
precision highp int;
varying vec3 vWorld;
uniform vec2 uHover;
uniform float uHoverOn;
uniform vec2 uCenter;
uniform vec2 uFade;
uniform float uOpacity;
uniform float uShowStop;
uniform float uShowGoal;
uniform float uShowAxes;
uniform vec3 uGap, uVoid, uTile, uStop, uHatch, uHoverCol, uCross, uLabel;
${GLSL_COMMON}
${GLSL_AXIS_LABELS}
${GLSL_GOAL}
${levelGlsl(level)}

bool existsAt(ivec2 t) { return uExists && L_exists(t); }
bool stopAt(ivec2 t) { return uShowStop > 0.002 && existsAt(t) && L_stop(t); }

void main() {
  vec2 p = vec2(vWorld.x, -vWorld.z);
  vec2 tc = floor(p + 0.5);
  vec2 f = p - tc;
  ivec2 t = ivec2(int(tc.x), int(tc.y));
  bool ex = existsAt(t);

  // derivatives up front, outside branches (they need uniform control flow)
  vec2 fw = fwidth(p);
  float fwr = fwidth(length(f));
  float ringD = abs(sdRoundBox(f, vec2(0.47), 0.13)) - 0.035;
  float fwRing = fwidth(ringD);
  float d = sdRoundBox(f, vec2(${(0.9 / 2).toFixed(3)}), 0.1);
  float aa = fwidth(d);
  float inside = 1.0 - smoothstep(-aa, aa, d);
  float hatchV = (p.x - p.y) * STOP_HATCH_FREQ;
  float hatch = stopHatch(hatchV, fwidth(hatchV));

  bool onCross = uHoverOn > 0.5 && (t.x == int(uHover.x) || t.y == int(uHover.y));
  vec3 col = uGap;
  if (ex) {
    bool st = stopAt(t);
    vec3 tcol = uTile;
    if (st) {
      tcol = mix(uTile, mix(uStop, uHatch, hatch), uShowStop);
    }
    if (onCross) tcol = mix(tcol, uCross * 0.96, st ? 0.45 : 0.9);
    if (st && uShowGoal > 0.002 && L_goal(t)) tcol = mix(tcol, drawGoal(tcol, f, fwr, tc), uShowGoal);
    if (uShowAxes > 0.002) {
      float m = axisLabelMask(f, t.xy);
      tcol = mix(tcol, uLabel, m * 0.9 * uShowAxes);
    }
    col = mix(uGap, tcol, inside);
    if (uShowGoal > 0.002) col = mix(col, SPLASH, splashAt(p) * 0.45 * uShowGoal);
  } else {
    vec3 ghost = mix(uVoid, uTile, 0.3);
    if (onCross) ghost = mix(ghost, uCross, 0.55);
    col = mix(uVoid, ghost, inside);
  }

  if (uHoverOn > 0.5 && t.x == int(uHover.x) && t.y == int(uHover.y)) {
    float a = 1.0 - smoothstep(-fwRing, fwRing, ringD);
    col = mix(col, uHoverCol, a);
  }

  float r = length(vWorld.xz - uCenter);
  float alpha = (1.0 - smoothstep(uFade.x, uFade.y, r)) * uOpacity;
  if (alpha < 0.003) discard;
  gl_FragColor = vec4(col, alpha);
  #include <colorspace_fragment>
}
`;
}
