import { useSyncExternalStore } from 'react';

export const COMPACT = '(max-width: 639.98px), (max-height: 500px) and (orientation: landscape)';

export const NARROW_HOME = '(max-width: 768px), (max-aspect-ratio: 11/10)';

export const COMPACT_HOME = '(max-aspect-ratio: 11/10) and (max-height: 720px)';

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
