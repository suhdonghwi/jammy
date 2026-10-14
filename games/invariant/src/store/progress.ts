// Per-viewer progress, kept in the browser. Every access is guarded: storage can
// be unavailable (private mode, blocked site data) and the app must still work.

export interface Progress {
  tutorialDone: boolean;
  cleared: string[];
  formulas: Record<string, string>;
}

const KEY = 'invariant-frog:progress';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      return { tutorialDone: !!p.tutorialDone, cleared: p.cleared ?? [], formulas: p.formulas ?? {} };
    }
  } catch {
    // ignore
  }
  return { tutorialDone: false, cleared: [], formulas: {} };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}
