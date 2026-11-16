import { useGame, type CaptionTone } from '../game/store';
import type { CompiledLevel } from '../levels/level';

export class Aborted extends Error {}

export interface Token {
  readonly alive: boolean;
  guard(): void;
}

export function createScope() {
  let current = 0;
  return {
    begin(): Token {
      const id = ++current;
      return {
        get alive() {
          return id === current;
        },
        guard() {
          if (id !== current) throw new Aborted();
        },
      };
    },
    cancel() {
      current++;
    },
  };
}

const sequences = createScope();
const checks = createScope();

export const begin = sequences.begin;
export const beginCheck = checks.begin;
export const abandonCheck = checks.cancel;

export async function busyWhile<T>(body: (tok: Token) => Promise<T>): Promise<T> {
  const tok = begin();
  useGame.setState({ busy: true, running: false });
  try {
    return await body(tok);
  } finally {
    if (tok.alive) useGame.setState({ busy: false });
  }
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
