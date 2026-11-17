import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { cameraRig } from '../cameraRig';
import { fadeRadius } from '../shaders/fade';
import { areaMask, MASK_REACH, type MaskBit } from './mask';

const MIN_DRIFT = 8;
const DRIFT_SHARE = 0.125;

interface MaskTiles {
  tiles: [number, number][];
  cx: number;
  cy: number;
}

export function useMaskTiles(bit: MaskBit): MaskTiles {
  const [found, setFound] = useState<MaskTiles>({ tiles: [], cx: 0, cy: 0 });
  const seen = useRef({ revision: -1, cx: 0, cy: 0, R: 0, drift: MIN_DRIFT });
  useFrame(() => {
    const t = cameraRig.target();
    const cx = Math.round(t.x);
    const cy = Math.round(-t.z);
    const R = Math.min(MASK_REACH, Math.ceil(fadeRadius()));
    const s = seen.current;
    if (areaMask.revision === s.revision && Math.abs(cx - s.cx) <= s.drift && Math.abs(cy - s.cy) <= s.drift && R <= s.R && R >= s.R - 2 * s.drift) return;
    const drift = Math.max(MIN_DRIFT, Math.round(R * DRIFT_SHARE));
    seen.current = { revision: areaMask.revision, cx, cy, R: R + drift, drift };
    setFound({ tiles: areaMask.tilesWithin(bit, cx, cy, R + 2 * drift), cx, cy });
  });
  return found;
}
