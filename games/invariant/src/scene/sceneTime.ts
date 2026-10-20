import { EXIT_MS } from '../hooks/presence';

let started = false;
let hidden = typeof document !== 'undefined' && document.hidden;
let pausedSince: number | null = performance.now();
let pausedTotal = 0;

function sceneMs(): number {
  const t = performance.now();
  return t - pausedTotal - (pausedSince === null ? 0 : t - pausedSince);
}

export const sceneNow = () => sceneMs() / 1000;

type Timer = { due: number; fn: () => void; handle: number | null };
const timers = new Set<Timer>();

function arm(tm: Timer) {
  tm.handle = window.setTimeout(() => {
    timers.delete(tm);
    tm.fn();
  }, Math.max(0, tm.due - sceneMs()));
}

export function after(ms: number, fn: () => void): () => void {
  const tm: Timer = { due: sceneMs() + ms, fn, handle: null };
  timers.add(tm);
  if (pausedSince === null) arm(tm);
  return () => {
    if (tm.handle !== null) clearTimeout(tm.handle);
    timers.delete(tm);
  };
}

export const sleep = (ms: number) => new Promise<void>((r) => after(ms, r));

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
    [...timers].sort((a, b) => a.due - b.due).forEach(arm);
  }
}

export const sceneStarted = () => started;

export function startScene() {
  if (started) return;
  started = true;
  const html = document.documentElement;
  html.dataset.started = '';
  delete html.dataset.leaving;
  update();
}

let leaving = false;

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
