import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { createServer } from 'vite';

const OUT = fileURLToPath(new URL('../public/og.png', import.meta.url));
const VIEW = { width: 1000, height: 525 };
const SCALE = 1.2;
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
  await page.screenshot({ path: OUT, timeout: 90_000 });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
  await server.close();
}
