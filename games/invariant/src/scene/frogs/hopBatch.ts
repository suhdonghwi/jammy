import { sfx } from '../../audio/sfx';

interface HopBatch {
  pending: number;
  results: boolean[];
}
let openBatch: HopBatch | null = null;

export function joinHopBatch(): HopBatch {
  if (!openBatch) {
    const b: HopBatch = { pending: 0, results: [] };
    openBatch = b;
    queueMicrotask(() => {
      openBatch = null;
      sfx.hop(b.pending);
    });
  }
  openBatch.pending++;
  return openBatch;
}

export function landInBatch(b: HopBatch, continues: boolean) {
  b.results.push(continues);
  if (b.results.length < b.pending) return;
  const q = b.results;
  sfx.land(!q.some(Boolean));
}
