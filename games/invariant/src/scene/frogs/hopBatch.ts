import { sfx } from '../../audio/sfx';

interface HopBatch {
  pending: number;
  landed: number;
  follow: () => void;
}
let openBatch: HopBatch | null = null;

export function joinHopBatch(follow: () => void): HopBatch {
  if (!openBatch) {
    const b: HopBatch = { pending: 0, landed: 0, follow };
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

export function landInBatch(b: HopBatch) {
  if (++b.landed < b.pending) return;
  sfx.land();
}
