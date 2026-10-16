// Draws the link preview image, public/og.png (1200 × 630), with the game
// itself: it serves the app, opens its `?poster` page (the home screen with
// only the title and copy, see src/ui/dev/Poster.tsx) in the system Chrome,
// and takes a screenshot.
//
//   pnpm og
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const OUT = fileURLToPath(new URL('../public/og.png', import.meta.url));
/** The page is laid out at this size and drawn 1.2× sharper (1200 × 630), so the copy reads at preview sizes. */
const VIEW = { width: 1000, height: 525 };
const SCALE = 1.2;
/** Long enough for the eggs to hatch and the camera to glide into place. */
const SETTLE_MS = 6000;

const server = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'warn' });
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', chromiumSandbox: true });
try {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: SCALE });
  const url = new URL('?poster', server.resolvedUrls!.local[0]).href;
  await page.goto(url);
  await page.locator('canvas').first().waitFor();
  await page.waitForTimeout(SETTLE_MS);
  // drawing the world in software (no GPU) can be slow
  await page.screenshot({ path: OUT, timeout: 90_000 });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
  await server.close();
}
