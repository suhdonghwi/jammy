import type { Rule } from '../checker/types';
import { runChecker } from '../director/checkRun';
import { sendFrogsHome } from '../director/frogs';
import { Aborted, createScope, events, type Token } from '../director/sequence';
import { checkAndPlay, revealAll, showUndecided } from '../director/verification';
import { ALLOW_NONE, setTutorial, useGame, type CaptionTone, type Game, type TutorialState } from '../game/store';
import { t as messages } from '../i18n/i18n';
import { cameraRig } from '../scene/cameraRig';
import { sleep } from '../scene/sceneTime';

const generations = createScope();
let skipStep: (() => void) | null = null;
let pendingNext: (() => void) | null = null;
let captionShownAt = 0;

export function newGeneration(): Token {
  skipStep = null;
  pendingNext = null;
  return generations.begin();
}

export function settled<T = void>(gen: Token, start: (settle: (value: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => start((value) => (gen.alive ? resolve(value) : reject(new Aborted()))));
}

export function setSkipStep(skip: (() => void) | null) {
  skipStep = skip;
}

const DOUBLE_CLICK_MS = 120;
const tooSoonAfter = (shownAt: number) => performance.now() - shownAt < DOUBLE_CLICK_MS;

function earlyNext(label = messages().caption.next, last?: () => void) {
  const shownAt = performance.now();
  return {
    label,
    onClick: () => {
      if (tooSoonAfter(shownAt)) return;
      if (skipStep) skipStep();
      else last?.();
    },
  };
}

const nextAfterCounterexample = () => useGame.getState().tutorial.nextAction ?? earlyNext();

type Spot = TutorialState['spotlight'];

export function say(text: string, spot: Spot = null, tone: CaptionTone = 'info', reserve?: string, last?: () => void) {
  captionShownAt = performance.now();
  useGame.setState({ caption: { text, tone, action: reserve ? earlyNext(reserve, last) : undefined } });
  setTutorial({ spotlight: spot });
}

export function sayWaiting(text: string, spot: Spot = null) {
  captionShownAt = performance.now();
  useGame.setState({ caption: { text, tone: 'info', action: { label: messages().caption.next, onClick: () => {}, disabled: true } } });
  setTutorial({ spotlight: spot });
}

function next(gen: Token, text: string, label = messages().caption.next, spot: Spot = null, tone: CaptionTone = 'info'): Promise<void> {
  return settled(gen, (settle) => {
    const shown = useGame.getState().caption;
    const shownAt = shown?.text === text ? captionShownAt : performance.now();
    pendingNext = () => {
      if (tooSoonAfter(shownAt)) return;
      pendingNext = null;
      setTutorial({ spotLines: [], nextAction: null });
      const passing = useGame.getState().caption;
      setTimeout(() => {
        if (useGame.getState().caption === passing) setTutorial({ spotlight: null });
      });
      settle();
    };
    const action = { label, onClick: () => pendingNext?.() };
    const replay = shown?.text === text ? shown.replay : undefined;
    useGame.setState({ caption: { text, tone, action, replay } });
    setTutorial({ spotlight: spot, nextAction: action });
  });
}

export async function beat(
  gen: Token,
  text: string,
  opts: {
    prepare?: () => Promise<void> | void;
    label?: string;
    spot?: Spot;
    settle?: number;
    callouts?: Game['callouts'];
    region?: Game['region'];
    keep?: boolean;
    lines?: TutorialState['spotLines'];
    tone?: CaptionTone;
  } = {},
): Promise<void> {
  if (!opts.keep) {
    useGame.setState({ callouts: opts.callouts ?? [], region: opts.region ?? null });
    setTutorial({ spotLines: opts.lines ?? [] });
  }
  if (opts.callouts) cameraRig.include(opts.callouts.map((c) => [c.x, c.y] as const));
  const tone = opts.tone ?? 'info';
  const label = opts.label ?? messages().caption.next;
  let pressed = false;
  let press = () => {};
  const early = new Promise<void>((resolve) => (press = resolve));
  say(text, opts.spot ?? null, tone, label, () => {
    pressed = true;
    press();
  });
  if (opts.prepare) await Promise.race([opts.prepare(), early]);
  gen.guard();
  if (pressed) return;
  await Promise.race([sleep(opts.settle ?? 300), early]);
  gen.guard();
  if (pressed) return;
  await next(gen, text, label, opts.spot ?? null, tone);
}

function holdCaption(gen: Token): Promise<void> {
  const c = useGame.getState().caption;
  return next(gen, c?.text ?? '', messages().caption.next, null, c?.tone ?? 'info');
}

export function allow(a: Partial<TutorialState['allow']>) {
  setTutorial({ allow: { ...ALLOW_NONE, ...a } });
}

export function waitEvent(gen: Token, names: ('stepped' | 'runDone')[], until?: () => boolean): Promise<void> {
  return settled(gen, (settle) => {
    const off = events.on((e) => {
      if (!gen.alive || (names.includes(e) && (!until || until()))) {
        off();
        settle();
      }
    });
  });
}

export function waitStore(gen: Token, test: (g: Game) => boolean): Promise<void> {
  return settled(gen, (settle) => {
    if (test(useGame.getState())) return settle();
    const off = useGame.subscribe((g) => {
      if (!gen.alive || test(g)) {
        off();
        settle();
      }
    });
  });
}

function choose<K extends string>(gen: Token, text: string, choices: { key: K; label: string; tone?: 'yes' | 'no' }[]): Promise<K> {
  return settled<K>(gen, (settle) => {
    const pick = (k: K) => () => settle(k);
    useGame.setState({
      caption: { text, tone: 'info', choices: choices.map((c) => ({ label: c.label, tone: c.tone, onClick: pick(c.key) })) },
      callouts: [],
      region: null,
    });
    setTutorial({ spotlight: null });
  });
}

export async function ask(gen: Token, text: string): Promise<boolean> {
  const k = await choose(gen, text, [
    { key: 'yes', label: messages().caption.yes, tone: 'yes' },
    { key: 'no', label: messages().caption.no, tone: 'no' },
  ]);
  return k === 'yes';
}

export function tutorialCheck(): 'refused' | void {
  const { formula, tutorial } = useGame.getState();
  if (!tutorial.check) return;
  if (!formula || !formula.ok) return 'refused';
  tutorial.check();
}

function waitCheck(gen: Token): Promise<void> {
  return settled(gen, (settle) => {
    allow({ formula: true });
    setTutorial({
      check: () => {
        setTutorial({ check: null });
        settle();
      },
    });
  });
}

export function showHint() {
  const h = useGame.getState().tutorial.hint;
  if (!h || h.shown) return;
  useGame.setState({ caption: { text: `${h.ask}\n\n**${messages().tutorial.hint}** ${h.nudge}`, tone: 'info' } });
  setTutorial({ hint: { ...h, shown: true }, spotlight: null });
}

export interface StageOptions {
  ask: string;
  rules: Rule[];
  nudge: string;
  ghost?: Partial<Record<Rule, string>>;
  region?: Game['region'];
  onFail?: (rule: Rule) => void;
}

export async function stage(gen: Token, o: StageOptions): Promise<void> {
  useGame.setState({ callouts: [], region: o.region ?? null });
  setTutorial({ hint: { ask: o.ask, nudge: o.nudge, shown: false } });
  say(o.ask, 'check');
  for (;;) {
    await waitCheck(gen);
    useGame.setState({ region: null });
    setTutorial({ spotlight: null });
    const stageRule = o.rules[o.rules.length - 1];
    const out = await checkAndPlay(
      o.rules,
      (failing) => ({
        prefix: failing !== stageRule ? messages().tutorial.lostRule(messages().rules[failing]) : undefined,
        extra: messages().tutorial.fixAndCheck,
        ghostExtra: o.ghost?.[failing],
      }),
      gen,
    );
    gen.guard();
    if (!out) continue;
    if (out.failing) {
      o.onFail?.(out.failing);
      continue;
    }
    if (out.undecided) {
      showUndecided(messages().tutorial.undecided);
      continue;
    }
    allow({});
    setTutorial({ hint: null });
    return;
  }
}

export async function demo(
  gen: Token,
  formula: string,
  rules: Rule[],
  opts: { ghostExtra?: string; restore?: string; guessedRight?: boolean } = {},
): Promise<void> {
  const g = useGame.getState();
  const mine = opts.restore ?? g.formulaText;
  useGame.setState({ busy: true, callouts: [], region: null });
  void sendFrogsHome('test');
  say(messages().tutorial.trying(formula), null, 'muted');
  if (g.formulaText.trim() !== formula) {
    setTutorial({ spotlight: 'formula' });
    await sleep(500);
    gen.guard();
    for (let k = 1; k <= formula.length; k++) {
      g.setFormula(formula.slice(0, k));
      await sleep(formula[k - 1] === ' ' ? 30 : 70);
      gen.guard();
    }
  }
  await sleep(550);
  gen.guard();
  useGame.setState({ busy: false });
  const verdict = opts.guessedRight === undefined ? undefined : opts.guessedRight ? messages().tutorial.guessedRight : messages().tutorial.guessedWrong;
  const tone = opts.guessedRight ? 'success' : 'fail';
  const out = await checkAndPlay(rules, () => ({ prefix: verdict, tone, ghostExtra: opts.ghostExtra, area: messages().verdicts.theArea, action: nextAfterCounterexample }), gen);
  gen.guard();
  if (out?.failing) await holdCaption(gen);
  void sendFrogsHome();
  useGame.setState({ failMark: null, region: null });
  g.setFormula(mine);
  const back = await runChecker(rules);
  gen.guard();
  if (back) revealAll(back);
}
