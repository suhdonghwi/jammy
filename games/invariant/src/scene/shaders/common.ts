import * as THREE from 'three';
import { cameraRig } from '../cameraRig';
import type { CompiledLevel } from '../../levels/level';
import { COLORS } from '../constants';

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

/**
 * The glyph atlas's characters, in order (see getDigitTexture): the digits and
 * minus, the equals sign, and the lowercase letters that variable names use.
 */
const GLYPHS = '0123456789-=abcdefghijklmnopqrstuvwxyz';
/** An atlas cell's width in tile units, with its glyph centred in it. */
const CELL = 0.14;
/** Each glyph's advance in tile units, measured in the font the atlas is drawn in (set when it is drawn). */
const advance: number[] = [...GLYPHS].map(() => CELL * 0.8);
/** The labels' size, relative to the atlas's full-size glyphs (a little smaller, so they stay quiet). */
const LABEL_SIZE = 0.82;
/** Bumped when the atlas is drawn, so the label layouts are measured again. */
let atlasVersion = 0;

/**
 * The axes' labels in the near-left corner of a tile (local coords f in
 * [-0.5, 0.5]): "i=3" along the row y = 0 and "n=3" up the column x = 0, with
 * both on the corner tile, the second just above the first. Letters sit at
 * their own widths, digits at the widest digit's; a label too long for the
 * tile shrinks to fit. The names come from setAxisNames; without them (no
 * level) a label is just its number.
 */
export const GLSL_DIGITS = /* glsl */ `
uniform sampler2D uDigits;
uniform ivec3 uNameX, uNameY;
uniform int uNameXLen, uNameYLen;
/** Where each glyph of "name=" is centred, and the whole prefix's width. */
uniform vec4 uNameXMid, uNameYMid;
uniform float uNameXW, uNameYW;
uniform float uDigitW;
int nameGlyph(ivec3 name, int k) { return k == 0 ? name.x : (k == 1 ? name.y : name.z); }
float pick(vec4 v, int k) { return k == 0 ? v.x : (k == 1 ? v.y : (k == 2 ? v.z : v.w)); }
/** A glyph's ink at dx from its centre (tile units), at height vy (0 to 1). */
float glyphMask(int glyph, float dx, float vy) {
  float u = 0.5 + dx / ${CELL.toFixed(2)};
  if (u < 0.0 || u > 1.0) return 0.0;
  return texture2D(uDigits, vec2((float(glyph) + u) / ${GLYPHS.length.toFixed(1)}, vy)).a;
}
/** "name=v" on line \`row\` of the corner (0 at the bottom). */
float labelMask(vec2 f, ivec3 name, int nameLen, vec4 mid, float nameW, int v, float row) {
  int a = v < 0 ? -v : v;
  int digits = a >= 100 ? 3 : (a >= 10 ? 2 : 1);
  int numLen = digits + (v < 0 ? 1 : 0);
  float pw = nameLen > 0 ? nameW : 0.0;
  float w = pw + uDigitW * float(numLen);
  vec2 q = (f - vec2(-0.41, -0.42 + row * ${(0.26 * LABEL_SIZE).toFixed(3)})) / min(${LABEL_SIZE.toFixed(2)}, 0.82 / w);
  if (q.y < 0.0 || q.y > 0.23 || q.x < 0.0 || q.x >= w) return 0.0;
  float vy = q.y / 0.23;
  if (q.x < pw) {
    // the nearest of the name's letters and its '='
    int k = 0;
    for (int i = 1; i < 4; i++) {
      if (i <= nameLen && abs(q.x - pick(mid, i)) < abs(q.x - pick(mid, k))) k = i;
    }
    return glyphMask(k < nameLen ? nameGlyph(name, k) : 11, q.x - pick(mid, k), vy);
  }
  float x = (q.x - pw) / uDigitW;
  int j = int(floor(x));
  int glyph = 10;
  if (!(v < 0 && j == 0)) {
    int pos = numLen - 1 - j;
    int p10 = pos == 0 ? 1 : (pos == 1 ? 10 : 100);
    glyph = a / p10 - (a / (p10 * 10)) * 10;
  }
  return glyphMask(glyph, (fract(x) - 0.5) * uDigitW, vy);
}
float axisLabelMask(vec2 f, ivec2 t) {
  float m = 0.0;
  if (t.y == 0) m = labelMask(f, uNameX, uNameXLen, uNameXMid, uNameXW, t.x, 0.0);
  // the corner tile carries both (unnamed, just the one number)
  if (t.x == 0 && (t.y != 0 || uNameYLen > 0)) m = max(m, labelMask(f, uNameY, uNameYLen, uNameYMid, uNameYW, t.y, t.y == 0 ? 1.0 : 0.0));
  return m;
}
`;

/** Uniforms for the axes' labels in GLSL_DIGITS (set them with setAxisNames). */
export function axisNameUniforms() {
  return {
    uNameX: { value: [0, 0, 0] },
    uNameXLen: { value: 0 },
    uNameXMid: { value: [0, 0, 0, 0] },
    uNameXW: { value: 0 },
    uNameY: { value: [0, 0, 0] },
    uNameYLen: { value: 0 },
    uNameYMid: { value: [0, 0, 0, 0] },
    uNameYW: { value: 0 },
    uDigitW: { value: CELL },
  };
}

interface NameLayout {
  glyphs: number[];
  len: number;
  mid: number[];
  width: number;
}
const NO_NAME: NameLayout = { glyphs: [0, 0, 0], len: 0, mid: [0, 0, 0, 0], width: 0 };
const layouts = new Map<string, NameLayout>();

/** "name=" laid out at its letters' widths; a name the atlas can't write (or too long) gets none, and its labels are bare numbers. */
function nameLayout(name: string | undefined): NameLayout {
  const key = `${name}|${atlasVersion}`;
  const known = layouts.get(key);
  if (known) return known;
  const glyphs = [...(name ?? '')].map((c) => GLYPHS.indexOf(c));
  let out = NO_NAME;
  if (glyphs.length && glyphs.length <= 3 && !glyphs.includes(-1)) {
    const mid: number[] = [];
    let x = 0;
    for (const g of [...glyphs, GLYPHS.indexOf('=')]) {
      mid.push(x + advance[g] / 2);
      x += advance[g];
    }
    out = { glyphs: [...glyphs, 0, 0].slice(0, 3), len: glyphs.length, mid: [...mid, 0, 0, 0].slice(0, 4), width: x };
  }
  layouts.set(key, out);
  return out;
}

/** Write the level's axis names into the labels (none: bare numbers). Cheap enough to call every frame. */
export function setAxisNames(u: Record<string, THREE.IUniform>, level: CompiledLevel | null) {
  const x = nameLayout(level?.view.x);
  const y = nameLayout(level?.view.y);
  u.uNameX.value = x.glyphs;
  u.uNameXLen.value = x.len;
  u.uNameXMid.value = x.mid;
  u.uNameXW.value = x.width;
  u.uNameY.value = y.glyphs;
  u.uNameYLen.value = y.len;
  u.uNameYMid.value = y.mid;
  u.uNameYW.value = y.width;
  u.uDigitW.value = Math.max(...advance.slice(0, 10));
}

/**
 * Goal tiles: a soft, recessed pool of amber water (a light column rises over
 * it in 3D — see GoalColumns). When a frog lands on a goal, rings spread on
 * the water's surface.
 */
export const MAX_EVENTS = 24;
export const GLSL_GOAL = /* glsl */ `
uniform vec3 uGoal;
uniform vec3 uPoolLight;
uniform vec3 uPoolDeep;
uniform float uTime;
uniform vec3 uEvents[${MAX_EVENTS}];
/** Time of the most recent landing (lets surfaces skip the splash when idle). */
uniform float uLastEvent;

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

// A single soft ring that runs out of the pool to about the tile's edge (p in
// tile space). Drawn on every surface, so it reads even when the landed frog
// hides the pool itself.
float splashAt(vec2 p) {
  if (uTime - uLastEvent > 0.8) return 0.0;
  float acc = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float a = uTime - e.z;
    if (a < 0.0 || a > 0.8) continue;
    float d = length(p - e.xy);
    if (d > 1.0) continue;
    // fast at first, easing out
    float rr = 0.3 + 0.45 * (1.0 - exp(-a * 4.0));
    float w = 0.02 + 0.02 * a;
    float fade = pow(max(0.0, 1.0 - a / 0.8), 2.0);
    acc = max(acc, exp(-pow((d - rr) / w, 2.0)) * fade);
  }
  return acc;
}

// A bright flash of the pool itself right after a landing on this tile.
float flashAt(vec2 tc) {
  float acc = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float age = uTime - e.z;
    if (age < 0.0 || age > 0.8) continue;
    if (abs(e.x - tc.x) > 0.5 || abs(e.y - tc.y) > 0.5) continue;
    float u = age / 0.8;
    // quick rise, slow fall
    acc = max(acc, smoothstep(0.0, 0.08, u) * pow(1.0 - u, 2.0));
  }
  return acc;
}

const vec3 SPLASH = vec3(1.0, 0.8, 0.36);

// f: tile-local coords; fwr: derivative of length(f) taken outside any branch;
// tc: tile centre in tile space.
vec3 drawGoal(vec3 col, vec2 f, float fwr, vec2 tc) {
  float aa = fwr * 1.3;
  float r = length(f);
  float pool = 1.0 - smoothstep(0.3 - aa, 0.3 + aa, r);
  vec2 n = r > 0.0 ? f / r : vec2(0.0);
  // solid water in a soft, pale amber
  vec3 water = mix(uPoolLight, uPoolDeep, smoothstep(0.0, 0.3, r));
  // inner shadow toward the far rim, as if the pool is set into the tile
  float shade = smoothstep(0.12, 0.3, r) * max(dot(n, vec2(0.0, 1.0)), 0.0);
  water *= 1.0 - 0.12 * shade;
  water = mix(water, vec3(1.0, 0.98, 0.92), rippleAt(tc + f) * 0.75);
  float flash = flashAt(tc);
  water = mix(water, vec3(1.0, 0.97, 0.82), flash * 0.85);
  // a warm halo around the pool while it flashes
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
    uEvents: { value: Array.from({ length: MAX_EVENTS }, () => new THREE.Vector3(0, 0, -100)) },
    uLastEvent: { value: -100 },
  };
}

let digitTexture: THREE.CanvasTexture | null = null;

/**
 * The code font, as in the code panel: an axis label like `lo=-1` reads as the
 * assignment it is. All system fonts, so the atlas is drawn once, at once.
 */
const CODE_FONT = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace";

/** Glyph atlas for GLYPHS (digits, minus, '=' and the letters), in the code font. */
export function getDigitTexture(): THREE.CanvasTexture {
  if (digitTexture) return digitTexture;
  const canvas = document.createElement('canvas');
  const cw = 64;
  const chh = 104;
  canvas.width = cw * GLYPHS.length;
  canvas.height = chh;
  const tex = new THREE.CanvasTexture(canvas);
  // sampled inside branches: no mipmaps, so no implicit derivatives are needed
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.font = `600 84px ${CODE_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  [...GLYPHS].forEach((c, i) => {
    g.fillText(c, i * cw + cw / 2, chh - 18);
    advance[i] = (g.measureText(c).width / cw) * CELL;
  });
  atlasVersion++;
  tex.needsUpdate = true;
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

/**
 * Everything fades into the horizon colour with distance from the camera's
 * target, so the infinite plane has no hard edge.
 */
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

/** Follow the camera: the fade is centred on its target and widens as it zooms out. Returns the fade radius. */
export function updateFade(u: Record<string, THREE.IUniform>): number {
  const t = cameraRig.target();
  const R = Math.max(26, cameraRig.distance() * 2.6);
  (u.uCenter.value as THREE.Vector2).set(t.x, t.z);
  (u.uFade.value as THREE.Vector2).set(R * 0.62, R);
  return R;
}
