import gsap from 'gsap';
import { useGame, type CaptionTone } from '../game/store';
import type { CompiledLevel } from '../levels/level';
import { handState } from '../scene/hand/handState';

export interface Token {
  readonly alive: boolean;
}

let current = 0;

export function begin(): Token {
  const id = ++current;
  gsap.killTweensOf(handState);
  return {
    get alive() {
      return id === current;
    },
  };
}

export function tween(target: object, vars: gsap.TweenVars): Promise<void> {
  return new Promise((resolve) => {
    gsap.to(target, { ...vars, onComplete: () => resolve(), onInterrupt: () => resolve() });
  });
}

export const currentLevel = (): CompiledLevel => useGame.getState().level!;

export function caption(text: string, tone: CaptionTone = 'info') {
  useGame.setState({ caption: { text, tone } });
}
