import { useEffect, useState } from 'react';

// The `narrow` variant (styles.css) as a hook: tall or narrow windows stack
// the home copy under the scene and centre it, title included.
const NARROW = '(max-width: 768px), (max-aspect-ratio: 11/10)';

export function useNarrowHome(): boolean {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}
