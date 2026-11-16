import * as THREE from 'three';
import type { CompiledLevel } from '../../levels/level';

const GLYPHS = '0123456789-=abcdefghijklmnopqrstuvwxyz';
const CELL = 0.14;
const advance: number[] = [...GLYPHS].map(() => CELL * 0.8);
const LABEL_SIZE = 0.82;

export const GLSL_AXIS_LABELS = /* glsl */ `
uniform sampler2D uDigits;
uniform ivec3 uNameX, uNameY;
uniform int uNameXLen, uNameYLen;
uniform vec4 uNameXMid, uNameYMid;
uniform float uNameXW, uNameYW;
uniform float uDigitW;
int nameGlyph(ivec3 name, int k) { return k == 0 ? name.x : (k == 1 ? name.y : name.z); }
float pick(vec4 v, int k) { return k == 0 ? v.x : (k == 1 ? v.y : (k == 2 ? v.z : v.w)); }
float glyphMask(int glyph, float dx, float vy) {
  float u = 0.5 + dx / ${CELL.toFixed(2)};
  if (u < 0.0 || u > 1.0) return 0.0;
  return texture2D(uDigits, vec2((float(glyph) + u) / ${GLYPHS.length.toFixed(1)}, vy)).a;
}
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
  if (t.x == 0 && (t.y != 0 || uNameYLen > 0)) m = max(m, labelMask(f, uNameY, uNameYLen, uNameYMid, uNameYW, t.y, t.y == 0 ? 1.0 : 0.0));
  return m;
}
`;

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

function nameLayout(name: string): NameLayout {
  const known = layouts.get(name);
  if (known) return known;
  getDigitTexture();
  const glyphs = [...name].map((c) => GLYPHS.indexOf(c));
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
  layouts.set(name, out);
  return out;
}

export function setAxisNames(u: Record<string, THREE.IUniform>, level: CompiledLevel) {
  const x = nameLayout(level.view.x);
  const y = nameLayout(level.view.y);
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

let digitTexture: THREE.CanvasTexture | null = null;

const CODE_FONT = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace";

export function getDigitTexture(): THREE.CanvasTexture {
  if (digitTexture) return digitTexture;
  const canvas = document.createElement('canvas');
  const cw = 64;
  const chh = 104;
  canvas.width = cw * GLYPHS.length;
  canvas.height = chh;
  const tex = new THREE.CanvasTexture(canvas);
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
  tex.needsUpdate = true;
  digitTexture = tex;
  return tex;
}
