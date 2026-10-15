import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as THREE from 'three';
import type opentype from 'opentype.js';
import { COLORS } from '../scene/constants';
import { frogGeometry, frogMaterial, outlineMaterial } from '../scene/models';
import { letterGeometries } from '../scene/text3d';
import { useTitleFont, Word } from '../scene/home/common';

// The home screen's title as 3D lettering, in its own small transparent canvas
// so the page layout places it (left-aligned, above the copy) at any size.
// A frog sits beside "Frog", breathes, glances toward the cursor and now and
// then hops on the spot.

export type TitleStyle = 'standing' | 'platforms' | 'plaque';

const LINE1 = { text: 'Invariant', size: 1.0 };
const LINE2 = { text: 'Frog', size: 1.3 };
const BUDDY = 1.55; // frog scale

function widthOf(font: opentype.Font, text: string, size: number) {
  const ls = letterGeometries(font, text, { size, depth: size * 0.42, letterSpacing: size * 0.02 });
  let min = Infinity;
  let max = -Infinity;
  for (const l of ls) {
    l.geom.computeBoundingBox();
    const bb = l.geom.boundingBox!;
    min = Math.min(min, l.x + bb.min.x);
    max = Math.max(max, l.x + bb.max.x);
    l.geom.dispose();
  }
  return max - min;
}

/** Content bounds per style, in title units (left edge at x = 0, baseline of "Frog" at y = 0). */
/** Where the "o" of "Frog" is (centre x and top), relative to the word's centre. */
function letterO(font: opentype.Font) {
  const ls = letterGeometries(font, LINE2.text, { size: LINE2.size, depth: LINE2.size * 0.42, letterSpacing: LINE2.size * 0.02 });
  const o = ls[2];
  o.geom.computeBoundingBox();
  const bb = o.geom.boundingBox!;
  const out = { x: o.x + (bb.min.x + bb.max.x) / 2, top: bb.max.y };
  ls.forEach((l) => l.geom.dispose());
  return out;
}

/** Content bounds per style, in title units (left edge at x = 0, baseline of "Frog" at y = 0). */
function layout(font: opentype.Font, style: TitleStyle) {
  const w1 = widthOf(font, LINE1.text, LINE1.size);
  const w2 = widthOf(font, LINE2.text, LINE2.size);
  const o = letterO(font);
  // standing: the frog hides behind the "o" and peeks over it; others: beside the word
  const buddyX = style === 'standing' ? w2 / 2 + o.x : w2 + 0.75;
  const right = style === 'standing' ? Math.max(w1, w2) : Math.max(w1, buddyX + 0.45);
  const y1 = style === 'standing' ? 1.32 : 1.5;
  const bottom = style === 'standing' ? -0.35 : style === 'platforms' ? -0.5 : -0.55;
  const top = style === 'plaque' ? y1 + 1.25 : y1 + 0.95;
  return { w1, w2, buddyX, oTop: o.top, y1, left: style === 'standing' ? -0.05 : -0.35, right: right + 0.25, bottom, top };
}

function useFrogBuddy() {
  return useMemo(() => {
    const geom = frogGeometry();
    const body = new THREE.InstancedMesh(geom, frogMaterial(), 1);
    body.setColorAt(0, new THREE.Color(COLORS.frog));
    body.frustumCulled = false;
    // the same dark outline as the lettering
    const line = new THREE.InstancedMesh(geom, outlineMaterial(0.018), 1);
    line.frustumCulled = false;
    return { body, line };
  }, []);
}

const dummy = new THREE.Object3D();

/** The frog beside the title. `peek`: it hides behind something and only looks over the top. */
function FrogBuddy({ x, y, z = 0.2, peek = false, scale = BUDDY, duckDepth = 0.62 }: { x: number; y: number; z?: number; peek?: boolean; scale?: number; duckDepth?: number }) {
  const mesh = useFrogBuddy();
  const look = useRef(0);
  const target = useRef(0);
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      // turn a little toward the cursor's side of the screen
      target.current = THREE.MathUtils.clamp(((e.clientX / window.innerWidth) * 2 - 1) * 1.1, -0.9, 0.9);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    look.current += (target.current - look.current) * Math.min(1, dt * 4);
    const breath = 0.025 * Math.sin(t * 2.4);
    let lift: number;
    let hop = 0;
    let crouch = 0;
    if (peek) {
      // mostly peeking over the edge with a gentle bob; now and then it
      // ducks out of sight and pops back up
      const c = (t + 2) % 6;
      const duck = c < 4.4 ? 0 : c < 4.75 ? (c - 4.4) / 0.35 : c < 5.2 ? 1 : c < 5.55 ? 1 - (c - 5.2) / 0.35 : 0;
      const pop = c > 5.2 && c < 5.75 ? Math.sin(((c - 5.2) / 0.55) * Math.PI) : 0;
      // ducking only as far as the letters cover it (its feet stay above the baseline)
      lift = 0.03 * Math.sin(t * 1.7) * (1 - duck) - duckDepth * duck * duck * (3 - 2 * duck) + 0.07 * pop;
      hop = pop;
    } else {
      // a happy hop every few seconds
      const u = ((t + 1.2) % 4.2) / 0.6;
      hop = u < 1 ? Math.sin(Math.PI * u) : 0;
      crouch = u > 1 && u < 1.25 ? Math.sin(Math.PI * (u - 1) * 4) : 0;
      lift = 0.45 * hop;
    }
    const sy = 1 + breath + 0.12 * hop - 0.12 * crouch;
    const sx = 1 - breath * 0.5 - 0.05 * hop + 0.06 * crouch;
    dummy.position.set(x, y + lift, z);
    dummy.rotation.set(peek ? 0 : -0.12 * hop, look.current, 0);
    dummy.scale.set(sx * scale, sy * scale, sx * scale);
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

function Platform({ x, width, y }: { x: number; width: number; y: number }) {
  const geom = useMemo(() => new RoundedBoxGeometry(width, 0.28, 1.0, 4, 0.1), [width]);
  const mats = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.slabTop, roughness: 0.5 }), []);
  return <mesh geometry={geom} material={mats} position={[x + width / 2, y - 0.14, 0]} />;
}

/** A rounded blue sign the letters stand on (the frog peeks over its top). */
function Plaque({ left, right, bottom, top }: { left: number; right: number; bottom: number; top: number }) {
  const geom = useMemo(() => new RoundedBoxGeometry(right - left, top - bottom, 0.4, 5, 0.22), [left, right, bottom, top]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom} position={[(right + left) / 2, (top + bottom) / 2, -0.4]}>
      <meshStandardMaterial color={COLORS.slabTop} roughness={0.5} />
    </mesh>
  );
}

function TitleScene({ font, style }: { font: opentype.Font; style: TitleStyle }) {
  const L = useMemo(() => layout(font, style), [font, style]);
  const { camera, size } = useThree();
  const group = useRef<THREE.Group>(null);

  // fit the content into the canvas, left-aligned
  useFrame(({ clock }) => {
    const pad = 0.15;
    const W = L.right - L.left + pad * 2;
    const H = L.top - L.bottom + pad * 2;
    const cam = camera as THREE.OrthographicCamera;
    cam.zoom = Math.min(size.width / W, size.height / H);
    cam.position.set(L.left - pad + size.width / cam.zoom / 2, (L.top + L.bottom) / 2, 20);
    cam.updateProjectionMatrix();
    // a slow sway so the depth reads
    if (group.current) {
      // standing letters face the viewer squarely (looked at a touch from above,
      // so their depth still reads); the other styles sway a little
      group.current.rotation.y = style === 'standing' ? 0 : 0.16 + Math.sin(clock.elapsedTime * 0.5) * 0.05;
      // platforms tip toward the viewer a little, so their tops read as slabs
      group.current.rotation.x = style === 'platforms' ? 0.32 : style === 'standing' ? 0.16 : 0.06;
    }
  });

  const blue = { face: COLORS.slabTop, side: COLORS.slabSide };
  // a deeper green than the frog itself, so the frog peeking over it stands out
  const green = { face: '#3fae37', side: '#2b7d25' };
  const white = { face: '#ffffff', side: '#d9e2f0' };
  const c1 = style === 'plaque' ? white : blue;
  const c2 = style === 'plaque' ? { face: '#eaffd9', side: '#bfe6a8' } : green;

  return (
    <group ref={group}>
      {style === 'platforms' && (
        <>
          <Platform x={-0.3} width={L.w1 + 0.6} y={L.y1 - 0.08} />
          <Platform x={-0.3} width={L.buddyX + 0.75} y={-0.08} />
        </>
      )}
      {style === 'plaque' && <Plaque left={L.left} right={L.right} bottom={L.bottom} top={L.top - 0.3} />}
      <Word font={font} text={LINE1.text} size={LINE1.size} position={[L.w1 / 2, L.y1, 0]} face={c1.face} side={c1.side} wave={0.08} outline={0.02} />
      <Word font={font} text={LINE2.text} size={LINE2.size} position={[L.w2 / 2, 0, 0]} face={c2.face} side={c2.side} wave={0.08} phase={1.4} outline={0.02} />
      {style === 'plaque' ? (
        <FrogBuddy x={L.right - 0.55} y={L.top - 0.75} z={-0.75} peek />
      ) : (
        style === 'standing' ? (
          // behind the "o", only its head showing over the top
          <FrogBuddy x={L.buddyX} y={L.oTop - 0.4} z={-0.7} peek scale={1.45} duckDepth={0.3} />
        ) : (
          <FrogBuddy x={L.buddyX} y={0.0} />
        )
      )}
    </group>
  );
}

/** The 3D title block. Its height follows its width, by the content's own proportions. */
export function Title3D({ style }: { style: TitleStyle }) {
  const font = useTitleFont();
  const aspect = useMemo(() => {
    if (!font) return 2.2;
    const L = layout(font, style);
    return (L.right - L.left + 0.3) / (L.top - L.bottom + 0.3);
  }, [font, style]);
  return (
    <div className="title3d" style={{ aspectRatio: aspect }}>
      {font && (
        <Canvas flat orthographic dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 20], zoom: 60, near: 0.1, far: 100 }}>
          <hemisphereLight args={['#ffffff', '#cfd6e2', 2.1]} />
          <directionalLight position={[4, 10, 6]} intensity={1.6} color="#ffffff" />
          <directionalLight position={[-6, 4, -4]} intensity={0.35} color="#ffffff" />
          <TitleScene font={font} style={style} />
        </Canvas>
      )}
    </div>
  );
}
