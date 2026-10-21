import * as THREE from 'three';
import { LINE1, LINE2, type TitleGlyphs } from './glyphs.ts';
import { letterGeometries, type LetterOptions } from './text3d.ts';

export const SIZE = 1;
export const LINE_GAP = 1.18;
export const WAVE = 0.08;
export const OUTLINE = 0.02;
export const FOV = 18;
// Measured from computeLayout(); fixed so the block has its size before the canvas starts. Update it if the letters change.
export const TITLE_ASPECT = 1.95;

export const letterOpts: LetterOptions = { size: SIZE, depth: SIZE * 0.42, gap: OUTLINE, drift: WAVE * 0.25 };

export type TitleAlign = 'left' | 'center';

function measure(glyphs: TitleGlyphs, text: string, opts: LetterOptions) {
  const ls = letterGeometries(glyphs, text, opts);
  let min = Infinity;
  let max = -Infinity;
  let o = { index: -1, x: 0, top: 0 };
  ls.forEach((l, i) => {
    l.geom.computeBoundingBox();
    const bb = l.geom.boundingBox!;
    min = Math.min(min, l.x + bb.min.x);
    max = Math.max(max, l.x + bb.max.x);
    if (o.index < 0 && text[i] === 'o') o = { index: i, x: l.x + (bb.min.x + bb.max.x) / 2, top: bb.max.y };
    l.geom.dispose();
  });
  return { min, max, o, xs: ls.map((l) => l.x) };
}

function place(glyphs: TitleGlyphs, align: TitleAlign, opts1: LetterOptions, opts2: LetterOptions) {
  const m1 = measure(glyphs, LINE1, opts1);
  const m2 = measure(glyphs, LINE2, opts2);
  const indent2 = align === 'center' ? (m1.max - m1.min - (m2.max - m2.min)) / 2 : 0;
  return {
    x1: -m1.min,
    x2: -m2.min + indent2,
    o: { ...m2.o, x: m2.o.x - m2.min + indent2 },
    left: -OUTLINE,
    right: Math.max(m1.max - m1.min, m2.max - m2.min) + OUTLINE,
    bottom: -0.32,
    top: LINE_GAP + 0.9,
    xs1: m1.xs,
    xs2: m2.xs,
  };
}

export type TitleLayout = ReturnType<typeof place>;

export function cameraFor(L: TitleLayout, fov: number, aspect: number) {
  const pad = 0.04;
  const W = L.right - L.left + pad * 2;
  const H = L.top - L.bottom + pad * 2;
  const half = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const dist = Math.max(H, W / aspect) / (2 * half);
  return new THREE.Vector3((L.left + L.right) / 2, (L.top + L.bottom) / 2, dist + 0.3);
}

export function computeLayout(glyphs: TitleGlyphs, align: TitleAlign): TitleLayout {
  const L = place(glyphs, align, letterOpts, letterOpts);
  const eye = cameraFor(L, FOV, TITLE_ASPECT);
  const opts1 = { ...letterOpts, eye: eye.clone().sub(new THREE.Vector3(L.x1, LINE_GAP, 0)) };
  const opts2 = { ...letterOpts, eye: eye.clone().sub(new THREE.Vector3(L.x2, 0, 0)) };
  return place(glyphs, align, opts1, opts2);
}
