import { useEffect, useRef, useState } from 'react';

// Keep things on screen a moment after they are closed, so they can play an
// exit animation instead of vanishing. Components render with `leaving` set
// during that moment, and swap in an exit animation (`animate-fade-out`,
// `animate-pop-out`, `animate-sink-out`).

/** Exit animations last this long (keep in step with the `animate-*-out` durations in styles.css). */
export const EXIT_MS = 150;

/** A single element: still mounted while `leaving`, then gone. */
export function usePresence(show: boolean): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(show);
  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [show]);
  return { mounted: show || mounted, leaving: !show && mounted };
}

/**
 * The last non-null value, kept while it plays its exit: `value` is what to
 * render (the current one, or the one that just went away), `leaving` whether
 * it is on its way out.
 */
export function useLingering<T>(current: T | null | undefined): { value: T | null; leaving: boolean } {
  const last = useRef<T | null>(current ?? null);
  if (current != null) last.current = current;
  const { mounted, leaving } = usePresence(current != null);
  return { value: mounted ? last.current : null, leaving };
}

/**
 * A list where removed items stay for their exit animation. Items are matched
 * by key; each comes back with `leaving` while it is on its way out.
 */
export function usePresentList<T>(items: readonly T[], keyOf: (t: T) => string): { item: T; key: string; leaving: boolean }[] {
  const gone = useRef(new Map<string, { item: T; at: number; index: number }>());
  const prev = useRef<{ item: T; key: string }[]>([]);
  const [, bump] = useState(0);
  const now = performance.now();
  const keys = new Set(items.map(keyOf));
  // anything that was here a moment ago and isn't now starts leaving
  prev.current.forEach((p, index) => {
    if (!keys.has(p.key) && !gone.current.has(p.key)) gone.current.set(p.key, { item: p.item, at: now, index });
  });
  // anything that came back stops leaving
  for (const k of keys) gone.current.delete(k);
  for (const [k, g] of gone.current) if (now - g.at > EXIT_MS) gone.current.delete(k);
  prev.current = items.map((item) => ({ item, key: keyOf(item) }));

  useEffect(() => {
    if (!gone.current.size) return;
    const t = setTimeout(() => bump((n) => n + 1), EXIT_MS + 20);
    return () => clearTimeout(t);
  });

  const out = items.map((item) => ({ item, key: keyOf(item), leaving: false }));
  for (const [key, g] of gone.current) out.splice(Math.min(g.index, out.length), 0, { item: g.item, key, leaving: true });
  return out;
}
