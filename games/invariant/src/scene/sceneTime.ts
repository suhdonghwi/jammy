// The scene's own clock, which stops while the page is hidden.
//
// In a background tab the browser stops drawing frames and throttles timers
// (down to once a minute), while the wall clock keeps going. Animations timed
// off the wall clock would then all snap to "minutes later" on return: hops
// landing mid-air, slabs popping up, the home loop skipping ahead. Timing
// everything in the scene from this clock instead, and scheduling its waits
// with `after`, makes the scene simply pause and carry on where it was.

let hiddenSince: number | null = typeof document !== 'undefined' && document.hidden ? performance.now() : null;
let pausedTotal = 0;

/** Milliseconds of scene time: like performance.now(), but frozen while the page is hidden. */
function sceneMs(): number {
  const t = performance.now();
  return t - pausedTotal - (hiddenSince === null ? 0 : t - hiddenSince);
}

/** Seconds of scene time: what everything in the scene is timed by. */
export const sceneNow = () => sceneMs() / 1000;

type Timer = { due: number; fn: () => void; handle: number | null };
const timers = new Set<Timer>();

function arm(tm: Timer) {
  tm.handle = window.setTimeout(() => {
    timers.delete(tm);
    tm.fn();
  }, Math.max(0, tm.due - sceneMs()));
}

/** setTimeout in scene time: it waits out the time the page is hidden. Returns a cancel function. */
export function after(ms: number, fn: () => void): () => void {
  const tm: Timer = { due: sceneMs() + ms, fn, handle: null };
  timers.add(tm);
  if (hiddenSince === null) arm(tm);
  return () => {
    if (tm.handle !== null) clearTimeout(tm.handle);
    timers.delete(tm);
  };
}

/** Wait `ms` of scene time (paused while the page is hidden). */
export const sleep = (ms: number) => new Promise<void>((r) => after(ms, r));

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    const t = performance.now();
    if (document.hidden) {
      if (hiddenSince !== null) return;
      hiddenSince = t;
      for (const tm of timers) {
        if (tm.handle !== null) clearTimeout(tm.handle);
        tm.handle = null;
      }
    } else if (hiddenSince !== null) {
      pausedTotal += t - hiddenSince;
      hiddenSince = null;
      // soonest first (ties keep the order they were set in)
      [...timers].sort((a, b) => a.due - b.due).forEach(arm);
    }
  });
}
