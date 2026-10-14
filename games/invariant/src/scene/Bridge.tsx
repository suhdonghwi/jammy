import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { COLORS, POND_SPACING, TILE } from './constants';

/**
 * "Rows lift into ponds": the tutorial's (i, n) grid, where every row is one
 * input, lifts row by row into stacked layers.
 */
export const bridgeState = { active: false, t: 0 };

const ROWS = 6;
const COLS = 9;

export function BridgeCinematic() {
  const group = useRef<THREE.Group>(null);
  const rows = useRef<(THREE.Group | null)[]>([]);
  const [active, setActive] = useState(false);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (active !== bridgeState.active) setActive(bridgeState.active);
    g.visible = bridgeState.active;
    if (!bridgeState.active) return;
    rows.current.forEach((r, n) => {
      if (!r) return;
      // stagger: row n starts a little later
      const u = THREE.MathUtils.clamp(bridgeState.t * 1.5 - n * 0.1, 0, 1);
      const e = u * u * (3 - 2 * u);
      // rows slide to the same depth and lift into a stack, each becoming a sheet
      r.position.set(0, e * n * POND_SPACING * 0.45, -n * (1 - e) - e * 2.5);
      r.scale.set(1, 1, 1 + e * 3.2);
    });
  });
  return (
    <group ref={group} visible={false}>
      {Array.from({ length: ROWS }, (_, n) => (
        <group key={n} ref={(el) => void (rows.current[n] = el)}>
          {Array.from({ length: COLS }, (_, i) => (
            <mesh key={i} position={[i - 2, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[TILE, TILE]} />
              <meshStandardMaterial color={i >= n ? COLORS.stopTile : COLORS.tile} transparent opacity={0.95} />
            </mesh>
          ))}
          {active && (
            <Html position={[-3.4, 0.05, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="pond-label">n = {n}</div>
            </Html>
          )}
        </group>
      ))}
    </group>
  );
}
