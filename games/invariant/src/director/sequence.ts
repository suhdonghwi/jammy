import { useGame, type CaptionTone } from '../game/store';
import type { CompiledLevel } from '../levels/level';

export interface Token {
  readonly alive: boolean;
}

let current = 0;
let currentCheck = 0;

export function begin(): Token {
  const id = ++current;
  return {
    get alive() {
      return id === current;
    },
  };
}

export function beginCheck(): Token {
  const id = ++currentCheck;
  return {
    get alive() {
      return id === currentCheck;
    },
  };
}

export function abandonCheck() {
  currentCheck++;
}

export const currentLevel = (): CompiledLevel => useGame.getState().level!;

export function caption(text: string, tone: CaptionTone = 'info') {
  useGame.setState({ caption: { text, tone } });
}

type EventName = 'stepped' | 'runDone';

const listeners = new Set<(e: EventName) => void>();

export const events = {
  emit(e: EventName) {
    listeners.forEach((l) => l(e));
  },
  on(l: (e: EventName) => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};
