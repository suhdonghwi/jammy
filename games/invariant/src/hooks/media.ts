import { useEffect, useState } from 'react';

/** Below Tailwind's sm breakpoint the HUD is the phone layout (see also scene/PhoneFraming): for the few choices that need more than a class. */
export const PHONE = '(max-width: 639.98px)';

/** The `narrow` variant (styles.css): tall or narrow windows stack the home copy under the scene and centre it, title included. */
export const NARROW_HOME = '(max-width: 768px), (max-aspect-ratio: 11/10)';

/**
 * Very small screens (narrow *and* short, like an iPhone SE) have no room for
 * both the scene and the title side by side: the copy then fills the screen,
 * with the scene washed back into a faint backdrop behind it.
 */
export const COMPACT_HOME = '(max-aspect-ratio: 11/10) and (max-height: 720px)';

/** Whether a media query matches, kept up to date. */
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
