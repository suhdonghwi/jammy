import { sfx } from '../audio/sfx';
import { checkFormula, type CheckResult } from '../checker/check';
import { RULES, type Counterexample, type Rule } from '../checker/types';
import { browserZ3 } from '../checker/z3-browser';
import { useGame, type Caption, type CaptionTone, type Game, type Region } from '../game/store';
import { t as messages } from '../i18n/i18n';
import type { State } from '../lang/ast';
import { hop, inputsOf, planeKey, showState, toBig } from '../levels/level';
import { tilesNear } from '../levels/tiles';
import { EGG_REGROW } from '../scene/area/Eggs';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { sceneNow, sleep } from '../scene/sceneTime';
import { dismissFrogs, hatch } from './frogs';
import { clamp01, smoothstep } from '../scene/easing';
import { GHOST_RISE, previewHop, raiseGhost, realRunTo } from './ghosts';
import { eggRegion, endingsRegion } from './regions';
import { begin, caption, currentLevel, type Token } from './sequence';


const fmt = (s: State) => '`' + showState(currentLevel(), s) + '`';

function markFailure(x: number, y: number, label: string) {
  useGame.setState({ failMark: { x, y, label, t0: sceneNow() } });
  sfx.fail();
}

async function focusOn(cex: Counterexample) {
  const L = currentLevel();
  const inputs = inputsOf(L, cex.state);
  if (planeKey(inputs) !== planeKey(useGame.getState().inputs)) {
    useGame.setState({ inputs });
    await sleep(250);
  }
  const labels = [cex.state, cex.next].flatMap((s) => (s ? [[Number(s[L.view.x]), Number(s[L.view.y])] as const] : []));
  await cameraRig.arrive({ labels });
}

export async function runChecker(rules: Rule[]): Promise<CheckResult | null> {
  const g = useGame.getState();
  const inv = g.valid;
  if (!g.level || !inv || (g.formula && !g.formula.ok)) return null;
  const t = cameraRig.target();
  const box = { cx: Math.round(t.x), cy: Math.round(-t.z), r: 20, planeR: 20, inputs: g.inputs };
  const keep = { ...g.verdicts };
  for (const r of rules) delete keep[r];
  useGame.setState({ checking: true, verdicts: keep, pending: rules, failMark: null, region: null });
  try {
    const ctx = await browserZ3();
    const res = await checkFormula(ctx, g.level, inv, box, { rules, timeout: 4000 });
    useGame.setState({ pitfallMessage: res.pitfall?.message ?? null });
    return res;
  } catch (e) {
    useGame.setState({ pending: [] });
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

export function revealAll(res: CheckResult) {
  useGame.setState((g) => ({ verdicts: { ...g.verdicts, ...res.verdicts }, pending: [] }));
}

function reveal(rule: Rule, res: CheckResult, chime: number) {
  const v = res.verdicts[rule];
  if (!v) return;
  useGame.setState((g) => ({ verdicts: { ...g.verdicts, [rule]: v }, pending: g.pending.filter((r) => r !== rule) }));
  if (v.status === 'pass') sfx.pass(chime);
}

export async function playCounterexample(cex: Counterexample, opts: CounterexampleOptions = {}) {
  const tok = begin();
  useGame.setState({ busy: true, running: false });
  try {
    await counterexample(tok, cex, opts);
  } finally {
    if (tok.alive) useGame.setState({ busy: false });
  }
}

const HOLD_MS = 1000;
const REGION_MS = 1300;
const BETWEEN_MS = 300;

async function counterexample(tok: Token, cex: Counterexample, opts: CounterexampleOptions) {
  const L = currentLevel();
  useGame.setState({ failMark: null, region: null });
  await dismissFrogs();
  if (!tok.alive) return;
  const x = Number(cex.state[L.view.x]);
  const y = Number(cex.state[L.view.y]);
  await focusOn(cex);
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
}

interface Outcome {
  failing?: Rule;
  undecided: boolean;
}

export async function playVerification(res: CheckResult, rules: Rule[], onFail: (rule: Rule) => CounterexampleOptions = () => ({})): Promise<Outcome | null> {
  const tok = begin();
  useGame.setState({ busy: true, running: false, failMark: null, region: null, callouts: [] });
  const order = RULES.filter((r) => rules.includes(r));
  let undecided = false;
  try {
    if (frogWorld.frogs.length) {
      await dismissFrogs();
      await sleep(EGG_REGROW * 1000);
      if (!tok.alive) return null;
    }
    for (const [i, rule] of order.entries()) {
      const v = res.verdicts[rule];
      if (!v) continue;
      if (v.status === 'fail') {
        await counterexample(tok, v.cex, onFail(rule));
        if (!tok.alive) return null;
        reveal(rule, res, i);
        return { failing: rule, undecided };
      }
      if (v.status === 'undecided') {
        reveal(rule, res, i);
        undecided = true;
        await sleep(HOLD_MS);
        if (!tok.alive) return null;
        continue;
      }
      const tag = await showHolds(rule);
      if (!tok.alive) return null;
      reveal(rule, res, i);
      if (tag) useGame.setState({ callouts: [tag] });
      if (i < order.length - 1) {
        await sleep(HOLD_MS);
        if (!tok.alive) return null;
        useGame.setState({ region: null, callouts: [] });
        void dismissFrogs('test');
        await sleep(BETWEEN_MS);
        if (!tok.alive) return null;
      }
    }
    return { undecided };
  } finally {
    if (tok.alive) useGame.setState({ busy: false, pending: [] });
  }
}

type Callout = Game['callouts'][number];

async function showHolds(rule: Rule): Promise<Callout | null> {
  const text = messages().verdicts.holdsTag[rule];
  if (rule === 'maintenance') {
    const f = await proofWave();
    return f ? { x: f.x, y: f.y, frog: f.id, text, tone: 'good' } : null;
  }
  const region = rule === 'initialization' ? eggRegion('good') : endingsRegion(() => 'good');
  useGame.setState({ region: { ...region, id: `check-${rule}`, tick: true } });
  await sleep(REGION_MS);
  const near = nearestTile(region);
  return near ? { ...near, text, tone: 'good' } : null;
}

function nearestTile(region: Region): { x: number; y: number } | null {
  const { x: cx, y: cy } = cameraRig.viewCenter();
  const tiles = region.tiles({ cx: Math.round(cx), cy: Math.round(cy), R: 8 });
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const tile of tiles) {
    const d = Math.hypot(tile.x - cx, tile.y - cy);
    if (d < bestD) [best, bestD] = [{ x: tile.x, y: tile.y }, d];
  }
  return best;
}

export function showUndecided(text: string) {
  caption(text, 'muted');
}

const PROOF_NEAR = 6;
const PROOF_FAR = 13;
const PROOF_MAX = 40;

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

export async function playProof() {
  const tok = begin();
  useGame.setState({ busy: true, running: false });
  void dismissFrogs();
  try {
    await cameraRig.zoomTo(Math.max(cameraRig.distance(), 18));
    if (tok.alive) await proofWave();
  } finally {
    if (tok.alive) useGame.setState({ busy: false });
  }
}

async function proofWave(): Promise<FrogSim | null> {
  const L = currentLevel();
  const { valid: inv, inputs } = useGame.getState();
  if (!inv) return null;
  const { x: tx, y: ty } = cameraRig.viewCenter();
  const near = (x: number, y: number) => Math.hypot(x - tx, y - ty);
  const candidates = tilesNear(L, inputs, { cx: Math.round(tx), cy: Math.round(ty), R: PROOF_FAR }, (s, x, y) => {
    if (!L.fast.planeReq(s) || inv.fast(s) !== true || L.fast.guard(s) !== true || near(x, y) > PROOF_FAR) return undefined;
    const from = toBig(s);
    return { from, to: hop(L, from), d: near(x, y) };
  });
  const hops = spreadHops(candidates.sort((a, b) => a.d - b.d));
  const fadeAt = (d: number) => 1 - smoothstep(clamp01((d - PROOF_NEAR) / (PROOF_FAR - PROOF_NEAR)));
  sfx.ghost();
  const ghosts = hops.map((h) => previewHop(h.from, 0, fadeAt(h.d)));
  await sleep((GHOST_RISE + 1.0) * 1000);
  return ghosts[0] ?? null;
}
