import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CompiledLevel } from '../../levels/level';
import { BASE, LONG } from '../../motion';
import { cameraRig } from '../cameraRig';
import { SLAB_H, TILE } from '../constants';
import { Toward } from '../easing';
import { hover } from '../hover';
import { sceneNow } from '../sceneTime';
import { axisNameUniforms, getDigitTexture, GLSL_AXIS_LABELS, setAxisNames } from '../shaders/axisLabels';
import { colorUniform, getBlobTexture, GLSL_COMMON } from '../shaders/common';
import { fadeUniforms, GLSL_FADE, updateFade } from '../shaders/fade';
import { GLSL_GOAL, goalUniforms } from '../shaders/goal';
import { GLSL_MASK, instanced } from './glsl';
import { areaMask, MASK_REACH } from './mask';
import { VisibleCells } from './visibleCells';

const CORNER = 0.07;
const BEVEL = 0.07;
const ROUND = [3, 3] as const;
const FACETED = [1, 1] as const;
const FACETED_BELOW_PX = 30;

const slabVertex = /* glsl */ `
${GLSL_MASK}
attribute vec2 aOffset;
uniform vec2 uGrid;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vF;
varying vec2 vFlags;
varying vec2 vTile;
void main() {
  vec2 tile = uGrid + aOffset;
  vec4 m = maskAt(tile);
  float h = heightOf(m);
  if (h < 0.002) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec3 p = position;
  p.y += (h - 1.0) * ${SLAB_H.toFixed(3)} - (1.0 - h) * 0.04;
  vec4 w = modelMatrix * vec4(p + vec3(tile.x, 0.0, -tile.y), 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vF = vec2(position.x, -position.z);
  vFlags = vec2(m.b, mod(floor(m.a * 3.0 + 0.5), 2.0));
  vTile = tile;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const slabFragment = /* glsl */ `
precision highp float;
precision highp int;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vF;
varying vec2 vFlags;
varying vec2 vTile;
uniform vec3 uTop, uSide, uStopCol, uStopHatch;
uniform vec2 uHover;
uniform float uHoverOn;
uniform float uDim;
uniform float uStopAmt;
uniform float uGoalAmt;
${GLSL_COMMON}
${GLSL_AXIS_LABELS}
${GLSL_GOAL}
${GLSL_FADE}
// A slab only lifts the ground: on a stop tile its top shows that tile's ground
// (striped grey, or amber where it is a goal) inside a blue rim.
const float WINDOW = 0.3;
vec3 topColor(float stopFlag, float goalFlag, float hatch, float win) {
  if (stopFlag < 0.5 || uStopAmt < 0.002) return uTop;
  vec3 ground = mix(uStopCol, uStopHatch, hatch);
  if (goalFlag > 0.5 && uGoalAmt > 0.002) ground = mix(ground, goalGround(vTile + vF, vTile), uGoalAmt);
  return mix(uTop, ground, win * uStopAmt);
}
void main() {
  vec2 fw = fwidth(vF);
  float hatchV = (vF.x - vF.y) * STOP_HATCH_FREQ;
  float hatch = stopHatch(hatchV, fwidth(hatchV));
  float winD = sdRoundBox(vF, vec2(WINDOW), 0.07);
  float fwWin = fwidth(winD);
  float win = 1.0 - smoothstep(-fwWin, fwWin, winD);
  float ringD = abs(sdRoundBox(vF, vec2(0.372), 0.1)) - 0.026;
  float fwRing = fwidth(ringD);
  vec3 n = normalize(vN);
  float top = step(0.6, n.y);
  vec3 col;
  if (top > 0.5) {
    col = topColor(vFlags.x, vFlags.y, hatch, win);
    if (uGoalAmt > 0.002) col = mix(col, SPLASH, splashAt(vTile + vF) * 0.45 * uGoalAmt);
    ivec2 t = ivec2(int(floor(vTile.x + 0.5)), int(floor(vTile.y + 0.5)));
    col = mix(col, vec3(1.0), axisLabelMask(vF, t) * 0.85);
    if (uHoverOn > 0.5 && t.x == int(uHover.x) && t.y == int(uHover.y)) {
      col = mix(col, vec3(1.0), (1.0 - smoothstep(-fwRing, fwRing, ringD)) * 0.95);
    }
  } else {
    col = uSide;
  }
  col = shadeLit(col, n);
  col = mix(col, vec3(0.86, 0.88, 0.92), uDim);
  col = applyFade(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const shadowVertex = /* glsl */ `
${GLSL_MASK}
attribute vec2 aOffset;
uniform vec2 uGrid;
varying vec2 vUv;
varying float vH;
void main() {
  vec2 tile = uGrid + aOffset;
  vUv = uv;
  vH = heightOf(maskAt(tile));
  if (vH < 0.002) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec4 w = modelMatrix * vec4(position + vec3(tile.x, 0.003, -tile.y), 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const shadowFragment = /* glsl */ `
varying vec2 vUv;
varying float vH;
uniform sampler2D uMap;
void main() {
  vec4 c = texture2D(uMap, vUv);
  gl_FragColor = vec4(c.rgb, c.a * vH * 0.75);
}
`;


function slabGeometry(cornerSteps: number, bevelSteps: number): THREE.BufferGeometry {
  const half = TILE / 2;
  const rim: [number, number, number, number][] = [];
  for (let c = 0; c < 4; c++) {
    const sx = c === 0 || c === 3 ? 1 : -1;
    const sz = c < 2 ? 1 : -1;
    for (let k = 0; k <= cornerSteps; k++) {
      const a = (c + k / cornerSteps) * (Math.PI / 2);
      rim.push([sx * (half - CORNER), sz * (half - CORNER), Math.cos(a), Math.sin(a)]);
    }
  }
  const n = rim.length;
  const position: number[] = [0, SLAB_H, 0];
  const normal: number[] = [0, 1, 0];
  const ring = (reach: number, y: number, tilt: number) => {
    const first = position.length / 3;
    for (const [x, z, nx, nz] of rim) {
      position.push(x + nx * reach, y, z + nz * reach);
      normal.push(nx * Math.sin(tilt), Math.cos(tilt), nz * Math.sin(tilt));
    }
    return first;
  };
  const rings = Array.from({ length: bevelSteps + 1 }, (_, k) => {
    const tilt = (k / bevelSteps) * (Math.PI / 2);
    return ring(CORNER - BEVEL * (1 - Math.sin(tilt)), SLAB_H - BEVEL * (1 - Math.cos(tilt)), tilt);
  });
  rings.push(ring(CORNER, 0, Math.PI / 2));
  const index: number[] = [];
  for (let k = 0; k < n; k++) {
    const next = (k + 1) % n;
    index.push(0, rings[0] + next, rings[0] + k);
    for (let r = 1; r < rings.length; r++) {
      const upper = rings[r - 1];
      const lower = rings[r];
      index.push(upper + k, upper + next, lower + k, upper + next, lower + next, lower + k);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setIndex(index);
  return g;
}

export function Slabs({ level, dim, showStop, showGoal }: { level: CompiledLevel; dim: boolean; showStop: boolean; showGoal: boolean }) {
  const camera = useThree((three) => three.camera);
  const canvas = useThree((three) => three.gl.domElement);
  const cells = useMemo(() => new VisibleCells(), []);
  const geoms = useMemo(() => {
    const shadow = new THREE.PlaneGeometry(1.45, 1.45).rotateX(-Math.PI / 2);
    const at = (base: THREE.BufferGeometry, offsets: THREE.InstancedBufferAttribute) => {
      const g = instanced(base, 0, {});
      g.setAttribute('aOffset', offsets);
      return g;
    };
    return {
      near: { slabs: at(slabGeometry(...ROUND), cells.near), shadow: at(shadow, cells.near) },
      far: { slabs: at(slabGeometry(...FACETED), cells.far), shadow: at(shadow, cells.far) },
    };
  }, [cells]);
  useEffect(() => () => [geoms.near, geoms.far].forEach((g) => (g.slabs.dispose(), g.shadow.dispose())), [geoms]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: slabVertex,
        fragmentShader: slabFragment,
        uniforms: {
          uTime: { value: 0 },
          uTop: colorUniform('slabTop'),
          uSide: colorUniform('slabSide'),
          uStopCol: colorUniform('stopTile'),
          uStopHatch: colorUniform('stopHatch'),
          ...goalUniforms(),
          uHover: { value: new THREE.Vector2() },
          uHoverOn: { value: 0 },
          uDim: { value: 0 },
          uStopAmt: { value: showStop ? 1 : 0 },
          uGoalAmt: { value: showGoal ? 1 : 0 },
          uDigits: { value: getDigitTexture() },
          ...axisNameUniforms(),
          ...fadeUniforms(),
          ...areaMask.uniforms,
          uGrid: { value: new THREE.Vector2() },
        },
      }),
    [],
  );
  const shadowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: shadowVertex,
        fragmentShader: shadowFragment,
        transparent: true,
        depthWrite: false,
        uniforms: { ...areaMask.uniforms, uGrid: material.uniforms.uGrid, uMap: { value: getBlobTexture() } },
      }),
    [material],
  );
  useEffect(() => () => (material.dispose(), shadowMat.dispose()), [material, shadowMat]);
  useEffect(() => setAxisNames(material.uniforms, level), [material, level]);
  const amounts = useMemo(() => ({ dim: new Toward(0, BASE), stop: new Toward(showStop ? 1 : 0, LONG), goal: new Toward(showGoal ? 1 : 0, LONG) }), []);
  useFrame(() => {
    const t = sceneNow();
    material.uniforms.uTime.value = t;
    const ht = hover.tile;
    material.uniforms.uHoverOn.value = ht ? 1 : 0;
    if (ht) material.uniforms.uHover.value.set(ht[0], ht[1]);
    material.uniforms.uDim.value = amounts.dim.at(dim ? 0.55 : 0, t);
    material.uniforms.uStopAmt.value = amounts.stop.at(showStop ? 1 : 0, t);
    material.uniforms.uGoalAmt.value = amounts.goal.at(showGoal ? 1 : 0, t);
    const reach = Math.min(MASK_REACH, Math.ceil(updateFade(material.uniforms)));
    const target = cameraRig.target();
    (material.uniforms.uGrid.value as THREE.Vector2).set(Math.round(target.x), Math.round(-target.z));
    const tilePxAtUnitDistance = (camera.projectionMatrix.elements[5] * canvas.height) / 2;
    cells.update(camera, target, reach, tilePxAtUnitDistance / FACETED_BELOW_PX);
    geoms.near.slabs.instanceCount = geoms.near.shadow.instanceCount = cells.nearCount;
    geoms.far.slabs.instanceCount = geoms.far.shadow.instanceCount = cells.farCount;
  });
  return (
    <>
      <mesh geometry={geoms.near.shadow} material={shadowMat} frustumCulled={false} renderOrder={1} />
      <mesh geometry={geoms.far.shadow} material={shadowMat} frustumCulled={false} renderOrder={1} />
      <mesh geometry={geoms.near.slabs} material={material} frustumCulled={false} />
      <mesh geometry={geoms.far.slabs} material={material} frustumCulled={false} />
    </>
  );
}
