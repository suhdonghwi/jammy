import { useEffect, useState } from 'react';

export const PHONE = '(max-width: 639.98px)';

export const NARROW_HOME = '(max-width: 768px), (max-aspect-ratio: 11/10)';

export const COMPACT_HOME = '(max-aspect-ratio: 11/10) and (max-height: 720px)';

export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}
