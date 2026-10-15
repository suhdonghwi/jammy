import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { CompiledLevel } from '../../levels/level';
import { SLAB_H } from '../constants';
import { frogWorld } from '../frogs/frogWorld';
import { occupancy, slotFor, type Slot } from '../frogs/occupancy';
import { eggGeometry } from '../models';
import { sceneNow } from '../sceneTime';
import { colorUniform, fadeUniforms, getBlobTexture, GLSL_COMMON, GLSL_FADE, updateFade } from '../shaders/common';
import { eggsNear, type TileWindow } from '../tiles';
import { field } from './field';
import { GLSL_APPEAR, GLSL_HEIGHT, GLSL_SLOT } from './glsl';
import { smoothstep } from '../easing';

// The eggs: every start state the precondition allows, one per tile. A hatched
// egg is hidden; an egg sharing its tile with frogs moves into a slot.

const eggVertex = /* glsl */ `
${GLSL_HEIGHT}
${GLSL_SLOT}
${GLSL_APPEAR}
attribute float aHide;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  float h = heightNow();
  vec3 sl = slotNow();
  float s = (1.0 - aHide) * sl.z * appearNow();
  vec3 p = position * s;
  vec4 w = modelMatrix * vec4(p + vec3(aTile.x + sl.x, h * ${SLAB_H.toFixed(3)}, -aTile.y - sl.y), 1.0);
  vWorld = w.xyz;
  vLocal = position;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const eggFragment = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
uniform vec3 uEgg;
${GLSL_COMMON}
${GLSL_FADE}
float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 n = normalize(vN);
  vec3 cell = floor(vLocal * 60.0);
  float speck = step(0.93, hash(cell)) * 0.12;
  vec3 col = uEgg * (1.0 - speck);
  col = shadeLit(col, n);
  // soft rim light
  col += pow(1.0 - max(n.y, 0.0), 3.0) * 0.04;
  col = applyFade(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function Eggs({ level, pond, win, version }: { level: CompiledLevel; pond: number; win: TileWindow; version: number }) {
  const base = useMemo(() => eggGeometry(), []);
  const shadowBase = useMemo(() => new THREE.PlaneGeometry(0.66, 0.66).rotateX(-Math.PI / 2), []);
  const [hatchVersion, setHatchVersion] = useState(0);
  const [occVersion, setOccVersion] = useState(0);
  useFrame(() => {
    if (frogWorld.hatchVersion !== hatchVersion) setHatchVersion(frogWorld.hatchVersion);
    if (occupancy.version !== occVersion) setOccVersion(occupancy.version);
  });
  /** Current slot animation per egg tile, so changes continue from where they are. */
  const slots = useRef(new Map<string, { fx: number; fy: number; fs: number; tx: number; ty: number; ts: number; t0: number }>());

  const eggs = useMemo(() => eggsNear(level, pond, win.cx, win.cy, win.R), [level, pond, win]);
  // when eggs are hidden or this layer goes away, frogs must not make room for them
  useEffect(
    () => () => {
      occupancy.eggs = new Set();
    },
    [],
  );

  const { geom, shadowGeom } = useMemo(() => {
    const n = eggs.length;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    const hide = new Float32Array(n);
    const slot = new Float32Array(n * 4);
    const slotAnim = new Float32Array(n * 3);
    const now = sceneNow();
    const visibleEggs = new Set<string>();
    const eggSlots = new Map<string, Slot>();
    eggs.forEach(([x, y], i) => {
      const key = `${x},${y}`;
      tile.set([x, y], i * 2);
      const a = field.anims.get(key);
      anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], i * 3);
      const hatched = frogWorld.hatched.has(key);
      hide[i] = hatched ? 1 : 0;
      if (!hatched) visibleEggs.add(key);
      // the egg takes the last slot after any frogs settled on its tile
      const frogs = occupancy.frogs.get(key) ?? 0;
      const target = slotFor(frogs, frogs + 1);
      const prev = slots.current.get(key);
      let cur = { fx: target.dx, fy: target.dy, fs: target.scale, tx: target.dx, ty: target.dy, ts: target.scale, t0: 0 };
      if (prev) {
        const u = Math.min(1, Math.max(0, (now - prev.t0) / 0.3));
        const e = smoothstep(u);
        const at = { x: prev.fx + (prev.tx - prev.fx) * e, y: prev.fy + (prev.ty - prev.fy) * e, s: prev.fs + (prev.ts - prev.fs) * e };
        cur =
          prev.tx === target.dx && prev.ty === target.dy && prev.ts === target.scale
            ? prev
            : { fx: at.x, fy: at.y, fs: at.s, tx: target.dx, ty: target.dy, ts: target.scale, t0: now };
      }
      slots.current.set(key, cur);
      eggSlots.set(key, { dx: cur.tx, dy: cur.ty, scale: cur.ts });
      slot.set([cur.fx, cur.fy, cur.tx, cur.ty], i * 4);
      slotAnim.set([cur.fs, cur.ts, cur.t0], i * 3);
    });
    occupancy.eggs = visibleEggs;
    occupancy.eggSlots = eggSlots;
    const geom = new THREE.InstancedBufferGeometry().copy(base as unknown as THREE.InstancedBufferGeometry);
    geom.instanceCount = n;
    geom.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 2));
    geom.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 3));
    geom.setAttribute('aHide', new THREE.InstancedBufferAttribute(hide, 1));
    geom.setAttribute('aSlot', new THREE.InstancedBufferAttribute(slot, 4));
    geom.setAttribute('aSlotAnim', new THREE.InstancedBufferAttribute(slotAnim, 3));
    const shadowGeom = new THREE.InstancedBufferGeometry().copy(shadowBase as unknown as THREE.InstancedBufferGeometry);
    shadowGeom.instanceCount = n;
    shadowGeom.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 2));
    shadowGeom.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 3));
    shadowGeom.setAttribute('aHide', new THREE.InstancedBufferAttribute(hide, 1));
    shadowGeom.setAttribute('aSlot', new THREE.InstancedBufferAttribute(slot, 4));
    shadowGeom.setAttribute('aSlotAnim', new THREE.InstancedBufferAttribute(slotAnim, 3));
    return { geom, shadowGeom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eggs, version, hatchVersion, occVersion, base, shadowBase]);
  useEffect(() => () => (geom.dispose(), shadowGeom.dispose()), [geom, shadowGeom]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: eggVertex,
        fragmentShader: eggFragment,
        uniforms: {
          uTime: { value: 0 },
          uEgg: colorUniform('egg'),
          uAppearT0: { value: sceneNow() },
          uAppearCenter: { value: new THREE.Vector2(win.cx, win.cy) },
          ...fadeUniforms(),
        },
      }),
    [],
  );
  const shadowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          ${GLSL_HEIGHT}
          ${GLSL_SLOT}
          ${GLSL_APPEAR}
          attribute float aHide;
          varying vec2 vUv;
          varying float vA;
          void main() {
            vUv = uv;
            vec3 sl = slotNow();
            vA = (1.0 - aHide) * sl.z * clamp(appearNow(), 0.0, 1.0);
            vec4 w = modelMatrix * vec4(position * sl.z + vec3(aTile.x + sl.x, heightNow() * ${SLAB_H.toFixed(3)} + 0.006, -aTile.y - sl.y), 1.0);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          varying float vA;
          uniform sampler2D uMap;
          void main() { vec4 c = texture2D(uMap, vUv); gl_FragColor = vec4(c.rgb, c.a * 0.7 * vA); }`,
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uMap: { value: getBlobTexture() }, uAppearT0: material.uniforms.uAppearT0, uAppearCenter: material.uniforms.uAppearCenter },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useFrame(() => {
    const t = sceneNow();
    material.uniforms.uTime.value = t;
    shadowMat.uniforms.uTime.value = t;
    updateFade(material.uniforms);
  });
  return (
    <>
      <mesh geometry={shadowGeom} material={shadowMat} frustumCulled={false} renderOrder={2} />
      <mesh geometry={geom} material={material} frustumCulled={false} />
    </>
  );
}
