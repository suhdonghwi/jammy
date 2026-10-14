import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Z3's WebAssembly build uses threads (SharedArrayBuffer), which requires
// cross-origin isolation.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [react()],
  server: { headers: isolation },
  preview: { headers: isolation },
  test: { environment: 'node' },
});
