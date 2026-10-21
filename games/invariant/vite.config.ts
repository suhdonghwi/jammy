import { defineConfig, type Plugin } from 'vite';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { titleGlyphs } from './scripts/title-glyphs.ts';

// Z3's threads need SharedArrayBuffer, which needs a cross-origin isolated page.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

const BASE = process.env.BASE_PATH ?? '/';
const SITE_URL = process.env.SITE_URL ?? 'https://jammy.fun/invariant/';
const siteUrl = { name: 'site-url', transformIndexHtml: (html: string) => html.replaceAll('%SITE_URL%', SITE_URL) };

const FIRST_SCREEN_FONTS = [/nunito-latin-wght-normal-[\w-]+\.woff2$/, /fredoka-latin-[56]00-normal-[\w-]+\.woff2$/];
const preloadFonts: Plugin = {
  name: 'preload-fonts',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler: (_, { bundle }) =>
      Object.keys(bundle ?? {})
        .filter((file) => FIRST_SCREEN_FONTS.some((re) => re.test(file)))
        .map((file) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: BASE + file, crossorigin: '' }, injectTo: 'head' })),
  },
};

const VENDOR = /[\\/]node_modules[\\/](three|@react-three[\\/][^\\/]+|camera-controls|react|react-dom|scheduler)[\\/]/;

export default defineConfig({
  base: BASE,
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss(), titleGlyphs(), siteUrl, preloadFonts],
  build: { rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'vendor', test: VENDOR }] } } } },
  server: { headers: isolation },
  preview: { headers: isolation },
});
