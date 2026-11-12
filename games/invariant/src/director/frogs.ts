import { sfx } from '../audio/sfx';
import { useGame } from '../game/store';
import { t } from '../i18n/i18n';
import type { State } from '../lang/ast';
import { hop, inputsOf, planeKey, running, toBig, type CompiledLevel } from '../levels/level';
import { eggsNear, tileState } from '../levels/tiles';
import { field } from '../scene/area/field';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld, type FrogKind, type FrogSim } from '../scene/frogs/frogWorld';
import { burstFx } from '../scene/frogs/Burst';
import { clearTrace } from '../scene/frogs/codeTrace';
import { hopArcs } from '../scene/frogs/HopArcs';
import { HATCH_EMERGE, hatchFx } from '../scene/frogs/Hatch';
import { occupancy } from '../scene/frogs/occupancy';
import { after, sceneNow, sleep } from '../scene/sceneTime';
import { eggRegion } from './regions';
import { abandonCheck, begin, currentLevel, events } from './sequence';

const TEST_EGGS = 10;
const RUN_BEATS = 80;
const EGG_POINT_REACH = 12;

function eggStatesNear(maxCount: number, radius: number): State[] {
  const L = currentLevel();
  const { inputs } = useGame.getState();
  const { x: tx, y: ty } = cameraRig.viewCenter();
  return eggsNear(L, inputs, Math.round(tx), Math.round(ty), Math.ceil(radius))
    .filter(([x, y]) => !frogWorld.hatched.has(`${x},${y}`) && Math.hypot(x - tx, y - ty) <= radius)
    .sort((a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty))
    .slice(0, maxCount)
    .map(([x, y]) => toBig(tileState(L, x, y, inputs)));
}

const MAX_HOPS = 40;
const RUN_REACH = 12;

function runTiles(L: CompiledLevel, egg: State): (readonly [number, number])[] {
  const at = (s: State) => [Number(s[L.view.x]), Number(s[L.view.y])] as const;
  let s = egg;
  for (let k = 0; k < MAX_HOPS && running(L, s); k++) s = hop(L, s);
  const [from, to] = [at(egg), at(s)];
  return Math.hypot(to[0] - from[0], to[1] - from[1]) <= RUN_REACH ? [from, to] : [from];
}

function firstEggs(count: number): State[] {
  const L = currentLevel();
  const { inputs } = useGame.getState();
  return eggsNear(L, inputs, 0, 0, 30)
    .sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[1] - b[1] || a[0] - b[0])
    .slice(0, count)
    .map(([x, y]) => toBig(tileState(L, x, y, inputs)));
}

export function hatch(s: State): FrogSim {
  const L = currentLevel();
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  const slot = occupancy.eggSlots.get(`${x},${y}`) ?? { dx: 0, dy: 0, scale: 1 };
  hatchFx.push({ x, y, plane: planeKey(inputsOf(L, s)), dx: slot.dx, dy: slot.dy, s: slot.scale });
  sfx.hatch();
  return placeFrog(s, { hatchT0: sceneNow() + HATCH_EMERGE, ox: slot.dx, oy: slot.dy, os: slot.scale, home: [x, y] });
}

function movingFrogs(): FrogSim[] {
  const plane = planeKey(useGame.getState().inputs);
  return frogWorld.frogs.filter((f) => f.kind === 'real' && !f.stopped && f.plane === plane);
}

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

export function interrupt() {
  begin();
  abandonCheck();
  clearTrace();
  frogWorld.clear();
  occupancy.eggs = new Set();
  hatchFx.clear();
  burstFx.clear();
  hopArcs.clear();
  useGame.setState({ busy: false, running: false, stepping: false, failMark: null, pending: [] });
}

export function resetLevel() {
  interrupt();
  field.reset();
}

export function resetFrogs() {
  begin();
  clearTrace();
  void dismissFrogs();
  useGame.setState({ running: false, failMark: null });
}

const FROG_LEAVE = 0.3;

export async function dismissFrogs(kind?: FrogKind): Promise<void> {
  const going = frogWorld.frogs.filter((f) => !f.leave && (!kind || f.kind === kind));
  await Promise.all(going.map(sendHome));
}

export function placeFrog(s: State, opts: Partial<FrogSim> = {}): FrogSim {
  const L = currentLevel();
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  frogWorld.markHatched(x, y);
  const f = frogWorld.add(L, 'real', s, { home: [x, y], ...opts });
  f.stopped = !running(L, s);
  return f;
}

function currentFrog(): FrogSim | undefined {
  const plane = planeKey(useGame.getState().inputs);
  return frogWorld.frogs.filter((f) => f.kind === 'real' && !f.leave && f.plane === plane).at(-1);
}

async function hopOnce(f: FrogSim, dur = 0.42) {
  const L = currentLevel();
  const n = hop(L, f.state);
  useGame.setState({ stepping: true });
  try {
    await frogWorld.hopTo(L, f, n, dur);
    f.stopped = !running(L, n);
  } finally {
    useGame.setState({ stepping: false });
  }
}

function nothingToHop(f: FrogSim | undefined) {
  if (useGame.getState().mode !== 'level') return;
  if (f) {
    useGame.setState({ callouts: [{ x: f.x, y: f.y, frog: f.id, text: t().level.frogStopped, tone: 'info' }] });
    cameraRig.include([[f.x, f.y]]);
    return;
  }
  const egg = eggStatesNear(1, EGG_POINT_REACH)[0] ?? firstEggs(1)[0];
  if (!egg) return;
  const L = currentLevel();
  const tile = [Number(egg[L.view.x]), Number(egg[L.view.y])] as const;
  useGame.setState({ region: { ...eggRegion('info'), id: 'pick-egg' }, callouts: [{ x: tile[0], y: tile[1], text: t().level.pickEgg, tone: 'info' }] });
  cameraRig.include([tile]);
}

export async function stepFrogs(scripted = false) {
  const g = useGame.getState();
  if (g.busy || g.running || g.stepping) return;
  if (!scripted && g.mode === 'tutorial' && !g.tutorial.allow.step) return;
  const f = currentFrog();
  if (!f || !running(currentLevel(), f.state)) return nothingToHop(f);
  useGame.setState({ failMark: null, callouts: g.mode === 'level' ? [] : g.callouts });
  await hopOnce(f);
  events.emit('stepped');
}

export async function runFrogs() {
  const g = useGame.getState();
  if (g.busy || g.running || g.stepping) return;
  if (g.mode === 'tutorial' && !g.tutorial.allow.run) return;
  const L = currentLevel();
  const f = currentFrog();
  if (!f || !running(L, f.state)) return nothingToHop(f);
  const tok = begin();
  useGame.setState({ failMark: null, running: true });
  void dismissFrogs('test');
  for (let beats = 0; tok.alive && useGame.getState().running && beats < RUN_BEATS && !f.leave && running(L, f.state); beats++) {
    await hopOnce(f, 0.34);
    await sleep(90);
  }
  if (tok.alive) {
    useGame.setState({ running: false });
    if (f.stopped) events.emit('runDone');
  }
}

export async function testEggs() {
  const g = useGame.getState();
  if (g.busy || g.running || g.stepping) return;
  const tok = begin();
  useGame.setState({ failMark: null, busy: true });
  await dismissFrogs();
  if (!tok.alive) return;
  const L = currentLevel();
  const eggs = firstEggs(TEST_EGGS);
  if (eggs.length) {
    await cameraRig.arrive({ focus: eggs.flatMap((s) => runTiles(L, s)) });
    if (!tok.alive) return;
  }
  eggs.forEach((s, i) => after(i * 6, () => tok.alive && hatch(s)));
  await sleep(Math.min(900, 300 + eggs.length * 6) + HATCH_EMERGE * 1000);
  for (let beats = 0; tok.alive && beats < RUN_BEATS; beats++) {
    if ((await hopAllOnce(0.34)) === 0) break;
    await sleep(90);
  }
  if (tok.alive) {
    useGame.setState({ busy: false });
    events.emit('runDone');
  }
}

export function pauseRun() {
  useGame.setState({ running: false });
}

function pickEgg(s: State) {
  const g = useGame.getState();
  if (g.busy) return;
  if (g.mode === 'level') {
    void dismissFrogs('real');
    useGame.setState({ running: false, failMark: null, callouts: [], region: null });
  }
  hatch(s);
}

export function tileClickable(x: number, y: number): boolean {
  const g = useGame.getState();
  if (g.busy || !g.reveal.eggs || !g.level) return false;
  if (g.mode === 'tutorial' && !g.tutorial.allow.eggs) return false;
  if (frogWorld.hatched.has(`${x},${y}`)) return false;
  return eggsNear(g.level, g.inputs, x, y, 0).some(([ex, ey]) => ex === x && ey === y);
}

export function clickTile(x: number, y: number) {
  if (!tileClickable(x, y)) return;
  const { level, inputs } = useGame.getState();
  pickEgg(toBig(tileState(level!, x, y, inputs)));
}

export function loopFrogs(eggs: State[]) {
  const tok = begin();
  const L = currentLevel();
  void (async () => {
    await sleep(400);
    for (let k = 0; tok.alive; k = (k + 1) % eggs.length) {
      const f = hatch(eggs[k]);
      await sleep(650);
      while (tok.alive && !f.stopped) {
        const n = hop(L, f.state);
        await frogWorld.hopTo(L, f, n, 0.42);
        f.stopped = !running(L, n);
        await sleep(160);
      }
      await sleep(1200);
      if (!tok.alive) return;
      await sendHome(f);
      await sleep(500);
    }
  })();
}

async function sendHome(f: FrogSim) {
  f.leave = { t0: sceneNow(), dur: FROG_LEAVE };
  await sleep(FROG_LEAVE * 1000 + 50);
  frogWorld.remove(f);
  const home = f.home;
  if (home && !frogWorld.frogs.some((g) => g.home?.[0] === home[0] && g.home?.[1] === home[1])) frogWorld.returnEgg(...home);
}

export function sendFrogsHome() {
  begin();
  void dismissFrogs('real');
}
