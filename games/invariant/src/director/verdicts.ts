import gsap from 'gsap';
import { checkFormula, type CheckResult } from '../checker/check';
import type { Counterexample } from '../checker/types';
import { browserZ3 } from '../checker/z3-browser';
import { useGame, type Caption, type CaptionTone } from '../game/store';
import type { State } from '../lang/ast';
import { hop, RULES, running, showState, toBig, type Rule } from '../levels/level';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { handState } from '../scene/hand/handState';
import { after, sceneNow } from '../scene/sceneTime';
import { areaNear, tileState } from '../scene/tiles';
import { hatch } from './frogs';
import { handIn, handOut, placeTestFrog, pointAt } from './hand';
import { begin, caption, currentLevel, sleep, tween } from './sequence';

// Checking the learner's area, and the hand acting out the result: a
// counterexample, a shrug when the solver can't decide, or frog rain on success.

/** A state as inline code in captions, e.g. `n = 0, i = 1`. */
const fmt = (s: State) => '`' + showState(currentLevel(), s) + '`';

/** Mark the tile where a check failed, with a short reason. */
function markFailure(x: number, y: number, label: string) {
  useGame.setState({ failMark: { x, y, label, t0: sceneNow() } });
}

/** Bring state s into view: ride to its pond, then glide (or, when it is far away, fly) over to it. */
async function focusState(s: State, far = false) {
  const L = currentLevel();
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  if (L.pond) {
    const p = Number(s[L.pond]);
    if (p !== useGame.getState().pond) {
      useGame.setState({ pond: p });
      await sleep(80);
      while (useGame.getState().elevating) await sleep(60);
    }
  }
  if (far) {
    await cameraRig.zoomTo(45);
    await cameraRig.lookAtTile(x, y);
    await cameraRig.zoomTo(13);
  } else {
    const t = cameraRig.target();
    const dist = Math.hypot(t.x - x, -t.z - y);
    if (dist > 3 || cameraRig.distance() > 22) await cameraRig.lookAtTile(x, y, Math.min(cameraRig.distance(), 16));
  }
}

/** Check the current area against the given rules (the lights show the verdicts); the hand taps while it thinks. */
export async function runChecker(rules: Rule[] = RULES): Promise<CheckResult | null> {
  const g = useGame.getState();
  const inv = g.valid;
  if (!g.level || !inv || (g.formula && !g.formula.ok)) return null;
  const t = cameraRig.target();
  const box = { cx: Math.round(t.x), cy: Math.round(-t.z), r: 20, pondR: 20, pond: g.pond };
  const keep = { ...g.verdicts };
  for (const r of rules) delete keep[r];
  useGame.setState({ checking: true, verdicts: keep, failMark: null });
  // a quick check needs no hand; a slow one gets it tapping its fingers
  let tapping = false;
  const tapTimer = setTimeout(() => {
    tapping = true;
    const tt = cameraRig.target();
    void handIn(tt.x + 2.5, -tt.z + 1.5, 2.4, { tap: 1, curl: 0.15, tilt: 0.1 });
  }, 350);
  try {
    const ctx = await browserZ3();
    const res = await checkFormula(ctx, g.level, inv, box, { rules, timeout: 4000 });
    useGame.setState({ verdicts: { ...keep, ...res.verdicts }, pitfallMessage: res.pitfall?.message ?? null });
    return res;
  } catch (e) {
    caption(`The solver could not start: ${(e as Error).message}`, 'fail');
    return null;
  } finally {
    clearTimeout(tapTimer);
    if (tapping) gsap.to(handState, { tap: 0, duration: 0.2 });
    useGame.setState({ checking: false });
  }
}

interface CounterexampleOptions {
  /** Said before the explanation (default: a note when the frog was found far away). */
  prefix?: string;
  /** Whose area it is: "your area" (the learner's, the default) or "the area" (one the tutorial is trying). */
  area?: string;
  /** The caption's tone (default: a failure). A demo the learner predicted right uses success. */
  tone?: CaptionTone;
  /** A paragraph added after it. */
  extra?: string;
  /** The caption's main button; by default it is Replay. Called when the caption is shown. */
  action?: () => Caption['action'];
}

/** The hand's demonstration of one counterexample. */
export async function playCounterexample(cex: Counterexample, opts: CounterexampleOptions = {}) {
  const tok = begin();
  const L = currentLevel();
  useGame.setState({ busy: true, running: false, failMark: null });
  frogWorld.clear();
  const x = Number(cex.state[L.view.x]);
  const y = Number(cex.state[L.view.y]);
  try {
    if (handState.visible > 0.1) await handOut();
    await focusState(cex.state, cex.far);
    if (!tok.alive) return;
    const prefix = opts.prefix ?? (cex.far ? 'Everything nearby looked fine — but far away: ' : '');
  const area = opts.area ?? 'your area';
    const broken = cex.broken ? ` \`${cex.broken}\` ${cex.rule === 'pres' ? 'no longer holds' : 'is false there'}.` : '';
    let text: string;
    if (cex.rule === 'init') {
      await handIn(x + 0.4, y - 1.3, 1.6, { curl: 0.2 });
      if (!tok.alive) return;
      await pointAt(x, y);
      hatch(cex.state);
      await sleep(450);
      markFailure(x, y, `starts outside ${area}`);
      useGame.setState({ selected: cex.state });
      text = `${prefix}This frog starts at ${fmt(cex.state)} — outside ${area}.${broken}`;
    } else {
      const f = await placeTestFrog(tok, cex.state);
      if (!f || !tok.alive) return;
      useGame.setState({ selected: cex.state });
      await sleep(380);
      if (cex.rule === 'pres' && cex.next) {
        const nx = Number(cex.next[L.view.x]);
        const ny = Number(cex.next[L.view.y]);
        await frogWorld.hopTo(L, f, cex.next, 0.55);
        useGame.setState({ selected: cex.next });
        markFailure(nx, ny, `lands outside ${area}`);
        if (!tok.alive) return;
        await pointAt(nx, ny);
        text = `${prefix}From ${fmt(cex.state)}, one hop lands at ${fmt(cex.next)} — outside ${area}.${broken}`;
      } else {
        markFailure(x, y, 'stops, but not on a goal');
        await pointAt(x, y);
        text = `${prefix}A frog that stops at ${fmt(cex.state)} doesn't meet the postcondition.`;
      }
    }
    if (opts.extra) text += `\n\n${opts.extra}`;
    const replay = { label: 'Replay', onClick: () => void playCounterexample(cex, opts) };
    const action = opts.action?.();
    const tone = opts.tone ?? 'fail';
    useGame.setState({ caption: action ? { text, tone, action, secondary: replay } : { text, tone, action: replay } });
    await sleep(600);
    if (tok.alive) await handOut();
  } finally {
    if (tok.alive) useGame.setState({ busy: false });
  }
}

/** The solver could neither prove nor break the area: the hand shrugs. */
export async function playShrug(text: string) {
  const tok = begin();
  useGame.setState({ busy: true });
  try {
    const t = cameraRig.target();
    await handIn(t.x + 0.5, -t.z + 1.5, 2.0, { curl: 0.05, point: 0, tilt: 0.2 });
    if (!tok.alive) return;
    await tween(handState, { palmUp: 1, curl: 0.15, duration: 0.35, ease: 'back.out(1.6)' });
    await tween(handState, { shrug: 1, duration: 0.2 });
    await sleep(1300);
    await tween(handState, { shrug: 0, palmUp: 0, duration: 0.3 });
    caption(text, 'muted');
    await handOut();
  } finally {
    if (tok.alive) useGame.setState({ busy: false });
  }
}

/**
 * Success: the hand scatters frogs everywhere on the area, and every one that
 * can hop lands on it again. `max` caps the frogs (a light shower, for a
 * stage's pass), and `zoomOut` pulls the camera back for the full one.
 */
export async function playRain({ max = 160, zoomOut = true }: { max?: number; zoomOut?: boolean } = {}) {
  const tok = begin();
  const L = currentLevel();
  useGame.setState({ busy: true, running: false, selected: null });
  frogWorld.clear();
  try {
    if (zoomOut) await cameraRig.zoomTo(Math.max(cameraRig.distance(), 18));
    const { valid: inv, pond } = useGame.getState();
    if (!inv) return;
    const t = cameraRig.target();
    const tx = t.x;
    const ty = -t.z;
    const tiles: State[] = areaNear(L, pond, inv.fast, Math.round(tx), Math.round(ty), 16)
      .filter(([x, y]) => Math.hypot(x - tx, y - ty) <= 15)
      .map(([x, y]) => toBig(tileState(L, x, y, pond)));
    // shuffle and cap
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const pick = tiles.slice(0, max);
    // the hand sweeps across while sprinkling
    Object.assign(handState, { x: tx - 9, y: 5, z: -ty + 2, curl: 0.55, tap: 0.6, point: 0, shrug: 0, palmUp: 0, yaw: 0 });
    void tween(handState, { visible: 1, duration: 0.3 });
    void tween(handState, { x: tx + 9, z: -ty - 2, duration: 1.8, ease: 'sine.inOut' });
    const frogs: FrogSim[] = [];
    pick.forEach((s, i) => {
      after((i / pick.length) * 1600 + Math.random() * 120, () => {
        if (!tok.alive) return;
        frogs.push(frogWorld.add(L, 'test', s, { drop: { t0: sceneNow(), dur: 0.5 + Math.random() * 0.3, from: 5 + Math.random() * 2 } }));
      });
    });
    await sleep(2400);
    if (!tok.alive) return;
    void handOut();
    const movers = frogs.filter((f) => running(L, f.state));
    await Promise.all(movers.map((f) => frogWorld.hopTo(L, f, hop(L, f.state), 0.45)));
  } finally {
    if (tok.alive) useGame.setState({ busy: false });
  }
}
