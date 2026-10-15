import { useGame } from '../../game/store';

// Hop announcements for the code panel: the body lights up while frogs hop,
// then the loop condition flashes with its result when they land. Hops started
// in the same tick form one batch: one body beat, and one condition flash once
// every frog in the batch has landed (their landing timers fire separately).

interface HopBatch {
  pending: number;
  results: boolean[];
}
let openBatch: HopBatch | null = null;

export function joinHopBatch(dur: number): HopBatch {
  if (!openBatch) {
    const b: HopBatch = { pending: 0, results: [] };
    openBatch = b;
    queueMicrotask(() => {
      openBatch = null;
      useGame.setState((g) => ({ hopTick: g.hopTick + 1, hopDur: dur }));
    });
  }
  openBatch.pending++;
  return openBatch;
}

export function landInBatch(b: HopBatch, continues: boolean) {
  b.results.push(continues);
  if (b.results.length < b.pending) return;
  const q = b.results;
  const guard = q.every(Boolean) ? 'true' : q.some(Boolean) ? 'mixed' : 'false';
  useGame.setState((g) => ({ landTick: g.landTick + 1, landGuard: guard }));
}
