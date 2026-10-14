import { CameraControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../store/game';
import { cameraRig, VIEW } from './cameraRig';
import { COLORS } from './constants';
import { Frogs } from './Frogs';
import { Hand } from './Hand';
import { HoverPreview } from './HoverPreview';
import { PondLayer } from './PondLayer';
import { FocusedLayer, PondStack } from './PondStack';
import { BridgeCinematic } from './Bridge';

function FogAndLight() {
  const scene = useThree((s) => s.scene);
  const light = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    scene.fog = new THREE.Fog(COLORS.background, 20, 40);
  }, [scene]);
  useFrame(() => {
    const d = cameraRig.distance();
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      fog.near = d * 0.85;
      fog.far = d * 1.6;
    }
    const l = light.current;
    if (l) {
      const t = cameraRig.target();
      l.position.set(t.x + 5, 14, t.z + 7);
      l.target.position.set(t.x, 0, t.z);
      l.target.updateMatrixWorld();
      const ext = Math.min(40, Math.max(14, d * 0.9));
      const cam = l.shadow.camera;
      if (cam.right !== ext) {
        cam.left = -ext;
        cam.right = ext;
        cam.top = ext;
        cam.bottom = -ext;
        cam.updateProjectionMatrix();
      }
    }
  });
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d5dae3', 1.9]} />
      <directionalLight ref={light} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-radius={6} />
    </>
  );
}

function Controls() {
  const ref = useRef<CameraControls>(null);
  useEffect(() => {
    cameraRig.attach(ref.current);
    const c = ref.current;
    if (c) {
      c.mouseButtons.left = 2; // TRUCK (pan)
      c.mouseButtons.right = 1; // ROTATE
      c.touches.one = 128; // TOUCH_TRUCK
      // Pan like a map: dragging moves along the ground, never up or down.
      c.verticalDragToForward = true;
      c.setBoundary(new THREE.Box3(new THREE.Vector3(-1e5, 0, -1e5), new THREE.Vector3(1e5, 0, 1e5)));
      c.boundaryFriction = 0;
      c.rotateTo(VIEW.azimuth, VIEW.polar, false);
    }
    return () => cameraRig.attach(null);
  }, []);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={5}
      maxDistance={70}
      minPolarAngle={0.3}
      maxPolarAngle={1.2}
      minAzimuthAngle={-1}
      maxAzimuthAngle={1.4}
      dollySpeed={0.6}
      smoothTime={0.45}
      draggingSmoothTime={0.12}
    />
  );
}

function LevelScene() {
  const level = useGame((s) => s.level);
  const cinematic = useGame((s) => s.cinematic);
  useEffect(() => {
    if (!level) return;
    const cam = level.camera ?? { x: 0, y: 0 };
    void cameraRig.resetAngle(false);
    void cameraRig.lookAtTile(cam.x, cam.y, cam.distance ?? 14, false);
  }, [level]);
  if (!level) return null;
  if (cinematic) return <BridgeCinematic />;
  return (
    <>
      <FocusedLayer>
        <PondLayer />
        <Frogs />
        <HoverPreview />
      </FocusedLayer>
      {level.pond && <PondStack />}
      <Hand />
    </>
  );
}

export function World() {
  return (
    <Canvas
      shadows="soft"
      flat
      dpr={[1, 2]}
      camera={{ position: [3, 10, 12], fov: 38, near: 0.1, far: 400 }}
      gl={{ antialias: true }}
      onPointerMissed={() => useGame.getState().patch({ selected: null })}
    >
      <color attach="background" args={[COLORS.background]} />
      <FogAndLight />
      <Controls />
      <LevelScene />
    </Canvas>
  );
}
