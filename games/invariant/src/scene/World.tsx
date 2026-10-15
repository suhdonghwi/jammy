import { CameraControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import { useGame } from '../game/store';
import { cameraRig } from './cameraRig';
import { HomeScene } from './home/HomeScene';
import { LevelScene } from './level/LevelScene';

// The one 3D canvas behind the whole app.

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#cfd6e2', 2.1]} />
      <directionalLight position={[4, 10, 6]} intensity={1.6} color="#ffffff" />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} color="#ffffff" />
    </>
  );
}

function Controls() {
  const ref = useRef<CameraControls>(null);
  // the home screen drives its own camera; user input there would only fight it
  const interactive = useGame((s) => s.mode !== 'menu');
  // attached before anything else's layout effects (and before the first
  // frame), so scenes can position the camera through it from the start
  useLayoutEffect(() => {
    cameraRig.attach(ref.current);
    const c = ref.current;
    if (c) {
      // pan along the ground like a map; right-drag rotates
      c.mouseButtons.left = 4; // SCREEN_PAN
      c.mouseButtons.right = 1; // ROTATE
      c.touches.one = 256; // TOUCH_SCREEN_PAN
    }
    return () => cameraRig.attach(null);
  }, []);
  return (
    <CameraControls
      ref={ref}
      makeDefault
      enabled={interactive}
      minDistance={6}
      maxDistance={60}
      minPolarAngle={0.25}
      maxPolarAngle={1.15}
      dollySpeed={0.6}
      smoothTime={0.42}
      draggingSmoothTime={0.1}
    />
  );
}

/** The home screen's scene, or the open level's. */
function SceneSwitch() {
  const mode = useGame((s) => s.mode);
  const level = useGame((s) => s.level);
  if (mode === 'menu' || !level) return <HomeScene />;
  return <LevelScene />;
}

export function World() {
  return (
    <Canvas
      flat
      dpr={[1, 1.75]}
      camera={{ position: [3, 10, 12], fov: 36, near: 0.1, far: 500 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => useGame.setState({ selected: null })}
    >
      <Lights />
      <Controls />
      <SceneSwitch />
    </Canvas>
  );
}
