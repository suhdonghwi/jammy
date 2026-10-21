import type * as THREE from 'three';

export function uploadInstances(count: number, ...attrs: (THREE.BufferAttribute | null | undefined)[]) {
  if (count === 0) return;
  for (const a of attrs) {
    if (!a) continue;
    a.clearUpdateRanges();
    a.addUpdateRange(0, count * a.itemSize);
    a.needsUpdate = true;
  }
}
