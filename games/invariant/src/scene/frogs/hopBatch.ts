import { sfx } from '../../audio/sfx';
import { useGame } from '../../game/store';

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
      sfx.hop(b.pending);
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
  sfx.land(guard === 'false');
  useGame.setState((g) => ({ landTick: g.landTick + 1, landGuard: guard }));
}
