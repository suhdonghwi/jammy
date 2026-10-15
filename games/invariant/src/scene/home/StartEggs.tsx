import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { field } from '../area/field';
import { COLORS, SLAB_H } from '../constants';
import { eggGeometry } from '../models';
import { sceneNow } from '../sceneTime';

export interface StartEgg {
  x: number;
  y: number;
  /** When it pops up and when it hatches (scene time). */
  appear: number;
  hatch: number;
}

const MAX = 16;
const dummy = new THREE.Object3D();

/** The eggs the home screen's frogs come from: they pop up, then vanish as the hatching shells take over. */
export function StartEggs({ eggs }: { eggs: React.RefObject<StartEgg[]> }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(eggGeometry(), new THREE.MeshStandardMaterial({ color: COLORS.egg, roughness: 0.7 }), MAX);
    m.frustumCulled = false;
    m.count = 0;
    return m;
  }, []);
  useFrame(() => {
    const t = sceneNow();
    let n = 0;
    for (const e of eggs.current) {
      if (t < e.appear || t >= e.hatch || n >= MAX) continue;
      // pop in with a little overshoot
      const u = Math.min(1, (t - e.appear) / 0.32);
      const s = u >= 1 ? 1 : 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2);
      dummy.position.set(e.x, field.heightAt(e.x, e.y) * SLAB_H, -e.y);
      dummy.scale.setScalar(Math.max(0, s));
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
