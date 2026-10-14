import { create } from 'zustand';
import type { State } from '../lang/ast';
import type { Formula } from '../checker/check';
import type { Counterexample, Verdicts } from '../checker/types';
import { compileFormula, compileLevel, type CompiledLevel, type FormulaResult, type LevelDef, type Rule } from '../levels/level';
import { loadProgress, saveProgress, type Progress } from './progress';

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
  /** Increments whenever frogs land (loop header highlight). */
  landings: number;
  lastFailure: Counterexample | null;
  ghost: string | null;
  hints: string[];
  hintsShown: number;
  showMe: string | null;
  showRules: boolean;
  cleared: boolean;
  pitfallMessage: string | null;
  /** A cinematic is playing; the level scene is hidden. */
  cinematic: boolean;
  progress: Progress;

  openLevel(def: LevelDef, mode: 'level' | 'tutorial'): void;
  backToMenu(): void;
  setFormula(text: string): void;
  setPond(p: number): void;
  setCaption(c: Caption | null): void;
  setReveal(r: Partial<Reveal>): void;
  patch(p: Partial<Game>): void;
  markCleared(id: string): void;
  markTutorialDone(): void;
}

export const useGame = create<Game>((set, get) => ({
  mode: 'menu',
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
  landings: 0,
  lastFailure: null,
  ghost: null,
  hints: [],
  hintsShown: 0,
  showMe: null,
  showRules: false,
  cleared: false,
  pitfallMessage: null,
  cinematic: false,
  progress: loadProgress(),

  openLevel(def, mode) {
    const level = compileLevel(def);
    const saved = mode === 'level' ? get().progress.formulas[def.id] ?? '' : '';
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
      cleared: get().progress.cleared.includes(def.id),
      pitfallMessage: null,
    });
    if (saved) get().setFormula(saved);
  },
  backToMenu() {
    set({ mode: 'menu', level: null, caption: null, running: false, busy: false });
  },
  setFormula(text) {
    const { level, progress, mode } = get();
    if (!level) return;
    if (text.trim() === '') {
      set({ formulaText: text, formula: null, valid: null, verdicts: {} });
      return;
    }
    const formula = compileFormula(level, text);
    set({
      formulaText: text,
      formula,
      valid: formula.ok ? { expr: formula.expr, fast: formula.fast, text } : get().valid,
      verdicts: {},
      pitfallMessage: null,
    });
    if (mode === 'level') {
      const p = { ...progress, formulas: { ...progress.formulas, [level.id]: text } };
      saveProgress(p);
      set({ progress: p });
    }
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
  markCleared(id) {
    const progress = get().progress;
    if (progress.cleared.includes(id)) return;
    const p = { ...progress, cleared: [...progress.cleared, id] };
    saveProgress(p);
    set({ progress: p });
  },
  markTutorialDone() {
    const p = { ...get().progress, tutorialDone: true };
    saveProgress(p);
    set({ progress: p });
  },
}));

export const game = () => useGame.getState();
