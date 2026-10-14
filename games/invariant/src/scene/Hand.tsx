import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { COLORS } from './constants';
import { handState } from './handState';

const FINGER_X = [-0.27, -0.09, 0.09, 0.27];
const FINGER_LEN = [0.36, 0.42, 0.4, 0.32];

/** A small, round, mitten-like hand — the skeptic. */
export function Hand() {
  const root = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const fingers = useRef<(THREE.Group | null)[]>([]);
  const thumb = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const g = root.current;
    const h = handState;
    if (!g || !inner.current) return;
    const t = clock.elapsedTime;
    g.visible = h.visible > 0.01;
    const s = 0.2 + 0.8 * h.visible;
    g.scale.setScalar(s);
    g.position.set(h.x, h.y + Math.sin(t * 1.6) * 0.04, h.z);
    inner.current.rotation.set(-0.35 + h.tilt, h.yaw, Math.sin(t * 9) * 0.22 * h.shrug);
    inner.current.position.y = Math.abs(Math.sin(t * 9)) * 0.15 * h.shrug;
    fingers.current.forEach((f, i) => {
      if (!f) return;
      const isIndex = i === 1;
      let curl = isIndex ? h.curl * (1 - h.point) : Math.max(h.curl, h.point * 0.95);
      curl += Math.max(0, Math.sin(t * 14 - i * 0.9)) * 0.45 * h.tap;
      f.rotation.x = -curl * 1.7;
    });
    if (thumb.current) thumb.current.rotation.y = 0.6 - 0.5 * Math.max(h.curl, h.point * 0.6);
  });

  const mat = <meshStandardMaterial color={COLORS.hand} roughness={0.45} metalness={0} />;
  return (
    <group ref={root} visible={false}>
      <group ref={inner}>
        {/* palm */}
        <mesh castShadow scale={[1, 0.46, 1.08]}>
          <sphereGeometry args={[0.5, 32, 24]} />
          {mat}
        </mesh>
        {/* wrist */}
        <mesh castShadow position={[0, 0.2, 0.62]} rotation={[0.9, 0, 0]}>
          <capsuleGeometry args={[0.3, 0.45, 8, 20]} />
          {mat}
        </mesh>
        {/* fingers */}
        {FINGER_X.map((x, i) => (
          <group key={i} position={[x, -0.02, -0.46]} ref={(el) => void (fingers.current[i] = el)}>
            <mesh castShadow position={[0, 0, -FINGER_LEN[i] / 2]} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.105, FINGER_LEN[i], 8, 16]} />
              {mat}
            </mesh>
          </group>
        ))}
        {/* thumb */}
        <group ref={thumb} position={[-0.44, -0.04, -0.12]}>
          <mesh castShadow position={[-0.14, 0, -0.08]} rotation={[Math.PI / 2, 0, 1.0]}>
            <capsuleGeometry args={[0.11, 0.26, 8, 16]} />
            {mat}
          </mesh>
        </group>
      </group>
    </group>
  );
}
