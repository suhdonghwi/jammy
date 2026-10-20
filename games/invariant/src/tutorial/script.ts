import type { CheckResult } from '../checker/check';
import type { Counterexample, Rule } from '../checker/types';
import { events } from '../director/events';
import { playCounterexample, runChecker, showUndecided } from '../director/verdicts';
import { ALLOW_NONE, useGame, type CaptionTone, type Game } from '../game/store';
import { t as messages } from '../i18n/i18n';
import { frogWorld } from '../scene/frogs/frogWorld';
import { sleep } from '../scene/sceneTime';

export class Aborted extends Error {}

let generation = 0;
let pendingCheck: (() => void) | null = null;
let pendingNext: (() => void) | null = null;
let captionShownAt = 0;

export function newGeneration(): number {
  generation++;
  pendingCheck = null;
  pendingNext = null;
  return generation;
}

export const currentGeneration = () => generation;

export function guard(gen: number) {
  if (gen !== generation) throw new Aborted();
}

const DOUBLE_CLICK_MS = 120;

function earlyNext(label = messages().caption.next) {
  const shownAt = performance.now();
  return {
    label,
    onClick: () => {
      if (performance.now() - shownAt >= DOUBLE_CLICK_MS) useGame.getState().skip?.();
    },
  };
}

const nextAfterCounterexample = () => useGame.getState().nextAction ?? earlyNext();

type Spot = Game['spotlight'];

export function say(text: string, spot: Spot = null, tone: CaptionTone = 'info', reserve?: string) {
  captionShownAt = performance.now();
  useGame.setState({ caption: { text, tone, action: reserve ? earlyNext(reserve) : undefined }, spotlight: spot });
}

export function sayWaiting(text: string, spot: Spot = null) {
  captionShownAt = performance.now();
  useGame.setState({ caption: { text, tone: 'info', action: { label: messages().caption.next, onClick: () => {}, disabled: true } }, spotlight: spot });
}

function next(gen: number, text: string, label = messages().caption.next, spot: Spot = null, tone: CaptionTone = 'info'): Promise<void> {
  return new Promise((resolve, reject) => {
    const shown = useGame.getState().caption;
    const shownAt = shown?.text === text ? captionShownAt : performance.now();
    pendingNext = () => {
      if (performance.now() - shownAt < DOUBLE_CLICK_MS) return;
      pendingNext = null;
      useGame.setState({ spotLines: [], nextAction: null });
      const passing = useGame.getState().caption;
      setTimeout(() => {
        if (useGame.getState().caption === passing) useGame.setState({ spotlight: null });
      });
      if (gen !== generation) reject(new Aborted());
      else resolve();
    };
    const action = { label, onClick: () => pendingNext?.() };
    const secondary = shown?.text === text ? shown.secondary : undefined;
    useGame.setState({ caption: { text, tone, action, secondary }, spotlight: spot, nextAction: action });
  });
}

export async function beat(
  gen: number,
  text: string,
  opts: {
    prepare?: () => Promise<void> | void;
    label?: string;
    spot?: Spot;
    settle?: number;
    callouts?: Game['callouts'];
    region?: Game['region'];
    lines?: Game['spotLines'];
    tone?: CaptionTone;
  } = {},
): Promise<void> {
  useGame.setState({ callouts: opts.callouts ?? [], region: opts.region ?? null, spotLines: opts.lines ?? [] });
  const tone = opts.tone ?? 'info';
  const label = opts.label ?? messages().caption.next;
  say(text, opts.spot ?? null, tone, label);
  if (opts.prepare) await opts.prepare();
  guard(gen);
  await sleep(opts.settle ?? 300);
  guard(gen);
  await next(gen, text, label, opts.spot ?? null, tone);
}

function holdCaption(gen: number): Promise<void> {
  const c = useGame.getState().caption;
  return next(gen, c?.text ?? '', messages().caption.next, null, c?.tone ?? 'info');
}

export function allow(a: Partial<Game['tutorialAllow']>) {
  useGame.setState({ tutorialAllow: { ...ALLOW_NONE, ...a } });
}

export function waitEvent(gen: number, name: 'stepped' | 'runDone', until?: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const off = events.on((e) => {
      if (gen !== generation) {
        off();
        reject(new Aborted());
      } else if (e === name && (!until || until())) {
        off();
        resolve();
      }
    });
  });
}

export function waitStore(gen: number, test: (g: Game) => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    if (test(useGame.getState())) return resolve();
    const off = useGame.subscribe((g) => {
      if (gen !== generation) {
        off();
        reject(new Aborted());
      } else if (test(g)) {
        off();
        resolve();
      }
    });
  });
}

function choose<K extends string>(gen: number, text: string, choices: { key: K; label: string; tone?: 'yes' | 'no' }[]): Promise<K> {
  return new Promise((resolve, reject) => {
    const pick = (k: K) => () => {
      if (gen !== generation) reject(new Aborted());
      else resolve(k);
    };
    useGame.setState({
      caption: { text, tone: 'info', choices: choices.map((c) => ({ label: c.label, tone: c.tone, onClick: pick(c.key) })) },
      spotlight: null,
      callouts: [],
      region: null,
    });
  });
}

export async function ask(gen: number, text: string): Promise<boolean> {
  const k = await choose(gen, text, [
    { key: 'yes', label: messages().caption.yes, tone: 'yes' },
    { key: 'no', label: messages().caption.no, tone: 'no' },
  ]);
  return k === 'yes';
}

export function tutorialCheck(): 'refused' | void {
  const g = useGame.getState();
  if (!pendingCheck) return;
  if (!g.formula || !g.formula.ok) return 'refused';
  pendingCheck();
}

function waitCheck(gen: number): Promise<void> {
  return new Promise((resolve, reject) => {
    pendingCheck = () => {
      pendingCheck = null;
      useGame.setState({ awaitingCheck: false });
      if (gen !== generation) reject(new Aborted());
      else resolve();
    };
    allow({ formula: true });
    useGame.setState({ awaitingCheck: true });
  });
}

export function showHint() {
  const h = useGame.getState().hint;
  if (!h || h.shown) return;
  useGame.setState({ hint: { ...h, shown: true }, caption: { text: `${h.ask}\n\n**${messages().tutorial.hint}** ${h.nudge}`, tone: 'info' }, spotlight: null });
}

interface StageOptions {
  ask: string;
  rules: Rule[];
  nudge: string;
  ghost?: Partial<Record<Rule, string>>;
  onFail?: (rule: Rule) => void;
}

export async function stage(gen: number, o: StageOptions): Promise<void> {
  useGame.setState({ hint: { ask: o.ask, nudge: o.nudge, shown: false }, callouts: [], region: null });
  let askNow = true;
  for (;;) {
    if (askNow) say(o.ask, 'check');
    await waitCheck(gen);
    askNow = false;
    useGame.setState({ spotlight: null });
    frogWorld.clear('test');
    const res = await runChecker(o.rules);
    guard(gen);
    if (!res) {
      askNow = true;
      continue;
    }
    const failing = o.rules.find((r) => res.verdicts[r]?.status === 'fail');
    if (!failing) {
      if (o.rules.some((r) => res.verdicts[r]?.status === 'undecided')) {
        showUndecided(messages().tutorial.undecided);
        continue;
      }
      frogWorld.clear();
      allow({});
      useGame.setState({ hint: null });
      return;
    }
    o.onFail?.(failing);
    const cex = failureOf(res, failing)!;
    const stageRule = o.rules[o.rules.length - 1];
    const prefix = failing !== stageRule ? messages().tutorial.lostRule(messages().rules[failing]) : undefined;
    useGame.setState({ pitfallMessage: null });
    await playCounterexample(cex, { prefix, extra: messages().tutorial.fixAndCheck, ghostExtra: o.ghost?.[failing] });
    guard(gen);
  }
}

export async function checkOnce(gen: number, ask: string, rules: Rule[]): Promise<{ failing?: Rule; cex: Counterexample | null }> {
  for (;;) {
    say(ask, 'check');
    await waitCheck(gen);
    useGame.setState({ spotlight: null });
    frogWorld.clear('test');
    const res = await runChecker(rules);
    guard(gen);
    if (!res) continue;
    const failing = rules.find((r) => res.verdicts[r]?.status === 'fail');
    if (failing) return { failing, cex: failureOf(res, failing) };
    if (rules.some((r) => res.verdicts[r]?.status === 'undecided')) {
      showUndecided(messages().tutorial.undecided);
      await sleep(1800);
      guard(gen);
      continue;
    }
    allow({});
    return { cex: null };
  }
}

export async function showFailure(gen: number, cex: Counterexample, opts: { prefix?: string; tone?: CaptionTone; ghostExtra?: string } = {}) {
  useGame.setState({ pitfallMessage: null });
  await playCounterexample(cex, { ...opts, action: nextAfterCounterexample });
  guard(gen);
  await holdCaption(gen);
  frogWorld.clear('test');
  useGame.setState({ failMark: null });
}

export async function demo(
  gen: number,
  formula: string,
  rules: Rule[],
  opts: { ghostExtra?: string; restore?: string; guessedRight?: boolean } = {},
): Promise<void> {
  const g = useGame.getState();
  const mine = opts.restore ?? g.formulaText;
  useGame.setState({ busy: true, callouts: [], region: null });
  frogWorld.clear('test');
  say(messages().tutorial.trying(formula), null, 'muted');
  if (g.formulaText.trim() !== formula) {
    useGame.setState({ spotlight: 'formula' });
    await sleep(500);
    guard(gen);
    for (let k = 1; k <= formula.length; k++) {
      g.setFormula(formula.slice(0, k));
      await sleep(formula[k - 1] === ' ' ? 30 : 70);
      guard(gen);
    }
  }
  await sleep(550);
  guard(gen);
  useGame.setState({ busy: false });
  const res = await runChecker(rules);
  guard(gen);
  const failing = res && rules.find((r) => res.verdicts[r]?.status === 'fail');
  const cex = res && failing ? failureOf(res, failing) : null;
  if (cex) {
    useGame.setState({ pitfallMessage: null });
    const verdict = opts.guessedRight === undefined ? undefined : opts.guessedRight ? messages().tutorial.guessedRight : messages().tutorial.guessedWrong;
    const tone = opts.guessedRight ? 'success' : 'fail';
    await playCounterexample(cex, { prefix: verdict, tone, ghostExtra: opts.ghostExtra, area: messages().verdicts.theArea, action: nextAfterCounterexample });
    guard(gen);
    await holdCaption(gen);
  }
  frogWorld.clear('test');
  useGame.setState({ failMark: null });
  g.setFormula(mine);
  await runChecker(rules);
  guard(gen);
}

function failureOf(res: CheckResult, rule: Rule) {
  const v = res.verdicts[rule];
  return v?.status === 'fail' ? v.cex : null;
}
