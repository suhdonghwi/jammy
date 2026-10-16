// Cuts the Korean fonts down to the Hangul a page can show, as woff2, into
// src/assets/fonts. The full fonts cover all 11,172 syllables; the subsets keep
// the 2,350 of KS X 1001 (which covers everyday Korean), the compatibility
// jamo, and any other syllable the game's own text uses.
//
// Run with `pnpm fonts` after adding Korean text with an unusual syllable
// (the script lists any it adds beyond KS X 1001).
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const root = join(import.meta.dirname, '..');
const outDir = join(root, 'src', 'assets', 'fonts');

const FONTS = [
  { from: '@noonnu/tmoney-round-wind-extra-bold/fonts/tmoneyroundwindextrabold-normal.woff', to: 'TmoneyRoundWind-ExtraBold.woff2' },
  { from: '@kfonts/nanum-square-round/NanumSquareRoundR.woff2', to: 'NanumSquareRound-Regular.woff2' },
  { from: '@kfonts/nanum-square-round/NanumSquareRoundB.woff2', to: 'NanumSquareRound-Bold.woff2' },
];

// KS X 1001's Hangul: EUC-KR rows 0xB0–0xC8, cells 0xA1–0xFE
const decoder = new TextDecoder('euc-kr');
const chars = new Set();
for (let hi = 0xb0; hi <= 0xc8; hi++) {
  for (let lo = 0xa1; lo <= 0xfe; lo++) chars.add(decoder.decode(new Uint8Array([hi, lo])));
}
for (let c = 0x3131; c <= 0x318e; c++) chars.add(String.fromCodePoint(c));

// every Hangul syllable in the source, so none of the game's own text falls back
const extra = new Set();
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) scan(p);
    else if (/\.(ts|tsx|css|html)$/.test(name)) {
      for (const ch of readFileSync(p, 'utf8').match(/[가-힣]/g) ?? []) {
        if (!chars.has(ch)) extra.add(ch);
      }
    }
  }
}
scan(join(root, 'src'));
for (const ch of extra) chars.add(ch);
if (extra.size) console.log(`beyond KS X 1001: ${[...extra].join('')}`);

const text = [...chars].join('');
mkdirSync(outDir, { recursive: true });
for (const f of FONTS) {
  const src = readFileSync(require.resolve(f.from));
  const out = await subsetFont(src, text, { targetFormat: 'woff2' });
  writeFileSync(join(outDir, f.to), out);
  console.log(`${f.to}: ${(src.length / 1024).toFixed(0)} KB → ${(out.length / 1024).toFixed(0)} KB`);
}
