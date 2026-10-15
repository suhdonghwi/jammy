import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS, SLAB_H } from './constants';
import { field } from './field';
import { handState } from './handState';
import { outlineMaterial } from './models';
import { getBlobTexture } from './shaders';
import { sceneNow } from './sceneTime';

// A puffy cartoon glove — the skeptic. Palm faces down, fingers point along -z.
// Every part has an inverted-hull outline so it reads clearly on the white world.

const FINGERS = [
  { x: -0.235, len: [0.13, 0.11], spread: 0.12 },
  { x: -0.08, len: [0.15, 0.13], spread: 0.03 },
  { x: 0.08, len: [0.145, 0.12], spread: -0.03 },
  { x: 0.23, len: [0.12, 0.1], spread: -0.12 },
];
const R = 0.088;

function Part({ geometry, material, outline, ...props }: { geometry: THREE.BufferGeometry; material: THREE.Material; outline: THREE.Material } & Record<string, unknown>) {
  return (
    <group {...props}>
      <mesh geometry={geometry} material={outline} />
      <mesh geometry={geometry} material={material} />
    </group>
  );
}

export function Hand() {
  const root = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const fingers = useRef<{ a: THREE.Group | null; b: THREE.Group | null }[]>(FINGERS.map(() => ({ a: null, b: null })));
  const thumb = useRef<{ a: THREE.Group | null; b: THREE.Group | null }>({ a: null, b: null });

  const assets = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.glove, roughness: 0.55, metalness: 0 });
    const cuffMat = new THREE.MeshStandardMaterial({ color: '#eef1f6', roughness: 0.6 });
    const outline = outlineMaterial(0.016);
    const palm = new RoundedBoxGeometry(0.64, 0.26, 0.58, 5, 0.12);
    const seg = (len: number, r = R) => new THREE.CapsuleGeometry(r, len, 8, 16).rotateX(Math.PI / 2);
    const wrist = new THREE.CylinderGeometry(0.2, 0.22, 0.2, 28).rotateX(Math.PI / 2);
    const cuff = new THREE.TorusGeometry(0.235, 0.075, 16, 40);
    const shadowMat = new THREE.MeshBasicMaterial({ map: getBlobTexture(), transparent: true, depthWrite: false });
    return { mat, cuffMat, outline, palm, seg, wrist, cuff, shadowMat };
  }, []);

  useFrame(() => {
    const g = root.current;
    const h = handState;
    if (!g || !inner.current) return;
    const t = sceneNow();
    g.visible = h.visible > 0.01;
    const s = (0.25 + 0.75 * h.visible) * 0.95;
    g.scale.setScalar(s);
    // hold steady while carrying a frog in the palm
    const bob = Math.sin(t * 1.7) * 0.035 * (1 - h.palmUp);
    g.position.set(h.x, h.y + bob, h.z);
    const shrugWobble = Math.sin(t * 10) * 0.25 * h.shrug;
    // base yaw π: the hand reaches in from the far side, fingers toward the viewer
    inner.current.rotation.set(-0.3 + h.tilt + h.shrug * -0.25, Math.PI + h.yaw, Math.PI * h.palmUp + shrugWobble, 'YXZ');
    inner.current.position.y = Math.abs(Math.sin(t * 10)) * 0.12 * h.shrug;

    fingers.current.forEach((f, i) => {
      const isIndex = i === 0; // the finger next to the thumb
      let curl = isIndex ? h.curl * (1 - h.point) : Math.max(h.curl, h.point * 0.95);
      curl += Math.max(0, Math.sin(t * 13 - i * 0.9)) * 0.5 * h.tap;
      if (f.a) f.a.rotation.set(-curl * 1.05, FINGERS[i].spread * (1 - curl * 0.6), 0);
      if (f.b) f.b.rotation.set(-curl * 1.25, 0, 0);
    });
    const tc = Math.max(h.curl, h.point * 0.7);
    if (thumb.current.a) thumb.current.a.rotation.set(-0.15 - tc * 0.4, 0.75 - tc * 0.5, -0.35);
    if (thumb.current.b) thumb.current.b.rotation.set(-tc * 0.8, 0, 0);

    // soft shadow on the ground under the hand: larger and lighter when high
    const sh = shadow.current;
    if (sh) {
      // straight below the hand, on whatever surface is there (floor or slab).
      // The shadow is a child of the hand's group, so this is in its local
      // frame: no x/z offset, and undo the group's height (bob included) and scale.
      const surface = field.heightAt(Math.round(h.x), Math.round(-h.z)) * SLAB_H;
      const height = Math.max(0.2, h.y - surface);
      sh.position.set(0, (surface + 0.012 - (h.y + bob)) / s, 0);
      sh.scale.setScalar((0.9 + height * 0.25) / s);
      (sh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, 1.6 / (1 + height)) * h.visible;
    }
  });

  const { mat, cuffMat, outline, palm, seg, wrist, cuff, shadowMat } = assets;
  return (
    <group ref={root} visible={false}>
      <mesh ref={shadow} material={shadowMat} rotation={[-Math.PI / 2, 0, 0]} renderOrder={4}>
        <planeGeometry args={[1.4, 1.4]} />
      </mesh>
      <group ref={inner}>
        <Part geometry={palm} material={mat} outline={outline} />
        {/* wrist + rolled cuff */}
        <Part geometry={wrist} material={mat} outline={outline} position={[0, 0.01, 0.34]} />
        <Part geometry={cuff} material={cuffMat} outline={outline} position={[0, 0.01, 0.46]} />
        {FINGERS.map((f, i) => (
          <group
            key={i}
            position={[f.x, -0.01, -0.24]}
            ref={(el) => void (fingers.current[i].a = el)}
          >
            <Part geometry={seg(f.len[0])} material={mat} outline={outline} position={[0, 0, -f.len[0] / 2 - 0.02]} />
            <group position={[0, 0, -f.len[0] - 0.05]} ref={(el) => void (fingers.current[i].b = el)}>
              <Part geometry={seg(f.len[1], R * 0.97)} material={mat} outline={outline} position={[0, 0, -f.len[1] / 2 - 0.02]} />
            </group>
          </group>
        ))}
        <group position={[-0.31, -0.02, -0.02]} ref={(el) => void (thumb.current.a = el)}>
          <Part geometry={seg(0.11, 0.092)} material={mat} outline={outline} position={[0, 0, -0.08]} />
          <group position={[0, 0, -0.16]} ref={(el) => void (thumb.current.b = el)}>
            <Part geometry={seg(0.08, 0.088)} material={mat} outline={outline} position={[0, 0, -0.06]} />
          </group>
        </group>
      </group>
    </group>
  );
}
