import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { COLORS } from '../../../scene/constants';
import { frogGeometry, frogMaterial, outlineMaterial } from '../../../scene/models';
import { sceneNow, sceneStarted } from '../../../scene/sceneTime';
import { LINE1, LINE2 } from './glyphs';
import { letterGeometries, type LetterOptions } from './text3d';
import { entrance, OUTLINE, STAGGER, waveAt, Word } from './Word';

const SIZE = 1;
const LINE_GAP = 1.18;
const WAVE = 0.08;
const PHASE2 = 1.4;
const FROG_SCALE = 1.12;
const FROG_AT = (LINE1.length + LINE2.length) * STAGGER + 0.05;
const FOV = 18;

const letterOpts: LetterOptions = { size: SIZE, depth: SIZE * 0.42, gap: OUTLINE, drift: WAVE * 0.25 };

function measure(text: string, opts: LetterOptions) {
  const ls = letterGeometries(text, opts);
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

type Layout = ReturnType<typeof place>;

function place(align: TitleAlign, opts1: LetterOptions, opts2: LetterOptions) {
  const m1 = measure(LINE1, opts1);
  const m2 = measure(LINE2, opts2);
  const indent2 = align === 'center' ? (m1.max - m1.min - (m2.max - m2.min)) / 2 : 0;
  return {
    x1: -m1.min,
    x2: -m2.min + indent2,
    o: { ...m2.o, x: m2.o.x - m2.min + indent2 },
    left: -OUTLINE,
    right: Math.max(m1.max - m1.min, m2.max - m2.min) + OUTLINE,
    bottom: -0.32,
    top: LINE_GAP + 0.9,
  };
}

function cameraFor(L: Layout, fov: number, aspect: number) {
  const pad = 0.04;
  const W = L.right - L.left + pad * 2;
  const H = L.top - L.bottom + pad * 2;
  const half = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const dist = Math.max(H, W / aspect) / (2 * half);
  return new THREE.Vector3((L.left + L.right) / 2, (L.top + L.bottom) / 2, dist + 0.3);
}

const layouts = new Map<TitleAlign, ReturnType<typeof computeLayout>>();
const layout = (align: TitleAlign) => layouts.get(align) ?? layouts.set(align, computeLayout(align)).get(align)!;

function computeLayout(align: TitleAlign) {
  let L = place(align, letterOpts, letterOpts);
  const eye = cameraFor(L, FOV, TITLE_ASPECT);
  const opts1 = { ...letterOpts, eye: eye.clone().sub(new THREE.Vector3(L.x1, LINE_GAP, 0)) };
  const opts2 = { ...letterOpts, eye: eye.clone().sub(new THREE.Vector3(L.x2, 0, 0)) };
  L = place(align, opts1, opts2);
  return { ...L, opts1, opts2 };
}

const dummy = new THREE.Object3D();
let frogGeom: THREE.BufferGeometry | undefined;

function PeekingFrog({ x, y, letterIndex, wave, clock }: { x: number; y: number; letterIndex: number; wave: number; clock: { t: number } }) {
  const mesh = useMemo(() => {
    const geom = (frogGeom ??= frogGeometry({ fine: true }));
    const body = new THREE.InstancedMesh(geom, frogMaterial(), 1);
    body.setColorAt(0, new THREE.Color(COLORS.frog));
    body.frustumCulled = false;
    const line = new THREE.InstancedMesh(geom, outlineMaterial(0.016), 1);
    line.frustumCulled = false;
    return { body, line };
  }, []);
  useFrame(() => {
    const t = sceneNow();
    const ride = waveAt(t, letterIndex, PHASE2) * wave;
    const breath = 0.02 * Math.sin(t * 2.4);
    const s = FROG_SCALE * entrance(clock.t, FROG_AT);
    dummy.position.set(x, y + ride, -0.58);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(s * (1 - breath * 0.5), s * (1 + breath), s * (1 - breath * 0.5));
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

function TitleScene({ align, wave }: { align: TitleAlign; wave: number }) {
  const L = useMemo(() => layout(align), [align]);
  const { camera, size } = useThree();
  const clock = useMemo(() => ({ t: -0.15 }), []);

  useFrame((_, dt) => {
    if (sceneStarted()) clock.t += Math.min(dt, 1 / 30);
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.copy(cameraFor(L, cam.fov, size.width / size.height));
    cam.lookAt(cam.position.x, cam.position.y, 0);
    cam.updateProjectionMatrix();
  });

  const frogHeight = 0.53 * FROG_SCALE;
  return (
    <group>
      <Word text={LINE1} position={[L.x1, LINE_GAP, 0]} letters={L.opts1} face={COLORS.slabTop} side={COLORS.slabSide} wave={wave} clock={clock} />
      <Word text={LINE2} position={[L.x2, 0, 0]} letters={L.opts2} face="#46b83e" side="#2f8a29" wave={wave} phase={PHASE2} clock={clock} first={LINE1.length} />
      <PeekingFrog x={L.o.x} y={L.o.top - frogHeight * 0.6} letterIndex={L.o.index} wave={wave} clock={clock} />
    </group>
  );
}

// Measured from layout(); fixed so the block has its size before the canvas starts. Update it if the letters change.
const TITLE_ASPECT = 1.95;

type TitleAlign = 'left' | 'center';

export function Title3D({
  width = 'w-full max-w-125 narrow:mx-auto narrow:max-w-85',
  align = 'left',
  still = false,
}: {
  width?: string;
  align?: TitleAlign;
  still?: boolean;
}) {
  return (
    <div className={width} style={{ aspectRatio: TITLE_ASPECT }}>
      <Canvas flat dpr={[1, 2]} gl={{ alpha: true, antialias: true }} camera={{ position: [0, 0, 30], fov: FOV, near: 0.1, far: 200 }}>
        <hemisphereLight args={['#ffffff', '#cfd6e2', 2.1]} />
        <directionalLight position={[4, 10, 6]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-6, 4, -4]} intensity={0.35} color="#ffffff" />
        <directionalLight position={[1, 2, 10]} intensity={1.1} color="#ffffff" />
        <TitleScene align={align} wave={still ? 0 : WAVE} />
      </Canvas>
    </div>
  );
}
