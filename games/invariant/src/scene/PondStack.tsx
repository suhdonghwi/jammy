import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { cameraRig } from './cameraRig';
import { COLORS, POND_SPACING } from './constants';

/** Animated focus value shared by the focused layer and the stack. */
export const stackAnim = { focus: 0 };

/** Wraps the focused pond's detail so it slides with the stack while gliding. */
export function FocusedLayer({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const pond = useGame((s) => s.pond);
  const hasPonds = useGame((s) => !!s.level?.pond);
  useFrame((_, dt) => {
    if (!hasPonds) {
      stackAnim.focus = pond;
    } else {
      const rate = 1 - Math.exp(-dt * 6);
      stackAnim.focus += (pond - stackAnim.focus) * rate;
      if (Math.abs(pond - stackAnim.focus) < 0.001) stackAnim.focus = pond;
    }
    if (ref.current) ref.current.position.y = (pond - stackAnim.focus) * POND_SPACING;
  });
  return <group ref={ref}>{children}</group>;
}

/** Faint sheets for the neighboring ponds, each labeled with its input value. */
export function PondStack() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const range = level.ponds!;
  const ponds = useMemo(() => {
    const out: number[] = [];
    for (let p = Math.max(range.min, pond - 5); p <= Math.min(range.max, pond + 5); p++) {
      if (level.fast.pondReq({ [level.pond!]: p, [level.view.x]: 0, [level.view.y]: 0 })) out.push(p);
    }
    return out;
  }, [level, pond, range]);
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = cameraRig.target();
    g.position.x = t.x;
    g.position.z = t.z;
  });
  return (
    <group ref={group}>
      {ponds.map((p) => (
        <Sheet key={p} p={p} name={level.pond!} focused={p === pond} />
      ))}
    </group>
  );
}

function Sheet({ p, name, focused }: { p: number; name: string; focused: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const offset = p - stackAnim.focus;
    g.position.y = offset * POND_SPACING - 0.03;
    if (matRef.current) {
      const target = focused ? 0 : offset > 0 ? 0.1 / offset : 0.55 / (1 + Math.abs(offset) * 0.6);
      matRef.current.opacity += (target - matRef.current.opacity) * 0.15;
    }
  });
  return (
    <group ref={ref}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[34, 34]} />
        <meshBasicMaterial ref={matRef} color={COLORS.sheet} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[-12, 0.05, 6]} center style={{ pointerEvents: 'none' }} zIndexRange={[5, 0]}>
        <div className={`pond-label ${focused ? 'focused' : ''}`}>
          {name} = {p}
        </div>
      </Html>
    </group>
  );
}
