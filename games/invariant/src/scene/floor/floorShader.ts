import type { CompiledLevel } from '../../levels/level';
import { GLSL_COMMON, GLSL_DIGITS, GLSL_GOAL } from '../shaders/common';
import { GLSL_INT_HELPERS, levelGlsl } from '../shaders/levelGlsl';

// The floor is one big plane drawn per pixel: each pixel works out which tile
// it is on and asks the level's formulas (compiled to GLSL) whether that tile
// exists, is a stop tile, or a goal — so the plane is infinite with no
// per-tile geometry.

export const floorVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/** The floor for a level (its formulas compiled in), or a plain grid without one. */
export function floorFragment(level: CompiledLevel | null) {
  return /* glsl */ `
precision highp float;
precision highp int;
varying vec3 vWorld;
uniform int uPond;
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

// uShow* fade 0 → 1 when an element is revealed
bool stopAt(ivec3 t) { return uShowStop > 0.002 && L_exists(t) && L_stop(t); }
bool edgeBetween(ivec3 a, ivec3 b) { return L_exists(a) && L_exists(b) && stopAt(a) != stopAt(b); }

void main() {
  vec2 p = vec2(vWorld.x, -vWorld.z);
  vec2 tc = floor(p + 0.5);
  vec2 f = p - tc;
  ivec3 t = ivec3(int(tc.x), int(tc.y), uPond);
  bool ex = L_exists(t);

  // derivatives are taken up front (uniform control flow)
  // derivatives of the continuous coordinate (f jumps at tile borders)
  vec2 fw = fwidth(p);
  float fwr = fwidth(length(f));
  float ringD = abs(sdRoundBox(f, vec2(0.47), 0.13)) - 0.035;
  float fwRing = fwidth(ringD);
  float d = sdRoundBox(f, vec2(${(0.9 / 2).toFixed(3)}), 0.1);
  float aa = fwidth(d);
  float inside = 1.0 - smoothstep(-aa, aa, d);

  vec3 col = uGap;
  if (ex) {
    bool st = stopAt(t);
    vec3 tcol = uTile;
    if (st) {
      float s = fract((f.x - f.y) * 4.0);
      float hatch = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.42, 0.5, s));
      tcol = mix(uTile, mix(uStop, uHatch, hatch * 0.55), uShowStop);
    }
    bool onCross = uHoverOn > 0.5 && (t.x == int(uHover.x) || t.y == int(uHover.y));
    // the hovered tile's row and column, across striped tiles too (tinted
    // more lightly there, so the stripes still show through)
    if (onCross) tcol = st ? mix(tcol, uCross * vec3(0.9, 0.94, 1.0), 0.7) : mix(tcol, uCross, 0.9);
    if (st && uShowGoal > 0.002 && L_goal(t)) tcol = mix(tcol, drawGoal(tcol, f, fwr, tc), uShowGoal);
    if (uShowAxes > 0.002) {
      float m = 0.0;
      if (t.y == 0) m = numberMask(f, t.x);
      else if (t.x == 0) m = numberMask(f, t.y);
      tcol = mix(tcol, uLabel, m * 0.9 * uShowAxes);
    }
    col = mix(uGap, tcol, inside);
    if (uShowGoal > 0.002) col = mix(col, SPLASH, splashAt(p) * 0.45 * uShowGoal);

  } else {
    // no state can be here (ruled out by the precondition): a faint ghost of a
    // tile, so the plane doesn't just end, yet clearly not a place frogs go.
    // It still takes part in hovering (the row/column band, faintly).
    vec3 ghost = mix(uVoid, uTile, 0.3);
    bool onCross = uHoverOn > 0.5 && (t.x == int(uHover.x) || t.y == int(uHover.y));
    if (onCross) ghost = mix(ghost, uCross, 0.55);
    col = mix(uVoid, ghost, inside);
  }

  // Boundary between the continue and stop regions. Drawn from the grid lines
  // themselves (not per tile), so the line is continuous; segments extend by
  // their width past each end so corners close up.
  if (uShowStop > 0.002) {
    float w = 0.045;
    float line = 0.0;
    // Near a grid vertex where the boundary turns, follow a quarter-circle arc.
    // RC = 0.15 makes the arc concentric with the inner tile's rounded corner
    // (tile half-size 0.45, corner radius 0.1), so the line hugs that corner
    // with the same thin margin as along straight edges.
    const float RC = 0.15;
    vec2 V = floor(p) + 0.5;
    vec2 local = p - V;
    ivec3 cSW = ivec3(int(floor(p.x)), int(floor(p.y)), uPond);
    ivec3 cSE = cSW + ivec3(1, 0, 0);
    ivec3 cNW = cSW + ivec3(0, 1, 0);
    ivec3 cNE = cSW + ivec3(1, 1, 0);
    bool inCorner = max(abs(local.x), abs(local.y)) < RC
      && L_exists(cSW) && L_exists(cSE) && L_exists(cNW) && L_exists(cNE);
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
      // nearest vertical grid line x = kx + 0.5, between tiles kx and kx + 1
      int kx = int(floor(p.x));
      float dx = abs(p.x - (float(kx) + 0.5));
      int ty = int(floor(p.y + 0.5));
      float fy = p.y - float(ty);
      bool edgeV = edgeBetween(ivec3(kx, ty, uPond), ivec3(kx + 1, ty, uPond));
      if (!edgeV && abs(fy) > 0.5 - w) {
        int ty2 = ty + (fy > 0.0 ? 1 : -1);
        edgeV = edgeBetween(ivec3(kx, ty2, uPond), ivec3(kx + 1, ty2, uPond));
      }
      if (edgeV) line = max(line, 1.0 - smoothstep(w - fw.x, w + fw.x, dx));
      // nearest horizontal grid line y = ky + 0.5, between tiles ky and ky + 1
      int ky = int(floor(p.y));
      float dy = abs(p.y - (float(ky) + 0.5));
      int tx = int(floor(p.x + 0.5));
      float fx = p.x - float(tx);
      bool edgeH = edgeBetween(ivec3(tx, ky, uPond), ivec3(tx, ky + 1, uPond));
      if (!edgeH && abs(fx) > 0.5 - w) {
        int tx2 = tx + (fx > 0.0 ? 1 : -1);
        edgeH = edgeBetween(ivec3(tx2, ky, uPond), ivec3(tx2, ky + 1, uPond));
      }
      if (edgeH) line = max(line, 1.0 - smoothstep(w - fw.y, w + fw.y, dy));
    }
    col = mix(col, uEdge, line * uShowStop);
  }

  // The axes: a thin line in the gap just before the row of numbers (y = -0.5)
  // and just before the column (x = -0.5). AxisLabels puts an arrowhead and
  // the variable's name at their ends.
  if (uShowAxes > 0.002) {
    float aw = 0.03;
    float ax = 1.0 - smoothstep(aw - fw.y, aw + fw.y, abs(p.y + 0.5));
    float ay = 1.0 - smoothstep(aw - fw.x, aw + fw.x, abs(p.x + 0.5));
    col = mix(col, uLabel, max(ax, ay) * 0.85 * uShowAxes);
  }

  // hover cursor: a crisp rounded outline around the inspected tile
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
