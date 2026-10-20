import * as THREE from 'three';
import titleGlyphs from 'virtual:title-glyphs';
import type { GlyphCommand } from './glyphs';

// Extruded 3D text: each letter's outline (read from the font at build time,
// see scripts/title-glyphs.ts) becomes an extruded THREE shape.

function glyphShapes(path: GlyphCommand[], scale: number): THREE.Shape[] {
  const sp = new THREE.ShapePath();
  for (const c of path) {
    // font outlines are y-down; flip to y-up
    switch (c[0]) {
      case 'M':
        sp.moveTo(c[1] * scale, -c[2] * scale);
        break;
      case 'L':
        sp.lineTo(c[1] * scale, -c[2] * scale);
        break;
      case 'Q':
        sp.quadraticCurveTo(c[1] * scale, -c[2] * scale, c[3] * scale, -c[4] * scale);
        break;
      case 'C':
        sp.bezierCurveTo(c[1] * scale, -c[2] * scale, c[3] * scale, -c[4] * scale, c[5] * scale, -c[6] * scale);
        break;
      case 'Z':
        sp.currentPath?.closePath();
        break;
    }
  }
  // three's toShapes nests holes by containment, so contour orientation doesn't matter
  return sp.toShapes();
}

export interface LetterOptions {
  size: number;
  depth: number;
  /** The least room between two letters on screen, for their outlines: neighbours never come closer. */
  gap: number;
  /** How far neighbours may shift up or down against each other (in the wave), so they keep clear of each other there too. */
  drift: number;
  /**
   * The camera, relative to the word's centre on its baseline. Seen in
   * perspective, a letter's side shows toward the middle, so letters are
   * spaced by how they look from here; without it, as if seen from far away.
   */
  eye?: THREE.Vector3Like;
}

/** Height bands the letters are compared in when spacing them. */
const BAND = 0.01;

/**
 * Where the front half of a letter's triangle edges cross each height band on
 * screen (on the plane z = 0, seen from `eye`): each crossing as its x in the
 * letter and the factor k perspective scales it by about the eye. Far away, k
 * is 1.
 */
function profile(geom: THREE.BufferGeometry, eye: THREE.Vector3Like | undefined) {
  const pos = geom.getAttribute('position');
  const bands = new Map<number, { x: number; k: number }[]>();
  const n = pos.count;
  const px = new Float64Array(n);
  const py = new Float64Array(n);
  const pk = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // only the front half counts: further back, a letter's side tucks behind its neighbour
    // (its sides run straight back, so this cuts them off at the middle)
    const k = eye ? eye.z / (eye.z - Math.max(pos.getZ(i), 0)) : 1;
    px[i] = pos.getX(i);
    py[i] = eye ? eye.y + (pos.getY(i) - eye.y) * k : pos.getY(i);
    pk[i] = k;
  }
  const edge = (i: number, j: number) => {
    const lo = Math.ceil(Math.min(py[i], py[j]) / BAND);
    const hi = Math.floor(Math.max(py[i], py[j]) / BAND);
    for (let b = lo; b <= hi; b++) {
      const t = py[i] === py[j] ? 0 : (b * BAND - py[i]) / (py[j] - py[i]);
      let list = bands.get(b);
      if (!list) bands.set(b, (list = []));
      list.push({ x: px[i] + (px[j] - px[i]) * t, k: pk[i] + (pk[j] - pk[i]) * t });
      if (py[i] === py[j]) list.push({ x: px[j], k: pk[j] });
    }
  };
  for (let t = 0; t < n; t += 3) {
    edge(t, t + 1);
    edge(t + 1, t + 2);
    edge(t + 2, t);
  }
  return bands;
}

type Profile = ReturnType<typeof profile>;

/**
 * Where the right letter must start for it to stay `gap` clear on screen of
 * the left one (starting at `left`) at every height, even shifted `drift` up
 * or down against it. `ex` is the eye's x.
 */
function clearance(left: number, lp: Profile, rp: Profile, ex: number, gap: number, drift: number) {
  // the left letter's right edge on screen, by band
  const edgeL = new Map<number, number>();
  lp.forEach((pts, b) => edgeL.set(b, Math.max(...pts.map((p) => ex + (left + p.x - ex) * p.k))));
  const reach = Math.ceil(drift / BAND);
  let need = -Infinity;
  rp.forEach((pts, b) => {
    let edge = -Infinity;
    for (let d = -reach; d <= reach; d++) edge = Math.max(edge, edgeL.get(b + d) ?? -Infinity);
    if (edge === -Infinity) return;
    // ex + (start + x - ex) k ≥ edge + gap, for every crossing
    for (const p of pts) need = Math.max(need, (edge + gap - ex) / p.k + ex - p.x);
  });
  return need;
}

/**
 * One extruded geometry per glyph (for per-letter animation), laid out and
 * centered as a word. Letters sit as the font spaces them, moved apart only
 * where they would come closer than `gap` on screen.
 */
export function letterGeometries(text: string, o: LetterOptions): { geom: THREE.BufferGeometry; x: number }[] {
  const { glyphs, kerning, unitsPerEm } = titleGlyphs;
  const scale = o.size / unitsPerEm;
  const bevel = o.size * 0.045;
  const letters = [...text].map((ch, i) => {
    const g = glyphs[ch];
    const shapes = glyphShapes(g.path, scale);
    let geom: THREE.BufferGeometry | null = null;
    if (shapes.length) {
      geom = new THREE.ExtrudeGeometry(shapes, {
        depth: o.depth,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: bevel * 0.8,
        bevelSegments: 5,
        curveSegments: 10,
      });
      geom.translate(0, 0, -o.depth / 2);
    }
    const next = text[i + 1];
    const advance = (g.advance + (next ? (kerning[ch + next] ?? 0) : 0)) * scale;
    return { geom, advance, profile: geom && profile(geom, o.eye) };
  });

  // Laid out from the first letter at x = 0. The eye is given from the
  // word's centre, which the layout itself moves: a few rounds settle it.
  let xs: number[] = [];
  let width = 0;
  for (let round = 0; round < (o.eye ? 3 : 1); round++) {
    const ex = (o.eye?.x ?? 0) + width / 2;
    let x = 0;
    let prev: { x: number; profile: Profile } | null = null;
    xs = letters.map((l) => {
      if (l.profile) {
        if (prev) x = Math.max(x, clearance(prev.x, prev.profile, l.profile, ex, o.gap, o.drift));
        prev = { x, profile: l.profile };
      }
      const at = x;
      x += l.advance;
      return at;
    });
    width = x;
  }
  // center the word horizontally; baseline stays at y = 0
  return letters.flatMap((l, i) => (l.geom ? [{ geom: l.geom, x: xs[i] - width / 2 }] : []));
}
