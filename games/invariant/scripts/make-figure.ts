// Renders the paper's figures (ui/dev/Figure.tsx): one transparent PNG per
// figure, and the figures of one group cropped to the same box, so the board
// lines up across them. pnpm figure <out-dir> [group]
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { createServer } from 'vite';

const dir = process.argv[2];
if (!dir) throw new Error('usage: pnpm figure <out-dir> [group]');
const OUT = resolve(process.env.INIT_CWD ?? process.cwd(), dir);
const VIEW = { width: 900, height: 620 };
const SCALE = 6;
const PAD = 6 * SCALE;
// Each group: the `?figure=` names, and the file each is written to.
const GROUPS: Record<string, [string, string][]> = {
  states: [
    ['a', 'states-a'],
    ['b', 'states-b'],
    ['c', 'states-c'],
  ],
  overshoot: ['init', 'maint', 'exit', 'pass'].map((k) => [`overshoot-${k}`, `overshoot-${k}`]),
};
const only = process.argv[3];
if (only && !GROUPS[only]) throw new Error(`no group ${only}; groups: ${Object.keys(GROUPS).join(', ')}`);

type Box = [number, number, number, number];

// The box of what a PNG draws (alpha > 0); runs in the page.
async function drawn(png: string): Promise<Box> {
  const img = new Image();
  img.src = `data:image/png;base64,${png}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, c.width, c.height).data;
  let [x0, y0, x1, y1] = [c.width, c.height, -1, -1];
  for (let y = 0; y < c.height; y++)
    for (let x = 0; x < c.width; x++)
      if (a[(y * c.width + x) * 4 + 3] > 2) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return [x0, y0, x1, y1];
}

// A PNG cropped to a box; runs in the page.
async function crop([png, [x0, y0, x1, y1]]: [string, Box]): Promise<string> {
  const img = new Image();
  img.src = `data:image/png;base64,${png}`;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = x1 - x0 + 1;
  c.height = y1 - y0 + 1;
  c.getContext('2d')!.drawImage(img, -x0, -y0);
  return c.toDataURL('image/png').split(',')[1];
}

type Point = [number, number];

interface Shot {
  png: string;
  /** The corners of each outline the figure asks for, in CSS pixels. */
  marks: Point[][];
}

async function render(page: Page, base: string, name: string): Promise<Shot> {
  await page.goto(new URL(`?figure=${name}`, base).href);
  await page.waitForFunction(() => (window as { __figureReady?: boolean }).__figureReady, null, { timeout: 60_000 });
  const marks = await page.evaluate(() => (window as { __figureMarks?: Point[][] }).__figureMarks ?? []);
  return { png: (await page.screenshot({ omitBackground: true, timeout: 90_000 })).toString('base64'), marks };
}

// The outlines of one figure as TikZ paths, in fractions of the cropped image
// with (0,0) at the bottom left, so the paper can draw them over the PNG.
function marksTex(file: string, marks: Point[][], [x0, y0, x1, y1]: Box): string {
  const f = (v: number) => v.toFixed(4);
  const paths = marks.map(
    (m) => `\\draw[fmark] ${m.map(([x, y]) => `(${f((x * SCALE - x0) / (x1 - x0 + 1))},${f(1 - (y * SCALE - y0) / (y1 - y0 + 1))})`).join(' -- ')} -- cycle;`,
  );
  return `\\expandafter\\def\\csname figmarks@${file}\\endcsname{${paths.join(' ')}}\n`;
}

mkdirSync(OUT, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true });
try {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: SCALE });
  const base = server.resolvedUrls!.local[0];
  const W = VIEW.width * SCALE - 1;
  const H = VIEW.height * SCALE - 1;
  for (const [group, figures] of Object.entries(GROUPS)) {
    if (only && group !== only) continue;
    const shots: Shot[] = [];
    for (const [name] of figures) shots.push(await render(page, base, name));
    const boxes = await Promise.all(shots.map((s) => page.evaluate(drawn, s.png)));
    const box: Box = [
      Math.max(0, Math.min(...boxes.map((b) => b[0])) - PAD),
      Math.max(0, Math.min(...boxes.map((b) => b[1])) - PAD),
      Math.min(W, Math.max(...boxes.map((b) => b[2])) + PAD),
      Math.min(H, Math.max(...boxes.map((b) => b[3])) + PAD),
    ];
    let tex = `% Written by pnpm figure (games/invariant/scripts/make-figure.ts): the outlines\n% the figures of group ${group} ask for. Each \\csname figmarks@<file>\\endcsname\n% draws them with the style fmark, in the PNG's fractions.\n`;
    for (const [k, [, file]] of figures.entries()) {
      const path = `${OUT}/${file}.png`;
      writeFileSync(path, Buffer.from(await page.evaluate(crop, [shots[k].png, box] as [string, Box]), 'base64'));
      console.log(`wrote ${path}`);
      tex += marksTex(file, shots[k].marks, box);
    }
    writeFileSync(`${OUT}/${group}-marks.tex`, tex);
    console.log(`wrote ${OUT}/${group}-marks.tex`);
  }
} finally {
  await browser.close();
  await server.close();
}
