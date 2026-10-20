import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { field } from '../area/field';
import { COLORS, SLAB_H } from '../constants';
import { popIn } from '../easing';
import { eggGeometry } from '../models';
import { sceneNow } from '../sceneTime';

export interface StartEgg {
  x: number;
  y: number;
  appear: number;
  hatch: number;
}

const MAX = 16;
const dummy = new THREE.Object3D();

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
      dummy.position.set(e.x, field.heightAt(e.x, e.y) * SLAB_H, -e.y);
      dummy.scale.setScalar(popIn((t - e.appear) / 0.32));
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}
