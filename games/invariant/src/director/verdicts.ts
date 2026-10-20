import { sfx } from '../audio/sfx';
import { checkFormula, type CheckResult } from '../checker/check';
import type { Counterexample, Rule } from '../checker/types';
import { browserZ3 } from '../checker/z3-browser';
import { useGame, type Caption, type CaptionTone } from '../game/store';
import { t as messages } from '../i18n/i18n';
import type { State } from '../lang/ast';
import { hop, inputsOf, planeKey, showState, toBig } from '../levels/level';
import { tilesNear } from '../levels/tiles';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { after, sceneNow, sleep } from '../scene/sceneTime';
import { hatch } from './frogs';
import { clamp01, smoothstep } from '../scene/easing';
import { hopArcs } from '../scene/frogs/HopArcs';
import { GHOST_RISE, raiseGhost, realRunTo } from './ghosts';
import { begin, caption, currentLevel } from './sequence';

const ABOVE_CAPTION = 0.05;

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
    await cameraRig.lookAtTile(x, y - 1.5);
    await cameraRig.zoomTo(13);
  } else {
    const t = cameraRig.target();
    const dist = Math.hypot(t.x - x, -t.z - y);
    if (dist > 3 || cameraRig.distance() > 22 || !cameraRig.inView(x, y, 1, ABOVE_CAPTION)) await cameraRig.lookAtTile(x, y - 1.5, Math.min(cameraRig.distance(), 16));
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
    useGame.setState({ checking: false });
  }
}

interface CounterexampleOptions {
  prefix?: string;
  area?: string;
  tone?: CaptionTone;
  extra?: string;
  ghostExtra?: string;
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
    await focusState(cex.state, cex.far);
    if (!tok.alive) return;
    const say = messages().verdicts;
    const prefix = opts.prefix ?? (cex.far ? say.far : '');
    const area = opts.area ?? say.yourArea;
    const broken = cex.broken ? (cex.rule === 'maintenance' ? say.noLongerHolds(cex.broken) : say.falseThere(cex.broken)) : '';
    const run = cex.rule === 'initialization' ? [cex.state] : realRunTo(cex.state);
    let f: FrogSim;
    if (run) {
      f = hatch(run[0]);
      await sleep(450);
      for (const s of run.slice(1)) {
        if (!tok.alive) return;
        await frogWorld.hopTo(L, f, s, 0.36);
      }
    } else {
      sfx.ghost();
      f = raiseGhost(cex.state);
      await sleep(GHOST_RISE * 1000 + 250);
    }
    if (!tok.alive) return;
    const from = run ? run[0] : null;
    let text: string;
    if (cex.rule === 'initialization') {
      markFailure(x, y, say.startsOutsideTag(area));
      text = `${prefix}${say.startsOutside(fmt(cex.state), area)}${broken}`;
    } else if (cex.rule === 'maintenance' && cex.next) {
      await frogWorld.hopTo(L, f, cex.next, 0.55);
      if (!tok.alive) return;
      markFailure(Number(cex.next[L.view.x]), Number(cex.next[L.view.y]), say.landsOutsideTag(area));
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
    const replay = { label: messages().caption.replay, onClick: () => void playCounterexample(cex, opts) };
    const action = opts.action?.();
    const tone = opts.tone ?? 'fail';
    useGame.setState({ caption: action ? { text, tone, action, secondary: replay } : { text, tone, action: replay } });
  } finally {
    if (tok.alive) useGame.setState({ busy: false });
  }
}

export function showUndecided(text: string) {
  caption(text, 'muted');
}

const PROOF_NEAR = 6;
const PROOF_FAR = 13;
const PROOF_MAX = 40;
const PROOF_ABOVE = 2.5;

interface ProofHop {
  from: State;
  to: State;
  d: number;
}

function spreadHops(hops: ProofHop[]): ProofHop[] {
  const L = currentLevel();
  const at = (s: State) => [Number(s[L.view.x]), Number(s[L.view.y])] as const;
  const apart = (a: readonly number[], b: readonly number[], r: number) => Math.hypot(a[0] - b[0], a[1] - b[1]) >= r;
  const picked: ProofHop[] = [];
  for (const h of hops) {
    if (picked.length >= PROOF_MAX) break;
    const [f, t] = [at(h.from), at(h.to)];
    const fits = picked.every((p) => {
      const [pf, pt] = [at(p.from), at(p.to)];
      return apart(f, pf, 2.2) && apart(f, pt, 1.2) && apart(t, pf, 1.2) && apart(t, pt, 1.2);
    });
    if (fits) picked.push(h);
  }
  return picked;
}

export async function playProof({ zoomOut = true }: { zoomOut?: boolean } = {}) {
  const tok = begin();
  const L = currentLevel();
  useGame.setState({ busy: true, running: false });
  frogWorld.clear();
  try {
    if (zoomOut) await cameraRig.zoomTo(Math.max(cameraRig.distance(), 18));
    if (!tok.alive) return;
    const { valid: inv, inputs } = useGame.getState();
    if (!inv) return;
    const t = cameraRig.target();
    const tx = t.x;
    const ty = -t.z + PROOF_ABOVE;
    const near = (x: number, y: number) => Math.hypot(x - tx, y - ty);
    const candidates = tilesNear(L, inputs, { cx: Math.round(tx), cy: Math.round(ty), R: PROOF_FAR }, (s, x, y) => {
      if (!L.fast.planeReq(s) || inv.fast(s) !== true || L.fast.guard(s) !== true || near(x, y) > PROOF_FAR) return undefined;
      const from = toBig(s);
      return { from, to: hop(L, from), d: near(x, y) };
    });
    const hops = spreadHops(candidates.sort((a, b) => a.d - b.d));
    const fadeAt = (d: number) => 1 - smoothstep(clamp01((d - PROOF_NEAR) / (PROOF_FAR - PROOF_NEAR)));
    sfx.ghost();
    const risen = hops.map((h) => {
      const delay = (h.d / PROOF_FAR) * 0.6;
      return { ...h, delay, f: raiseGhost(h.from, delay, fadeAt(h.d)) };
    });
    const now = sceneNow();
    for (const h of risen) {
      hopArcs.add({
        frog: h.f.id,
        fx: h.f.x,
        fy: h.f.y,
        tx: Number(h.to[L.view.x]),
        ty: Number(h.to[L.view.y]),
        plane: h.f.plane,
        t0: now + h.delay + GHOST_RISE + 0.1,
        fade: h.f.fade ?? 1,
      });
    }
    await sleep((0.6 + GHOST_RISE + 0.9) * 1000);
  } finally {
    if (tok.alive) useGame.setState({ busy: false });
  }
}
