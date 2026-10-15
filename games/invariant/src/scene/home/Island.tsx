import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { COLORS } from '../constants';
import { Frogs } from '../Frogs';
import { Slabs } from '../AreaLayer';
import { useArea, useHomeLevel, useTitleFont, useWanderers, Word } from './common';

// Draft D: a little island of slabs floating in a pastel sky, the title
// standing on it, frogs pottering about. The camera slowly circles it.

const R = 4.4;
const TILES: [number, number][] = [];
for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) if (x * x + y * y <= R * R) TILES.push([x, y]);
// frogs stay off the strip where the title stands
const WALK = TILES.filter(([x, y]) => !(y === 1 && Math.abs(x) <= 4));

/** The rock under the island: a rounded, tapering lump with soft stripes of strata. */
function Rock() {
  const geom = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const N = 14;
    for (let i = 0; i <= N; i++) {
      const t = i / N; // 0 top → 1 bottom tip
      const r = (R + 0.55) * Math.pow(1 - t, 0.75) * (1 - 0.08 * Math.sin(t * Math.PI));
      pts.push(new THREE.Vector2(Math.max(r, 0.001), -t * 4.2));
    }
    const g = new THREE.LatheGeometry(pts.reverse(), 9);
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#c9b8e8',
        roughness: 0.9,
        flatShading: true,
      }),
    [],
  );
  return (
    <group>
      <mesh geometry={geom} material={mat} position={[0, -0.02, 0]} />
      {/* the island's grassy lid under the slabs */}
      <mesh position={[0, -0.04, 0]}>
        <cylinderGeometry args={[R + 0.6, R + 0.55, 0.12, 9]} />
        <meshStandardMaterial color="#9fe08f" roughness={0.8} flatShading />
      </mesh>
    </group>
  );
}

/** Soft puffy clouds drifting slowly around the island. */
function Clouds() {
  const group = useRef<THREE.Group>(null);
  const puffs = useMemo(() => {
    const rnd = (i: number) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
    return Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2 + rnd(i) * 0.5;
      const d = 13 + rnd(i + 3) * 8;
      return { x: Math.cos(a) * d, y: -3.5 + rnd(i + 7) * 5, z: Math.sin(a) * d, s: 0.9 + rnd(i + 11) * 1.3 };
    });
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 1, flatShading: true }), []);
  const ball = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  useFrame(({ clock }) => {
    if (group.current) group.current.rotation.y = clock.elapsedTime * 0.015;
  });
  return (
    <group ref={group}>
      {puffs.map((p, i) => (
        <group key={i} position={[p.x, p.y, p.z]} scale={p.s}>
          <mesh geometry={ball} material={mat} />
          <mesh geometry={ball} material={mat} position={[0.9, -0.2, 0.1]} scale={0.75} />
          <mesh geometry={ball} material={mat} position={[-0.85, -0.25, -0.1]} scale={0.7} />
          <mesh geometry={ball} material={mat} position={[0.2, 0.45, 0]} scale={0.6} />
        </group>
      ))}
    </group>
  );
}

export function IslandHome() {
  const font = useTitleFont();
  const level = useHomeLevel();
  const version = useArea(TILES);
  useWanderers(level, { tiles: WALK, count: 6, every: 1.2 });
  const island = useRef<THREE.Group>(null);

  useEffect(() => {
    void cameraRig.controls?.setLookAt(0, 7, 16, 0, 0.5, 0, false);
  }, []);
  const mode = useGame((s) => s.mode);
  useFrame(({ clock, size }) => {
    const t = clock.elapsedTime;
    // the island bobs gently
    if (island.current) island.current.position.y = Math.sin(t * 0.8) * 0.12;
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const fit = Math.max(1, 1.2 / Math.max(0.5, size.width / size.height));
    // circle slowly, swinging back and forth so the title stays mostly readable
    const a = Math.sin(t * 0.09) * 0.7;
    const d = 17 * fit;
    void c.setLookAt(Math.sin(a) * d, 3.8 * fit, Math.cos(a) * d, 0, -0.5, 0, false);
  });

  return (
    <group>
      <Clouds />
      <group ref={island}>
        <Rock />
        <Slabs version={version} dim={false} showStop={false} showGoal={false} />
        <Frogs />
        {font && (
          <>
            <Word font={font} text="Invariant" size={1.3} position={[0, 2.45, -1.2]} face={COLORS.slabTop} side={COLORS.slabSide} />
            <Word font={font} text="Frog" size={1.6} position={[0, 0.35, -1.0]} face={COLORS.frog} side="#38952f" phase={1.4} />
          </>
        )}
      </group>
    </group>
  );
}
