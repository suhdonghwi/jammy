import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import opentype from 'opentype.js';
import type { Plugin } from 'vite';
import { LINE1, LINE2, type TitleGlyphs } from '../src/ui/home/title/glyphs.ts';

const require = createRequire(import.meta.url);
const FONT = '@fontsource/fredoka/files/fredoka-latin-700-normal.woff';
const ID = 'virtual:title-glyphs';

const r = (v: number) => Math.round(v * 10) / 10;

function extract(): TitleGlyphs {
  const buf = readFileSync(require.resolve(FONT));
  const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const unique = [...new Set(LINE1 + LINE2)];
  const out: TitleGlyphs = { unitsPerEm: font.unitsPerEm, glyphs: {}, kerning: {} };
  for (const ch of unique) {
    const g = font.charToGlyph(ch);
    const path = g.getPath(0, 0, font.unitsPerEm).commands.map((c) => {
      switch (c.type) {
        case 'M':
        case 'L':
          return [c.type, r(c.x), r(c.y)] as const;
        case 'Q':
          return [c.type, r(c.x1), r(c.y1), r(c.x), r(c.y)] as const;
        case 'C':
          return [c.type, r(c.x1), r(c.y1), r(c.x2), r(c.y2), r(c.x), r(c.y)] as const;
        case 'Z':
          return [c.type] as const;
      }
    });
    out.glyphs[ch] = { advance: g.advanceWidth ?? 0, path };
    for (const next of unique) {
      const k = font.getKerningValue(g, font.charToGlyph(next));
      if (k) out.kerning[ch + next] = k;
    }
  }
  return out;
}

export function titleGlyphs(): Plugin {
  return {
    name: 'title-glyphs',
    resolveId: (id) => (id === ID ? `\0${ID}` : null),
    load: (id) => (id === `\0${ID}` ? `export default ${JSON.stringify(extract())};` : null),
  };
}
