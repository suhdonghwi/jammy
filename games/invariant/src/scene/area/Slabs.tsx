import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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
import { field } from './field';
import { GLSL_HEIGHT, instanced } from './glsl';

const slabVertex = /* glsl */ `
${GLSL_HEIGHT}
attribute vec2 aFlags;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vF;
varying vec2 vFlags;
varying vec2 vTile;
void main() {
  float h = heightNow();
  vec3 p = position;
  p.y += (h - 1.0) * ${SLAB_H.toFixed(3)} - (1.0 - h) * 0.04;
  vec4 w = modelMatrix * vec4(p + vec3(aTile.x, 0.0, -aTile.y), 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vF = vec2(position.x, -position.z);
  vFlags = aFlags;
  vTile = aTile;
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
${GLSL_HEIGHT}
varying vec2 vUv;
varying float vH;
void main() {
  vUv = uv;
  vH = heightNow();
  vec4 w = modelMatrix * vec4(position + vec3(aTile.x, 0.003, -aTile.y), 1.0);
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

export function Slabs({ level, version, dim, showStop, showGoal }: { level: CompiledLevel; version: number; dim: boolean; showStop: boolean; showGoal: boolean }) {
  const base = useMemo(() => {
    const g = new RoundedBoxGeometry(TILE, SLAB_H, TILE, 3, 0.07);
    g.translate(0, SLAB_H / 2, 0);
    return g;
  }, []);
  const shadowBase = useMemo(() => new THREE.PlaneGeometry(1.45, 1.45).rotateX(-Math.PI / 2), []);

  const { geom, shadowGeom } = useMemo(() => {
    const anims = version === 0 ? [] : [...field.anims.values()];
    const n = anims.length;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    const flags = new Float32Array(n * 2);
    anims.forEach((a, i) => {
      tile.set([a.x, a.y], i * 2);
      anim.set([a.from, a.to, a.t0], i * 3);
      flags.set([a.stop ? 1 : 0, a.goal ? 1 : 0], i * 2);
    });
    const geom = instanced(base, n, { aTile: [tile, 2], aAnim: [anim, 3], aFlags: [flags, 2] });
    const shadowGeom = instanced(shadowBase, n, { aTile: [tile, 2], aAnim: [anim, 3] });
    return { geom, shadowGeom };
  }, [version, base, shadowBase]);
  useEffect(() => () => (geom.dispose(), shadowGeom.dispose()), [geom, shadowGeom]);

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
        uniforms: { uTime: material.uniforms.uTime, uMap: { value: getBlobTexture() } },
      }),
    [material],
  );
  useFrame((_, frameDt) => {
    const dt = Math.min(frameDt, 0.1);
    material.uniforms.uTime.value = sceneNow();
    setAxisNames(material.uniforms, level);
    material.uniforms.uLastEvent.value = goalEvents.fill(material.uniforms.uEvents.value as THREE.Vector3[], planeKey(useGame.getState().inputs));
    const ht = hover.tile;
    material.uniforms.uHoverOn.value = ht ? 1 : 0;
    if (ht) material.uniforms.uHover.value.set(ht[0], ht[1]);
    const k = 1 - Math.exp(-dt * 8);
    material.uniforms.uDim.value += ((dim ? 0.55 : 0) - material.uniforms.uDim.value) * k;
    const kr = 1 - Math.exp(-dt * 3.2);
    material.uniforms.uStopAmt.value += ((showStop ? 1 : 0) - material.uniforms.uStopAmt.value) * kr;
    material.uniforms.uGoalAmt.value += ((showGoal ? 1 : 0) - material.uniforms.uGoalAmt.value) * kr;
    updateFade(material.uniforms);
  });
  return (
    <>
      <mesh geometry={shadowGeom} material={shadowMat} frustumCulled={false} renderOrder={1} />
      <mesh geometry={geom} material={material} frustumCulled={false} />
    </>
  );
}
