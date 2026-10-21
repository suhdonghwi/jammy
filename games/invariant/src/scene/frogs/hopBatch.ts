import { sfx } from '../../audio/sfx';

interface HopBatch {
  pending: number;
  results: boolean[];
  follow: () => void;
}
let openBatch: HopBatch | null = null;

export function joinHopBatch(follow: () => void): HopBatch {
  if (!openBatch) {
    const b: HopBatch = { pending: 0, results: [], follow };
    openBatch = b;
    queueMicrotask(() => {
      openBatch = null;
      sfx.hop(b.pending);
      b.follow();
    });
  }
  openBatch.pending++;
  openBatch.follow = follow;
  return openBatch;
}

export function landInBatch(b: HopBatch, continues: boolean) {
  b.results.push(continues);
  if (b.results.length < b.pending) return;
  const q = b.results;
  sfx.land(!q.some(Boolean));
}
