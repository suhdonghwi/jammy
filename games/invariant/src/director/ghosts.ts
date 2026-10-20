import type { State } from '../lang/ast';
import { burstFx } from '../scene/frogs/Burst';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { sceneNow } from '../scene/sceneTime';
import { currentLevel } from './sequence';

export const GHOST_RISE = 0.95;
const TURNS = 2;

export function raiseGhost(s: State, delay = 0): FrogSim {
  const t0 = sceneNow() + delay;
  const f = frogWorld.add(currentLevel(), 'test', s, { rise: { t0, dur: GHOST_RISE, turns: TURNS } });
  burstFx.push(f.x, f.y, f.plane, t0 + GHOST_RISE * 0.18);
  return f;
}
