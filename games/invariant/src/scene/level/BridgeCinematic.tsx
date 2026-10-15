import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, TILE } from '../constants';
import { frogGeometry, frogMaterial } from '../models';
import { smoothstep } from '../easing';

/**
 * "Rows lift into ponds": the tutorial's (i, n) grid — one row per input n —
 * lifts row by row into a stack of floors.
 */
export const bridgeState = { t: 0 };

const ROWS = 5;
const COLS = 8;
const LIFT = 1.9;

export function BridgeCinematic() {
  const rows = useRef<(THREE.Group | null)[]>([]);
  const plates = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const assets = useMemo(() => {
    const tile = new RoundedBoxGeometry(TILE, 0.08, TILE, 2, 0.03);
    const white = new THREE.MeshStandardMaterial({ color: COLORS.tile, roughness: 0.8 });
    const gray = new THREE.MeshStandardMaterial({ color: COLORS.stopTile, roughness: 0.8 });
    const frogMat = frogMaterial();
    const frog = frogGeometry();
    return { tile, white, gray, frogMat, frog };
  }, []);

  useFrame(() => {
    const t = bridgeState.t;
    rows.current.forEach((r, n) => {
      if (!r) return;
      const u = THREE.MathUtils.clamp(t * 1.5 - n * 0.1, 0, 1);
      const e = smoothstep(u);
      // every row slides to the same depth and lifts to its own floor
      r.position.set(0, e * n * LIFT, -n * (1 - e) - e * 2);
      const p = plates.current[n];
      if (p) p.opacity = e * 0.85;
      const plate = r.children[0];
      if (plate) plate.scale.set(1, 1, 1 + e * 5);
    });
  });

  return (
    <group>
      {Array.from({ length: ROWS }, (_, n) => (
        <group key={n} ref={(el) => void (rows.current[n] = el)}>
          <mesh position={[1.5, -0.06, 0]}>
            <boxGeometry args={[COLS + 0.5, 0.04, 1.1]} />
            <meshStandardMaterial
              ref={(m) => void (plates.current[n] = m)}
              color="#f3f6fa"
              transparent
              opacity={0}
              roughness={0.9}
            />
          </mesh>
          {Array.from({ length: COLS }, (_, i) => (
            <mesh key={i} geometry={assets.tile} material={i - 2 >= n ? assets.gray : assets.white} position={[i - 2, 0, 0]} />
          ))}
          {/* each row's frog sits on its goal, i = n */}
          <mesh geometry={assets.frog} material={assets.frogMat} position={[n, 0.05, 0]} />
        </group>
      ))}
    </group>
  );
}
