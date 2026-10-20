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
