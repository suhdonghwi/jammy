import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { cameraRig } from '../cameraRig';
import { fadeRadius } from '../shaders/common';
import { areaMask, MASK_REACH, type MaskBit } from './mask';

const DRIFT = 8;

export interface MaskTiles {
  tiles: [number, number][];
  cx: number;
  cy: number;
}

export function useMaskTiles(bit: MaskBit): MaskTiles {
  const [found, setFound] = useState<MaskTiles>({ tiles: [], cx: 0, cy: 0 });
  const seen = useRef({ revision: -1, cx: 0, cy: 0, R: 0 });
  useFrame(() => {
    const t = cameraRig.target();
    const cx = Math.round(t.x);
    const cy = Math.round(-t.z);
    const R = Math.min(MASK_REACH, Math.ceil(fadeRadius()));
    const s = seen.current;
    if (areaMask.revision === s.revision && Math.abs(cx - s.cx) <= DRIFT && Math.abs(cy - s.cy) <= DRIFT && R <= s.R && R >= s.R - 2 * DRIFT) return;
    seen.current = { revision: areaMask.revision, cx, cy, R: R + DRIFT };
    setFound({ tiles: areaMask.tilesWithin(bit, cx, cy, R + 2 * DRIFT), cx, cy });
  });
  return found;
}
