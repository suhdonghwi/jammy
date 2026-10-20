import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { field } from '../area/field';
import { SLAB_H } from '../constants';
import type { FrogSim } from '../frogs/frogWorld';

export type TagTone = 'info' | 'good' | 'fail';

type TagAnchor = { tile: [number, number] } | { frog: FrogSim };

const FROG_TOP = 0.53;
const TILE_TAG_Y = 0.62;
const GAP = 0.07;
const EDGE = 8;
const POINTER_INSET = 18;
const v = new THREE.Vector3();
const onScreen = new THREE.Vector3();

function anchorPoint(a: TagAnchor): THREE.Vector3 | null {
  if ('tile' in a) {
    const [x, y] = a.tile;
    return v.set(x, field.heightAt(x, y) * SLAB_H + TILE_TAG_Y, -y);
  }
  const p = a.frog.drawn;
  return p ? v.set(p.x, p.y + FROG_TOP * p.scale + GAP, p.z) : null;
}

const TAG =
  'relative origin-bottom rounded-full bg-(--tag-bg) px-3.25 pt-1 pb-1.25 font-display text-md font-semibold whitespace-nowrap text-white tabular-nums transition-[opacity,translate,scale] duration-250 data-covered:translate-y-1 data-covered:scale-90 data-covered:opacity-0 after:absolute after:-bottom-1.25 after:left-[calc(50%+var(--tag-dx,0px))] after:-ml-1.5 after:border-6 after:border-b-0 after:border-transparent after:border-t-(--tag-bg)';
const HOLDER = { transform: 'translate(-50%, -100%)' };
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
  leaving?: boolean;
  hidden?: () => boolean;
  children: ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const holder = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const width = useRef(0);
  const watch = useRef<ResizeObserver | null>(null);
  useEffect(() => () => watch.current?.disconnect(), []);
  const [start] = useState(() => anchorPoint(anchor)?.toArray());
  const placed = useRef(start ? 1 : 0);
  useFrame(({ camera, size }) => {
    if (!watch.current && box.current) {
      const el = box.current;
      watch.current = new ResizeObserver(() => void (width.current = el.offsetWidth));
      watch.current.observe(el);
    }
    const p = anchorPoint(anchor);
    if (group.current && p) {
      group.current.position.copy(p);
      placed.current++;
    }
    if (holder.current && box.current && p) {
      const k = THREE.MathUtils.clamp(14 / camera.position.distanceTo(p), 0.7, 1);
      const x = ((onScreen.copy(p).project(camera).x + 1) / 2) * size.width;
      const half = (width.current * k) / 2;
      const reach = Math.max(0, half - POINTER_INSET * k);
      const dx = THREE.MathUtils.clamp(Math.max(EDGE + half - x, Math.min(0, size.width - EDGE - half - x)), -reach, reach);
      holder.current.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), -100%) scale(${k.toFixed(3)})`;
      box.current.style.setProperty('--tag-dx', `${(-dx / k).toFixed(1)}px`);
      if (placed.current > 1) holder.current.style.visibility = '';
    }
    box.current?.toggleAttribute('data-covered', !!hidden?.());
  });
  return (
    <group ref={group} position={start}>
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={holder} className="origin-bottom pb-1.5" style={start ? HOLDER : { ...HOLDER, visibility: 'hidden' }}>
          <div ref={box} className={`${TAG} ${TONE[tone]} ${leaving ? 'animate-tag-out' : 'animate-tag-in'}`}>
            {children}
          </div>
        </div>
      </Html>
    </group>
  );
}
