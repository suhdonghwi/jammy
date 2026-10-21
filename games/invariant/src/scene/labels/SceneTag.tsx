import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { field } from '../area/field';
import { cameraRig } from '../cameraRig';
import { SLAB_H } from '../constants';
import type { FrogSim } from '../frogs/frogWorld';

export type TagTone = 'info' | 'good' | 'fail';

type TagAnchor = { tile: [number, number] } | { frog: FrogSim };

const FROG_TOP = 0.53;
const TILE_TAG_Y = 0.62;
const GAP = 0.07;
const EDGE = 8;
const POINTER_INSET = 18;
const POINTER_ROOM = 6;
const APART = 4;
const v = new THREE.Vector3();
const onScreen = new THREE.Vector3();

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const taken = { frame: -1, boxes: [] as Box[] };

function liftClear(box: Box, frame: number): number {
  if (taken.frame !== frame) Object.assign(taken, { frame, boxes: [] });
  let lift = 0;
  for (let moved = true, n = 0; moved && n < 8; n++) {
    moved = false;
    for (const o of taken.boxes) {
      const top = box.top - lift;
      const bottom = box.bottom - lift;
      if (box.left < o.right + APART && box.right > o.left - APART && top < o.bottom + APART && bottom > o.top - APART) {
        lift += bottom - o.top + APART;
        moved = true;
      }
    }
  }
  taken.boxes.push({ ...box, top: box.top - lift, bottom: box.bottom - lift });
  return lift;
}

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
  const height = useRef(0);
  const lift = useRef(0);
  const measure = useCallback((el: HTMLDivElement | null) => {
    box.current = el;
    if (!el) return;
    const watch = new ResizeObserver(() => {
      width.current = el.offsetWidth;
      height.current = el.offsetHeight;
    });
    watch.observe(el);
    return () => {
      watch.disconnect();
      box.current = null;
    };
  }, []);
  const [start] = useState(() => anchorPoint(anchor)?.toArray());
  const placed = useRef(start ? 1 : 0);
  useFrame(({ camera, size, clock }, dt) => {
    const p = anchorPoint(anchor);
    if (group.current && p) {
      group.current.position.copy(p);
      placed.current++;
    }
    if (holder.current && box.current && p) {
      const k = THREE.MathUtils.clamp(14 / camera.position.distanceTo(p), 0.7, 1);
      onScreen.copy(p).project(camera);
      const x = ((onScreen.x + 1) / 2) * size.width;
      const y = ((1 - onScreen.y) / 2) * size.height;
      const half = (width.current * k) / 2;
      const reach = Math.max(0, half - POINTER_INSET * k);
      const { left, right } = cameraRig.free;
      const [from, to] = right - left > 2 * half ? [left, right] : [EDGE, size.width - EDGE];
      const dx = THREE.MathUtils.clamp(Math.max(from + half - x, Math.min(0, to - half - x)), -reach, reach);
      const bottom = y - POINTER_ROOM * k;
      const shown = !leaving && !hidden?.();
      const goal = shown ? liftClear({ left: x + dx - half, right: x + dx + half, top: bottom - height.current * k, bottom }, clock.elapsedTime) : lift.current;
      lift.current = placed.current > 1 ? THREE.MathUtils.damp(lift.current, goal, 12, dt) : goal;
      holder.current.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-100% - ${lift.current.toFixed(1)}px)) scale(${k.toFixed(3)})`;
      box.current.style.setProperty('--tag-dx', `${(-dx / k).toFixed(1)}px`);
      if (placed.current > 1) holder.current.style.visibility = '';
    }
    box.current?.toggleAttribute('data-covered', !!hidden?.());
  });
  return (
    <group ref={group} position={start}>
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div ref={holder} className="origin-bottom pb-1.5" style={start ? HOLDER : { ...HOLDER, visibility: 'hidden' }}>
          <div ref={measure} className={`${TAG} ${TONE[tone]} ${leaving ? 'animate-tag-out' : 'animate-tag-in'}`}>
            {children}
          </div>
        </div>
      </Html>
    </group>
  );
}
