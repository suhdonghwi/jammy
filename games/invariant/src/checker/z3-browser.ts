import type { Context } from 'z3-solver';

// Z3's Emscripten build must be loaded as a classic script (its thread workers
// re-load it by URL), and threads need a cross-origin isolated page.

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
      await loadScript(`${import.meta.env.BASE_URL}z3/z3-built.js`);
      const { init } = await import('z3-solver');
      const api = await init();
      return api.Context('main');
    })();
    pending.catch(() => {
      pending = null;
    });
  }
  return pending;
}
