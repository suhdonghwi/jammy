import * as THREE from 'three';
import fredokaUrl from '@fontsource/fredoka/files/fredoka-latin-600-normal.woff?url';
import { COLORS } from './constants';

// Shared GLSL snippets and textures for the custom tile / slab / egg shaders.

export const GLSL_COMMON = /* glsl */ `
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

/** Draws a number in the near-left corner of a tile (local coords f in [-0.5, 0.5]). */
export const GLSL_DIGITS = /* glsl */ `
uniform sampler2D uDigits;
float numberMask(vec2 f, int v) {
  int a = v < 0 ? -v : v;
  int digits = a >= 100 ? 3 : (a >= 10 ? 2 : 1);
  int n = digits + (v < 0 ? 1 : 0);
  vec2 o = vec2(-0.41, -0.42);
  vec2 cs = vec2(0.105, 0.17);
  vec2 q = (f - o) / cs;
  if (q.y < 0.0 || q.y > 1.0 || q.x < 0.0 || q.x >= float(n)) return 0.0;
  int k = int(floor(q.x));
  int glyph = 10;
  if (!(v < 0 && k == 0)) {
    int pos = n - 1 - k;
    int p10 = pos == 0 ? 1 : (pos == 1 ? 10 : 100);
    glyph = a / p10 - (a / (p10 * 10)) * 10;
  }
  vec2 uv = vec2((float(glyph) + fract(q.x)) / 11.0, q.y);
  return texture2D(uDigits, uv).a;
}
`;

/**
 * Goal tiles — a pool of amber water set into the surface. Variants being
 * explored (switchable in the HUD):
 *   0 well    — a flat recessed pool (painted inner shadow and lit rim)
 *   1 deep    — a real-looking round hole: parallax into the surface, inner wall, water at the bottom
 *   2 basin   — the same, but a rounded square following the tile
 *   3 shimmer — the flat well with a slow, faint caustic shimmer
 * When a frog lands on a goal, rings spread on the water's surface.
 */
export const MAX_EVENTS = 24;
export const GLSL_GOAL = /* glsl */ `
uniform vec3 uGoal;
uniform vec3 uGoalGlow;
uniform float uTime;
uniform int uGoalStyle;
uniform vec3 uEvents[${MAX_EVENTS}];

// rings on the water from recent landings (p in tile space)
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
      acc = max(acc, exp(-pow((d - rr) / 0.022, 2.0)) * fade * (k == 0 ? 1.0 : 0.6));
    }
  }
  return acc;
}

vec3 waterAt(vec2 fb, vec2 tc, float seed, float R) {
  float r = length(fb);
  vec3 c = mix(uGoalGlow, uGoal, 0.3 + 0.45 * smoothstep(0.0, R, r));
  if (uGoalStyle == 3) {
    float w = sin(fb.x * 21.0 + uTime * 0.9 + seed * 6.0) * sin(fb.y * 18.0 - uTime * 0.7 + seed * 3.0);
    float w2 = sin((fb.x + fb.y) * 15.0 - uTime * 0.6);
    c = mix(c, vec3(1.0, 0.95, 0.8), smoothstep(0.55, 1.0, w * 0.7 + w2 * 0.3) * 0.22);
  }
  c = mix(c, vec3(1.0, 0.97, 0.88), rippleAt(tc + fb) * 0.8);
  return c;
}

float holeSd(vec2 q) {
  return uGoalStyle == 2 ? sdRoundBox(q, vec2(0.34), 0.13) : length(q) - 0.3;
}

// f: tile-local coords; fwr/fwd: derivatives taken outside any branch;
// tc: tile centre; V: direction to the camera in tile space (x, up, y).
vec3 drawGoal(vec3 col, vec2 f, float fwr, float seed, vec2 tc, vec3 V) {
  float aa = fwr * 1.3;
  if (uGoalStyle == 0 || uGoalStyle == 3) {
    float r = length(f);
    float pool = 1.0 - smoothstep(0.3 - aa, 0.3 + aa, r);
    vec2 n = r > 0.0 ? f / r : vec2(0.0);
    float shade = smoothstep(0.12, 0.3, r) * dot(n, vec2(0.0, 1.0));
    vec3 water = waterAt(f, tc, seed, 0.3) * (1.0 - 0.18 * max(shade, 0.0));
    col = mix(col, water, pool);
    float edge = 1.0 - smoothstep(0.012 - aa, 0.012 + aa, abs(r - 0.3));
    col = mix(col, vec3(1.0, 0.97, 0.9), edge * max(-dot(n, vec2(0.0, 1.0)), 0.0) * 0.9);
    col = mix(col, uGoal * 0.7, edge * max(dot(n, vec2(0.0, 1.0)), 0.0) * 0.6);
    return col;
  }
  // a hole with depth: follow the view ray down into the surface
  float sd0 = holeSd(f);
  float inside = 1.0 - smoothstep(-aa, aa, sd0);
  float D = 0.2;
  vec2 off = -vec2(V.x, V.z) * (D / max(V.y, 0.25));
  vec3 hole;
  if (holeSd(f + off) < 0.0) {
    // the ray reaches the water at the bottom
    hole = waterAt(f + off, tc, seed, 0.3) * 0.94;
  } else {
    // the ray hits the inner wall: find how deep
    float lo = 0.0;
    float hi = 1.0;
    for (int i = 0; i < 6; i++) {
      float m = (lo + hi) * 0.5;
      if (holeSd(f + m * off) < 0.0) lo = m;
      else hi = m;
    }
    vec2 wp = f + lo * off;
    vec2 g = vec2(holeSd(wp + vec2(0.01, 0.0)) - holeSd(wp - vec2(0.01, 0.0)), holeSd(wp + vec2(0.0, 0.01)) - holeSd(wp - vec2(0.0, 0.01)));
    vec2 nrm = normalize(g + 1e-6);
    float lit = 0.5 + 0.5 * dot(-nrm, normalize(vec2(-0.55, 0.85)));
    // the wall is the surrounding surface, darker the deeper it goes
    hole = col * mix(0.95, 0.62, lo) * (0.82 + 0.22 * lit);
  }
  // a thin lit lip along the rim
  float lip = (1.0 - smoothstep(0.0, 0.025 + aa, abs(sd0))) * 0.55;
  col = mix(col, hole, inside);
  col = mix(col, vec3(1.0), lip * (1.0 - inside * 0.4));
  return col;
}
`;

export const GOAL_STYLES = ['well', 'deep', 'basin', 'shimmer'] as const;
export type GoalStyle = (typeof GOAL_STYLES)[number];

export function goalUniforms(): Record<string, THREE.IUniform> {
  return {
    uGoal: { value: new THREE.Color(COLORS.goal) },
    uGoalGlow: { value: new THREE.Color(COLORS.goalGlow) },
    uGoalStyle: { value: 1 },
    uEvents: { value: Array.from({ length: MAX_EVENTS }, () => new THREE.Vector3(0, 0, -100)) },
  };
}

export const tileSeed = /* glsl */ `
float tileSeed(vec2 t) { return fract(sin(dot(t, vec2(12.9898, 78.233))) * 43758.5453); }
`;

let digitTexture: THREE.CanvasTexture | null = null;

/** Glyph atlas for 0-9 and '-', drawn with the UI font once it has loaded. */
export function getDigitTexture(): THREE.CanvasTexture {
  if (digitTexture) return digitTexture;
  const canvas = document.createElement('canvas');
  const cw = 64;
  const chh = 104;
  canvas.width = cw * 11;
  canvas.height = chh;
  const tex = new THREE.CanvasTexture(canvas);
  // sampled inside branches: no mipmaps, so no implicit derivatives are needed
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (family: string) => {
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#ffffff';
    g.font = `600 84px ${family}`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    const glyphs = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '−'];
    glyphs.forEach((c, i) => g.fillText(c, i * cw + cw / 2, chh - 18));
    tex.needsUpdate = true;
  };
  draw('ui-rounded, system-ui, sans-serif');
  const face = new FontFace('FredokaDigits', `url(${fredokaUrl})`);
  face
    .load()
    .then((f) => {
      document.fonts.add(f);
      draw('FredokaDigits');
    })
    .catch(() => {});
  digitTexture = tex;
  return tex;
}

let blobTexture: THREE.Texture | null = null;
/** Soft round shadow. */
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
