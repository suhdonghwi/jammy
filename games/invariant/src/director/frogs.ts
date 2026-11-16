import { sfx } from '../audio/sfx';
import { useGame, type Game } from '../game/store';
import type { State } from '../lang/ast';
import { inputsOf, planeKey } from '../levels/inputs';
import { hop, running, toBig, type CompiledLevel } from '../levels/level';
import { eggsNear, tileOf, tileState } from '../levels/tiles';
import { BEAT, HOLD, LONG, ms, SHORT, TICK } from '../motion';
import { cameraRig, type Tile } from '../scene/cameraRig';
import { frogWorld, HOP, HOP_GAP_MS, type FrogKind, type FrogSim } from '../scene/frogs/frogWorld';
import { HATCH_EMERGE, hatchFx } from '../scene/frogs/Hatch';
import { HATCH_GROW } from '../scene/frogs/motion';
import { EGG_ALONE, EGG_ASIDE, occupancy } from '../scene/frogs/occupancy';
import { after, sceneNow, sleep } from '../scene/sceneTime';
import { traceHop } from './codeTrace';
import { joinHopBatch, landInBatch } from './hopBatch';
import { begin, busyWhile, currentLevel, events } from './sequence';

export const HATCH_MS = (HATCH_EMERGE + HATCH_GROW) * 1000;
export const RUN_BEATS = 80;
const TEST_EGGS = 10;
const MAX_HOPS = 40;
const RUN_REACH = 12;
const FROG_LEAVE = SHORT;
const HATCH_STAGGER = 0.02;

export const sceneBusy = (g: Game) => g.busy || g.running || g.stepping;

export function firstEggTiles(count: number): Tile[] {
  const { level, inputs } = useGame.getState();
  return eggsNear(level!, inputs, 0, 0, 30)
    .sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[1] - b[1] || a[0] - b[0])
    .slice(0, count);
}

function runTiles(L: CompiledLevel, egg: State): Tile[] {
  let s = egg;
  for (let k = 0; k < MAX_HOPS && running(L, s); k++) s = hop(L, s);
  const [from, to] = [tileOf(L, egg), tileOf(L, s)];
  return Math.hypot(to[0] - from[0], to[1] - from[1]) <= RUN_REACH ? [from, to] : [from];
}

export function placeFrog(s: State, opts: Partial<FrogSim> = {}): FrogSim {
  const L = currentLevel();
  const [x, y] = tileOf(L, s);
  frogWorld.markHatched(x, y);
  const f = frogWorld.add(L, 'real', s, { home: [x, y], trail: [[x, y]], ...opts });
  f.stopped = !running(L, s);
  return f;
}

export function hatch(s: State): FrogSim {
  const L = currentLevel();
  const [x, y] = tileOf(L, s);
  const slot = occupancy.frogs.has(`${x},${y}`) ? EGG_ASIDE : EGG_ALONE;
  hatchFx.push({ x, y, plane: planeKey(inputsOf(L, s)), dx: slot.dx, dy: slot.dy, s: slot.scale });
  sfx.hatch();
  return placeFrog(s, { hatchT0: sceneNow() + HATCH_EMERGE, slot: { ...slot }, home: [x, y] });
}

function hatchUntrailed(s: State): FrogSim {
  const f = hatch(s);
  f.trail = undefined;
  return f;
}

export function hopFrog(L: CompiledLevel, f: FrogSim, next: State, dur = HOP): Promise<void> {
  const from = f.state;
  const batch = joinHopBatch(() => traceHop(L, from, next, dur));
  return frogWorld.hopTo(L, f, next, dur).then(() => landInBatch(batch));
}

export async function hopOn(L: CompiledLevel, f: FrogSim): Promise<void> {
  const next = hop(L, f.state);
  await hopFrog(L, f, next);
  f.stopped = !running(L, next);
}

export async function whileStepping<T>(body: () => Promise<T>): Promise<T> {
  useGame.setState({ stepping: true });
  try {
    return await body();
  } finally {
    useGame.setState({ stepping: false });
  }
}

async function sendFrogHome(f: FrogSim) {
  f.leave = { t0: sceneNow(), dur: FROG_LEAVE };
  const home = f.home;
  if (home && !frogWorld.frogs.some((g) => !g.leave && g.home?.[0] === home[0] && g.home?.[1] === home[1])) frogWorld.returnEgg(...home);
  await sleep(ms(FROG_LEAVE));
  frogWorld.remove(f);
}

export async function sendFrogsHome(kind?: FrogKind): Promise<void> {
  const going = frogWorld.frogs.filter((f) => !f.leave && (!kind || f.kind === kind));
  await Promise.all(going.map(sendFrogHome));
}

function movingFrogs(): FrogSim[] {
  const plane = planeKey(useGame.getState().inputs);
  return frogWorld.frogs.filter((f) => f.kind === 'real' && !f.stopped && f.plane === plane);
}

async function hopAllOnce(): Promise<number> {
  const L = currentLevel();
  const frogs = movingFrogs();
  if (frogs.length === 0) return 0;
  await whileStepping(() => Promise.all(frogs.map((f) => hopOn(L, f))));
  return frogs.length;
}

export async function testEggs() {
  if (sceneBusy(useGame.getState())) return;
  const finished = await busyWhile(async (tok) => {
    useGame.setState({ failMark: null });
    await sendFrogsHome();
    if (!tok.alive) return false;
    const L = currentLevel();
    const { inputs } = useGame.getState();
    const eggs = firstEggTiles(TEST_EGGS).map(([x, y]) => toBig(tileState(L, x, y, inputs)));
    if (eggs.length) {
      await cameraRig.arrive({ focus: eggs.flatMap((s) => runTiles(L, s)) });
      if (!tok.alive) return false;
    }
    eggs.forEach((s, i) => after(ms(i * HATCH_STAGGER), () => tok.alive && hatchUntrailed(s)));
    await sleep(ms(Math.max(0, eggs.length - 1) * HATCH_STAGGER) + HATCH_MS + ms(TICK));
    for (let beats = 0; tok.alive && beats < RUN_BEATS; beats++) {
      if ((await hopAllOnce()) === 0) break;
      await sleep(HOP_GAP_MS);
    }
    return tok.alive;
  });
  if (finished) events.emit('runDone');
}

export function loopFrogs(eggs: State[]) {
  const tok = begin();
  const L = currentLevel();
  void (async () => {
    await sleep(ms(LONG));
    for (let k = 0; tok.alive; k = (k + 1) % eggs.length) {
      const f = hatchUntrailed(eggs[k]);
      await sleep(HATCH_MS + ms(BEAT));
      while (tok.alive && !f.stopped) {
        await hopOn(L, f);
        await sleep(HOP_GAP_MS);
      }
      await sleep(ms(HOLD));
      if (!tok.alive) return;
      await sendFrogHome(f);
      await sleep(ms(LONG));
    }
  })();
}
