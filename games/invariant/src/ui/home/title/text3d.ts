import * as THREE from 'three';
import titleGlyphs from 'virtual:title-glyphs';
import type { GlyphCommand } from './glyphs';

// Extruded 3D text: each letter's outline (read from the font at build time,
// see scripts/title-glyphs.ts) becomes an extruded THREE shape.

function glyphShapes(path: GlyphCommand[], scale: number): THREE.Shape[] {
  const sp = new THREE.ShapePath();
  const s = scale;
  for (const c of path) {
    // font outlines are y-down; flip to y-up
    switch (c[0]) {
      case 'M':
        sp.moveTo(c[1] * s, -c[2] * s);
        break;
      case 'L':
        sp.lineTo(c[1] * s, -c[2] * s);
        break;
      case 'Q':
        sp.quadraticCurveTo(c[1] * s, -c[2] * s, c[3] * s, -c[4] * s);
        break;
      case 'C':
        sp.bezierCurveTo(c[1] * s, -c[2] * s, c[3] * s, -c[4] * s, c[5] * s, -c[6] * s);
        break;
      case 'Z':
        sp.currentPath?.closePath();
        break;
    }
  }
  if (sp.subPaths.length === 0) return [];
  // three's toShapes nests holes by containment, so contour orientation doesn't matter
  return sp.toShapes();
}

export interface LetterOptions {
  size: number;
  depth: number;
  letterSpacing: number;
}

/** One extruded geometry per glyph (for per-letter animation), laid out and centered as a word. */
export function letterGeometries(text: string, o: LetterOptions): { geom: THREE.BufferGeometry; x: number }[] {
  const { glyphs, kerning, unitsPerEm } = titleGlyphs;
  const scale = o.size / unitsPerEm;
  const bevel = o.size * 0.045;
  let x = 0;
  const out: { geom: THREE.BufferGeometry; x: number }[] = [];
  [...text].forEach((ch, i) => {
    const g = glyphs[ch];
    const shapes = glyphShapes(g.path, scale);
    if (shapes.length) {
      const geom = new THREE.ExtrudeGeometry(shapes, {
        depth: o.depth,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel * 0.8,
        bevelSegments: 5,
        curveSegments: 10,
      });
      geom.translate(0, 0, -o.depth / 2);
      out.push({ geom, x });
    }
    x += g.advance * scale + o.letterSpacing;
    const next = text[i + 1];
    if (next) x += (kerning[ch + next] ?? 0) * scale;
  });
  // center the word horizontally; baseline stays at y = 0
  const width = x - o.letterSpacing;
  out.forEach((l) => (l.x -= width / 2));
  return out;
}
