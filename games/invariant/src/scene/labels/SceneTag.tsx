import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { field } from '../area/field';
import { SLAB_H } from '../constants';
import type { FrogSim } from '../frogs/frogWorld';

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
/** How close (px) a tag may come to the screen's side. */
const EDGE = 8;
/** How far (px) the pointer stays in from the pill's ends. */
const POINTER_INSET = 18;
const v = new THREE.Vector3();
const onScreen = new THREE.Vector3();

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

/** A dark pill with a pointer underneath (both in --tag-bg); a covered tag fades and dips away. */
const TAG =
  'relative origin-bottom rounded-full bg-(--tag-bg) px-3.25 pt-1 pb-1.25 font-display text-md font-semibold whitespace-nowrap text-white tabular-nums transition-[opacity,translate,scale] duration-250 data-covered:translate-y-1 data-covered:scale-90 data-covered:opacity-0 after:absolute after:-bottom-1.25 after:left-[calc(50%+var(--tag-dx,0px))] after:-ml-1.5 after:border-6 after:border-b-0 after:border-transparent after:border-t-(--tag-bg)';
const TONE: Record<TagTone, string> = {
  info: '[--tag-bg:var(--color-tag)]',
  good: '[--tag-bg:var(--color-tag-good)]',
  fail: '[--tag-bg:var(--color-tag-fail)]',
};

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
  // the pill's width, for keeping it on screen (Html mounts it a moment after this component)
  const width = useRef(0);
  const watch = useRef<ResizeObserver | null>(null);
  useEffect(() => () => watch.current?.disconnect(), []);
  useFrame(({ camera, size }) => {
    if (!watch.current && box.current) {
      const el = box.current;
      watch.current = new ResizeObserver(() => void (width.current = el.offsetWidth));
      watch.current.observe(el);
    }
    const p = anchorPoint(anchor);
    if (group.current && p) group.current.position.copy(p);
    // the pointer's tip sits on the anchor and the tag grows upward from it;
    // a little smaller when the camera is far, so it never swamps the frog
    if (holder.current && box.current && p) {
      const k = THREE.MathUtils.clamp(14 / camera.position.distanceTo(p), 0.7, 1);
      // near the screen's side (a phone's narrow view) the pill slides inward
      // while its pointer stays on the anchor, as far as the pill reaches
      const x = ((onScreen.copy(p).project(camera).x + 1) / 2) * size.width;
      const half = (width.current * k) / 2;
      const reach = Math.max(0, half - POINTER_INSET * k);
      const dx = THREE.MathUtils.clamp(Math.max(EDGE + half - x, Math.min(0, size.width - EDGE - half - x)), -reach, reach);
      holder.current.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), -100%) scale(${k.toFixed(3)})`;
      box.current.style.setProperty('--tag-dx', `${(-dx / k).toFixed(1)}px`);
    }
    box.current?.toggleAttribute('data-covered', !!hidden?.());
  });
  return (
    <group ref={group}>
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        {/* positioned (above) so the pointer's tip sits on the anchor */}
        <div ref={holder} className="origin-bottom pb-1.5">
          <div ref={box} className={`${TAG} ${TONE[tone]} ${leaving ? 'animate-tag-out' : 'animate-tag-in'}`}>
            {children}
          </div>
        </div>
      </Html>
    </group>
  );
}
