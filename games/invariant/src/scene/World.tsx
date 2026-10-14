import { CameraControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { useGame } from '../store/game';
import { cameraRig, VIEW } from './cameraRig';
import { POND_SPACING } from './constants';
import { Floor } from './Floor';
import { AreaLayer } from './AreaLayer';
import { Frogs } from './Frogs';
import { Hand } from './Hand';
import { HoverPreview } from './HoverPreview';
import { HomeScene } from './HomeScene';
import { BridgeCinematic } from './Bridge';
import { director } from '../director/director';
import { useHover } from './hover';

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#cfd6e2', 2.1]} />
      <directionalLight position={[4, 10, 6]} intensity={1.6} />
      <directionalLight position={[-6, 4, -4]} intensity={0.35} />
    </>
  );
}

function Controls() {
  const ref = useRef<CameraControls>(null);
  useEffect(() => {
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
 * Ponds are stacked like floors of a building at y = n × spacing. Changing n
 * moves only the camera — up or down the stack — while the old floor fades out
 * and the new one fades in. Nothing else moves.
 */
function useElevator() {
  const level = useGame((s) => s.level);
  const pond = useGame((s) => s.pond);
  const hasPonds = !!level?.pond;
  const layerY = hasPonds ? pond * POND_SPACING : 0;
  const [leaving, setLeaving] = useState<number[]>([]);
  const prev = useRef<{ level: typeof level; pond: number } | null>(null);

  useEffect(() => {
    cameraRig.layerY = layerY;
    const p = prev.current;
    prev.current = { level, pond };
    if (!level) return;
    const c = cameraRig.controls;
    if (!p || p.level !== level || !hasPonds) {
      // fresh level: place the camera without animation
      const cam = level.camera ?? { x: 0, y: 0 };
      void c?.rotateTo(VIEW.azimuth, VIEW.polar, false);
      void cameraRig.lookAtTile(cam.x, cam.y, (cam.distance ?? 15) * 1.2, false);
      setLeaving([]);
      return;
    }
    if (p.pond === pond) return;
    setLeaving((l) => [...l.filter((q) => q !== pond), p.pond]);
    const t = cameraRig.target();
    useGame.setState({ elevating: true, elevatorDir: Math.sign(pond - p.pond) });
    // Ride straight up or down: the old floor fades away at once, the new
    // floor fades in as the camera arrives.
    void (async () => {
      await c?.moveTo(t.x, layerY, t.z, true);
      useGame.setState({ elevating: false });
    })();
    const timer = setTimeout(() => setLeaving((l) => l.filter((q) => q !== p.pond)), 1200);
    return () => clearTimeout(timer);
  }, [level, pond, layerY, hasPonds]);

  return { layerY, leaving };
}

function LevelScene() {
  const level = useGame((s) => s.level)!;
  const pond = useGame((s) => s.pond);
  const reveal = useGame((s) => s.reveal);
  const valid = useGame((s) => s.valid);
  const formula = useGame((s) => s.formula);
  const cinematic = useGame((s) => s.cinematic);
  const { layerY, leaving } = useElevator();
  useEffect(() => useHover.setState({ tile: null }), [level, pond]);

  if (cinematic) return <BridgeCinematic />;
  return (
    <>
      <Floor
        key={`floor-${pond}`}
        level={level}
        pond={pond}
        y={layerY}
        opacity={1}
        initialOpacity={leaving.length ? 0 : 1}
        fadeSpeed={leaving.length ? 3.5 : 5}
        fadeDelay={leaving.length ? 0.35 : 0}
        interactive
        showStop={reveal.stop}
        showGoal={reveal.goals}
        showAxes={reveal.axes}
        onTile={(x, y) => director.clickTile(x, y)}
      />
      {leaving.map((p) => (
        <Floor
          key={`floor-${p}`}
          level={level}
          pond={p}
          y={p * POND_SPACING}
          opacity={0}
          initialOpacity={1}
          fadeSpeed={6}
          showStop={reveal.stop}
          showGoal={reveal.goals}
          showAxes={reveal.axes}
        />
      ))}
      <group position={[0, layerY, 0]}>
        <AreaLayer
          level={level}
          pond={pond}
          inv={valid?.fast ?? null}
          dim={formula !== null && !formula.ok}
          showStop={reveal.stop}
          showGoal={reveal.goals}
          showEggs={reveal.eggs}
          showArea={reveal.formula}
        />
        <Frogs />
        {reveal.hover && <HoverPreview />}
        <Hand />
      </group>
    </>
  );
}

function DevExpose() {
  const three = useThree();
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __three: three });
  }, [three]);
  return null;
}

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
      onPointerMissed={() => useGame.getState().patch({ selected: null })}
    >
      <Lights />
      <Controls />
      <DevExpose />
      <SceneSwitch />
    </Canvas>
  );
}
