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
 * Goal tiles. Three styles are being explored (switchable in the HUD):
 *   0 portal  — a swirling vortex disc with a bright rim and core
 *   1 sparkle — a soft glowing pad (particles rise from it in 3D)
 *   2 ripple  — pulse rings expanding from a bright centre (with a light beam in 3D)
 */
export const GLSL_GOAL = /* glsl */ `
uniform vec3 uGoal;
uniform vec3 uGoalGlow;
uniform vec3 uPortalA;
uniform vec3 uPortalB;
uniform float uTime;
uniform int uGoalStyle;
// fwr: screen-space derivative of length(f), taken outside any branch.
// seed: per-tile value so neighbouring goals don't move in lockstep.
vec3 drawGoal(vec3 col, vec2 f, float fwr, float seed) {
  float aa = fwr * 1.3;
  float r = length(f);
  float a = atan(f.y, f.x);
  float pulse = 0.5 + 0.5 * sin(uTime * 2.0 + seed * 6.283);
  if (uGoalStyle == 0) {
    // portal
    float glow = pow(1.0 - smoothstep(0.2, 0.5, r), 1.5);
    col = mix(col, uPortalB, glow * (0.3 + 0.18 * pulse));
    float disk = 1.0 - smoothstep(0.29 - aa, 0.29 + aa, r);
    float swirl = 0.5 + 0.5 * sin(a * 3.0 - r * 26.0 + uTime * 2.6 + seed * 6.283);
    float depth = smoothstep(0.0, 0.29, r);
    vec3 inner = mix(uPortalA, uPortalB, swirl * 0.8 * depth + 0.2 * depth);
    inner = mix(vec3(1.0, 0.97, 0.9), inner, smoothstep(0.0, 0.11, r));
    col = mix(col, inner, disk);
    float rim = exp(-pow((r - 0.29) / 0.022, 2.0));
    col = mix(col, vec3(1.0, 0.96, 0.88), rim * (0.75 + 0.25 * pulse));
  } else if (uGoalStyle == 1) {
    // glowing pad
    float glow = pow(1.0 - smoothstep(0.05, 0.5, r), 1.4);
    col = mix(col, uGoalGlow, glow * (0.55 + 0.3 * pulse));
    float pad = 1.0 - smoothstep(0.2 - aa, 0.2 + aa, r);
    vec3 padCol = mix(vec3(1.0, 0.97, 0.88), uGoal, smoothstep(0.0, 0.2, r));
    col = mix(col, padCol, pad);
    float ring = exp(-pow((r - (0.26 + 0.02 * pulse)) / 0.014, 2.0));
    col = mix(col, uGoal, ring * 0.8);
  } else {
    // ripple
    for (int k = 0; k < 3; k++) {
      float ph = fract(uTime * 0.55 + float(k) / 3.0 + seed);
      float rr = 0.1 + ph * 0.36;
      float ring = exp(-pow((r - rr) / 0.018, 2.0)) * (1.0 - ph) * (1.0 - ph);
      col = mix(col, uGoal, ring * 0.95);
    }
    float glow = 1.0 - smoothstep(0.0, 0.3, r);
    col = mix(col, uGoalGlow, glow * 0.45);
    float dotm = 1.0 - smoothstep(0.1 - aa, 0.1 + aa, r);
    col = mix(col, mix(vec3(1.0, 0.96, 0.85), uGoal, 0.35), dotm);
  }
  return col;
}
`;

export const GOAL_STYLES = ['portal', 'sparkle', 'ripple'] as const;
export type GoalStyle = (typeof GOAL_STYLES)[number];

export function goalUniforms(): Record<string, THREE.IUniform> {
  return {
    uGoal: { value: new THREE.Color(COLORS.goal) },
    uGoalGlow: { value: new THREE.Color(COLORS.goalGlow) },
    uPortalA: { value: new THREE.Color(COLORS.portalA) },
    uPortalB: { value: new THREE.Color(COLORS.portalB) },
    uGoalStyle: { value: 0 },
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
