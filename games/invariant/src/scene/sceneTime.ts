// The scene's own clock, which stops while the page is hidden, and which
// starts only once the page is ready to be seen.
//
// In a background tab the browser stops drawing frames and throttles timers
// (down to once a minute), while the wall clock keeps going. Animations timed
// off the wall clock would then all snap to "minutes later" on return: hops
// landing mid-air, slabs popping up, the home loop skipping ahead. Timing
// everything in the scene from this clock instead, and scheduling its waits
// with `after`, makes the scene simply pause and carry on where it was.
//
// On load, the world's first frame takes a while (its shaders compile), and
// the fonts arrive late. So the clock holds until both are done (`startScene`,
// from World), and so does every entrance animation on the page (styles.css
// pauses them until `data-started` is set): everything comes in together, in
// order, rather than playing out unseen or popping in one by one. Going to
// another screen (`switchScene`) fades this one out and then starts over the
// same way, so each screen comes in on its own, as it does on load.

import { EXIT_MS } from '../hooks/presence';

let started = false;
let hidden = typeof document !== 'undefined' && document.hidden;
let pausedSince: number | null = performance.now();
let pausedTotal = 0;

/** Milliseconds of scene time: like performance.now(), but frozen until the scene starts and while the page is hidden. */
function sceneMs(): number {
  const t = performance.now();
  return t - pausedTotal - (pausedSince === null ? 0 : t - pausedSince);
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
  if (pausedSince === null) arm(tm);
  return () => {
    if (tm.handle !== null) clearTimeout(tm.handle);
    timers.delete(tm);
  };
}

/** Wait `ms` of scene time (paused while the page is hidden). */
export const sleep = (ms: number) => new Promise<void>((r) => after(ms, r));

/** Pause or resume the clock and its timers, as the page is shown, hidden or started. */
function update() {
  const t = performance.now();
  if (!started || hidden) {
    if (pausedSince !== null) return;
    pausedSince = t;
    for (const tm of timers) {
      if (tm.handle !== null) clearTimeout(tm.handle);
      tm.handle = null;
    }
  } else if (pausedSince !== null) {
    pausedTotal += t - pausedSince;
    pausedSince = null;
    // soonest first (ties keep the order they were set in)
    [...timers].sort((a, b) => a.due - b.due).forEach(arm);
  }
}

/** Whether the page's entrance has begun. */
export const sceneStarted = () => started;

/** Begin the entrance: start the clock, and let the page's entrance animations play. */
export function startScene() {
  if (started) return;
  started = true;
  const html = document.documentElement;
  html.dataset.started = '';
  delete html.dataset.leaving;
  update();
}

let leaving = false;

/**
 * Go to another screen: this one fades out (styles.css, `data-leaving`),
 * then the clock holds, `go` sets up the next one, and it comes in once its
 * first frame is drawn (see World), on a page with nothing moving to
 * stutter while that frame is slow. Presses during the fade are ignored.
 */
export function switchScene(go: () => void) {
  if (leaving || !started) return;
  leaving = true;
  document.documentElement.dataset.leaving = '';
  setTimeout(() => {
    leaving = false;
    started = false;
    delete document.documentElement.dataset.started;
    update();
    go();
    startAnyway();
  }, EXIT_MS);
}

/** However slow the first frame is, the page doesn't wait for it forever. */
let fallback = 0;
function startAnyway() {
  clearTimeout(fallback);
  fallback = window.setTimeout(startScene, 3000);
}

if (typeof document !== 'undefined') {
  startAnyway();
  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    update();
  });
}
