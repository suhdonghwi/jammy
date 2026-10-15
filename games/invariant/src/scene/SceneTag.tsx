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
type TagAnchor = { tile: [number, number] } | { frog: FrogSim };

/** Height of the sitting frog model (its bounding box top). */
const FROG_TOP = 0.53;
/** Over a bare tile, where a frog's head would be. */
const TILE_TAG_Y = 0.62;
const GAP = 0.07;
const v = new THREE.Vector3();

/** The point the tag's pointer touches: just above the frog's head (or a tile). */
function anchorPoint(a: TagAnchor): THREE.Vector3 | null {
  if ('tile' in a) {
    const [x, y] = a.tile;
    return v.set(x, field.heightAt(x, y) * SLAB_H + TILE_TAG_Y, -y);
  }
  const p = a.frog.drawn;
  // rides with the frog, hops included, so the frog never runs into it
  return p ? v.set(p.x, p.y + FROG_TOP * p.scale + GAP, p.z) : null;
}

export function SceneTag({
  anchor,
  tone = 'info',
  hidden,
  leaving = false,
  children,
}: {
  anchor: TagAnchor;
  tone?: TagTone;
  /** On its way out (fades away). */
  leaving?: boolean;
  /** Checked every frame; a hidden tag fades out (and back in). */
  hidden?: () => boolean;
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const holder = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  useFrame(({ camera }) => {
    const p = anchorPoint(anchor);
    if (group.current && p) group.current.position.copy(p);
    // the pointer's tip sits on the anchor and the tag grows upward from it;
    // a little smaller when the camera is far, so it never swamps the frog
    if (holder.current && p) {
      const k = THREE.MathUtils.clamp(14 / camera.position.distanceTo(p), 0.7, 1);
      holder.current.style.transform = `translate(-50%, -100%) scale(${k.toFixed(3)})`;
    }
    box.current?.classList.toggle('covered', !!hidden?.());
  });
  return (
    <group ref={group}>
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={holder} className="scene-tag-holder">
          <div ref={box} className={`scene-tag ${tone} ${leaving ? 'leaving' : ''}`}>
            {children}
          </div>
        </div>
      </Html>
    </group>
  );
}
