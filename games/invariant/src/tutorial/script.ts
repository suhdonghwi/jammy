import type { CheckResult } from '../checker/check';
import type { Counterexample } from '../checker/types';
import { events } from '../director/events';
import { handIn } from '../director/hand';
import { sleep } from '../director/sequence';
import { playCounterexample, playShrug, runChecker } from '../director/verdicts';
import { useGame, type CaptionTone, type Game } from '../game/store';
import { RULE_NAMES, type Rule } from '../levels/level';
import { cameraRig } from '../scene/cameraRig';
import { frogWorld } from '../scene/frogs/frogWorld';

// The tutorial's vocabulary: captions, beats, waiting for the learner, and
// the stages where the learner draws an area. Every step runs under a
// generation number; stopping or rewinding the tutorial starts a new one, and
// anything still waiting from the old one throws Aborted.
//
// Pacing rules:
//  - a caption always appears *before* the scene changes it describes, and the
//    Next button only appears once the change has finished;
//  - nothing the learner should read is replaced automatically — explanations
//    wait for Next;
//  - any formula is a valid move: a stage checks whatever was typed against
//    the rules introduced so far, and the story branches on which rule failed;
//  - whatever a caption refers to (the code, Step, Check…) is spotlighted.

export class Aborted extends Error {}

let generation = 0;
let pendingCheck: (() => void) | null = null;
let pendingNext: (() => void) | null = null;
let captionShownAt = 0;

/** Start a new generation (cancelling the old one's waits), and return it. */
export function newGeneration(): number {
  generation++;
  pendingCheck = null;
  pendingNext = null;
  return generation;
}

export const currentGeneration = () => generation;

/** Throw if the tutorial has moved on since `gen` started. */
export function guard(gen: number) {
  if (gen !== generation) throw new Aborted();
}

/** Clicks this soon after a button appears are ignored, so a double click doesn't press two buttons. */
const DOUBLE_CLICK_MS = 120;

/**
 * A Next button for a step that isn't ready yet (its scene is still playing).
 * It shows right away; pressing it skips ahead to the next step at once
 * instead of waiting.
 */
function earlyNext(label = 'Next') {
  const shownAt = performance.now();
  return {
    label,
    onClick: () => {
      if (performance.now() - shownAt >= DOUBLE_CLICK_MS) useGame.getState().skip?.();
    },
  };
}

/** The Next button for a counterexample's caption: the live one if a step is already waiting on it (a replay), or an early one. */
export const nextAfterCounterexample = () => useGame.getState().nextAction ?? earlyNext();

type Spot = Game['spotlight'];

/** Show a caption. `reserve`: the label of the button that will advance it (see earlyNext). */
export function say(text: string, spot: Spot = null, tone: CaptionTone = 'info', reserve?: string) {
  captionShownAt = performance.now();
  useGame.setState({ caption: { text, tone, action: reserve ? earlyNext(reserve) : undefined }, spotlight: spot });
}

/** Show a caption whose Next is there but greyed: the step waits for the learner to do something first. */
export function sayWaiting(text: string, spot: Spot = null) {
  captionShownAt = performance.now();
  useGame.setState({ caption: { text, tone: 'info', action: { label: 'Next', onClick: () => {}, disabled: true } }, spotlight: spot });
}

/** Show a caption with a button and wait for it. */
function next(gen: number, text: string, label = 'Next', spot: Spot = null, tone: CaptionTone = 'info'): Promise<void> {
  return new Promise((resolve, reject) => {
    const shown = useGame.getState().caption;
    // the double-click guard counts from when this caption (and its button)
    // first appeared, not from the invisible moment the button becomes ready
    const shownAt = shown?.text === text ? captionShownAt : performance.now();
    pendingNext = () => {
      if (performance.now() - shownAt < DOUBLE_CLICK_MS) return;
      pendingNext = null;
      useGame.setState({ spotlight: null, spotLines: [], nextAction: null });
      if (gen !== generation) reject(new Aborted());
      else resolve();
    };
    const action = { label, onClick: () => pendingNext?.() };
    const secondary = shown?.text === text ? shown.secondary : undefined;
    useGame.setState({ caption: { text, tone, action, secondary }, spotlight: spot, nextAction: action });
  });
}

/**
 * One beat of the story: the caption appears right away with its final text,
 * `prepare` runs the scene change it describes, and only then does the Next
 * button appear (same text, so the caption doesn't re-animate).
 */
export async function beat(
  gen: number,
  text: string,
  opts: {
    prepare?: () => Promise<void> | void;
    label?: string;
    spot?: Spot;
    settle?: number;
    callouts?: Game['callouts'];
    lines?: number[];
    tone?: CaptionTone;
  } = {},
): Promise<void> {
  // small labelled tags in the scene for what this beat talks about (cleared otherwise)
  useGame.setState({ callouts: opts.callouts ?? [], spotLines: opts.lines ?? [] });
  const tone = opts.tone ?? 'info';
  say(text, opts.spot ?? null, tone, opts.label ?? 'Next');
  if (opts.prepare) await opts.prepare();
  guard(gen);
  await sleep(opts.settle ?? 300);
  guard(gen);
  await next(gen, text, opts.label ?? 'Next', opts.spot ?? null, tone);
}

/** Keep the caption currently shown (e.g. a counterexample) until Next. */
export function holdCaption(gen: number): Promise<void> {
  const c = useGame.getState().caption;
  return next(gen, c?.text ?? '', 'Next', null, c?.tone ?? 'info');
}

/** Let the learner use these controls (and only these) for now. */
export function allow(a: Partial<Game['tutorialAllow']>) {
  useGame.setState({ tutorialAllow: { step: false, run: false, eggs: false, formula: false, ...a } });
}

/** Wait for the learner's Step or Run (optionally until a condition holds). */
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

/** Wait until the store satisfies `test` (checked on every change). */
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

/** A question with a few answers as buttons; resolves with the chosen key. */
export function choose<K extends string>(gen: number, text: string, choices: { key: K; label: string; tone?: 'yes' | 'no' }[]): Promise<K> {
  return new Promise((resolve, reject) => {
    const pick = (k: K) => () => {
      if (gen !== generation) reject(new Aborted());
      else resolve(k);
    };
    // the previous beat's tags go: the question stands on its own
    useGame.setState({
      caption: { text, tone: 'info', choices: choices.map((c) => ({ label: c.label, tone: c.tone, onClick: pick(c.key) })) },
      spotlight: null,
      callouts: [],
    });
  });
}

/** A yes-or-no question; resolves with true for Yes. */
export async function ask(gen: number, text: string): Promise<boolean> {
  const k = await choose(gen, text, [
    { key: 'yes', label: 'Yes', tone: 'yes' },
    { key: 'no', label: 'No', tone: 'no' },
  ]);
  return k === 'yes';
}

// ---- Check, and the hint ladder ----

/** The Check button in tutorial mode: hands a valid formula to the stage waiting for it. */
export function tutorialCheck() {
  const g = useGame.getState();
  if (!pendingCheck) return;
  if (!g.formula || !g.formula.ok) {
    useGame.setState((s) => ({ errorNudge: s.errorNudge + 1 }));
    return;
  }
  pendingCheck();
}

/** Let the learner edit the area and press Check; resolves when they do (with a valid formula). */
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

/** The Hint button: a nudge, then a formula to try (Tab fills it in), then filling it in. */
export function climbHint() {
  const g = useGame.getState();
  const h = g.hint;
  if (!h || h.rung >= 3) return;
  const rung = h.rung + 1;
  if (rung === 1) {
    useGame.setState({ hint: { ...h, rung }, caption: { text: `${h.ask}\n\n**Hint:** ${h.nudge}`, tone: 'info' }, spotlight: null });
  } else if (rung === 2) {
    useGame.setState({
      hint: { ...h, rung },
      caption: { text: `${h.ask}\n\n**Hint:** ${h.nudge}\n\nTry \`${h.formula}\` — press Tab to fill it in.`, tone: 'info' },
      spotlight: 'formula',
    });
  } else {
    useGame.setState({ hint: { ...h, rung } });
    g.setFormula(h.formula);
  }
}

// ---- stages and demos ----

export interface StageOptions {
  /** What this stage asks for (shown with Check spotlit). */
  ask: string;
  /** The rules checked: everything introduced so far. */
  rules: Rule[];
  /** The hint ladder's nudge and formula. */
  nudge: string;
  hint: string;
  /** Check the current area first, before asking for anything. */
  checkFirst?: boolean;
  /** A paragraph added to a rule's counterexample caption. */
  explain?: Partial<Record<Rule, string>>;
  /** Called with each rule the learner's own area breaks. */
  onFail?: (rule: Rule) => void;
}

/**
 * One stage: the learner draws an area and presses Check; the rules
 * introduced so far run on it. A failure is acted out and the stage waits for
 * another Check; the stage ends on the first pass, returning the verdicts.
 */
export async function stage(gen: number, o: StageOptions): Promise<CheckResult> {
  useGame.setState({ hint: { rung: 0, ask: o.ask, nudge: o.nudge, formula: o.hint }, callouts: [] });
  // after a failure its caption stays (with Replay) while the learner fixes
  // the area, so the ask is only said at the start
  let askNow = !o.checkFirst;
  let waitFirst = !o.checkFirst;
  for (;;) {
    if (askNow) say(o.ask, 'check');
    if (waitFirst) await waitCheck(gen);
    askNow = false;
    waitFirst = true;
    // no "Checking…" caption: most checks finish before one could be read,
    // and the Check button's spinner and the lights show a slow one
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
        await playShrug("I couldn't prove that either way. Try a simpler formula — the hint has one.");
        guard(gen);
        continue;
      }
      // the stage's frogs (a counterexample's, say) go; the learner's area stays
      frogWorld.clear();
      allow({});
      useGame.setState({ hint: null, selected: null });
      return res;
    }
    o.onFail?.(failing);
    const cex = failureOf(res, failing)!;
    const stageRule = o.rules[o.rules.length - 1];
    const prefix = failing !== stageRule ? `${RULE_NAMES[failing]} held a moment ago; this change lost it. ` : undefined;
    // the level's pitfall line duplicates the explanations here
    useGame.setState({ pitfallMessage: null });
    const extra = `${o.explain?.[failing] ?? ''}\n\nFix your area and press **Check** again.`.trim();
    await playCounterexample(cex, { prefix, extra });
    guard(gen);
  }
}

/**
 * Show a formula in the box, slabs and all, for the learner to look at (the
 * box stays read-only). `preview()` then puts the learner's own area back.
 */
export function preview(formula: string): () => void {
  const mine = useGame.getState().formulaText;
  useGame.getState().setFormula(formula);
  return () => useGame.getState().setFormula(mine);
}

/**
 * A formula of the tutorial's own is tried: the hand types it into the box
 * (the slabs follow) unless it is already there, the rules run, and the
 * counterexample is acted out. Next restores the learner's area (`restore`,
 * or whatever the box held) and its verdicts. Returns the counterexample.
 */
export async function demo(gen: number, formula: string, rules: Rule[], opts: { extra?: string; restore?: string } = {}): Promise<Counterexample | null> {
  const g = useGame.getState();
  const mine = opts.restore ?? g.formulaText;
  useGame.setState({ busy: true, callouts: [] });
  frogWorld.clear('test');
  say(`Trying \`${formula}\`…`, 'formula', 'muted');
  if (g.formulaText.trim() !== formula) {
    const t = cameraRig.target();
    void handIn(t.x + 2.5, -t.z + 1.5, 2.4, { tap: 1, curl: 0.15, tilt: 0.1 });
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
    // the area on the plane is the one being tried, not the learner's
    await playCounterexample(cex, { extra: opts.extra, area: 'this area', action: nextAfterCounterexample });
    guard(gen);
    await holdCaption(gen);
  }
  // back to the learner's area, with its lights green again
  frogWorld.clear('test');
  useGame.setState({ failMark: null, selected: null });
  g.setFormula(mine);
  await runChecker(rules);
  guard(gen);
  return cex;
}

/** The counterexample a check found for a rule, if it failed. */
export function failureOf(res: CheckResult, rule: Rule) {
  const v = res.verdicts[rule];
  return v?.status === 'fail' ? v.cex : null;
}
