import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { COLORS } from '../constants';
import { Floor } from '../Floor';
import { Frogs } from '../Frogs';
import { frogWorld, yawToward } from '../frogSim';
import { Slabs } from '../AreaLayer';
import { useArea, useHomeLevel, useTitleFont, Word } from './common';

// Draft A: the big extruded title standing on the endless plane, with a loop
// of slabs around it and frogs hopping along the loop.

const PATH: [number, number][] = [];
for (let x = -6; x <= 6; x++) PATH.push([x, 3]);
for (let y = 2; y >= 0; y--) PATH.push([6, y]);
for (let x = 6; x >= -6; x--) PATH.push([x, -1]);
for (let y = 0; y <= 2; y++) PATH.push([-6, y]);

export function ClassicHome() {
  const font = useTitleFont();
  const level = useHomeLevel();
  const version = useArea(PATH);

  useEffect(() => {
    frogWorld.clear();
    const starts = [0, 9, 18, 27];
    const frogs = starts.map((k) =>
      frogWorld.add(level, 'real', { i: BigInt(PATH[k][0]), n: BigInt(PATH[k][1]) }, { hatchT0: performance.now() / 1000 + k * 0.02 }),
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
        void frogWorld.hopTo(level, f, { i: BigInt(x), n: BigInt(y) }, 0.45, true).then(() => {
          const [nx, ny] = PATH[(pos[j] + 1) % PATH.length];
          f.face = yawToward(x, y, nx, ny);
        });
      });
    }, 900);
    void cameraRig.controls?.setLookAt(0, 4.4, 11.5, 0, 1.6, -1, false);
    return () => {
      clearInterval(timer);
      frogWorld.clear();
    };
  }, [level]);

  // slow, subtle camera drift
  const mode = useGame((s) => s.mode);
  useFrame(({ clock, size }) => {
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const t = clock.elapsedTime;
    const fit = Math.max(1, 1.25 / Math.max(0.5, size.width / size.height));
    void c.setLookAt(Math.sin(t * 0.12) * 1.2, 3.6 + fit * 0.6, 11.5 * fit, 0, 0.75, -1, false);
  });

  const words = useMemo(
    () =>
      font && (
        <>
          <Word font={font} text="Invariant" size={1.25} position={[0, 2.45, -1.2]} face={COLORS.slabTop} side={COLORS.slabSide} />
          <Word font={font} text="Frog" size={1.55} position={[0, 0.5, -1.0]} face={COLORS.frog} side="#38952f" phase={1.4} />
        </>
      ),
    [font],
  );

  return (
    <group>
      <Floor level={null} pond={0} y={0} opacity={1} showAxes={false} showStop={false} showGoal={false} />
      <Slabs version={version} dim={false} showStop={false} showGoal={false} />
      <Frogs />
      {words}
    </group>
  );
}
