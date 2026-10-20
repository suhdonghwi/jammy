import { create } from 'zustand';
import { RULES, type Rule, type Verdicts } from '../checker/types';
import { compileFormula, compileLevel, startInputs, type CompiledLevel, type Formula, type FormulaResult, type Inputs, type LevelDef } from '../levels/level';
import { localizeLevel } from '../levels/localize';
import type { TileWindow } from '../levels/tiles';

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
  area: boolean;
  assert: boolean;
  lights: Rule[];
  awake: Rule[];
}

const FULL_REVEAL: Reveal = {
  code: true,
  axes: true,
  stop: true,
  hover: true,
  eggs: true,
  goals: true,
  run: true,
  step: true,
  formula: true,
  area: true,
  assert: true,
  lights: RULES,
  awake: RULES,
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
  area: false,
  assert: false,
  lights: [],
  awake: [],
};

export type CaptionTone = 'info' | 'fail' | 'success' | 'muted';

export interface Caption {
  text: string;
  tone: CaptionTone;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  secondary?: { label: string; onClick: () => void };
  choices?: { label: string; onClick: () => void; tone?: 'yes' | 'no' }[];
}

interface Hint {
  ask: string;
  nudge: string;
  shown: boolean;
}

export interface Game {
  mode: 'menu' | 'level' | 'tutorial';
  menuView: 'home' | 'levels';
  level: CompiledLevel | null;
  inputs: Inputs;
  formulaText: string;
  formula: FormulaResult | null;
  valid: Formula | null;
  verdicts: Partial<Verdicts>;
  checking: boolean;
  busy: boolean;
  running: boolean;
  caption: Caption | null;
  reveal: Reveal;
  hopTick: number;
  hopDur: number;
  landTick: number;
  landGuard: 'true' | 'false' | 'mixed';
  hint: Hint | null;
  hintsShown: number;
  showRules: boolean;
  showSyntax: boolean;
  pitfallMessage: string | null;
  stepping: boolean;
  frogTags: boolean;
  back: (() => void) | null;
  skip: (() => void) | null;
  awaitingCheck: boolean;
  nextAction: { label: string; onClick: () => void } | null;
  tutorialAllow: { step: boolean; run: boolean; eggs: boolean; formula: boolean };
  spotLines: number[];
  spotlight: 'code' | 'step' | 'run' | 'formula' | 'check' | 'lights' | null;
  inputHover: string | null;
  callouts: { x: number; y: number; frog?: number; text: string; tone: 'info' | 'good' | 'fail' }[];
  region: Region | null;
  failMark: { x: number; y: number; label: string; t0: number } | null;

  openLevel(def: LevelDef, mode: 'level' | 'tutorial'): void;
  backToMenu(view?: 'home' | 'levels'): void;
  setFormula(text: string): void;
  setReveal(r: Partial<Reveal>): void;
}

export interface RegionTile {
  x: number;
  y: number;
  tone: 'info' | 'good' | 'fail';
}

export interface Region {
  tiles: (win: TileWindow) => RegionTile[];
  center: [number, number];
}

export const ALLOW_NONE: Game['tutorialAllow'] = { step: false, run: false, eggs: false, formula: false };

const FRESH = {
  formulaText: '',
  formula: null,
  valid: null,
  verdicts: {},
  checking: false,
  busy: false,
  running: false,
  hint: null,
  hintsShown: 0,
  pitfallMessage: null,
  failMark: null,
  callouts: [],
  region: null,
  stepping: false,
  frogTags: false,
  back: null,
  skip: null,
  awaitingCheck: false,
  tutorialAllow: ALLOW_NONE,
  spotLines: [],
  nextAction: null,
  spotlight: null,
  inputHover: null,
} satisfies Partial<Game>;

export const useGame = create<Game>((set, get) => ({
  ...FRESH,
  mode: 'menu',
  menuView: 'home',
  level: null,
  inputs: {},
  caption: null,
  reveal: FULL_REVEAL,
  hopTick: 0,
  hopDur: 0.42,
  landTick: 0,
  landGuard: 'true',
  showRules: false,
  showSyntax: false,

  openLevel(def, mode) {
    const level = compileLevel(localizeLevel(def));
    set({
      ...FRESH,
      mode,
      level,
      inputs: startInputs(level),
      caption: level.intro ? { text: level.intro, tone: 'info' } : null,
      reveal: mode === 'tutorial' ? EMPTY_REVEAL : FULL_REVEAL,
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
      valid: formula.ok ? formula : get().valid,
      verdicts: {},
      pitfallMessage: null,
      failMark: null,
    });
  },
  setReveal(r) {
    set({ reveal: { ...get().reveal, ...r } });
  },
}));
