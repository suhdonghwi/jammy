import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { SLAB_H } from './constants';
import { field } from './field';
import type { FrogSim } from './frogSim';

// The one kind of label in the scene: a small pill with a pointer, floating
// over a tile or riding along with a frog. Callouts, failure labels and the
// frog's own state tag are all this component.

export type TagTone = 'info' | 'good' | 'fail';

/** Where a tag hangs: over a tile, or over a frog (following it as it hops). */
export type TagAnchor = { tile: [number, number] } | { frog: FrogSim };

const TAG_HEIGHT = 0.98;
const v = new THREE.Vector3();

export function anchorPoint(a: TagAnchor): THREE.Vector3 | null {
  if ('tile' in a) {
    const [x, y] = a.tile;
    return v.set(x, field.heightAt(x, y) * SLAB_H + TAG_HEIGHT, -y);
  }
  const p = a.frog.drawn;
  return p ? v.set(p.x, p.ground + TAG_HEIGHT, p.z) : null;
}

export function SceneTag({
  anchor,
  tone = 'info',
  hidden,
  children,
}: {
  anchor: TagAnchor;
  tone?: TagTone;
  /** Checked every frame; a hidden tag fades out (and back in). */
  hidden?: () => boolean;
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const box = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const p = anchorPoint(anchor);
    if (group.current && p) group.current.position.copy(p);
    box.current?.classList.toggle('covered', !!hidden?.());
  });
  return (
    <group ref={group}>
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={box} className={`scene-tag ${tone}`}>
          {children}
        </div>
      </Html>
    </group>
  );
}
