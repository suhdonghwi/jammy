import { defineConfig } from 'vite';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { titleGlyphs } from './scripts/title-glyphs.ts';

// Z3's threads need SharedArrayBuffer, which needs a cross-origin isolated page.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

const SITE_URL = process.env.SITE_URL ?? 'https://jammy.fun/invariant/';
const siteUrl = { name: 'site-url', transformIndexHtml: (html: string) => html.replaceAll('%SITE_URL%', SITE_URL) };

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), titleGlyphs(), siteUrl],
  server: { headers: isolation },
  preview: { headers: isolation },
});
