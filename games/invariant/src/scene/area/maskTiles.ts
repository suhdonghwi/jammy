import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import { cameraRig } from '../cameraRig';
import { viewRadius } from '../shaders/fade';
import { areaMask, MASK_REACH, type MaskBit } from './mask';

const MIN_DRIFT = 8;
const DRIFT_SHARE = 0.125;
const ZOOM_SHARE = 0.1;

interface MaskTiles {
  tiles: [number, number][];
  cx: number;
  cy: number;
  distance: number;
}

export function useMaskTiles(bit: MaskBit): MaskTiles {
  const [found, setFound] = useState<MaskTiles>({ tiles: [], cx: 0, cy: 0, distance: 0 });
  const seen = useRef({ revision: -1, cx: 0, cy: 0, R: 0, drift: MIN_DRIFT, distance: 0 });
  useFrame(() => {
    const t = cameraRig.target();
    const cx = Math.round(t.x);
    const cy = Math.round(-t.z);
    const R = Math.min(MASK_REACH, Math.ceil(viewRadius()));
    const distance = cameraRig.distance();
    const s = seen.current;
    const zoomed = Math.abs(distance - s.distance) > s.distance * ZOOM_SHARE;
    if (!zoomed && areaMask.revision === s.revision && Math.abs(cx - s.cx) <= s.drift && Math.abs(cy - s.cy) <= s.drift && R <= s.R && R >= s.R - 2 * s.drift) return;
    const drift = Math.max(MIN_DRIFT, Math.round(R * DRIFT_SHARE));
    seen.current = { revision: areaMask.revision, cx, cy, R: R + drift, drift, distance };
    setFound({ tiles: areaMask.tilesWithin(bit, cx, cy, R + 2 * drift), cx, cy, distance });
  });
  return found;
}
