import fredokaUrl from '@fontsource/fredoka/files/fredoka-latin-600-normal.woff?url';
import * as THREE from 'three';
import { cameraRig } from '../cameraRig';
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
