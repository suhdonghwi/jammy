import type { CheckResult } from '../checker/check';
import { RULES, type Rule } from '../checker/types';
import { useGame, type Game, type Region } from '../game/store';
import { t as messages } from '../i18n/i18n';
import { EGG_REGROW } from '../scene/area/glsl';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld } from '../scene/frogs/frogWorld';
import { sleep } from '../scene/sceneTime';
import { runChecker } from './checkRun';
import { counterexample, type CounterexampleOptions } from './counterexample';
import { sendFrogsHome } from './frogs';
import { proofWave } from './ghosts';
import { eggRegion, endingsRegion } from './regions';
import { busyWhile, caption, type Token } from './sequence';

const HOLD_MS = 1000;
const REGION_MS = 1300;
const BETWEEN_MS = 300;

export function revealAll(res: CheckResult) {
  useGame.setState((g) => ({ verdicts: { ...g.verdicts, ...res.verdicts }, pending: [] }));
}

function reveal(rule: Rule, res: CheckResult) {
  const v = res.verdicts[rule];
  if (!v) return;
  useGame.setState((g) => ({ verdicts: { ...g.verdicts, [rule]: v }, pending: g.pending.filter((r) => r !== rule) }));
}

interface Outcome {
  failing?: Rule;
  undecided: boolean;
}

export async function checkAndPlay(rules: Rule[], onFail?: (rule: Rule) => CounterexampleOptions, owner?: Token): Promise<Outcome | null> {
  void sendFrogsHome('test');
  const res = await runChecker(rules);
  owner?.guard();
  return res && playVerification(res, rules, onFail);
}

function playVerification(res: CheckResult, rules: Rule[], onFail: (rule: Rule) => CounterexampleOptions = () => ({})): Promise<Outcome | null> {
  return busyWhile(async (tok) => {
    useGame.setState({ failMark: null, region: null, callouts: [] });
    try {
      return await verifyRules(tok, res, rules, onFail);
    } finally {
      useGame.setState((g) => ({ pending: g.pending.filter((r) => !rules.includes(r)) }));
    }
  });
}

async function verifyRules(tok: Token, res: CheckResult, rules: Rule[], onFail: (rule: Rule) => CounterexampleOptions): Promise<Outcome | null> {
  const order = RULES.filter((r) => rules.includes(r));
  let undecided = false;
  if (frogWorld.frogs.length) {
    await sendFrogsHome();
    await sleep(EGG_REGROW * 1000);
    if (!tok.alive) return null;
  }
  for (const [i, rule] of order.entries()) {
    const v = res.verdicts[rule];
    if (!v) continue;
    if (v.status === 'fail') {
      await counterexample(tok, v.cex, onFail(rule));
      if (!tok.alive) return null;
      reveal(rule, res);
      return { failing: rule, undecided };
    }
    if (v.status === 'undecided') {
      reveal(rule, res);
      undecided = true;
      await sleep(HOLD_MS);
      if (!tok.alive) return null;
      continue;
    }
    const tag = await showHolds(rule);
    if (!tok.alive) return null;
    reveal(rule, res);
    if (tag) useGame.setState({ callouts: [tag] });
    if (i < order.length - 1) {
      await sleep(HOLD_MS);
      if (!tok.alive) return null;
      useGame.setState({ region: null, callouts: [] });
      void sendFrogsHome('test');
      await sleep(BETWEEN_MS);
      if (!tok.alive) return null;
    }
  }
  return { undecided };
}

type Callout = Game['callouts'][number];

async function showHolds(rule: Rule): Promise<Callout | null> {
  const text = messages().verdicts.holdsTag[rule];
  if (rule === 'maintenance') {
    const f = await proofWave();
    return f ? { x: f.x, y: f.y, frog: f.id, text, tone: 'good' } : null;
  }
  const region = rule === 'initialization' ? eggRegion('good') : endingsRegion('good');
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
