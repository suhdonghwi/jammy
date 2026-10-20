import type { State } from '../lang/ast';
import { hop, inputsOf, running, toBig } from '../levels/level';
import { eggsNear, tileState } from '../levels/tiles';
import { burstFx } from '../scene/frogs/Burst';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { sceneNow } from '../scene/sceneTime';
import { currentLevel } from './sequence';

export const GHOST_RISE = 0.95;
const TURNS = 2;

export function raiseGhost(s: State, delay = 0, fade = 1): FrogSim {
  const t0 = sceneNow() + delay;
  const f = frogWorld.add(currentLevel(), 'test', s, { rise: { t0, dur: GHOST_RISE, turns: TURNS }, fade });
  burstFx.push(f.x, f.y, f.plane, t0 + GHOST_RISE * 0.18, fade);
  return f;
}

const REACH_HOPS = 16;
const REACH_EGGS = 10;

export function realRunTo(s: State): State[] | null {
  const L = currentLevel();
  const inputs = inputsOf(L, s);
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  let best: State[] | null = null;
  for (const [ex, ey] of eggsNear(L, inputs, x, y, REACH_EGGS)) {
    let cur = toBig(tileState(L, ex, ey, inputs));
    const path = [cur];
    for (let k = 0; k <= REACH_HOPS && (!best || path.length < best.length); k++) {
      if (Number(cur[L.view.x]) === x && Number(cur[L.view.y]) === y) {
        best = path;
        break;
      }
      if (!running(L, cur)) break;
      cur = hop(L, cur);
      path.push(cur);
    }
  }
  return best;
}
