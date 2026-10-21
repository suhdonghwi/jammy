import { useEffect, useRef, useState } from 'react';
import { EXIT_MS } from '../ui/timing';

export function usePresence(show: boolean): { mounted: boolean; leaving: boolean } {
  const [mounted, setMounted] = useState(show);
  if (show && !mounted) setMounted(true);
  useEffect(() => {
    if (show) return;
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [show]);
  return { mounted: show || mounted, leaving: !show && mounted };
}

export function useLingering<T>(current: T | null | undefined): { value: T | null; leaving: boolean } {
  const last = useRef<T | null>(current ?? null);
  if (current != null) last.current = current;
  const { mounted, leaving } = usePresence(current != null);
  return { value: mounted ? last.current : null, leaving };
}

export function usePresentList<T>(items: readonly T[], keyOf: (t: T) => string): { item: T; key: string; leaving: boolean }[] {
  const gone = useRef(new Map<string, { item: T; at: number; index: number }>());
  const prev = useRef<{ item: T; key: string }[]>([]);
  const [, bump] = useState(0);
  const now = performance.now();
  const keys = new Set(items.map(keyOf));
  prev.current.forEach((p, index) => {
    if (!keys.has(p.key) && !gone.current.has(p.key)) gone.current.set(p.key, { item: p.item, at: now, index });
  });
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
