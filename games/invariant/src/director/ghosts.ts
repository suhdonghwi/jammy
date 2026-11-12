import type { State } from '../lang/ast';
import { hop } from '../levels/level';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { ARC_DRAW, hopArcs } from '../scene/frogs/HopArcs';
import { after, sceneNow } from '../scene/sceneTime';
import { sfx } from '../audio/sfx';
import { currentLevel } from './sequence';

export const GHOST_RISE = 0.6;
const TURNS = 2;

export function raiseGhost(s: State, delay = 0, fade = 1): FrogSim {
  const t0 = sceneNow() + delay;
  return frogWorld.add(currentLevel(), 'test', s, { rise: { t0, dur: GHOST_RISE, turns: TURNS }, fade });
}

export function previewHop(s: State, delay = 0, fade = 1): FrogSim {
  const L = currentLevel();
  const f = raiseGhost(s, delay, fade);
  const to = hop(L, s);
  hopArcs.add({
    frog: f.id,
    fx: f.x,
    fy: f.y,
    tx: Number(to[L.view.x]),
    ty: Number(to[L.view.y]),
    plane: f.plane,
    t0: sceneNow() + delay + GHOST_RISE + 0.1,
    fade,
  });
  after((delay + GHOST_RISE + 0.1 + ARC_DRAW) * 1000, () => frogWorld.frogs.includes(f) && sfx.landing());
  return f;
}
