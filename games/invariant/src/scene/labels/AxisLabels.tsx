import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { cameraRig } from '../cameraRig';

// The axes' variable names: "i →" at the near end of the row of numbers along
// x (pointing along it), and "n ↑" at the far end of the column along y. They
// follow the camera along their axis so both stay in view (and clear of the
// caption at the bottom), and shrink a little with distance like the other
// tags.

/** The number row is tile row 0 and the number column is tile column 0 (see floorShader). */
const AXIS_ROW = 0;
const AXIS_COL = 0;
/** How far from the camera's target the label sits along its axis, in tiles. */
const reach = (distance: number) => THREE.MathUtils.clamp(distance * 0.3, 3, 9);

const LABEL =
  'rounded-full bg-white/80 px-2.5 pt-0.5 pb-0.75 font-display text-md font-semibold whitespace-nowrap text-[#6a7488] shadow-[0_1px_3px_rgb(32_44_70/0.12)] backdrop-blur-sm';

function AxisLabel({ axis, name }: { axis: 'x' | 'y'; name: string }) {
  const group = useRef<THREE.Group>(null);
  const holder = useRef<HTMLDivElement>(null);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const t = cameraRig.target();
    const r = reach(cameraRig.distance());
    // sits just off the number row/column, so it never covers a number
    if (axis === 'x') g.position.set(Math.round(t.x) - r, 0.02, -AXIS_ROW + 0.9);
    else g.position.set(AXIS_COL - 0.9, 0.02, -(Math.round(-t.z) + r));
    if (holder.current) {
      const k = THREE.MathUtils.clamp(14 / camera.position.distanceTo(g.position), 0.75, 1);
      holder.current.style.transform = `translate(-50%, -50%) scale(${k.toFixed(3)})`;
    }
  });
  return (
    <group ref={group}>
      <Html zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={holder} className="animate-fade">
          <span className={LABEL}>
            {name} {axis === 'x' ? '→' : '↑'}
          </span>
        </div>
      </Html>
    </group>
  );
}

/** The plane's axes, named after the level's view variables (while the axes are revealed). */
export function AxisLabels() {
  const level = useGame((s) => s.level);
  const on = useGame((s) => s.reveal.axes);
  if (!level || !on) return null;
  return (
    <>
      <AxisLabel axis="x" name={level.view.x} />
      <AxisLabel axis="y" name={level.view.y} />
    </>
  );
}
