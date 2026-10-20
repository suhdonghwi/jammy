import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { popIn } from '../../../scene/easing';
import { outlineGeometry, outlineMaterial } from '../../../scene/models';
import { sceneNow } from '../../../scene/sceneTime';
import { letterGeometries, type LetterOptions } from './text3d';

/** The outline's thickness around each letter. */
export const OUTLINE = 0.02;
const outline = outlineMaterial(OUTLINE, undefined, 0.08);

/**
 * The title's entrance: its letters pop in one after another, STAGGER seconds
 * apart. How far along one is (its scale) at time t of the entrance, if it
 * starts at `start`.
 */
export const STAGGER = 0.03;
export const entrance = (t: number, start: number) => popIn((t - start) / 0.28, 0.6);

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
  /** The entrance's clock, and the place of this word's first letter in the title. */
  clock: { t: number };
  first?: number;
}

/** Each word's extruded letters, outlines and middles: slow to build, so built once and kept (by the options, which the title keeps too). */
const built = new WeakMap<LetterOptions, Map<string, ReturnType<typeof build>>>();

function build(text: string, opts: LetterOptions) {
  return letterGeometries(text, opts).map((l) => {
    l.geom.computeBoundingBox();
    return { ...l, line: outlineGeometry(l.geom), mid: l.geom.boundingBox!.getCenter(new THREE.Vector3()) };
  });
}

/** An extruded, outlined word with a gentle wave running through its letters, which pop in one by one. */
export function Word({ text, letters: opts, position, face, side, wave, phase = 0, clock, first = 0 }: WordProps) {
  const letters = useMemo(() => {
    const byText = built.get(opts) ?? built.set(opts, new Map()).get(opts)!;
    return byText.get(text) ?? byText.set(text, build(text, opts)).get(text)!;
  }, [text, opts]);
  const mats = useMemo(
    () => [new THREE.MeshStandardMaterial({ color: face, roughness: 0.45 }), new THREE.MeshStandardMaterial({ color: side, roughness: 0.6 })],
    [face, side],
  );
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const t = sceneNow();
    refs.current.forEach((g, i) => {
      if (!g) return;
      // each letter grows from its middle
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
        <group key={i} position={[l.x, 0, 0]}>
          <group ref={(el) => void (refs.current[i] = el)}>
            <mesh geometry={l.line} material={outline} />
            <mesh geometry={l.geom} material={mats} />
          </group>
        </group>
      ))}
    </group>
  );
}
