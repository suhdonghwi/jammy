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

/** Goal emblem: a gold coin with a white star (signed distances, crisp at any zoom). */
export const GLSL_GOAL = /* glsl */ `
uniform vec3 uGoal;
float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
uniform vec3 uGoalGlow;
uniform float uTime;
// fwr: screen-space derivative of length(f), taken outside any branch.
// seed: per-tile value so neighbouring goals don't pulse in lockstep.
vec3 drawGoal(vec3 col, vec2 f, float fwr, float seed) {
  float aa = fwr * 1.3;
  float r = length(f);
  float pulse = 0.5 + 0.5 * sin(uTime * 2.1 + seed * 6.283);
  // warm glow spreading over the tile, breathing slowly
  float glow = pow(1.0 - smoothstep(0.08, 0.5, r), 1.6);
  col = mix(col, uGoalGlow, glow * (0.55 + 0.35 * pulse));
  // a soft bright ring of light that swells with the pulse
  float halo = exp(-pow((r - (0.33 + 0.03 * pulse)) / 0.045, 2.0));
  col = mix(col, vec3(1.0, 0.93, 0.7), halo * (0.35 + 0.35 * pulse));
  // the coin, lit from the top-left
  float coin = 1.0 - smoothstep(0.27 - aa, 0.27 + aa, r);
  vec3 gold = mix(uGoal * 1.15, uGoal * 0.88, clamp(0.5 - (f.y - f.x) * 1.1, 0.0, 1.0));
  col = mix(col, gold, coin);
  float rim = 1.0 - smoothstep(0.02 - aa, 0.02 + aa, abs(r - 0.245));
  col = mix(col, uGoal * 0.74, rim * coin);
  // a sheen that sweeps across the coin now and then
  float sweep = fract(uTime * 0.28 + seed) * 2.2 - 1.1;
  float sheen = 1.0 - smoothstep(0.0, 0.07, abs((f.x + f.y) * 0.707 - sweep));
  col = mix(col, vec3(1.0, 0.98, 0.9), sheen * coin * 0.55);
  // white star, breathing a little with the glow
  float st = sdStar5(f + vec2(0.0, 0.01), 0.15 + 0.01 * pulse, 0.46);
  float star = 1.0 - smoothstep(-aa, aa, st);
  col = mix(col, vec3(1.0, 0.99, 0.95), star);
  return col;
}
`;

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
