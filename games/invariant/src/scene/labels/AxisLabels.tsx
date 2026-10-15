import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { cameraRig } from '../cameraRig';
import { COLORS } from '../constants';

// The ends of the two axes the floor draws (see floorShader): a flat arrowhead
// on the line and the variable's name just past it, like a chart's axis. They
// follow the camera along their axis so both stay in view, and the name
// shrinks a little with distance like the other tags.

/** The x axis runs along y = -0.5 and the y axis along x = -0.5 (just before the numbers). */
const AXIS_OFF = -0.5;
/** How far past the camera's target the arrowhead sits, in tiles. */
const reach = (distance: number) => THREE.MathUtils.clamp(distance * 0.34, 3.5, 10);

const NAME =
  'rounded-full bg-white/85 px-2.5 pt-0.5 pb-0.75 font-display text-xl font-semibold whitespace-nowrap text-[#5f6a7e] shadow-[0_1px_3px_rgb(32_44_70/0.12)] backdrop-blur-sm';

/** A flat triangle, pointing +x, lying on the floor. */
function arrowGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0.42, 0);
  shape.lineTo(-0.18, 0.22);
  shape.lineTo(-0.06, 0);
  shape.lineTo(-0.18, -0.22);
  shape.closePath();
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

function AxisEnd({ axis, name }: { axis: 'x' | 'y'; name: string }) {
  const group = useRef<THREE.Group>(null);
  const holder = useRef<HTMLDivElement>(null);
  const geometry = useMemo(arrowGeometry, []);
  useFrame(({ camera }) => {
    const g = group.current;
    if (!g) return;
    const t = cameraRig.target();
    const r = reach(cameraRig.distance());
    if (axis === 'x') g.position.set(Math.round(t.x) + r, 0.015, -AXIS_OFF);
    else g.position.set(AXIS_OFF, 0.015, -(Math.round(-t.z) + r));
    if (holder.current) {
      const k = THREE.MathUtils.clamp(14 / camera.position.distanceTo(g.position), 0.85, 1);
      holder.current.style.transform = `translate(-50%, -50%) scale(${k.toFixed(3)})`;
    }
  });
  // the y axis points away from the camera: the arrow turns to face +y (world -z)
  const yaw = axis === 'x' ? 0 : Math.PI / 2;
  const past: [number, number, number] = axis === 'x' ? [1.1, 0, 0] : [0, 0, -1.1];
  return (
    <group ref={group}>
      <mesh geometry={geometry} rotation={[0, yaw, 0]} renderOrder={7}>
        <meshBasicMaterial color={COLORS.label} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <group position={past}>
        <Html zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div ref={holder} className="animate-fade">
            <span className={NAME}>{name}</span>
          </div>
        </Html>
      </group>
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
      <AxisEnd axis="x" name={level.view.x} />
      <AxisEnd axis="y" name={level.view.y} />
    </>
  );
}
