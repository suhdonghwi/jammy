import type { State } from '../lang/ast';
import { holds } from '../lang/eval';
import { hop, running } from '../levels/level';
import { tileOf } from '../levels/tiles';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { ARC_DRAW, hopArcs } from '../scene/frogs/HopArcs';
import { after, sceneNow } from '../scene/sceneTime';
import { sfx } from '../audio/sfx';
import { currentLevel } from './sequence';

export const GHOST_RISE = 0.6;
const TURNS = 2;

export function raiseGhost(s: State, delay = 0, fade = 1): FrogSim {
  const L = currentLevel();
  const t0 = sceneNow() + delay;
  const f = frogWorld.add(L, 'test', s, { rise: { t0, dur: GHOST_RISE, turns: TURNS }, fade });
  after((delay + GHOST_RISE) * 1000, () => {
    if (frogWorld.frogs.includes(f) && !running(L, f.state) && holds(L.post, f.state)) frogWorld.landOnGoal(f);
  });
  return f;
}

export function previewHop(s: State, delay = 0, fade = 1): FrogSim {
  const L = currentLevel();
  const f = raiseGhost(s, delay, fade);
  const [tx, ty] = tileOf(L, hop(L, s));
  hopArcs.add({
    frog: f.id,
    fx: f.x,
    fy: f.y,
    tx,
    ty,
    plane: f.plane,
    t0: sceneNow() + delay + GHOST_RISE + 0.1,
    fade,
  });
  after((delay + GHOST_RISE + 0.1 + ARC_DRAW) * 1000, () => frogWorld.frogs.includes(f) && sfx.landing());
  return f;
}
