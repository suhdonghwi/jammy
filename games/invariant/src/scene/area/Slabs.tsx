import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { planeKey, type CompiledLevel } from '../../levels/level';
import { SLAB_H, TILE } from '../constants';
import { goalEvents } from '../goalEvents';
import { hover } from '../hover';
import { sceneNow } from '../sceneTime';
import {
  colorUniform,
  fadeUniforms,
  getBlobTexture,
  axisNameUniforms,
  getDigitTexture,
  GLSL_COMMON,
  GLSL_DIGITS,
  GLSL_FADE,
  GLSL_GOAL,
  goalUniforms,
  setAxisNames,
  updateFade,
} from '../shaders/common';
import { cameraRig } from '../cameraRig';
import { GLSL_MASK, instanced } from './glsl';
import { areaMask, MASK_REACH } from './mask';

const CORNER = 0.07;
const CORNER_STEPS = 3;
const BEVEL = 0.07;

const slabVertex = /* glsl */ `
${GLSL_MASK}
attribute vec2 aOffset;
uniform vec2 uGrid;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vF;
varying vec2 vFlags;
varying vec2 vTile;
varying float vUp;
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
  vUp = position.y;
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
varying float vUp;
uniform vec3 uTop, uSide, uStopTop;
uniform vec2 uHover;
uniform float uHoverOn;
uniform float uDim;
uniform float uStopAmt;
uniform float uGoalAmt;
${GLSL_COMMON}
${GLSL_DIGITS}
${GLSL_GOAL}
${GLSL_FADE}
void main() {
  vec2 fw = fwidth(vF);
  float fwr = fwidth(length(vF));
  float ringD = abs(sdRoundBox(vF, vec2(0.372), 0.1)) - 0.026;
  float fwRing = fwidth(ringD);
  vec3 n = normalize(vN);
  float top = step(0.6, n.y);
  // the bevel along the top edge is shaded, not modelled: the mesh is a plain prism
  if (top > 0.5) {
    vec2 outward = sign(vF) * max(abs(vF) - ${(TILE / 2 - CORNER).toFixed(3)}, 0.0);
    float lean = (1.0 - clamp(-sdRoundBox(vF, vec2(${(TILE / 2).toFixed(3)}), ${CORNER.toFixed(2)}) / ${BEVEL.toFixed(2)}, 0.0, 1.0)) * 0.785;
    if (dot(outward, outward) > 1e-8) {
      outward = normalize(outward);
      n = normalize(vec3(outward.x * sin(lean), cos(lean), -outward.y * sin(lean)));
    }
  } else {
    float lean = (1.0 - clamp((${SLAB_H.toFixed(3)} - vUp) / ${BEVEL.toFixed(2)}, 0.0, 1.0)) * 0.785;
    n = normalize(vec3(n.x * cos(lean), sin(lean), n.z * cos(lean)));
  }
  bool stop = vFlags.x > 0.5 && uStopAmt > 0.002;
  vec3 col;
  if (top > 0.5) {
    col = uTop;
    if (stop) {
      float s = fract((vF.x - vF.y) * 4.0);
      float hatch = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.42, 0.5, s));
      col = mix(uTop, mix(uStopTop, uStopTop * 0.9, hatch), uStopAmt);
    }
    if (stop && vFlags.y > 0.5 && uGoalAmt > 0.002) col = mix(col, drawGoal(col, vF, fwr, vTile), uGoalAmt);
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


function prismGeometry(): THREE.BufferGeometry {
  const half = TILE / 2;
  const rim: [number, number, number, number][] = [];
  for (let c = 0; c < 4; c++) {
    const sx = c === 0 || c === 3 ? 1 : -1;
    const sz = c < 2 ? 1 : -1;
    for (let k = 0; k <= CORNER_STEPS; k++) {
      const a = (c + k / CORNER_STEPS) * (Math.PI / 2);
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      rim.push([sx * (half - CORNER) + nx * CORNER, sz * (half - CORNER) + nz * CORNER, nx, nz]);
    }
  }
  const n = rim.length;
  const position: number[] = [0, SLAB_H, 0];
  const normal: number[] = [0, 1, 0];
  const index: number[] = [];
  for (const [x, z] of rim) {
    position.push(x, SLAB_H, z);
    normal.push(0, 1, 0);
  }
  for (let k = 0; k < n; k++) index.push(0, 1 + ((k + 1) % n), 1 + k);
  const side = 1 + n;
  for (const [x, z, nx, nz] of rim) {
    position.push(x, SLAB_H, z, x, 0, z);
    normal.push(nx, 0, nz, nx, 0, nz);
  }
  for (let k = 0; k < n; k++) {
    const a = side + 2 * k;
    const b = side + 2 * ((k + 1) % n);
    index.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setIndex(index);
  return g;
}

const grid = (() => {
  const cells: [number, number, number][] = [];
  for (let y = -MASK_REACH; y <= MASK_REACH; y++) {
    for (let x = -MASK_REACH; x <= MASK_REACH; x++) {
      const d = Math.hypot(x, y);
      if (d <= MASK_REACH) cells.push([x, y, d]);
    }
  }
  cells.sort((a, b) => a[2] - b[2]);
  const offsets = new Float32Array(cells.length * 2);
  const within = new Uint32Array(MASK_REACH + 1);
  cells.forEach(([x, y, d], i) => {
    offsets.set([x, y], i * 2);
    within.fill(i + 1, Math.ceil(d));
  });
  return { offsets, within };
})();

export function Slabs({ level, dim, showStop, showGoal }: { level: CompiledLevel; dim: boolean; showStop: boolean; showGoal: boolean }) {
  const geoms = useMemo(() => {
    const cells = { aOffset: [grid.offsets, 2] } as const;
    return {
      slabs: instanced(prismGeometry(), 0, cells),
      shadow: instanced(new THREE.PlaneGeometry(1.45, 1.45).rotateX(-Math.PI / 2), 0, cells),
    };
  }, []);
  useEffect(() => () => Object.values(geoms).forEach((g) => g.dispose()), [geoms]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: slabVertex,
        fragmentShader: slabFragment,
        uniforms: {
          uTime: { value: 0 },
          uTop: colorUniform('slabTop'),
          uSide: colorUniform('slabSide'),
          uStopTop: colorUniform('slabStopTop'),
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
  useFrame((_, frameDt) => {
    const dt = Math.min(frameDt, 0.1);
    material.uniforms.uTime.value = sceneNow();
    setAxisNames(material.uniforms, level);
    goalEvents.sync(planeKey(useGame.getState().inputs));
    const ht = hover.tile;
    material.uniforms.uHoverOn.value = ht ? 1 : 0;
    if (ht) material.uniforms.uHover.value.set(ht[0], ht[1]);
    const k = 1 - Math.exp(-dt * 8);
    material.uniforms.uDim.value += ((dim ? 0.55 : 0) - material.uniforms.uDim.value) * k;
    const kr = 1 - Math.exp(-dt * 3.2);
    material.uniforms.uStopAmt.value += ((showStop ? 1 : 0) - material.uniforms.uStopAmt.value) * kr;
    material.uniforms.uGoalAmt.value += ((showGoal ? 1 : 0) - material.uniforms.uGoalAmt.value) * kr;
    const reach = Math.min(MASK_REACH, Math.ceil(updateFade(material.uniforms)));
    const t = cameraRig.target();
    (material.uniforms.uGrid.value as THREE.Vector2).set(Math.round(t.x), Math.round(-t.z));
    geoms.slabs.instanceCount = geoms.shadow.instanceCount = grid.within[reach];
  });
  return (
    <>
      <mesh geometry={geoms.shadow} material={shadowMat} frustumCulled={false} renderOrder={1} />
      <mesh geometry={geoms.slabs} material={material} frustumCulled={false} />
    </>
  );
}
