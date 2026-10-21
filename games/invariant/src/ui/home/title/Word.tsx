import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import titleGlyphs from 'virtual:title-glyphs';
import { popIn } from '../../../scene/easing';
import { outlineGeometry, outlineMaterial } from '../../../scene/models';
import { sceneNow } from '../../../scene/sceneTime';
import { letterOpts, OUTLINE } from './layout';
import { extrudeLetters } from './text3d';

const outline = outlineMaterial(OUTLINE, undefined, 0.08);

export const STAGGER = 0.03;
export const entrance = (t: number, start: number) => popIn((t - start) / 0.28, 0.6);

export const waveAt = (t: number, i: number, phase: number) => Math.max(0, Math.sin(t * 1.6 - i * 0.55 + phase));

interface WordProps {
  text: string;
  xs: number[];
  position: [number, number, number];
  face: string;
  side: string;
  wave: number;
  phase?: number;
  clock: { t: number };
  first?: number;
}

const built = new Map<string, ReturnType<typeof build>>();

function build(text: string) {
  return extrudeLetters(titleGlyphs, text, letterOpts).flatMap(({ geom }) => {
    if (!geom) return [];
    geom.computeBoundingBox();
    return [{ geom, line: outlineGeometry(geom), mid: geom.boundingBox!.getCenter(new THREE.Vector3()) }];
  });
}

export function Word({ text, xs, position, face, side, wave, phase = 0, clock, first = 0 }: WordProps) {
  const letters = useMemo(() => built.get(text) ?? built.set(text, build(text)).get(text)!, [text]);
  const mats = useMemo(
    () => [new THREE.MeshStandardMaterial({ color: face, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: side, roughness: 0.6 })],
    [face, side],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const t = sceneNow();
    refs.current.forEach((g, i) => {
      if (!g) return;
      const s = entrance(clock.t, (first + i) * STAGGER);
      const { mid } = letters[i];
      g.scale.setScalar(s);
      g.position.set(mid.x * (1 - s), waveAt(t, i, phase) * wave + mid.y * (1 - s), 0);
      g.rotation.z = Math.sin(t * 1.6 - i * 0.55 + phase - 0.6) * 0.02 * (wave / 0.12);
    });
  });
  return (
    <group position={position}>
      {letters.map((l, i) => (
        <group key={i} position={[xs[i], 0, 0]}>
          <group ref={(el) => void (refs.current[i] = el)}>
            <mesh geometry={l.line} material={outline} />
            <mesh geometry={l.geom} material={mats} />
          </group>
        </group>
      ))}
    </group>
  );
}
