import type { Z3LowLevel } from 'z3-solver';

// z3-solver frees a Z3 object when its JavaScript wrapper is garbage
// collected: a finalizer on the main thread calls `Z3_dec_ref`. But
// `solver.check()` runs on a worker thread, and Z3's reference counts are not
// thread-safe, so a finalizer firing during a check (likely after a big query,
// say a quantifier unrolled into hundreds of instances, left a lot of garbage)
// corrupted the heap now and then: "memory access out of bounds", an
// assertion violation, or a check that never came back. So while a check is
// in flight every dec_ref is queued, and the queue is drained once the check
// returns, when the main thread is the only one touching Z3. (Z3's own
// `enable_concurrent_dec_ref` mode made the WebAssembly build crash more.)

type LowLevel = Z3LowLevel['Z3'];

let solving = false;
const queued: (() => void)[] = [];

/** Reroute every `*_dec_ref` of the low-level API through the queue. Call once, right after `init()`. */
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

/** Run a solver call (one that goes to the worker thread) with finalizers held back. */
export async function whileSolving<T>(run: () => Promise<T>): Promise<T> {
  solving = true;
  try {
    return await run();
  } finally {
    solving = false;
    for (const f of queued.splice(0)) f();
  }
}
