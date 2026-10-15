import type { CheckResult } from '../checker/check';
import { events } from '../director/events';
import { sleep } from '../director/sequence';
import { runChecker } from '../director/verdicts';
import { useGame, type CaptionTone, type Game } from '../game/store';
import { show } from '../lang/ast';
import { compileFormula, type Rule } from '../levels/level';
import { frogWorld } from '../scene/frogs/frogWorld';

// The tutorial's vocabulary: captions, beats, waiting for the learner, and
// asking for a formula. Every step runs under a generation number; stopping
// or rewinding the tutorial starts a new one, and anything still waiting from
// the old one throws Aborted.
//
// Pacing rules:
//  - a caption always appears *before* the scene changes it describes, and the
//    Next button only appears once the change has finished;
//  - nothing the learner should read is replaced automatically — explanations
//    wait for Next;
//  - each attempt asks for one specific formula (offered as Tab-to-fill
//    placeholder text), so what happens next is always what the caption promises;
//  - whatever a caption refers to (the code, Step, Check…) is spotlighted.

export class Aborted extends Error {}

let generation = 0;
let pendingCheck: (() => void) | null = null;
let pendingNext: (() => void) | null = null;
/** Formulas the current attempt accepts (normalized). */
let expected: { accepted: string[]; display: string } | null = null;
let captionShownAt = 0;

/** Start a new generation (cancelling the old one's waits), and return it. */
export function newGeneration(): number {
  generation++;
  pendingCheck = null;
  pendingNext = null;
  expected = null;
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
      useGame.setState({ spotlight: null, nextAction: null });
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
  opts: { prepare?: () => Promise<void> | void; label?: string; spot?: Spot; settle?: number; callouts?: Game['callouts'] } = {},
): Promise<void> {
  // small labelled tags in the scene for what this beat talks about (cleared otherwise)
  useGame.setState({ callouts: opts.callouts ?? [] });
  say(text, opts.spot ?? null, 'info', opts.label ?? 'Next');
  if (opts.prepare) await opts.prepare();
  guard(gen);
  await sleep(opts.settle ?? 300);
  guard(gen);
  await next(gen, text, opts.label ?? 'Next', opts.spot ?? null);
}

/** Keep the caption currently shown (e.g. a counterexample) until Next. */
export function holdCaption(gen: number): Promise<void> {
  const c = useGame.getState().caption;
  return next(gen, c?.text ?? '', 'Next', null, c?.tone ?? 'info');
}

/** Let the learner use these controls (and only these) for now. */
export function allow(a: Partial<Game['tutorialAllow']>) {
  useGame.setState({ tutorialAllow: { step: false, run: false, eggs: false, ...a } });
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

/** A formula in canonical form, to compare what was typed with what was asked for. */
function normalize(text: string): string | null {
  const level = useGame.getState().level;
  if (!level) return null;
  const f = compileFormula(level, text);
  return f.ok ? show(f.expr) : null;
}

/** The Check button in tutorial mode: only the formula the step asks for goes through. */
export function tutorialCheck() {
  const g = useGame.getState();
  if (!pendingCheck || !expected) return;
  if (g.formula && !g.formula.ok) {
    useGame.setState((s) => ({ errorNudge: s.errorNudge + 1 }));
    return;
  }
  const got = normalize(g.formulaText);
  if (!got || !expected.accepted.includes(got)) {
    useGame.setState({
      caption: { text: `For this step, type exactly \`${expected.display}\` — press Tab to fill it in.`, tone: 'fail' },
      spotlight: 'formula',
    });
    return;
  }
  pendingCheck();
}

/** Ask for one specific formula, wait for Check, and run the given rules. */
export async function attempt(gen: number, formula: string, alternatives: string[], rules: Rule[]): Promise<CheckResult> {
  expected = {
    display: formula,
    accepted: [formula, ...alternatives].map(normalize).filter((t): t is string => !!t),
  };
  useGame.setState({ suggestion: formula, callouts: [] });
  for (;;) {
    await new Promise<void>((resolve, reject) => {
      pendingCheck = () => {
        pendingCheck = null;
        useGame.setState({ awaitingCheck: false });
        if (gen !== generation) reject(new Aborted());
        else resolve();
      };
      useGame.setState({ awaitingCheck: true });
    });
    useGame.setState({ spotlight: null });
    frogWorld.clear('test');
    say('Checking…', null, 'muted');
    const res = await runChecker(rules);
    guard(gen);
    if (res) {
      expected = null;
      useGame.setState({ suggestion: null });
      return res;
    }
  }
}

/** The counterexample a check found for a rule, if it failed. */
export function failureOf(res: CheckResult, rule: Rule) {
  const v = res.verdicts[rule];
  return v?.status === 'fail' ? v.cex : null;
}
