import type { Z3LowLevel } from 'z3-solver';

// z3-solver frees objects from finalizers on the main thread, but Z3's reference
// counts aren't thread-safe and solver.check() runs on a worker: a finalizer firing
// mid-check corrupts the heap. So dec_refs are queued while a check runs.
type LowLevel = Z3LowLevel['Z3'];

let solving = false;
const queued: (() => void)[] = [];

export function guardDecRefs(Z3: LowLevel): void {
  const api = Z3 as unknown as Record<string, unknown>;
  for (const key of Object.keys(api)) {
    if (key !== 'dec_ref' && !key.endsWith('_dec_ref')) continue;
    const original = api[key] as (...args: unknown[]) => void;
    api[key] = (...args: unknown[]) => {
      if (solving) queued.push(() => original(...args));
      else original(...args);
    };
  }
}

export async function whileSolving<T>(run: () => Promise<T>): Promise<T> {
  solving = true;
  try {
    return await run();
  } finally {
    solving = false;
    for (const f of queued.splice(0)) f();
  }
}
