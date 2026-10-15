import { create } from 'zustand';
import type { Formula } from '../checker/check';
import type { Verdicts } from '../checker/types';
import { compileFormula, compileLevel, type CompiledLevel, type FormulaResult, type LevelDef, type Rule } from '../levels/level';
import { localizeLevel } from '../levels/localize';

// The game's state, shared by the scene, the HUD and the scripted sequences.

export interface Reveal {
  code: boolean;
  axes: boolean;
  stop: boolean;
  hover: boolean;
  eggs: boolean;
  goals: boolean;
  run: boolean;
  step: boolean;
  formula: boolean;
  /** The ghost `assert(…)` line at the top of the loop body. */
  assert: boolean;
  /** Rule lights shown in the top bar. */
  lights: Rule[];
  /** Lights that are live (the tutorial shows the rest dim until their stage). */
  awake: Rule[];
}

export const FULL_REVEAL: Reveal = {
  code: true,
  axes: true,
  stop: true,
  hover: true,
  eggs: true,
  goals: true,
  run: true,
  step: true,
  formula: true,
  assert: true,
  lights: ['initialization', 'maintenance', 'termination'],
  awake: ['initialization', 'maintenance', 'termination'],
};

export const EMPTY_REVEAL: Reveal = {
  code: false,
  axes: false,
  stop: false,
  hover: false,
  eggs: false,
  goals: false,
  run: false,
  step: false,
  formula: false,
  assert: false,
  lights: [],
  awake: [],
};

export type CaptionTone = 'info' | 'fail' | 'success' | 'muted';

export interface Caption {
  text: string;
  tone: CaptionTone;
  /** Main button (Next, Replay, …); `disabled` shows it greyed, for a step that waits on the learner first. */
  action?: { label: string; onClick: () => void; disabled?: boolean };
  /** Optional quieter button next to it (e.g. Replay). */
  secondary?: { label: string; onClick: () => void };
  /** A question: these buttons instead of a main one (the tutorial's predictions); `tone` gives Yes and No their marks. */
  choices?: { label: string; onClick: () => void; tone?: 'yes' | 'no' }[];
}

/** The tutorial's hint for the current stage: one sentence, shown under the stage's ask. */
export interface Hint {
  ask: string;
  nudge: string;
  /** The learner has asked for it (the button goes). */
  shown: boolean;
}

export interface Game {
  mode: 'menu' | 'level' | 'tutorial';
  /** On the home screen: the title, or the level picker. */
  menuView: 'home' | 'levels';
  level: CompiledLevel | null;
  plane: number;
  formulaText: string;
  formula: FormulaResult | null;
  /** Last valid formula — the slabs follow it. */
  valid: Formula | null;
  verdicts: Partial<Verdicts>;
  checking: boolean;
  /** A director sequence is playing (input is locked). */
  busy: boolean;
  running: boolean;
  caption: Caption | null;
  reveal: Reveal;
  /** Increments when frogs start a hop (the loop body runs). */
  hopTick: number;
  hopDur: number;
  /** Increments when frogs land (the loop condition is checked). */
  landTick: number;
  landGuard: 'true' | 'false' | 'mixed';
  /** Tutorial: the stage's hint while it waits for Check. */
  hint: Hint | null;
  /** Levels: how many of the level's hints the learner has asked for. */
  hintsShown: number;
  showRules: boolean;
  /** The syntax reference card is open. */
  showSyntax: boolean;
  pitfallMessage: string | null;
  /** A single Step is animating. */
  stepping: boolean;
  /** Tutorial: real frogs carry a tag with their variables, animated as they change. */
  frogTags: boolean;
  /** Tutorial: go back to the previous step (null on the first one). */
  back: (() => void) | null;
  /** Tutorial: jump straight to the next step, its scene rebuilt at once (Next pressed mid-animation). */
  skip: (() => void) | null;
  /** Tutorial: the current step is waiting for the learner to press Check. */
  awaitingCheck: boolean;
  /** Tutorial: the Next action the script is currently waiting on (so replays can restore it). */
  nextAction: { label: string; onClick: () => void } | null;
  /** Tutorial: which controls the current beat lets the learner use. */
  tutorialAllow: { step: boolean; run: boolean; eggs: boolean; formula: boolean };
  /** Tutorial: program lines the caption is talking about (1-based). */
  spotLines: number[];
  /** Tutorial: the UI element the caption is talking about. */
  spotlight: 'code' | 'step' | 'run' | 'formula' | 'check' | 'lights' | null;
  /** Bumped when Check is pressed with an invalid formula (shows the inline error at once). */
  errorNudge: number;
  /** Tutorial labels: over tile (x, y), or riding along with a frog when `frog` (its id) is set; an empty text is an outline alone. */
  callouts: { x: number; y: number; frog?: number; text: string; tone: 'info' | 'good' }[];
  /** Where the last check failed (tile in the focused plane) and why. */
  failMark: { x: number; y: number; label: string; t0: number } | null;

  openLevel(def: LevelDef, mode: 'level' | 'tutorial'): void;
  backToMenu(view?: 'home' | 'levels'): void;
  setFormula(text: string): void;
  setReveal(r: Partial<Reveal>): void;
}

export const useGame = create<Game>((set, get) => ({
  mode: 'menu',
  menuView: 'home',
  level: null,
  plane: 0,
  formulaText: '',
  formula: null,
  valid: null,
  verdicts: {},
  checking: false,
  busy: false,
  running: false,
  caption: null,
  reveal: FULL_REVEAL,
  hopTick: 0,
  hopDur: 0.42,
  landTick: 0,
  landGuard: 'true',
  hint: null,
  hintsShown: 0,
  showRules: false,
  showSyntax: false,
  pitfallMessage: null,
  failMark: null,
  errorNudge: 0,
  callouts: [],
  stepping: false,
  frogTags: false,
  back: null,
  skip: null,
  awaitingCheck: false,
  tutorialAllow: { step: false, run: false, eggs: false, formula: false },
  spotLines: [],
  nextAction: null,
  spotlight: null,

  openLevel(def, mode) {
    // in the current language: its title, intro, hints and pitfalls
    const level = compileLevel(localizeLevel(def));
    set({
      mode,
      level,
      plane: def.planes?.start ?? 0,
      formulaText: '',
      formula: null,
      valid: null,
      verdicts: {},
      checking: false,
      busy: false,
      running: false,
      caption: level.intro ? { text: level.intro, tone: 'info' } : null,
      reveal: mode === 'tutorial' ? EMPTY_REVEAL : FULL_REVEAL,
      hint: null,
      hintsShown: 0,
      pitfallMessage: null,
      failMark: null,
      callouts: [],
      stepping: false,
      frogTags: false,
      back: null,
      skip: null,
      awaitingCheck: false,
      tutorialAllow: { step: false, run: false, eggs: false, formula: false },
      spotLines: [],
      nextAction: null,
      spotlight: null,
    });
  },
  backToMenu(view = 'home') {
    set({ mode: 'menu', menuView: view, level: null, caption: null, running: false, busy: false });
  },
  setFormula(text) {
    const { level } = get();
    if (!level) return;
    if (text.trim() === '') {
      set({ formulaText: text, formula: null, valid: null, verdicts: {}, failMark: null });
      return;
    }
    const formula = compileFormula(level, text);
    set({
      formulaText: text,
      formula,
      valid: formula.ok ? { expr: formula.expr, fast: formula.fast, text } : get().valid,
      verdicts: {},
      pitfallMessage: null,
      failMark: null,
    });
  },
  setReveal(r) {
    set({ reveal: { ...get().reveal, ...r } });
  },
}));
