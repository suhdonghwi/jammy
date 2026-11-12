import { useEffect, useRef } from 'react';
import { compileFormula, compileLevel, type Formula, type Inputs } from '../../levels/level';
import { useArea } from '../area/AreaLayer';
import { GoalColumns } from '../area/GoalColumns';
import { Slabs } from '../area/Slabs';
import { Floor } from '../floor/Floor';
import { Frogs } from '../frogs/Frogs';
import { frogWorld, HOP, yawToward } from '../frogs/frogWorld';
import { HATCH_EMERGE, HatchShells, hatchFx } from '../frogs/Hatch';
import { goalEvents } from '../goalEvents';
import { after, sceneNow } from '../sceneTime';
import { StartEggs, type StartEgg } from './StartEggs';
import { useHomeCamera } from './useHomeCamera';

const DIAGONAL = compileLevel({
  id: 'home-diagonal',
  title: 'home',
  source: `var x, y;
while (x < y) {
  x = x + 1;
}
ensures x == y && x >= 2 && x <= 9;`,
  view: { x: 'x', y: 'y' },
  solutions: [],
});

const RING = { x0: 1, y0: 8, w: 7, h: 5 };
const FROGS = 5;
const EGG_IN = 0.25;
const EGG_HOLD = 0.9;
const EGG_STAGGER = 0.3;
const BEAT = 950;

function edgePath({ x0, y0, w, h }: typeof RING): [number, number][] {
  const p: [number, number][] = [];
  for (let x = x0; x < x0 + w; x++) p.push([x, y0 + h - 1]);
  for (let y = y0 + h - 2; y >= y0; y--) p.push([x0 + w - 1, y]);
  for (let x = x0 + w - 2; x >= x0; x--) p.push([x, y0]);
  for (let y = y0 + 1; y < y0 + h - 1; y++) p.push([x0, y]);
  return p;
}
const PATH = edgePath(RING);

function ringArea({ x0, y0, w, h }: typeof RING): Formula {
  const [x1, y1] = [x0 + w - 1, y0 + h - 1];
  const f = compileFormula(DIAGONAL, `${x0} <= x <= ${x1} && ${y0} <= y <= ${y1} && (x == ${x0} || x == ${x1} || y == ${y0} || y == ${y1})`);
  if (!f.ok) throw f.error;
  return f;
}
const AREA = ringArea(RING);
const NO_INPUTS: Inputs = {};

export function HomeScene() {
  useHomeCamera();

  useArea(DIAGONAL, NO_INPUTS, AREA);

  const eggs = useRef<StartEgg[]>([]);
  useEffect(() => {
    frogWorld.clear();
    const pos = Array.from({ length: FROGS }, (_, j) => Math.floor((j * PATH.length) / FROGS));
    const t0 = sceneNow();
    const timers: (() => void)[] = [];
    eggs.current = [];
    const frogs = pos.map((k, j) => {
      const [x, y] = PATH[k];
      const hatch = t0 + EGG_IN + EGG_HOLD + j * EGG_STAGGER;
      eggs.current.push({ x, y, appear: t0 + EGG_IN + j * 0.1, hatch });
      timers.push(after((hatch - t0) * 1000, () => hatchFx.push({ x, y, plane: '', dx: 0, dy: 0, s: 1 })));
      const f = frogWorld.add(DIAGONAL, 'real', { x: BigInt(x), y: BigInt(y) }, { hatchT0: hatch + HATCH_EMERGE });
      const [nx, ny] = PATH[(k + 1) % PATH.length];
      f.face = f.yaw = yawToward(x, y, nx, ny);
      return f;
    });
    const lastOut = Math.max(...frogs.map((f) => f.hatchT0 ?? t0)) + 0.6;
    const beat = () => {
      timers.push(after(BEAT, beat));
      if (sceneNow() < lastOut) return;
      frogs.forEach((f, j) => {
        pos[j] = (pos[j] + 1) % PATH.length;
        const [x, y] = PATH[pos[j]];
        void frogWorld.hopTo(DIAGONAL, f, { x: BigInt(x), y: BigInt(y) }, HOP, true).then(() => {
          const [nx, ny] = PATH[(pos[j] + 1) % PATH.length];
          f.face = yawToward(x, y, nx, ny);
        });
      });
    };
    timers.push(after(BEAT, beat));

    return () => {
      timers.forEach((cancel) => cancel());
      hatchFx.clear();
      frogs.forEach((f) => frogWorld.remove(f));
      goalEvents.clear();
    };
  }, []);

  return (
    <group>
      <Floor level={DIAGONAL} inputs={NO_INPUTS} fadeIn={2.6} showAxes={false} />
      <Slabs level={DIAGONAL} dim={false} showStop showGoal />
      <GoalColumns />
      <StartEggs eggs={eggs} />
      <Frogs />
      <HatchShells />
    </group>
  );
}
