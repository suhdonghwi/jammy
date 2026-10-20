import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { titleGlyphs } from './scripts/title-glyphs.ts';

// Z3's WebAssembly build uses threads (SharedArrayBuffer), which requires
// cross-origin isolation.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

/** Where the site lives, for the absolute URLs link previews need (`%SITE_URL%` in index.html). */
const SITE_URL = process.env.SITE_URL ?? 'https://jammy.fun/invariant/';
const siteUrl = { name: 'site-url', transformIndexHtml: (html: string) => html.replaceAll('%SITE_URL%', SITE_URL) };

export default defineConfig({
  // Served from a subpath in production (e.g. BASE_PATH=/invariant/).
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), titleGlyphs(), siteUrl],
  server: { headers: isolation },
  preview: { headers: isolation },
});
