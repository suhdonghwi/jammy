// What the 3D title says, and the shape of its letters' outlines, which
// scripts/title-glyphs.ts reads from the font at build time.

export const LINE1 = 'Invariant';
export const LINE2 = 'Frog';

/** A glyph outline command, in font units (y down, baseline at 0), as opentype.js gives it. */
export type GlyphCommand =
  | readonly ['M' | 'L', number, number]
  | readonly ['Q', number, number, number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z'];

export interface TitleGlyphs {
  unitsPerEm: number;
  /** Each letter's advance width and outline. */
  glyphs: Record<string, { advance: number; path: GlyphCommand[] }>;
  /** Kerning between two letters (keyed by the pair), where it isn't 0. */
  kerning: Record<string, number>;
}
