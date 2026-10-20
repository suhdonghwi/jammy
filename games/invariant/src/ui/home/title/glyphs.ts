export const LINE1 = 'Invariant';
export const LINE2 = 'Frog';

export type GlyphCommand =
  | readonly ['M' | 'L', number, number]
  | readonly ['Q', number, number, number, number]
  | readonly ['C', number, number, number, number, number, number]
  | readonly ['Z'];

export interface TitleGlyphs {
  unitsPerEm: number;
  glyphs: Record<string, { advance: number; path: GlyphCommand[] }>;
  kerning: Record<string, number>;
}
