import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { EXIT_MS } from '../../ui/presence';
import { field } from '../area/field';
import { COLORS, SLAB_H } from '../constants';
import { sceneNow } from '../sceneTime';
import { SceneTag, type TagTone } from './SceneTag';

// A labelled tile: an outline (and optionally a faint wash) on the tile, and a
// small tag above it (none when the label is empty: just the outline).

const TONE_COLORS: Record<TagTone, string> = {
  info: '#2b3445',
  good: '#2f9e44',
  fail: COLORS.fail,
};
export const TONE_PREFIX: Record<TagTone, string> = { info: '', good: '✓ ', fail: '✕ ' };

function roundedRect(w: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const h = w / 2;
  s.moveTo(-h + r, -h);
  s.lineTo(h - r, -h);
  s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r);
  s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h);
  s.quadraticCurveTo(-h, h, -h, h - r);
  s.lineTo(-h, -h + r);
  s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

const ringGeometry = (() => {
  const outer = roundedRect(1.0, 0.17);
  outer.holes.push(roundedRect(0.88, 0.12) as unknown as THREE.Path);
  return new THREE.ShapeGeometry(outer, 8).rotateX(-Math.PI / 2);
})();
const washGeometry = new THREE.ShapeGeometry(roundedRect(0.88, 0.12), 8).rotateX(-Math.PI / 2);

interface TileTagProps {
  x: number;
  y: number;
  label: string;
  tone: TagTone;
  /** Pulse the outline (failures). */
  pulse?: boolean;
  /** Fill the tile with a faint wash. */
  wash?: boolean;
  /** On its way out: everything fades. */
  leaving?: boolean;
}

export function TileTag({ x, y, label, tone, pulse = false, wash = false, leaving = false }: TileTagProps) {
  const color = TONE_COLORS[tone];
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const washRef = useRef<THREE.Mesh>(null);
  const t0 = useRef(sceneNow());
  // the exit runs in real time, in step with the tag's own CSS fade
  const leftAt = useRef<number | null>(null);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = sceneNow() - t0.current;
    g.position.set(x, field.heightAt(x, y) * SLAB_H + 0.012, -y);
    if (leaving && leftAt.current === null) leftAt.current = performance.now();
    const out = leftAt.current === null ? 1 : Math.max(0, 1 - (performance.now() - leftAt.current) / EXIT_MS);
    const pop = Math.min(1, t / 0.3) * out;
    const beat = pulse ? 0.5 + 0.5 * Math.sin(t * 4.2) : 1;
    if (ring.current) {
      ring.current.scale.setScalar(0.9 + 0.1 * pop + (pulse ? 0.035 * beat : 0));
      (ring.current.material as THREE.MeshBasicMaterial).opacity = pop * (pulse ? 0.75 + 0.25 * beat : 0.85);
    }
    if (washRef.current) (washRef.current.material as THREE.MeshBasicMaterial).opacity = pop * (0.12 + 0.1 * beat);
  });

  return (
    <>
      <group ref={group}>
        {wash && (
          <mesh ref={washRef} geometry={washGeometry} renderOrder={8}>
            <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
        <mesh ref={ring} geometry={ringGeometry} renderOrder={9}>
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>
      {label !== '' && (
        <SceneTag anchor={{ tile: [x, y] }} tone={tone} leaving={leaving}>
          {TONE_PREFIX[tone]}
          {label}
        </SceneTag>
      )}
    </>
  );
}
