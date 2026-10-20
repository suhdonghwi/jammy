import gsap from 'gsap';
import { sfx } from '../audio/sfx';
import { checkFormula, type CheckResult } from '../checker/check';
import type { Counterexample, Rule } from '../checker/types';
import { browserZ3 } from '../checker/z3-browser';
import { useGame, type Caption, type CaptionTone } from '../game/store';
import { t as messages } from '../i18n/i18n';
import type { State } from '../lang/ast';
import { hop, inputsOf, planeKey, running, showState, toBig } from '../levels/level';
import { tilesNear } from '../levels/tiles';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { handState } from '../scene/hand/handState';
import { after, sceneNow, sleep } from '../scene/sceneTime';
import { hatch } from './frogs';
import { handIn, handOut, placeTestFrog, pointAt } from './hand';
import { begin, caption, currentLevel, tween } from './sequence';

const fmt = (s: State) => '`' + showState(currentLevel(), s) + '`';

function markFailure(x: number, y: number, label: string) {
  useGame.setState({ failMark: { x, y, label, t0: sceneNow() } });
  sfx.fail();
}

async function focusState(s: State, far = false) {
  const L = currentLevel();
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  const inputs = inputsOf(L, s);
  if (planeKey(inputs) !== planeKey(useGame.getState().inputs)) {
    useGame.setState({ inputs });
    await sleep(250);
  }
  if (far) {
    await cameraRig.zoomTo(45);
    await cameraRig.lookAtTile(x, y);
    await cameraRig.zoomTo(13);
  } else {
    const t = cameraRig.target();
    const dist = Math.hypot(t.x - x, -t.z - y);
    if (dist > 3 || cameraRig.distance() > 22 || !cameraRig.inView(x, y)) await cameraRig.lookAtTile(x, y, Math.min(cameraRig.distance(), 16));
  }
}

export async function runChecker(rules: Rule[]): Promise<CheckResult | null> {
  const g = useGame.getState();
  const inv = g.valid;
  if (!g.level || !inv || (g.formula && !g.formula.ok)) return null;
  const t = cameraRig.target();
  const box = { cx: Math.round(t.x), cy: Math.round(-t.z), r: 20, planeR: 20, inputs: g.inputs };
  const keep = { ...g.verdicts };
  for (const r of rules) delete keep[r];
  useGame.setState({ checking: true, verdicts: keep, failMark: null });
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
    rules.filter((r) => res.verdicts[r]?.status === 'pass').forEach((_, i) => after(i * 130, () => sfx.pass(i)));
    return res;
  } catch (e) {
    caption(messages().verdicts.solverFailed((e as Error).message), 'fail');
    return null;
  } finally {
    clearTimeout(tapTimer);
    if (tapping) gsap.to(handState, { tap: 0, duration: 0.2 });
    useGame.setState({ checking: false });
  }
}

interface CounterexampleOptions {
  prefix?: string;
  area?: string;
  tone?: CaptionTone;
  extra?: string;
  action?: () => Caption['action'];
}

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
    const say = messages().verdicts;
    const prefix = opts.prefix ?? (cex.far ? say.far : '');
    const area = opts.area ?? say.yourArea;
    const broken = cex.broken ? (cex.rule === 'maintenance' ? say.noLongerHolds(cex.broken) : say.falseThere(cex.broken)) : '';
    let text: string;
    if (cex.rule === 'initialization') {
      await pointAt(x, y);
      hatch(cex.state);
      await sleep(450);
      markFailure(x, y, say.startsOutsideTag(area));
      text = `${prefix}${say.startsOutside(fmt(cex.state), area)}${broken}`;
    } else {
      const f = await placeTestFrog(tok, cex.state);
      if (!f || !tok.alive) return;
      await sleep(380);
      if (cex.rule === 'maintenance' && cex.next) {
        const nx = Number(cex.next[L.view.x]);
        const ny = Number(cex.next[L.view.y]);
        await frogWorld.hopTo(L, f, cex.next, 0.55);
        markFailure(nx, ny, say.landsOutsideTag(area));
        if (!tok.alive) return;
        await pointAt(nx, ny);
        text = `${prefix}${say.landsOutside(fmt(cex.state), fmt(cex.next), area)}${broken}`;
      } else {
        markFailure(x, y, say.offGoalTag);
        await pointAt(x, y);
        text = `${prefix}${say.offGoal(fmt(cex.state))}`;
      }
    }
    if (opts.extra) text += `\n\n${opts.extra}`;
    const replay = { label: messages().caption.replay, onClick: () => void playCounterexample(cex, opts) };
    const action = opts.action?.();
    const tone = opts.tone ?? 'fail';
    useGame.setState({ caption: action ? { text, tone, action, secondary: replay } : { text, tone, action: replay } });
    await sleep(600);
    if (tok.alive) await handOut();
  } finally {
    if (tok.alive) useGame.setState({ busy: false });
  }
}

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

export async function playRain({ max = 160, zoomOut = true }: { max?: number; zoomOut?: boolean } = {}) {
  const tok = begin();
  const L = currentLevel();
  useGame.setState({ busy: true, running: false });
  frogWorld.clear();
  try {
    if (zoomOut) await cameraRig.zoomTo(Math.max(cameraRig.distance(), 18));
    const { valid: inv, inputs } = useGame.getState();
    if (!inv) return;
    const t = cameraRig.target();
    const tx = t.x;
    const ty = -t.z;
    const tiles: State[] = tilesNear(L, inputs, { cx: Math.round(tx), cy: Math.round(ty), R: 16 }, (s, x, y) =>
      L.fast.planeReq(s) && inv.fast(s) === true && Math.hypot(x - tx, y - ty) <= 15 ? toBig(s) : undefined,
    );
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const pick = tiles.slice(0, max);
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
