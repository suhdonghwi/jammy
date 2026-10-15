import { QuadraticBezierLine } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { field } from '../area/field';
import { COLORS, SLAB_H } from '../constants';
import { useHover } from '../hover';
import { frogGeometry, frogMaterial } from '../models';
import { sceneNow } from '../sceneTime';
import { tileState } from '../tiles';

/** Where would a frog on the hovered tile hop? A dashed arc and a ghost frog. */
export function HoverPreview() {
  const level = useGame((s) => s.level)!;
  const plane = useGame((s) => s.plane);
  const enabled = useGame((s) => s.reveal.hover && !s.busy);
  const tile = useHover((s) => s.tile);
  const ghost = useRef<THREE.Mesh>(null);
  const assets = useMemo(() => {
    const geom = frogGeometry();
    const mat = frogMaterial({ ghost: true });
    return { geom, mat };
  }, []);

  const hop = useMemo(() => {
    if (!tile) return null;
    const s = tileState(level, tile[0], tile[1], plane);
    if (!level.fast.planeReq(s) || level.fast.guard(s) !== true) return null;
    const n: Record<string, number> = { ...s };
    for (const v in level.fast.next) n[v] = level.fast.next[v](s) as number;
    return { from: tile, to: [n[level.view.x], n[level.view.y]] as [number, number] };
  }, [tile, level, plane]);

  useFrame(() => {
    const g = ghost.current;
    if (!g || !hop) return;
    const h = field.heightAt(hop.to[0], hop.to[1]) * SLAB_H;
    g.position.set(hop.to[0], h + 0.02 + Math.abs(Math.sin(sceneNow() * 3)) * 0.05, -hop.to[1]);
    g.rotation.y = Math.atan2(hop.to[0] - hop.from[0], -(hop.to[1] - hop.from[1]));
  });

  if (!enabled || !hop) return null;
  const h0 = field.heightAt(hop.from[0], hop.from[1]) * SLAB_H;
  const h1 = field.heightAt(hop.to[0], hop.to[1]) * SLAB_H;
  const dist = Math.hypot(hop.to[0] - hop.from[0], hop.to[1] - hop.from[1]);
  return (
    <group>
      <QuadraticBezierLine
        start={[hop.from[0], h0 + 0.2, -hop.from[1]]}
        end={[hop.to[0], h1 + 0.2, -hop.to[1]]}
        mid={[(hop.from[0] + hop.to[0]) / 2, Math.max(h0, h1) + 1.1 + 0.25 * dist, -(hop.from[1] + hop.to[1]) / 2]}
        color={COLORS.hover}
        lineWidth={2.5}
        dashed
        dashSize={0.1}
        gapSize={0.07}
        transparent
        opacity={0.85}
      />
      <mesh ref={ghost} geometry={assets.geom} material={assets.mat} />
    </group>
  );
}
