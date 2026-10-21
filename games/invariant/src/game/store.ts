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
  lights: [],
  awake: [],
};

export type CaptionTone = 'info' | 'fail' | 'success' | 'muted';

export interface Caption {
  text: string;
  tone: CaptionTone;
  action?: { label: string; onClick: () => void; disabled?: boolean };
  secondary?: { label: string; onClick: () => void };
  close?: () => void;
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
  pending: Rule[];
  busy: boolean;
  running: boolean;
  caption: Caption | null;
  reveal: Reveal;
  codeCursor: CodeCursor | null;
  hintsShown: number;
  showRules: boolean;
  showSyntax: boolean;
  pitfallMessage: string | null;
  stepping: boolean;
  frogTags: boolean;
  tutorial: TutorialState;
  inputHover: string | null;
  callouts: { x: number; y: number; frog?: number; text: string; tone: 'info' | 'good' | 'fail' }[];
  region: Region | null;
  failMark: { x: number; y: number; label: string; t0: number } | null;

  openLevel(def: LevelDef, mode: 'level' | 'tutorial'): void;
  backToMenu(view?: 'home' | 'levels'): void;
  setFormula(text: string): void;
  setReveal(r: Partial<Reveal>): void;
}

export interface CodeCursor {
  at: number;
  until?: number;
  loops: boolean | null;
}

export interface RegionTile {
  x: number;
  y: number;
  tone: 'info' | 'good' | 'fail';
}

export interface Region {
  id: string;
  tiles: (win: TileWindow) => RegionTile[];
  center: [number, number];
  tick?: boolean;
}

export interface TutorialState {
  back: (() => void) | null;
  skip: (() => void) | null;
  awaitingCheck: boolean;
  nextAction: { label: string; onClick: () => void } | null;
  allow: { step: boolean; run: boolean; eggs: boolean; formula: boolean };
  spotLines: number[];
  spotlight: 'code' | 'step' | 'run' | 'formula' | 'check' | 'lights' | null;
  hint: Hint | null;
}

export const ALLOW_NONE: TutorialState['allow'] = { step: false, run: false, eggs: false, formula: false };

export const NO_TUTORIAL: TutorialState = {
  back: null,
  skip: null,
  awaitingCheck: false,
  nextAction: null,
  allow: ALLOW_NONE,
  spotLines: [],
  spotlight: null,
  hint: null,
};

export function setTutorial(patch: Partial<TutorialState>) {
  useGame.setState((g) => ({ tutorial: { ...g.tutorial, ...patch } }));
}

const FRESH = {
  formulaText: '',
  formula: null,
  valid: null,
  verdicts: {},
  pending: [],
  busy: false,
  running: false,
  hintsShown: 0,
  pitfallMessage: null,
  failMark: null,
  callouts: [],
  region: null,
  stepping: false,
  frogTags: false,
  tutorial: NO_TUTORIAL,
  inputHover: null,
} satisfies Partial<Game>;

export const useGame = create<Game>((set, get) => ({
  ...FRESH,
  mode: 'menu',
  menuView: 'home',
  level: null,
  inputs: {},
  checking: false,
  caption: null,
  reveal: FULL_REVEAL,
  codeCursor: null,
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
