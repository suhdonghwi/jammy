import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type opentype from 'opentype.js';
import { compileLevel, type CompiledLevel } from '../../levels/level';
import { allLevels } from '../../levels/defs';
import { field } from '../field';
import { frogWorld, yawToward, type FrogSim } from '../frogSim';
import { outlineMaterial } from '../models';
import { letterGeometries, loadTitleFont } from '../text3d';

// Pieces shared by the home screen drafts.

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

/** The tutorial program: home frogs are counter states, with (i, n) as their tile. */
export function useHomeLevel(): CompiledLevel {
  return useMemo(() => compileLevel(allLevels[0]), []);
}

export const tileKey = (x: number, y: number) => `${x},${y}`;

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

export interface WanderOptions {
  /** Tiles frogs may stand on. */
  tiles: readonly (readonly [number, number])[];
  /** Where frogs start (defaults to evenly spread picks from `tiles`). */
  starts?: readonly (readonly [number, number])[];
  count?: number;
  /** Seconds between a frog's hops (each frog is offset a little). */
  every?: number;
  hopDur?: number;
  /** Chance of keeping the current direction when possible. */
  straight?: number;
  /** Called after each landing. */
  onLand?: (f: FrogSim, x: number, y: number) => void;
}

/**
 * Frogs wandering over a set of tiles: each hop goes to a neighbouring tile in
 * the set (they never leave it), preferring to keep going the same way.
 */
export function useWanderers(level: CompiledLevel, o: WanderOptions) {
  const opts = useRef(o);
  opts.current = o;
  useEffect(() => {
    const { tiles, count = 6, every = 1.1, hopDur = 0.45, straight = 0.65 } = opts.current;
    const set = new Set(tiles.map(([x, y]) => tileKey(x, y)));
    const starts = opts.current.starts ?? Array.from({ length: count }, (_, i) => tiles[Math.floor(((i + 0.5) / count) * tiles.length)]);
    frogWorld.clear();
    const now = performance.now() / 1000;
    const frogs = starts.map(([x, y], i) => frogWorld.add(level, 'real', { i: BigInt(x), n: BigInt(y) }, { hatchT0: now + 0.3 + i * 0.12 }));
    const dirs = frogs.map(() => [1, 0] as [number, number]);
    const DIRS: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const timers: number[] = [];
    frogs.forEach((f, j) => {
      const tick = () => {
        const { x, y } = f;
        const options = DIRS.filter(([dx, dy]) => set.has(tileKey(x + dx, y + dy)));
        if (options.length) {
          const keep = options.find(([dx, dy]) => dx === dirs[j][0] && dy === dirs[j][1]);
          const d = keep && Math.random() < straight ? keep : options[Math.floor(Math.random() * options.length)];
          dirs[j] = d;
          const nx = x + d[0];
          const ny = y + d[1];
          f.face = yawToward(x, y, nx, ny);
          void frogWorld.hopTo(level, f, { i: BigInt(nx), n: BigInt(ny) }, hopDur, true).then(() => opts.current.onLand?.(f, nx, ny));
        }
        timers[j] = window.setTimeout(tick, (opts.current.every ?? every) * 1000 * (0.75 + Math.random() * 0.5));
      };
      timers[j] = window.setTimeout(tick, 900 + j * 170);
    });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      frogWorld.clear();
    };
  }, [level]);
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
