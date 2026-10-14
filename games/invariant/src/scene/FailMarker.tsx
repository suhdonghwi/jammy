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
function tagTexture(label: string) {
  const hit = tagTextures.get(label);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = '600 46px Fredoka, ui-rounded, sans-serif';
  g.font = font;
  const text = `✕  ${label}`;
  const w = Math.ceil(g.measureText(text).width) + 64;
  c.width = w;
  c.height = 92;
  g.font = font;
  g.fillStyle = COLORS.fail;
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
  tagTextures.set(label, out);
  return out;
}

export function FailMarker() {
  const mark = useGame((s) => s.failMark);
  const group = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const wash = useRef<THREE.Mesh>(null);
  const tag = useRef<THREE.Sprite>(null);
  const geoms = useMemo(() => {
    const outer = roundedRect(1.0, 0.17);
    outer.holes.push(roundedRect(0.86, 0.12) as unknown as THREE.Path);
    return {
      ring: new THREE.ShapeGeometry(outer, 8).rotateX(-Math.PI / 2),
      wash: new THREE.ShapeGeometry(roundedRect(0.88, 0.12), 8).rotateX(-Math.PI / 2),
    };
  }, []);
  const tagInfo = mark ? tagTexture(mark.label) : null;

  useFrame(() => {
    const g = group.current;
    if (!g || !mark) return;
    const t = (performance.now() - mark.t0) / 1000;
    const base = field.heightAt(mark.x, mark.y) * SLAB_H;
    g.position.set(mark.x, base + 0.012, -mark.y);
    // pop in, then a slow pulse
    const pop = Math.min(1, t / 0.25);
    const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
    if (ring.current) {
      ring.current.scale.setScalar(0.9 + 0.1 * pop + 0.035 * pulse);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = pop * (0.75 + 0.25 * pulse);
    }
    if (wash.current) (wash.current.material as THREE.MeshBasicMaterial).opacity = pop * (0.12 + 0.1 * pulse);
    if (tag.current && tagInfo) {
      const h = 0.36;
      tag.current.scale.set(h * tagInfo.aspect, h, 1);
      tag.current.position.set(0, 0.95 + 0.04 * Math.sin(t * 2.4), 0);
      (tag.current.material as THREE.SpriteMaterial).opacity = Math.min(1, t / 0.3);
    }
  });

  if (!mark || !tagInfo) return null;
  return (
    <group ref={group} key={`${mark.x},${mark.y},${mark.t0}`}>
      <mesh ref={wash} geometry={geoms.wash} renderOrder={8}>
        <meshBasicMaterial color={COLORS.fail} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={ring} geometry={geoms.ring} renderOrder={9}>
        <meshBasicMaterial color={COLORS.fail} transparent opacity={0} depthWrite={false} />
      </mesh>
      <sprite ref={tag} renderOrder={12}>
        <spriteMaterial map={tagInfo.tex} transparent depthTest={false} opacity={0} />
      </sprite>
    </group>
  );
}
