import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import type { FastState } from '../../lang/eval';
import { tileState } from '../../levels/tiles';
import { field } from '../area/field';
import { SLAB_H } from '../constants';
import { HopLine } from '../frogs/HopLine';
import { useHover } from '../hover';
import { frogGeometry, frogMaterial, ghostDepthMaterial } from '../models';
import { sceneNow } from '../sceneTime';

export function HoverPreview() {
  const level = useGame((s) => s.level)!;
  const inputs = useGame((s) => s.inputs);
  const enabled = useGame((s) => s.reveal.hover && !s.busy);
  const tile = useHover((s) => s.tile);
  const ghost = useRef<THREE.Group>(null);
  const assets = useMemo(() => {
    const geom = frogGeometry();
    const mat = frogMaterial({ ghost: true });
    const depth = ghostDepthMaterial();
    return { geom, mat, depth };
  }, []);
  useEffect(() => () => assets.geom.dispose(), [assets]);

  const hop = useMemo(() => {
    if (!tile) return null;
    const s = tileState(level, tile[0], tile[1], inputs);
    if (!level.fast.planeReq(s) || level.fast.guard(s) !== true) return null;
    const n: FastState = { ...s };
    for (const v in level.fast.next) n[v] = level.fast.next[v](s) as number;
    return { from: tile, to: [n[level.view.x] as number, n[level.view.y] as number] as [number, number] };
  }, [tile, level, inputs]);

  useFrame(() => {
    const g = ghost.current;
    if (!g || !hop) return;
    const h = field.heightAt(hop.to[0], hop.to[1]) * SLAB_H;
    g.position.set(hop.to[0], h + 0.02 + Math.abs(Math.sin(sceneNow() * 3)) * 0.05, -hop.to[1]);
    g.rotation.y = Math.atan2(hop.to[0] - hop.from[0], -(hop.to[1] - hop.from[1]));
  });

  if (!enabled || !hop) return null;
  return (
    <group>
      <HopLine
        path={() => ({
          from: [hop.from[0], hop.from[1], field.heightAt(hop.from[0], hop.from[1]) * SLAB_H],
          to: [hop.to[0], hop.to[1], field.heightAt(hop.to[0], hop.to[1]) * SLAB_H],
          drawn: 1,
          opacity: 1,
        })}
      />
      <group ref={ghost}>
        <mesh geometry={assets.geom} material={assets.depth} renderOrder={4} />
        <mesh geometry={assets.geom} material={assets.mat} renderOrder={5} />
      </group>
    </group>
  );
}
