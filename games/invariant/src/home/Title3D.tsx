import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import type opentype from 'opentype.js';
import { COLORS } from '../scene/constants';
import { frogGeometry, frogMaterial, outlineMaterial } from '../scene/models';
import { letterGeometries } from '../scene/text3d';
import { useTitleFont, Word } from '../scene/home/common';

// The home screen's title as 3D lettering, in its own small transparent canvas
// so the page layout places it (left-aligned, above the copy) at any size.
// A frog hides behind the "o" of "Frog" and peeks over it, riding the wave
// that runs through the letters.

const SIZE = 1;
const LINE1 = 'Invariant';
const LINE2 = 'Frog';
const LINE_GAP = 1.18;
/** The wave through the letters (see Word): height, and the phase of "Frog". */
const WAVE = 0.08;
const PHASE2 = 1.4;
/** The frog, relative to the letters. */
const FROG_SCALE = 1.12;

/** Room between letters: their bevel and outline make them a little wider than the glyphs, and they tilt in the wave. */
const SPACING = 0.075;
const letterOpts = { size: SIZE, depth: SIZE * 0.42, letterSpacing: SIZE * SPACING };

/**
 * A word's ink extents relative to its centre (as Word lays it out), and where
 * its "o" is (letter index, centre x and top).
 */
function measure(font: opentype.Font, text: string) {
  const ls = letterGeometries(font, text, letterOpts);
  let min = Infinity;
  let max = -Infinity;
  let o = { index: -1, x: 0, top: 0 };
  ls.forEach((l, i) => {
    l.geom.computeBoundingBox();
    const bb = l.geom.boundingBox!;
    min = Math.min(min, l.x + bb.min.x);
    max = Math.max(max, l.x + bb.max.x);
    if (o.index < 0 && text[i] === 'o') o = { index: i, x: l.x + (bb.min.x + bb.max.x) / 2, top: bb.max.y };
    l.geom.dispose();
  });
  return { min, max, o };
}

/**
 * Both words are placed so their ink starts exactly at x = 0 (not at the
 * glyphs' built-in side bearing), so the title's left edge lines up with the
 * text below it.
 */
function layout(font: opentype.Font) {
  const m1 = measure(font, LINE1);
  const m2 = measure(font, LINE2);
  const OUTLINE = 0.02;
  return {
    /** Word centres, so each word's ink starts at x = 0. */
    x1: -m1.min,
    x2: -m2.min,
    o: { ...m2.o, x: m2.o.x - m2.min },
    left: -OUTLINE,
    right: Math.max(m1.max - m1.min, m2.max - m2.min) + OUTLINE,
    bottom: -0.32,
    top: LINE_GAP + 0.9,
  };
}

const dummy = new THREE.Object3D();

/**
 * The frog behind the "o": only its head shows over the top. It rises and
 * falls exactly as the "o" does in the wave, and otherwise just breathes.
 */
function PeekingFrog({ x, y, letterIndex }: { x: number; y: number; letterIndex: number }) {
  const mesh = useMemo(() => {
    const geom = frogGeometry();
    const body = new THREE.InstancedMesh(geom, frogMaterial(), 1);
    body.setColorAt(0, new THREE.Color(COLORS.frog));
    body.frustumCulled = false;
    // the same dark outline as the lettering
    const line = new THREE.InstancedMesh(geom, outlineMaterial(0.016), 1);
    line.frustumCulled = false;
    return { body, line };
  }, []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // the same wave as Word gives this letter
    const ride = Math.max(0, Math.sin(t * 1.6 - letterIndex * 0.55 + PHASE2)) * WAVE;
    const breath = 0.02 * Math.sin(t * 2.4);
    dummy.position.set(x, y + ride, -0.58);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(FROG_SCALE * (1 - breath * 0.5), FROG_SCALE * (1 + breath), FROG_SCALE * (1 - breath * 0.5));
    dummy.updateMatrix();
    for (const m of [mesh.body, mesh.line]) {
      m.setMatrixAt(0, dummy.matrix);
      m.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      <primitive object={mesh.line} />
      <primitive object={mesh.body} />
    </>
  );
}

function TitleScene({ font }: { font: opentype.Font }) {
  const L = useMemo(() => layout(font), [font]);
  const { camera, size } = useThree();

  // A gentle perspective lens straight in front of the title: the letters face
  // the viewer and their sides show just a little toward the edges.
  useFrame(() => {
    const pad = 0.04;
    const W = L.right - L.left + pad * 2;
    const H = L.top - L.bottom + pad * 2;
    const cam = camera as THREE.PerspectiveCamera;
    const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dist = Math.max(H, W / (size.width / size.height)) / (2 * half);
    const cx = (L.left + L.right) / 2;
    const cy = (L.top + L.bottom) / 2;
    cam.position.set(cx, cy, dist + 0.3);
    cam.lookAt(cx, cy, 0);
    cam.updateProjectionMatrix();
  });

  // the frog peeks over the "o": about 40% of it (its head) shows above the letter
  const frogHeight = 0.53 * FROG_SCALE;
  return (
    <group>
      <Word font={font} text={LINE1} size={SIZE} position={[L.x1, LINE_GAP, 0]} face={COLORS.slabTop} side={COLORS.slabSide} wave={WAVE} outline={0.02} spacing={SPACING} />
      {/* a deeper green than the frog itself, so the frog peeking over it stands out */}
      <Word font={font} text={LINE2} size={SIZE} position={[L.x2, 0, 0]} face="#46b83e" side="#2f8a29" wave={WAVE} phase={PHASE2} outline={0.02} spacing={SPACING} />
      <PeekingFrog x={L.o.x} y={L.o.top - frogHeight * 0.6} letterIndex={L.o.index} />
    </group>
  );
}

/** The 3D title block. Its height follows its width, by the content's own proportions. */
export function Title3D() {
  const font = useTitleFont();
  const aspect = useMemo(() => {
    if (!font) return 2.2;
    const L = layout(font);
    return (L.right - L.left + 0.08) / (L.top - L.bottom + 0.08);
  }, [font]);
  return (
    <div className="title3d" style={{ aspectRatio: aspect }}>
      {font && (
        <Canvas flat dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 30], fov: 18, near: 0.1, far: 200 }}>
          <hemisphereLight args={['#ffffff', '#cfd6e2', 2.1]} />
          <directionalLight position={[4, 10, 6]} intensity={1.6} color="#ffffff" />
          <directionalLight position={[-6, 4, -4]} intensity={0.35} color="#ffffff" />
          {/* the letters face the viewer, so light them from the front too */}
          <directionalLight position={[1, 2, 10]} intensity={1.1} color="#ffffff" />
          <TitleScene font={font} />
        </Canvas>
      )}
    </div>
  );
}
