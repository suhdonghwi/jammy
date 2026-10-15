import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type opentype from 'opentype.js';
import { field } from '../field';
import { outlineMaterial } from '../models';
import { letterGeometries, loadTitleFont } from '../text3d';

// Pieces shared by the home screen: the title font and lettering, and the slab area.

export function useTitleFont(): opentype.Font | null {
  const [font, setFont] = useState<opentype.Font | null>(null);
  useEffect(() => {
    let alive = true;
    void loadTitleFont().then((f) => alive && setFont(f));
    return () => {
      alive = false;
    };
  }, []);
  return font;
}

/**
 * Raise a decorative area of slabs on these tiles; returns the field version
 * for <Slabs>. `flags` marks slabs where the loop stops / goals (for stripes
 * and pools on their tops).
 */
export function useArea(tiles: readonly (readonly [number, number])[], flags?: (x: number, y: number) => { stop: boolean; goal: boolean }): number {
  const [version, setVersion] = useState(0);
  const flagsRef = useRef(flags);
  flagsRef.current = flags;
  useEffect(() => {
    field.reset();
    field.update(
      tiles.map(([x, y]) => ({ x, y, ...(flagsRef.current?.(x, y) ?? { stop: false, goal: false }) })),
      true,
    );
    setVersion((v) => v + 1);
    return () => field.reset();
  }, [tiles]);
  return version;
}

const outlines = new Map<string, THREE.ShaderMaterial>();
function sharedOutline(thickness: number, color?: string) {
  const k = `${thickness}|${color ?? ''}`;
  let m = outlines.get(k);
  if (!m) outlines.set(k, (m = outlineMaterial(thickness, color)));
  return m;
}

export interface WordProps {
  font: opentype.Font;
  text: string;
  size: number;
  /** Baseline position. */
  position: [number, number, number];
  face: string;
  side: string;
  /** Glow of the face colour (0 = none). */
  emissive?: number;
  outline?: number;
  outlineColor?: string;
  /** Height of the wave running through the letters. */
  wave?: number;
  phase?: number;
  depth?: number;
}

/** An extruded word with a gentle wave running through its letters. */
export function Word({ font, text, size, position, face, side, emissive = 0, outline = 0.028, outlineColor, wave = 0.12, phase = 0, depth = 0.42 }: WordProps) {
  const letters = useMemo(() => letterGeometries(font, text, { size, depth: size * depth, letterSpacing: size * 0.02 }), [font, text, size, depth]);
  const mats = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ color: face, roughness: 0.45, emissive: face, emissiveIntensity: emissive }),
      new THREE.MeshStandardMaterial({ color: side, roughness: 0.6, emissive: side, emissiveIntensity: emissive * 0.5 }),
    ],
    [face, side, emissive],
  );
  const line = outline > 0 ? sharedOutline(outline, outlineColor) : null;
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((g, i) => {
      if (!g) return;
      const w = Math.sin(t * 1.6 - i * 0.55 + phase);
      g.position.y = Math.max(0, w) * wave;
      g.rotation.z = Math.sin(t * 1.6 - i * 0.55 + phase - 0.6) * 0.02 * (wave / 0.12);
    });
  });
  return (
    <group position={position}>
      {letters.map((l, i) => (
        <group key={i} position={[l.x, 0, 0]}>
          <group ref={(el) => void (refs.current[i] = el)}>
            {line && <mesh geometry={l.geom} material={line} />}
            <mesh geometry={l.geom} material={mats} />
          </group>
        </group>
      ))}
    </group>
  );
}
