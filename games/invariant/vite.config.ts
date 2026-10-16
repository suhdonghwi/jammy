import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { titleGlyphs } from './scripts/title-glyphs';

// Z3's WebAssembly build uses threads (SharedArrayBuffer), which requires
// cross-origin isolation.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  // Served from a subpath in production (e.g. BASE_PATH=/invariant/).
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), titleGlyphs()],
  server: { headers: isolation },
  preview: { headers: isolation },
  test: { environment: 'node' },
});
