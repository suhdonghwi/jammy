import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { planeExists, planeKey, type CompiledLevel, type Inputs } from '../../levels/level';
import { field } from '../area/field';
import { cameraRig } from '../cameraRig';
import { SLAB_H } from '../constants';
import { goalEvents } from '../goalEvents';
import { hover } from '../hover';
import { sceneNow } from '../sceneTime';
import { axisNameUniforms, colorUniform, getDigitTexture, goalUniforms, setAxisNames, updateFade } from '../shaders/common';
import { inputUniforms, setInputUniforms } from '../shaders/levelGlsl';
import { floorFragment, floorVertex } from './floorShader';

// The floor of a plane: one quad shaded per pixel (see floorShader), which
// fades in and out, follows the camera, and reports the tile under the pointer.

const _p = new THREE.Vector3();
/**
 * The tile under the pointer. A raised slab is hit first: intersect the ray
 * with the slab-top plane and keep that tile if it is raised; otherwise use the
 * floor hit.
 */
function pickTile(e: ThreeEvent<PointerEvent | MouseEvent>): [number, number] {
  const ray = e.ray;
  if (Math.abs(ray.direction.y) > 1e-4) {
    const t = (SLAB_H - ray.origin.y) / ray.direction.y;
    if (t > 0) {
      ray.at(t, _p);
      const tx = Math.round(_p.x);
      const ty = Math.round(-_p.z);
      if (field.heightAt(tx, ty) > 0.5) return [tx, ty];
    }
  }
  return [Math.round(e.point.x), Math.round(-e.point.z)];
}

export interface FloorProps {
  level: CompiledLevel | null;
  /** The plane: the off-axis inputs' values. */
  inputs: Inputs;
  opacity: number;
  /** Opacity to start from (fades toward `opacity`). */
  initialOpacity?: number;
  /** Fade rate (per second). */
  fadeSpeed?: number;
  /** Seconds to hold the initial opacity before fading. */
  fadeDelay?: number;
  interactive?: boolean;
  showStop?: boolean;
  showGoal?: boolean;
  showAxes?: boolean;
  onTile?: (x: number, y: number) => void;
  /** Whether a click on the tile would do something (the pointer cursor shows it). */
  clickable?: (x: number, y: number) => boolean;
}

export function Floor({ level, inputs, opacity, initialOpacity, fadeSpeed = 5, fadeDelay = 0, interactive, showStop = true, showGoal = true, showAxes = true, onTile, clickable }: FloorProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const canvas = useThree((s) => s.gl.domElement);
  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: floorVertex,
      fragmentShader: floorFragment(level),
      transparent: true,
      depthWrite: true,
      uniforms: {
        ...inputUniforms(level),
        uHover: { value: new THREE.Vector2() },
        uHoverOn: { value: 0 },
        uCenter: { value: new THREE.Vector2() },
        uFade: { value: new THREE.Vector2(20, 30) },
        uOpacity: { value: initialOpacity ?? opacity },
        uShowStop: { value: showStop ? 1 : 0 },
        uShowGoal: { value: showGoal ? 1 : 0 },
        uShowAxes: { value: showAxes ? 1 : 0 },
        uDigits: { value: getDigitTexture() },
        ...axisNameUniforms(),
        ...goalUniforms(),
        uTime: { value: 0 },
        uGap: colorUniform('gap'),
        uVoid: colorUniform('void'),
        uTile: colorUniform('tile'),
        uStop: colorUniform('stopTile'),
        uHatch: colorUniform('stopHatch'),
        uEdge: colorUniform('stopEdge'),
        uHoverCol: colorUniform('hover'),
        uCross: colorUniform('cross'),
        uLabel: colorUniform('label'),
      },
    });
    setAxisNames(m.uniforms, level);
    return m;
    // the program only depends on the level
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);
  useEffect(() => () => material.dispose(), [material]);

  const u = material.uniforms;
  // the plane's inputs, set when they change (a check may have moved the view to another plane)
  const key = planeKey(inputs);
  useMemo(() => setInputUniforms(u, level, inputs, level ? planeExists(level, inputs) : true), [u, level, inputs, key]);
  const shows = useRef({ stop: showStop, goal: showGoal, axes: showAxes });
  shows.current = { stop: showStop, goal: showGoal, axes: showAxes };

  const target = useRef(opacity);
  target.current = opacity;
  const born = useRef(sceneNow());

  useFrame((_, frameDt) => {
    // the first frame after the page was hidden carries the whole gap: don't let fades jump
    const dt = Math.min(frameDt, 0.1);
    const m = mesh.current;
    if (!m) return;
    // the plane follows the camera (snapped to whole tiles), as far as the fade reaches
    const R = updateFade(u);
    const t = cameraRig.target();
    m.position.set(Math.round(t.x), 0, Math.round(t.z));
    m.scale.setScalar(R * 2.2);
    u.uTime.value = sceneNow();
    // measured once the font has loaded, so set again as it may change
    setAxisNames(u, level);
    u.uLastEvent.value = goalEvents.fill(u.uEvents.value as THREE.Vector3[], key);
    // revealed elements fade in rather than popping
    const kr = 1 - Math.exp(-dt * 3.2);
    const towards = (cur: number, on: boolean) => {
      const v = cur + ((on ? 1 : 0) - cur) * kr;
      return Math.abs(v - (on ? 1 : 0)) < 0.003 ? (on ? 1 : 0) : v;
    };
    u.uShowStop.value = towards(u.uShowStop.value, shows.current.stop);
    u.uShowGoal.value = towards(u.uShowGoal.value, shows.current.goal);
    u.uShowAxes.value = towards(u.uShowAxes.value, shows.current.axes);
    if (sceneNow() - born.current >= fadeDelay) {
      const k = 1 - Math.exp(-dt * fadeSpeed);
      u.uOpacity.value += (target.current - u.uOpacity.value) * k;
      if (Math.abs(target.current - u.uOpacity.value) < 0.002) u.uOpacity.value = target.current;
    }
    if (interactive && hover.tile) {
      u.uHover.value.set(hover.tile[0], hover.tile[1]);
      u.uHoverOn.value = 1;
    } else u.uHoverOn.value = 0;
    // checked every frame: a tile stops being clickable while the pointer rests on it (its egg hatched, a run started)
    if (interactive) {
      const cursor = hover.tile && clickable?.(hover.tile[0], hover.tile[1]) ? 'pointer' : '';
      if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
    }
    m.visible = u.uOpacity.value > 0.004;
  });

  useEffect(() => {
    if (interactive) return () => void (canvas.style.cursor = '');
  }, [interactive, canvas]);

  const handlers = interactive
    ? {
        onPointerMove: (e: ThreeEvent<PointerEvent>) => hover.set(pickTile(e)),
        onPointerOut: () => hover.set(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return;
          const [tx, ty] = pickTile(e);
          onTile?.(tx, ty);
        },
      }
    : {};

  return (
    <mesh ref={mesh} material={material} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-1} {...handlers}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
