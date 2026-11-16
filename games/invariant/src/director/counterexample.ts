import { sfx } from '../audio/sfx';
import type { Counterexample } from '../checker/types';
import { useGame, type Caption, type CaptionTone } from '../game/store';
import { t as messages } from '../i18n/i18n';
import type { State } from '../lang/ast';
import { inputsOf, planeKey } from '../levels/inputs';
import { showState } from '../levels/level';
import { tileOf } from '../levels/tiles';
import { BEAT, EXIT, ms } from '../motion';
import { cameraRig } from '../scene/cameraRig';
import { PLANE_SHIFT } from '../scene/planeShift';
import { HOP, type FrogSim } from '../scene/frogs/frogWorld';
import { sceneNow, sleep } from '../scene/sceneTime';
import { hatch, HATCH_MS, hopFrog, sendFrogsHome } from './frogs';
import { GHOST_RISE, raiseGhost } from './ghosts';
import { busyWhile, currentLevel, type Token } from './sequence';

export interface CounterexampleOptions {
  prefix?: string;
  area?: string;
  tone?: CaptionTone;
  extra?: string;
  ghostExtra?: string;
  action?: () => Caption['action'];
}

const fmt = (s: State) => '`' + showState(currentLevel(), s) + '`';

function markFailure(x: number, y: number, label: string) {
  useGame.setState({ failMark: { x, y, label, t0: sceneNow() } });
  sfx.fail();
}

const SHIFT_BEFORE_GLIDE = 0.6;

async function focusOn(tok: Token, cex: Counterexample, leaving: Promise<void>) {
  const L = currentLevel();
  const inputs = inputsOf(L, cex.state);
  if (planeKey(inputs) !== planeKey(useGame.getState().inputs)) {
    await sleep(ms(EXIT));
    if (!tok.alive) return;
    useGame.setState({ inputs });
    await sleep(ms(PLANE_SHIFT * SHIFT_BEFORE_GLIDE));
    if (!tok.alive) return;
  }
  const tile = (s: State) => tileOf(L, s);
  const labels = [cex.state, cex.next].flatMap((s) => (s ? [tile(s)] : []));
  await Promise.all([cameraRig.arrive({ labels, focus: (cex.run ?? []).map(tile) }), leaving]);
}

export function playCounterexample(cex: Counterexample, opts: CounterexampleOptions = {}) {
  return busyWhile((tok) => counterexample(tok, cex, opts));
}

const REAL_RUN_SECONDS = 6;
const FASTEST_HOP = 0.08;

export async function counterexample(tok: Token, cex: Counterexample, opts: CounterexampleOptions) {
  const L = currentLevel();
  useGame.setState({ failMark: null, region: null });
  const [x, y] = tileOf(L, cex.state);
  await focusOn(tok, cex, sendFrogsHome());
  if (!tok.alive) return;
  const say = messages().verdicts;
  const prefix = opts.prefix ?? (cex.far ? say.far : '');
  const area = opts.area ?? say.yourArea;
  const broken = cex.broken ? (cex.rule === 'maintenance' ? say.noLongerHolds(cex.broken) : say.falseThere(cex.broken)) : '';
  const run = cex.run;
  let f: FrogSim;
  if (run) {
    f = hatch(run[0]);
    await sleep(HATCH_MS);
    const pace = Math.max(FASTEST_HOP, Math.min(HOP, REAL_RUN_SECONDS / run.length));
    for (const s of run.slice(1)) {
      if (!tok.alive) return;
      await hopFrog(L, f, s, pace);
    }
  } else {
    sfx.ghost();
    f = raiseGhost(cex.state);
    await sleep(ms(GHOST_RISE + BEAT));
  }
  if (!tok.alive) return;
  const from = run ? run[0] : null;
  let text: string;
  if (cex.rule === 'initialization') {
    markFailure(x, y, say.startsOutsideTag(area));
    text = `${prefix}${say.startsOutside(fmt(cex.state), area)}${broken}`;
  } else if (cex.rule === 'maintenance' && cex.next) {
    await hopFrog(L, f, cex.next);
    if (!tok.alive) return;
    markFailure(...tileOf(L, cex.next), say.landsOutsideTag(area));
    const lands =
      !from ? say.landsOutside(fmt(cex.state), fmt(cex.next), area)
      : run!.length === 1 ? say.eggLandsOutside(fmt(cex.state), fmt(cex.next), area)
      : say.realLandsOutside(fmt(from), fmt(cex.state), fmt(cex.next), area);
    text = `${prefix}${lands}${broken}`;
  } else {
    markFailure(x, y, say.offGoalTag);
    text = `${prefix}${from ? say.realOffGoal(fmt(from), fmt(cex.state)) : say.offGoal(fmt(cex.state))}`;
  }
  if (!run && opts.ghostExtra) text += `\n\n${opts.ghostExtra}`;
  if (opts.extra) text += `\n\n${opts.extra}`;
  const { mode, pitfallMessage } = useGame.getState();
  if (mode === 'level' && pitfallMessage) text += `\n\n${pitfallMessage}`;
  const action = opts.action?.();
  const tone = opts.tone ?? 'fail';
  useGame.setState({ caption: { text, tone, action, replay: () => void playCounterexample(cex, opts) } });
}
