import { useRef } from 'react';
import { EXIT_MS } from '../../hooks/presence';

export function useExitFade(leaving: boolean): () => number {
  const leftAt = useRef<number | null>(null);
  return () => {
    if (!leaving) leftAt.current = null;
    else if (leftAt.current === null) leftAt.current = performance.now();
    return leftAt.current === null ? 1 : Math.max(0, 1 - (performance.now() - leftAt.current) / EXIT_MS);
  };
}
