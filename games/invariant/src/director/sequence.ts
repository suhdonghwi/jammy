import { useGame, type CaptionTone } from '../game/store';
import type { CompiledLevel } from '../levels/level';

export interface Token {
  readonly alive: boolean;
}

let current = 0;

export function begin(): Token {
  const id = ++current;
  return {
    get alive() {
      return id === current;
    },
  };
}

export const currentLevel = (): CompiledLevel => useGame.getState().level!;

export function caption(text: string, tone: CaptionTone = 'info') {
  useGame.setState({ caption: { text, tone } });
}
