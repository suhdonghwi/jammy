import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { planeExists, type Inputs } from '../../levels/inputs';
import type { CompiledLevel } from '../../levels/level';
import { field } from '../area/field';
import { cameraRig } from '../cameraRig';
import { SLAB_H } from '../constants';
import { hover } from '../hover';
import { sceneNow } from '../sceneTime';
import { axisNameUniforms, getDigitTexture, setAxisNames } from '../shaders/axisLabels';
import { colorUniform } from '../shaders/common';
import { fadeUniforms, updateFade } from '../shaders/fade';
import { goalUniforms } from '../shaders/goal';
import { floorFragment, floorVertex } from './floorShader';
import { LONG } from '../../motion';
import { Toward } from '../easing';
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
        uHatch: colorUniform('stopHatch'),
        uStop: colorUniform('stopTile'),
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

  const amounts = useMemo(
    () => ({ stop: new Toward(showStop ? 1 : 0, LONG), goal: new Toward(showGoal ? 1 : 0, LONG), axes: new Toward(showAxes ? 1 : 0, LONG), shown: new Toward(fadeIn ? 0 : 1, fadeIn || LONG) }),
    [level],
  );

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    const now = sceneNow();
    setInputUniforms(u, level, inputs, planeExists(level, inputs));
    const R = updateFade(u);
    const t = cameraRig.target();
    m.position.set(Math.round(t.x), 0, Math.round(t.z));
    m.scale.setScalar(R * 2.2);
    u.uTime.value = now;
    u.uShowStop.value = amounts.stop.at(showStop ? 1 : 0, now);
    u.uShowGoal.value = amounts.goal.at(showGoal ? 1 : 0, now);
    u.uShowAxes.value = amounts.axes.at(showAxes ? 1 : 0, now);
    u.uOpacity.value = amounts.shown.at(1, now);
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
