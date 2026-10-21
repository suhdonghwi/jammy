import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { layouts } from 'virtual:title-glyphs';
import { COLORS } from '../../../scene/constants';
import { frogGeometry, frogMaterial, outlineMaterial } from '../../../scene/models';
import { sceneNow, sceneStarted } from '../../../scene/sceneTime';
import { LINE1, LINE2 } from './glyphs';
import { cameraFor, FOV, LINE_GAP, TITLE_ASPECT, WAVE, type TitleAlign } from './layout';
import { entrance, STAGGER, waveAt, Word } from './Word';

const PHASE2 = 1.4;
const FROG_SCALE = 1.12;
const FROG_AT = (LINE1.length + LINE2.length) * STAGGER + 0.05;

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
  const L = layouts[align];
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
      <Word text={LINE1} position={[L.x1, LINE_GAP, 0]} xs={L.xs1} face={COLORS.slabTop} side={COLORS.slabSide} wave={wave} clock={clock} />
      <Word text={LINE2} position={[L.x2, 0, 0]} xs={L.xs2} face="#46b83e" side="#2f8a29" wave={wave} phase={PHASE2} clock={clock} first={LINE1.length} />
      <PeekingFrog x={L.o.x} y={L.o.top - frogHeight * 0.6} letterIndex={L.o.index} wave={wave} clock={clock} />
    </group>
  );
}

export function Title3D({
  width = 'w-full max-w-125 narrow:mx-auto narrow:max-w-85 short:max-w-[min(31.25rem,45vw,calc((100dvh-12.5rem)*1.95))]',
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
