import { CameraControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useLayoutEffect, useRef, useState } from 'react';
import { prepareSound } from '../audio/sfx';
import { useGame } from '../game/store';
import { cameraRig } from './cameraRig';
import { HomeScene } from './home/HomeScene';
import { LevelScene } from './level/LevelScene';
import { PhoneFraming } from './PhoneFraming';
import { startScene } from './sceneTime';

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

/**
 * Starts the scene (see sceneTime) once its first frame is drawn and the fonts
 * are in. Mounted with each scene, so a new screen waits for its own frame.
 */
function Start() {
  const frames = useRef(0);
  useFrame(() => {
    // the first frame is the slow one (its shaders compile); it is on screen once the next begins
    if (++frames.current === 2) {
      // slow too, and better now, with nothing on screen to stall, than at the first press
      prepareSound();
      void document.fonts.ready.then(startScene);
    }
  });
  return null;
}

/** The home screen's scene, or the open level's. */
function SceneSwitch() {
  const mode = useGame((s) => s.mode);
  const level = useGame((s) => s.level);
  if (mode === 'menu' || !level)
    return (
      <>
        <HomeScene />
        <Start key="home" />
      </>
    );
  return (
    <>
      <LevelScene />
      <Start key={level.id} />
    </>
  );
}

/** The sharpest the world is drawn (device pixels per CSS pixel). */
const MAX_DPR = 1.75;

export function World() {
  // Drawn as sharp as the screen allows (up to MAX_DPR), and less sharp if
  // frames start dropping: the floor is shaded per pixel, so on a slow GPU
  // fewer pixels is what keeps it smooth.
  const top = Math.max(1, Math.min(window.devicePixelRatio, MAX_DPR));
  const [dpr, setDpr] = useState(top);
  return (
    <Canvas
      flat
      dpr={dpr}
      camera={{ position: [3, 10, 12], fov: 36, near: 0.1, far: 500 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      {/* never gives up for good: a window the browser throttles for a while
          (hidden behind others, battery saver) gets its sharpness back after */}
      <PerformanceMonitor
        factor={1}
        // in quarter steps, so small swings don't resize the canvas
        onChange={({ factor }) => setDpr(factor === 1 ? top : Math.round((1 + (top - 1) * factor) * 4) / 4)}
      />
      <Lights />
      <Controls />
      <PhoneFraming />
      <SceneSwitch />
    </Canvas>
  );
}
