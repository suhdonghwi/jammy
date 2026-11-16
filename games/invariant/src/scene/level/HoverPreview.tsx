import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { hopFrom, tileState } from '../../levels/tiles';
import { field } from '../area/field';
import { HopLine } from '../frogs/HopLine';
import { useHover } from '../hover';
import { frogGeometry, frogMaterial, ghostDepthMaterial } from '../models';

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
    if (!level.fast.planeReq(s)) return null;
    const to = hopFrom(level, s);
    return to && { from: tile, to };
  }, [tile, level, inputs]);

  useFrame(() => {
    const g = ghost.current;
    if (!g || !hop) return;
    const h = field.groundAt(hop.to[0], hop.to[1]);
    g.position.set(hop.to[0], h, -hop.to[1]);
    g.rotation.y = Math.atan2(hop.to[0] - hop.from[0], -(hop.to[1] - hop.from[1]));
  });

  if (!enabled || !hop) return null;
  return (
    <group>
      <HopLine
        path={() => ({
          from: [hop.from[0], hop.from[1], field.groundAt(hop.from[0], hop.from[1])],
          to: [hop.to[0], hop.to[1], field.groundAt(hop.to[0], hop.to[1])],
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
