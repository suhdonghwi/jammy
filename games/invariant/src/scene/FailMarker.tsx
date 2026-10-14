import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { COLORS, SLAB_H } from './constants';
import { field } from './field';

// Where a check failed: a pulsing red outline and wash on the tile, and a small
// tag above it saying what went wrong. Frogs keep their own colours.

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

const tagTextures = new Map<string, { tex: THREE.Texture; aspect: number }>();
function tagTexture(label: string, color: string, prefix: string) {
  const key = `${color}|${prefix}|${label}`;
  const hit = tagTextures.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = '600 46px Fredoka, ui-rounded, sans-serif';
  g.font = font;
  const text = prefix ? `${prefix}  ${label}` : label;
  const w = Math.ceil(g.measureText(text).width) + 64;
  c.width = w;
  c.height = 92;
  g.font = font;
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(2, 6, w - 4, 76, 38);
  g.fill();
  // little pointer under the tag
  g.beginPath();
  g.moveTo(w / 2 - 12, 80);
  g.lineTo(w / 2 + 12, 80);
  g.lineTo(w / 2, 91);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, 45);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const out = { tex, aspect: w / 92 };
  tagTextures.set(key, out);
  return out;
}

export interface TileTagProps {
  x: number;
  y: number;
  label: string;
  color: string;
  prefix?: string;
  /** Pulse the outline (failures). */
  pulse?: boolean;
  /** Fill the tile with a faint wash. */
  wash?: boolean;
}

/** An outline on a tile and a small labelled tag floating above it. */
export function TileTag({ x, y, label, color, prefix = '', pulse = false, wash = false }: TileTagProps) {
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const washRef = useRef<THREE.Mesh>(null);
  const tag = useRef<THREE.Sprite>(null);
  const t0 = useRef(performance.now());
  const geoms = useMemo(() => {
    const outer = roundedRect(1.0, 0.17);
    outer.holes.push(roundedRect(0.88, 0.12) as unknown as THREE.Path);
    return {
      ring: new THREE.ShapeGeometry(outer, 8).rotateX(-Math.PI / 2),
      wash: new THREE.ShapeGeometry(roundedRect(0.88, 0.12), 8).rotateX(-Math.PI / 2),
    };
  }, []);
  const tagInfo = tagTexture(label, color, prefix);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const t = (performance.now() - t0.current) / 1000;
    const base = field.heightAt(x, y) * SLAB_H;
    g.position.set(x, base + 0.012, -y);
    const pop = Math.min(1, t / 0.3);
    const beat = pulse ? 0.5 + 0.5 * Math.sin(t * 4.2) : 1;
    if (ring.current) {
      ring.current.scale.setScalar(0.9 + 0.1 * pop + (pulse ? 0.035 * beat : 0));
      (ring.current.material as THREE.MeshBasicMaterial).opacity = pop * (pulse ? 0.75 + 0.25 * beat : 0.85);
    }
    if (washRef.current) (washRef.current.material as THREE.MeshBasicMaterial).opacity = pop * (0.12 + 0.1 * beat);
    if (tag.current) {
      const h = 0.34;
      tag.current.scale.set(h * tagInfo.aspect, h, 1);
      tag.current.position.set(0, 0.95 + 0.04 * Math.sin(t * 2.4), 0);
      (tag.current.material as THREE.SpriteMaterial).opacity = Math.min(1, t / 0.35);
    }
  });

  return (
    <group ref={group}>
      {wash && (
        <mesh ref={washRef} geometry={geoms.wash} renderOrder={8}>
          <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      <mesh ref={ring} geometry={geoms.ring} renderOrder={9}>
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} />
      </mesh>
      <sprite ref={tag} renderOrder={12}>
        <spriteMaterial map={tagInfo.tex} transparent depthTest={false} opacity={0} />
      </sprite>
    </group>
  );
}

const TONES = { info: '#2b3445', good: '#2f9e44' } as const;

/** Where the last check failed. Frogs keep their own colours. */
export function FailMarker() {
  const mark = useGame((s) => s.failMark);
  if (!mark) return null;
  return <TileTag key={`${mark.x},${mark.y},${mark.t0}`} x={mark.x} y={mark.y} label={mark.label} color={COLORS.fail} prefix="✕" pulse wash />;
}

/** Tutorial hints placed on tiles ("egg: input n = 2", "Init ✓", …). */
export function Callouts() {
  const callouts = useGame((s) => s.callouts);
  return (
    <>
      {callouts.map((c) => (
        <TileTag key={`${c.x},${c.y},${c.text}`} x={c.x} y={c.y} label={c.text} color={TONES[c.tone]} prefix={c.tone === 'good' ? '✓' : ''} />
      ))}
    </>
  );
}
