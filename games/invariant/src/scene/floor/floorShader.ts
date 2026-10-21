import type { CompiledLevel } from '../../levels/level';
import { GLSL_COMMON, GLSL_DIGITS, GLSL_GOAL } from '../shaders/common';
import { GLSL_INT_HELPERS, levelGlsl } from './levelGlsl';

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
uniform vec3 uGap, uVoid, uTile, uStop, uHatch, uEdge, uHoverCol, uCross, uLabel;
${GLSL_COMMON}
${GLSL_DIGITS}
${GLSL_GOAL}
${GLSL_INT_HELPERS}
${levelGlsl(level)}

bool existsAt(ivec2 t) { return uExists && L_exists(t); }
bool stopAt(ivec2 t) { return uShowStop > 0.002 && existsAt(t) && L_stop(t); }
bool edgeBetween(ivec2 a, ivec2 b) { return existsAt(a) && existsAt(b) && stopAt(a) != stopAt(b); }

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

  bool onCross = uHoverOn > 0.5 && (t.x == int(uHover.x) || t.y == int(uHover.y));
  vec3 col = uGap;
  if (ex) {
    bool st = stopAt(t);
    vec3 tcol = uTile;
    if (st) {
      float s = fract((f.x - f.y) * 4.0);
      float hatch = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.42, 0.5, s));
      tcol = mix(uTile, mix(uStop, uHatch, hatch * 0.55), uShowStop);
    }
    if (uShowAxes > 0.002 && (t.x == 0 || t.y == 0)) tcol = mix(tcol, uCross, (st ? 0.35 : 0.6) * uShowAxes);
    if (onCross) tcol = st ? mix(tcol, uCross * vec3(0.9, 0.94, 1.0), 0.7) : mix(tcol, uCross, 0.9);
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

  if (uShowStop > 0.002) {
    float w = 0.045;
    float line = 0.0;
    // makes the boundary's corner arc concentric with the tile's rounded corner (half-size 0.45, radius 0.1)
    const float RC = 0.15;
    vec2 V = floor(p) + 0.5;
    vec2 local = p - V;
    ivec2 cSW = ivec2(int(floor(p.x)), int(floor(p.y)));
    ivec2 cSE = cSW + ivec2(1, 0);
    ivec2 cNW = cSW + ivec2(0, 1);
    ivec2 cNE = cSW + ivec2(1, 1);
    bool inCorner = max(abs(local.x), abs(local.y)) < RC
      && existsAt(cSW) && existsAt(cSE) && existsAt(cNW) && existsAt(cNE);
    if (inCorner) {
      bool sw = stopAt(cSW);
      bool se = stopAt(cSE);
      bool nw = stopAt(cNW);
      bool ne = stopAt(cNE);
      bool up = nw != ne;
      bool down = sw != se;
      bool right = ne != se;
      bool left = nw != sw;
      int count = int(up) + int(down) + int(right) + int(left);
      float d = 1e3;
      if (count == 2 && up && down) d = abs(local.x);
      else if (count == 2 && left && right) d = abs(local.y);
      else if (count == 2) {
        vec2 dir = vec2(right ? 1.0 : -1.0, up ? 1.0 : -1.0);
        d = abs(length(local - dir * RC) - RC);
      } else if (count == 4) d = min(abs(local.x), abs(local.y));
      float fwl = length(fw);
      line = 1.0 - smoothstep(w - fwl, w + fwl, d);
    } else {
      int kx = int(floor(p.x));
      float dx = abs(p.x - (float(kx) + 0.5));
      int ty = int(floor(p.y + 0.5));
      float fy = p.y - float(ty);
      bool edgeV = edgeBetween(ivec2(kx, ty), ivec2(kx + 1, ty));
      if (!edgeV && abs(fy) > 0.5 - w) {
        int ty2 = ty + (fy > 0.0 ? 1 : -1);
        edgeV = edgeBetween(ivec2(kx, ty2), ivec2(kx + 1, ty2));
      }
      if (edgeV) line = max(line, 1.0 - smoothstep(w - fw.x, w + fw.x, dx));
      int ky = int(floor(p.y));
      float dy = abs(p.y - (float(ky) + 0.5));
      int tx = int(floor(p.x + 0.5));
      float fx = p.x - float(tx);
      bool edgeH = edgeBetween(ivec2(tx, ky), ivec2(tx, ky + 1));
      if (!edgeH && abs(fx) > 0.5 - w) {
        int tx2 = tx + (fx > 0.0 ? 1 : -1);
        edgeH = edgeBetween(ivec2(tx2, ky), ivec2(tx2, ky + 1));
      }
      if (edgeH) line = max(line, 1.0 - smoothstep(w - fw.y, w + fw.y, dy));
    }
    col = mix(col, uEdge, line * uShowStop);
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
