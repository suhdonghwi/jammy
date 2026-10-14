import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type opentype from 'opentype.js';
import { useGame } from '../store/game';
import { cameraRig } from './cameraRig';
import { COLORS } from './constants';
import { field } from './field';
import { Floor } from './Floor';
import { Frogs } from './Frogs';
import { frogWorld, yawToward } from './frogSim';
import { Slabs } from './AreaLayer';
import { outlineMaterial } from './models';
import { letterGeometries, loadTitleFont } from './text3d';
import { compileLevel } from '../levels/level';
import { allLevels } from '../levels/defs';

// The home screen: a big extruded title standing on the endless plane, with a
// little patch of area and frogs hopping around it.

const outline = outlineMaterial(0.028);

function Word({ font, text, size, y, z, face, side, phase }: { font: opentype.Font; text: string; size: number; y: number; z: number; face: string; side: string; phase: number }) {
  const letters = useMemo(() => letterGeometries(font, text, { size, depth: size * 0.42, letterSpacing: size * 0.02 }), [font, text, size]);
  const mats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: face, roughness: 0.45 }),
      new THREE.MeshStandardMaterial({ color: side, roughness: 0.6 }),
    ],
    [face, side],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      // a gentle wave through the letters
      const w = Math.sin(t * 1.6 - i * 0.55 + phase);
      g.position.y = y + Math.max(0, w) * 0.12;
      g.rotation.z = Math.sin(t * 1.6 - i * 0.55 + phase - 0.6) * 0.02;
    });
  });
  return (
    <group position={[0, 0, z]}>
      {letters.map((l, i) => (
        <group key={i} position={[l.x, y, 0]} ref={(el) => void (refs.current[i] = el)}>
          <mesh geometry={l.geom} material={outline} />
          <mesh geometry={l.geom} material={mats} />
        </group>
      ))}
    </group>
  );
}

// a loop of slabs around the title; frogs hop along it
const PATH: [number, number][] = [];
for (let x = -6; x <= 6; x++) PATH.push([x, 3]);
for (let y = 2; y >= 0; y--) PATH.push([6, y]);
for (let x = 6; x >= -6; x--) PATH.push([x, -1]);
for (let y = 0; y <= 2; y++) PATH.push([-6, y]);

export function HomeScene() {
  const [font, setFont] = useState<opentype.Font | null>(null);
  const [version, setVersion] = useState(0);
  const tutorial = useMemo(() => compileLevel(allLevels[0]), []);
  useEffect(() => {
    let alive = true;
    void loadTitleFont().then((f) => alive && setFont(f));
    return () => {
      alive = false;
    };
  }, []);

  // decorative area + frogs hopping around a loop
  useEffect(() => {
    field.reset();
    const tiles = PATH.map(([x, y]) => ({ x, y, stop: false, goal: false }));
    field.update(tiles, true);
    setVersion((v) => v + 1);
    frogWorld.clear();
    const starts = [0, 9, 18, 27];
    const frogs = starts.map((k) =>
      frogWorld.add(tutorial, 'real', { i: BigInt(PATH[k][0]), n: BigInt(PATH[k][1]) }, { hatchT0: performance.now() / 1000 + k * 0.02 }),
    );
    const pos = [...starts];
    frogs.forEach((f, j) => {
      const [x, y] = PATH[pos[j]];
      const [nx, ny] = PATH[(pos[j] + 1) % PATH.length];
      f.face = f.yaw = yawToward(x, y, nx, ny);
    });
    const timer = setInterval(() => {
      frogs.forEach((f, j) => {
        pos[j] = (pos[j] + 1) % PATH.length;
        const [x, y] = PATH[pos[j]];
        void frogWorld.hopTo(tutorial, f, { i: BigInt(x), n: BigInt(y) }, 0.45, true).then(() => {
          // look ahead along the loop
          const [nx, ny] = PATH[(pos[j] + 1) % PATH.length];
          f.face = yawToward(x, y, nx, ny);
        });
      });
    }, 900);
    void cameraRig.controls?.setLookAt(0, 4.4, 11.5, 0, 1.6, -1, false);
    return () => {
      clearInterval(timer);
      frogWorld.clear();
      field.reset();
    };
  }, [tutorial]);

  // slow, subtle camera drift
  const mode = useGame((s) => s.mode);
  useFrame(({ clock, size }) => {
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const t = clock.elapsedTime;
    const fit = Math.max(1, 1.25 / Math.max(0.5, size.width / size.height));
    void c.setLookAt(Math.sin(t * 0.12) * 1.2, 3.6 + fit * 0.6, 11.5 * fit, 0, 0.75, -1, false);
  });

  return (
    <group>
      <Floor level={null} pond={0} y={0} opacity={1} showAxes={false} showStop={false} showGoal={false} />
      <Slabs version={version} dim={false} showStop={false} showGoal={false} />
      <Frogs />
      {font && (
        <>
          <Word font={font} text="Invariant" size={1.25} y={2.45} z={-1.2} face={COLORS.slabTop} side={COLORS.slabSide} phase={0} />
          <Word font={font} text="Frog" size={1.55} y={0.5} z={-1.0} face={COLORS.frog} side="#38952f" phase={1.4} />
        </>
      )}
    </group>
  );
}
