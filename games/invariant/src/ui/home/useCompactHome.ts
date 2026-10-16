import { useEffect, useState } from 'react';

// Very small screens (narrow *and* short, like an iPhone SE) have no room for
// both the scene and the title side by side: the copy then fills the screen,
// with the scene washed back into a faint backdrop behind it.
const COMPACT_HOME = '(max-aspect-ratio: 11/10) and (max-height: 720px)';

export function useCompactHome(): boolean {
  const [compact, setCompact] = useState(() => window.matchMedia(COMPACT_HOME).matches);
  useEffect(() => {
    const mq = window.matchMedia(COMPACT_HOME);
    const on = () => setCompact(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return compact;
}
