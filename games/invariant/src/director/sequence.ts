import gsap from 'gsap';
import { useGame, type Caption, type CaptionTone } from '../game/store';
import type { CompiledLevel } from '../levels/level';
import { handState } from '../scene/hand/handState';

// Helpers for the scripted sequences (the hand's demonstrations, runs, the
// tutorial). Every sequence gets a token; starting a new one cancels the old.

export interface Token {
  readonly alive: boolean;
}

let current = 0;

/** Start a new sequence, cancelling whatever was playing (and the hand's tweens). */
export function begin(): Token {
  const id = ++current;
  gsap.killTweensOf(handState);
  return {
    get alive() {
      return id === current;
    },
  };
}

/** A GSAP tween as a promise; it also resolves if the tween is killed. */
export function tween(target: object, vars: gsap.TweenVars): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(target, { ...vars, onComplete: () => resolve(), onInterrupt: () => resolve() });
  });
}

/** The open level (sequences only run while one is open). */
export const currentLevel = (): CompiledLevel => useGame.getState().level!;

export function caption(text: string, tone: CaptionTone = 'info', action?: Caption['action']) {
  useGame.setState({ caption: { text, tone, action } });
}
