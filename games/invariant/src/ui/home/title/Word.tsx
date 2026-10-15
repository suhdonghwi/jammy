import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { outlineMaterial } from '../../../scene/models';
import { sceneNow } from '../../../scene/sceneTime';
import { letterGeometries, type LetterOptions } from './text3d';

const outline = outlineMaterial(0.02);

/** How far letter `i` of a word is lifted by the wave at time t (0..1 of the wave's height). */
export const waveAt = (t: number, i: number, phase: number) => Math.max(0, Math.sin(t * 1.6 - i * 0.55 + phase));

interface WordProps {
  text: string;
  letters: LetterOptions;
  /** Baseline position. */
  position: [number, number, number];
  face: string;
  side: string;
  /** Height of the wave running through the letters, and where in it this word starts. */
  wave: number;
  phase?: number;
}

/** An extruded, outlined word with a gentle wave running through its letters. */
export function Word({ text, letters: opts, position, face, side, wave, phase = 0 }: WordProps) {
  const letters = useMemo(() => letterGeometries(text, opts), [text, opts]);
  const mats = useMemo(
    () => [new THREE.MeshStandardMaterial({ color: face, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: side, roughness: 0.6 })],
    [face, side],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const t = sceneNow();
    refs.current.forEach((g, i) => {
      if (!g) return;
      g.position.y = waveAt(t, i, phase) * wave;
      g.rotation.z = Math.sin(t * 1.6 - i * 0.55 + phase - 0.6) * 0.02 * (wave / 0.12);
    });
  });
  return (
    <group position={position}>
      {letters.map((l, i) => (
        <group key={i} position={[l.x, 0, 0]}>
          <group ref={(el) => void (refs.current[i] = el)}>
            <mesh geometry={l.geom} material={outline} />
            <mesh geometry={l.geom} material={mats} />
          </group>
        </group>
      ))}
    </group>
  );
}
