import { useGame } from '../game/store';
import { t } from '../i18n/i18n';
import type { State } from '../lang/ast';
import { planeKey } from '../levels/inputs';
import { running, toBig } from '../levels/level';
import { eggsNear, tileState } from '../levels/tiles';
import { cameraRig, type Tile } from '../scene/cameraRig';
import { frogWorld, HOP_GAP_MS, type FrogSim } from '../scene/frogs/frogWorld';
import { sleep } from '../scene/sceneTime';
import { firstEggTiles, hatch, hopOn, RUN_BEATS, sceneBusy, sendFrogsHome, whileStepping } from './frogs';
import { eggRegion } from './regions';
import { begin, currentLevel, events } from './sequence';

const EGG_POINT_REACH = 12;

function currentFrog(): FrogSim | undefined {
  const plane = planeKey(useGame.getState().inputs);
  return frogWorld.frogs.filter((f) => f.kind === 'real' && !f.leave && f.plane === plane).at(-1);
}

function nearestEgg(radius: number): Tile | undefined {
  const { level, inputs } = useGame.getState();
  const { x: tx, y: ty } = cameraRig.viewCenter();
  return eggsNear(level!, inputs, Math.round(tx), Math.round(ty), Math.ceil(radius))
    .filter(([x, y]) => !frogWorld.hatched.has(`${x},${y}`) && Math.hypot(x - tx, y - ty) <= radius)
    .sort((a, b) => Math.hypot(a[0] - tx, a[1] - ty) - Math.hypot(b[0] - tx, b[1] - ty))[0];
}

function nothingToHop(f: FrogSim | undefined) {
  if (useGame.getState().mode !== 'level') return;
  if (f) {
    useGame.setState({ callouts: [{ x: f.x, y: f.y, frog: f.id, text: t().level.frogStopped, tone: 'info' }] });
    cameraRig.include([[f.x, f.y]]);
    return;
  }
  const tile = nearestEgg(EGG_POINT_REACH) ?? firstEggTiles(1)[0];
  if (!tile) return;
  useGame.setState({ region: { ...eggRegion('info'), id: 'pick-egg' }, callouts: [{ x: tile[0], y: tile[1], text: t().level.pickEgg, tone: 'info' }] });
  cameraRig.include([tile]);
}

export async function stepFrogs(scripted = false) {
  const g = useGame.getState();
  if (sceneBusy(g)) return;
  if (!scripted && g.mode === 'tutorial' && !g.tutorial.allow.step) return;
  const L = currentLevel();
  const f = currentFrog();
  if (!f || !running(L, f.state)) return nothingToHop(f);
  useGame.setState({ failMark: null, callouts: g.mode === 'level' ? [] : g.callouts });
  await whileStepping(() => hopOn(L, f));
  events.emit('stepped');
}

export async function runFrogs() {
  const g = useGame.getState();
  if (sceneBusy(g)) return;
  if (g.mode === 'tutorial' && !g.tutorial.allow.run) return;
  const L = currentLevel();
  const f = currentFrog();
  if (!f || !running(L, f.state)) return nothingToHop(f);
  const tok = begin();
  useGame.setState({ failMark: null, running: true });
  void sendFrogsHome('test');
  for (let beats = 0; tok.alive && useGame.getState().running && beats < RUN_BEATS && !f.leave && running(L, f.state); beats++) {
    await whileStepping(() => hopOn(L, f));
    await sleep(HOP_GAP_MS);
  }
  if (tok.alive) {
    useGame.setState({ running: false });
    if (f.stopped) events.emit('runDone');
  }
}

export function pauseRun() {
  useGame.setState({ running: false });
}

function pickEgg(s: State) {
  const g = useGame.getState();
  if (g.busy) return;
  if (g.mode === 'level') {
    void sendFrogsHome('real');
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
