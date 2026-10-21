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
import { axisNameUniforms, colorUniform, fadeUniforms, getDigitTexture, goalUniforms, setAxisNames, updateFade } from '../shaders/common';
import { floorFragment, floorVertex } from './floorShader';
import { inputUniforms, setInputUniforms } from './levelGlsl';

const _p = new THREE.Vector3();
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

interface FloorProps {
  level: CompiledLevel;
  inputs: Inputs;
  fadeIn?: number;
  interactive?: boolean;
  showStop?: boolean;
  showGoal?: boolean;
  showAxes?: boolean;
  onTile?: (x: number, y: number) => void;
  clickable?: (x: number, y: number) => boolean;
}

export function Floor({ level, inputs, fadeIn = 0, interactive, showStop = true, showGoal = true, showAxes = true, onTile, clickable }: FloorProps) {
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
        ...fadeUniforms(),
        uOpacity: { value: fadeIn ? 0 : 1 },
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
  }, [level]);
  useEffect(() => () => material.dispose(), [material]);

  const u = material.uniforms;
  const key = planeKey(inputs);
  const shows = useRef({ stop: showStop, goal: showGoal, axes: showAxes });
  shows.current = { stop: showStop, goal: showGoal, axes: showAxes };

  useFrame((_, frameDt) => {
    const dt = Math.min(frameDt, 0.1);
    const m = mesh.current;
    if (!m) return;
    setInputUniforms(u, level, inputs, planeExists(level, inputs));
    const R = updateFade(u);
    const t = cameraRig.target();
    m.position.set(Math.round(t.x), 0, Math.round(t.z));
    m.scale.setScalar(R * 2.2);
    u.uTime.value = sceneNow();
    setAxisNames(u, level);
    goalEvents.sync(key);
    const kr = 1 - Math.exp(-dt * 3.2);
    const towards = (cur: number, on: boolean) => {
      const v = cur + ((on ? 1 : 0) - cur) * kr;
      return Math.abs(v - (on ? 1 : 0)) < 0.003 ? (on ? 1 : 0) : v;
    };
    u.uShowStop.value = towards(u.uShowStop.value, shows.current.stop);
    u.uShowGoal.value = towards(u.uShowGoal.value, shows.current.goal);
    u.uShowAxes.value = towards(u.uShowAxes.value, shows.current.axes);
    if (u.uOpacity.value < 1) {
      u.uOpacity.value += (1 - u.uOpacity.value) * (1 - Math.exp(-dt * fadeIn));
      if (1 - u.uOpacity.value < 0.002) u.uOpacity.value = 1;
    }
    if (interactive && hover.tile) {
      u.uHover.value.set(hover.tile[0], hover.tile[1]);
      u.uHoverOn.value = 1;
    } else u.uHoverOn.value = 0;
    if (interactive) {
      const cursor = hover.tile && clickable?.(hover.tile[0], hover.tile[1]) ? 'pointer' : '';
      if (canvas.style.cursor !== cursor) canvas.style.cursor = cursor;
    }
    m.visible = u.uOpacity.value > 0.004;
  });

  useEffect(() => {
    if (!interactive) return;
    return () => {
      canvas.style.cursor = '';
      hover.set(null);
    };
  }, [interactive, canvas]);

  const touch = useRef<{ on: boolean; was: [number, number] | null }>({ on: false, was: null });
  const handlers = interactive
    ? {
        onPointerDown: (e: ThreeEvent<PointerEvent>) => {
          touch.current = { on: e.pointerType === 'touch', was: hover.tile };
          if (touch.current.on) hover.set(null);
        },
        onPointerMove: (e: ThreeEvent<PointerEvent>) => {
          if (e.pointerType !== 'touch') hover.set(pickTile(e));
        },
        onPointerOut: (e: ThreeEvent<PointerEvent>) => {
          if (e.pointerType !== 'touch') hover.set(null);
        },
        onClick: (e: ThreeEvent<MouseEvent>) => {
          if (e.delta > 4) return;
          const [tx, ty] = pickTile(e);
          if (touch.current.on) {
            const was = touch.current.was;
            hover.set(was && was[0] === tx && was[1] === ty ? null : [tx, ty]);
          }
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
