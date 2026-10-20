// Z3 is served from public/, not bundled: its Emscripten thread workers re-load z3-built.js by URL.
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const buildDir = dirname(require.resolve('z3-solver/build/z3-built.js'));
const outDir = join(import.meta.dirname, '..', 'public', 'z3');
mkdirSync(outDir, { recursive: true });
for (const f of ['z3-built.js', 'z3-built.wasm']) copyFileSync(join(buildDir, f), join(outDir, f));
console.log('copied Z3 browser build to public/z3');
