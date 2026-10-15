import fredokaBold from '@fontsource/fredoka/files/fredoka-latin-700-normal.woff?url';
import opentype from 'opentype.js';
import { useEffect, useState } from 'react';
import * as THREE from 'three';

// Extruded 3D text from a bundled font (no CDN): opentype.js parses the WOFF
// and each glyph outline becomes an extruded THREE shape.

let fontPromise: Promise<opentype.Font> | null = null;

/** The title font, once it has loaded (null until then). */
export function useTitleFont(): opentype.Font | null {
  const [font, setFont] = useState<opentype.Font | null>(null);
  useEffect(() => {
    let alive = true;
    fontPromise ??= fetch(fredokaBold)
      .then((r) => r.arrayBuffer())
      .then((buf) => opentype.parse(buf));
    void fontPromise.then((f) => alive && setFont(f));
    return () => {
      alive = false;
    };
  }, []);
  return font;
}

function glyphShapes(path: opentype.Path): THREE.Shape[] {
  const sp = new THREE.ShapePath();
  for (const c of path.commands) {
    // opentype paths are y-down; flip to y-up
    switch (c.type) {
      case 'M':
        sp.moveTo(c.x, -c.y);
        break;
      case 'L':
        sp.lineTo(c.x, -c.y);
        break;
      case 'Q':
        sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
        break;
      case 'C':
        sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
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
export function letterGeometries(font: opentype.Font, text: string, o: LetterOptions): { geom: THREE.BufferGeometry; x: number }[] {
  const glyphs = font.stringToGlyphs(text);
  const scale = o.size / font.unitsPerEm;
  const bevel = o.size * 0.045;
  let x = 0;
  const out: { geom: THREE.BufferGeometry; x: number }[] = [];
  glyphs.forEach((g, i) => {
    const shapes = glyphShapes(g.getPath(0, 0, o.size));
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
    x += (g.advanceWidth ?? 0) * scale + o.letterSpacing;
    const next = glyphs[i + 1];
    if (next) x += font.getKerningValue(g, next) * scale;
  });
  // center the word horizontally; baseline stays at y = 0
  const width = x - o.letterSpacing;
  out.forEach((l) => (l.x -= width / 2));
  return out;
}
