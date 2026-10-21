import type { Context } from 'z3-solver';
import { version } from 'z3-solver/package.json';
import { guardDecRefs } from './z3-guard';

let pending: Promise<Context<'main'>> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`failed to load ${src}`));
    document.head.appendChild(el);
  });
}

export function browserZ3(): Promise<Context<'main'>> {
  if (!pending) {
    pending = (async () => {
      if (!globalThis.crossOriginIsolated) {
        throw new Error('The solver needs a cross-origin isolated page (COOP/COEP headers).');
      }
      // a classic script, as its Emscripten thread workers re-load it by URL
      await loadScript(`${import.meta.env.BASE_URL}z3/${version}/z3-built.js`);
      const { init } = await import('z3-solver');
      const api = await init();
      guardDecRefs(api.Z3);
      return api.Context('main');
    })();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
