import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import type { TileWindow } from '../../levels/tiles';
import { cameraRig } from '../cameraRig';

export function useTileWindow(): TileWindow {
  const [win, setWin] = useState<TileWindow>({ cx: 0, cy: 0, R: 18 });
  const ref = useRef(win);
  useFrame(() => {
    const t = cameraRig.target();
    const d = cameraRig.distance();
    const cx = Math.round(t.x);
    const cy = Math.round(-t.z);
    const R = Math.min(40, Math.max(16, Math.ceil((d * 1.7) / 4) * 4));
    const c = ref.current;
    if (Math.abs(cx - c.cx) > 3 || Math.abs(cy - c.cy) > 3 || R !== c.R) {
      ref.current = { cx, cy, R };
      setWin(ref.current);
    }
  });
  return win;
}
