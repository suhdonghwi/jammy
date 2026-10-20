import gsap from 'gsap';
import { sfx } from '../audio/sfx';
import { useGame } from '../game/store';
import type { State } from '../lang/ast';
import { hop, inputsOf, planeKey, running, startView, toBig } from '../levels/level';
import { eggsNear, tileState } from '../levels/tiles';
import { field } from '../scene/area/field';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { HATCH_EMERGE, hatchFx } from '../scene/frogs/Hatch';
import { occupancy } from '../scene/frogs/occupancy';
import { handState } from '../scene/hand/handState';
import { after, sceneNow, sleep } from '../scene/sceneTime';
import { events } from './events';
import { begin, currentLevel } from './sequence';

// The learner's frogs: hatching from eggs, Step, Run and Pause, and clearing
// the board.

/** How many eggs Run hatches, from the smallest inputs up. */
const RUN_EGGS = 10;

/** Unhatched eggs around the camera's target, nearest first. */
function eggStatesNear(maxCount: number, radius: number): State[] {
  const L = currentLevel();
  const { inputs } = useGame.getState();
  const t = cameraRig.target();
  const tx = t.x;
  const ty = -t.z;
  return eggsNear(L, inputs, Math.round(tx), Math.round(ty), Math.ceil(radius))
    .filter(([x, y]) => !frogWorld.hatched.has(`${x},${y}`) && Math.hypot(x - tx, y - ty) <= radius)
    .sort((a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty))
    .slice(0, maxCount)
    .map(([x, y]) => toBig(tileState(L, x, y, inputs)));
}

/** The first eggs, from the smallest inputs up: the ones nearest the origin. */
function firstEggs(count: number): State[] {
  const L = currentLevel();
  const { inputs } = useGame.getState();
  return eggsNear(L, inputs, 0, 0, 30)
    .sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[1] - b[1] || a[0] - b[0])
    .slice(0, count)
    .map(([x, y]) => toBig(tileState(L, x, y, inputs)));
}

/** The egg at state s cracks open and a real frog climbs out from where it sat. */
export function hatch(s: State): FrogSim {
  const L = currentLevel();
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  const slot = occupancy.eggSlots.get(`${x},${y}`) ?? { dx: 0, dy: 0, scale: 1 };
  hatchFx.push({ x, y, plane: planeKey(inputsOf(L, s)), dx: slot.dx, dy: slot.dy, s: slot.scale });
  sfx.hatch();
  return placeFrog(s, { hatchT0: sceneNow() + HATCH_EMERGE, ox: slot.dx, oy: slot.dy, os: slot.scale });
}

/** Real frogs in the focused plane that still have hops to make. */
function movingFrogs(): FrogSim[] {
  const plane = planeKey(useGame.getState().inputs);
  return frogWorld.frogs.filter((f) => f.kind === 'real' && !f.stopped && f.plane === plane);
}

/**
 * One hop for every moving frog. `stepping` stays on while they are in the
 * air, so nothing else (Step, Run, an egg) can start hops that would fight
 * over the same frogs — e.g. Step pressed right after Pause.
 */
async function hopAllOnce(dur = 0.42): Promise<number> {
  const L = currentLevel();
  const frogs = movingFrogs();
  if (frogs.length === 0) return 0;
  useGame.setState({ stepping: true });
  try {
    await Promise.all(
      frogs.map((f) => {
        const n = hop(L, f.state);
        return frogWorld.hopTo(L, f, n, dur).then(() => {
          f.stopped = !running(L, n);
        });
      }),
    );
  } finally {
    useGame.setState({ stepping: false });
  }
  return frogs.length;
}

/**
 * Stop whatever is playing (hand, checks, hatching) and clear frogs and
 * markers, keeping the level itself: the tutorial uses this to rewind a step.
 */
export function interrupt() {
  begin();
  frogWorld.clear();
  occupancy.eggs = new Set();
  hatchFx.clear();
  handState.visible = 0;
  useGame.setState({ busy: false, running: false, stepping: false, checking: false, failMark: null });
}

/** A fresh board for a level that is opening (or closing). */
export function resetLevel() {
  interrupt();
  field.reset();
}

/** Reset: every frog goes, and the eggs are back (the area stays). */
export function resetFrogs() {
  begin();
  frogWorld.clear();
  useGame.setState({ running: false, failMark: null });
}

/** Put a real frog straight on its tile, its egg gone: rebuilding a scene (`opts`: how it appears, as when hatching). */
export function placeFrog(s: State, opts: Partial<FrogSim> = {}): FrogSim {
  const L = currentLevel();
  frogWorld.markHatched(Number(s[L.view.x]), Number(s[L.view.y]));
  const f = frogWorld.add(L, 'real', s, opts);
  f.stopped = !running(L, s);
  return f;
}

/** Step: every moving frog hops once (with none on the board, the nearest egg hatches). `scripted`: the tutorial's own steps. */
export async function stepFrogs(scripted = false) {
  const g = useGame.getState();
  if (g.busy || g.running || g.stepping) return;
  if (!scripted && g.mode === 'tutorial' && !g.tutorialAllow.step) return;
  if (movingFrogs().length === 0 && !frogWorld.frogs.some((f) => f.kind === 'real')) {
    const eggs = eggStatesNear(1, 6);
    if (eggs.length) hatch(eggs[0]);
    return;
  }
  await hopAllOnce();
  events.emit('stepped');
}

/** Run: hatch the first eggs (unless frogs are already out) and hop until every frog stops. */
export async function runFrogs() {
  const g = useGame.getState();
  if (g.busy || g.running || g.stepping) return;
  if (g.mode === 'tutorial' && !g.tutorialAllow.run) return;
  const tok = begin();
  frogWorld.clear('test');
  // running from the first moment (Step is disabled while eggs hatch)
  useGame.setState({ failMark: null, running: true });
  gsap.to(handState, { visible: 0, duration: 0.3 });
  if (movingFrogs().length === 0) {
    frogWorld.clear('real');
    const L = currentLevel();
    const eggs = firstEggs(RUN_EGGS);
    // looking somewhere else: back to the level's starting view first, where the first eggs are
    if (eggs.length && !cameraRig.inView(Number(eggs[0][L.view.x]), Number(eggs[0][L.view.y]), 1.4)) {
      const v = startView(L);
      void cameraRig.resetAngle();
      await cameraRig.lookAtTile(v.x, v.y, v.distance);
      if (!tok.alive) return;
    }
    eggs.forEach((s, i) => after(i * 6, () => tok.alive && hatch(s)));
    await sleep(Math.min(900, 300 + eggs.length * 6) + HATCH_EMERGE * 1000);
  }
  for (let beats = 0; tok.alive && useGame.getState().running && beats < 80; beats++) {
    if ((await hopAllOnce(0.34)) === 0) break;
    await sleep(90);
  }
  if (tok.alive) {
    useGame.setState({ running: false });
    // only a run where every frog has stopped counts as done (not a pause)
    if (movingFrogs().length === 0) events.emit('runDone');
  }
}

export function pauseRun() {
  useGame.setState({ running: false });
}

/** Clicking an egg: its frog hatches and hops all the way (or joins a run in progress). */
async function runEgg(s: State) {
  const g = useGame.getState();
  if (g.busy || g.stepping) return;
  const f = hatch(s);
  if (g.running) return;
  useGame.setState({ stepping: true });
  try {
    await sleep(350);
    const L = currentLevel();
    for (let k = 0; !f.stopped && k < 60 && frogWorld.frogs.includes(f); k++) {
      const n = hop(L, f.state);
      await frogWorld.hopTo(L, f, n, 0.36);
      f.stopped = !running(L, n);
    }
  } finally {
    useGame.setState({ stepping: false });
  }
}

/** Would a click on this tile do something? It does on an unhatched egg, while eggs can be clicked. */
export function tileClickable(x: number, y: number): boolean {
  const g = useGame.getState();
  if (g.busy || !g.reveal.eggs || !g.level) return false;
  if (g.mode === 'tutorial' && !g.tutorialAllow.eggs) return false;
  if (frogWorld.hatched.has(`${x},${y}`)) return false;
  return eggsNear(g.level, g.inputs, x, y, 0).some(([ex, ey]) => ex === x && ey === y);
}

/** A click on the floor: an unhatched egg runs its frog. */
export function clickTile(x: number, y: number) {
  if (!tileClickable(x, y)) return;
  const { level, inputs } = useGame.getState();
  void runEgg(toBig(tileState(level!, x, y, inputs)));
}
