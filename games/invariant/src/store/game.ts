import { create } from 'zustand';
import type { State } from '../lang/ast';
import type { Formula } from '../checker/check';
import type { Counterexample, Verdicts } from '../checker/types';
import { compileFormula, compileLevel, type CompiledLevel, type FormulaResult, type LevelDef, type Rule } from '../levels/level';

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
  lights: Rule[];
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
  lights: ['init', 'pres', 'exit'],
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
  lights: [],
};

export type CaptionTone = 'info' | 'fail' | 'success' | 'muted';

export interface Caption {
  text: string;
  tone: CaptionTone;
  /** Optional button shown in the caption bar (tutorial "Next" etc.). */
  action?: { label: string; onClick: () => void };
}

export interface Game {
  mode: 'menu' | 'level' | 'tutorial';
  /** On the home screen: the title, or the level picker. */
  menuView: 'home' | 'levels';
  /** The camera is riding between ponds (and in which direction). */
  elevating: boolean;
  elevatorDir: number;
  level: CompiledLevel | null;
  pond: number;
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
  /** Values shown under the code like a debugger. */
  selected: State | null;
  /** Increments when frogs start a hop (the loop body runs). */
  hopTick: number;
  hopDur: number;
  /** Increments when frogs land (the loop condition is checked). */
  landTick: number;
  landGuard: 'true' | 'false' | 'mixed';
  lastFailure: Counterexample | null;
  ghost: string | null;
  hints: string[];
  hintsShown: number;
  showMe: string | null;
  showRules: boolean;
  pitfallMessage: string | null;
  /** A cinematic is playing; the level scene is hidden. */
  cinematic: boolean;
  /** A single Step is animating. */
  stepping: boolean;
  /** Tutorial: the current step is waiting for the learner to press Check. */
  awaitingCheck: boolean;
  /** Tutorial: which controls the current beat lets the learner use. */
  tutorialAllow: { step: boolean; run: boolean; eggs: boolean };
  /** Tutorial: the UI element the caption is talking about. */
  spotlight: 'code' | 'step' | 'run' | 'formula' | 'check' | 'lights' | null;
  /** Where the last check failed (tile in the focused pond) and why. */
  failMark: { x: number; y: number; label: string; t0: number } | null;

  openLevel(def: LevelDef, mode: 'level' | 'tutorial'): void;
  backToMenu(view?: 'home' | 'levels'): void;
  setFormula(text: string): void;
  setPond(p: number): void;
  setCaption(c: Caption | null): void;
  setReveal(r: Partial<Reveal>): void;
  patch(p: Partial<Game>): void;
}

export const useGame = create<Game>((set, get) => ({
  mode: 'menu',
  menuView: 'home',
  elevating: false,
  elevatorDir: 1,
  level: null,
  pond: 0,
  formulaText: '',
  formula: null,
  valid: null,
  verdicts: {},
  checking: false,
  busy: false,
  running: false,
  caption: null,
  reveal: FULL_REVEAL,
  selected: null,
  hopTick: 0,
  hopDur: 0.42,
  landTick: 0,
  landGuard: 'true',
  lastFailure: null,
  ghost: null,
  hints: [],
  hintsShown: 0,
  showMe: null,
  showRules: false,
  pitfallMessage: null,
  cinematic: false,
  failMark: null,
  stepping: false,
  awaitingCheck: false,
  tutorialAllow: { step: false, run: false, eggs: false },
  spotlight: null,

  openLevel(def, mode) {
    const level = compileLevel(def);
    set({
      mode,
      level,
      pond: def.ponds?.start ?? 0,
      formulaText: '',
      formula: null,
      valid: null,
      verdicts: {},
      checking: false,
      busy: false,
      running: false,
      caption: def.intro ? { text: def.intro, tone: 'info' } : null,
      reveal: mode === 'tutorial' ? EMPTY_REVEAL : FULL_REVEAL,
      selected: null,
      lastFailure: null,
      ghost: null,
      hints: def.hints ?? [],
      hintsShown: 0,
      showMe: null,
      pitfallMessage: null,
      elevating: false,
      failMark: null,
      stepping: false,
      awaitingCheck: false,
      tutorialAllow: { step: false, run: false, eggs: false },
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
  setPond(p) {
    set({ pond: p });
  },
  setCaption(c) {
    set({ caption: c });
  },
  setReveal(r) {
    set({ reveal: { ...get().reveal, ...r } });
  },
  patch(p) {
    set(p);
  },
}));

export const game = () => useGame.getState();
