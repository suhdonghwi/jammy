import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { planeKey, type CompiledLevel, type Inputs } from '../../levels/level';
import { eggsNear, type TileWindow } from '../../levels/tiles';
import { SLAB_H } from '../constants';
import { clamp01, smoothstep } from '../easing';
import { frogWorld } from '../frogs/frogWorld';
import { occupancy, slotFor, type Slot } from '../frogs/occupancy';
import { eggGeometry } from '../models';
import { sceneNow } from '../sceneTime';
import { colorUniform, fadeUniforms, getBlobTexture, GLSL_COMMON, GLSL_FADE, updateFade } from '../shaders/common';
import { field } from './field';
import { GLSL_APPEAR, GLSL_BACK, GLSL_HEIGHT, GLSL_SLOT, instanced, SLOT_DUR } from './glsl';

const eggVertex = /* glsl */ `
${GLSL_HEIGHT}
${GLSL_SLOT}
${GLSL_APPEAR}
${GLSL_BACK}
attribute float aHide;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  float h = heightNow();
  vec3 sl = slotNow();
  float s = (1.0 - aHide) * backNow() * sl.z * appearNow();
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
  col += pow(1.0 - max(n.y, 0.0), 3.0) * 0.04;
  col = applyFade(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
const shadowVertex = /* glsl */ `
${GLSL_HEIGHT}
${GLSL_SLOT}
${GLSL_APPEAR}
${GLSL_BACK}
attribute float aHide;
varying vec2 vUv;
varying float vA;
void main() {
  vUv = uv;
  vec3 sl = slotNow();
  vA = (1.0 - aHide) * backNow() * sl.z * clamp(appearNow(), 0.0, 1.0);
  vec4 w = modelMatrix * vec4(position * sl.z + vec3(aTile.x + sl.x, heightNow() * ${SLAB_H.toFixed(3)} + 0.006, -aTile.y - sl.y), 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const shadowFragment = /* glsl */ `
varying vec2 vUv;
varying float vA;
uniform sampler2D uMap;
void main() { vec4 c = texture2D(uMap, vUv); gl_FragColor = vec4(c.rgb, c.a * 0.7 * vA); }
`;

interface SlotAnim {
  fx: number;
  fy: number;
  fs: number;
  tx: number;
  ty: number;
  ts: number;
  t0: number;
}

const PER_FROG_ATTRS = ['aHide', 'aBack', 'aSlot', 'aSlotAnim'] as const;

export function Eggs({ level, inputs, win, version }: { level: CompiledLevel; inputs: Inputs; win: TileWindow; version: number }) {
  const base = useMemo(() => eggGeometry(), []);
  const shadowBase = useMemo(() => new THREE.PlaneGeometry(0.66, 0.66).rotateX(-Math.PI / 2), []);
  const slots = useRef(new Map<string, SlotAnim>());
  const synced = useRef({ geom: null as THREE.BufferGeometry | null, hatch: -1, occ: -1 });

  const key = planeKey(inputs);
  const eggs = useMemo(() => eggsNear(level, inputs, win.cx, win.cy, win.R), [level, key, win]);
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
    eggs.forEach(([x, y], i) => {
      tile.set([x, y], i * 2);
      const a = field.anims.get(`${x},${y}`);
      anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], i * 3);
    });
    const attrs = {
      aTile: [tile, 2],
      aAnim: [anim, 3],
      aHide: [new Float32Array(n), 1],
      aBack: [new Float32Array(n), 1],
      aSlot: [new Float32Array(n * 4), 4],
      aSlotAnim: [new Float32Array(n * 3), 3],
    } as const;
    return { geom: instanced(base, n, attrs), shadowGeom: instanced(shadowBase, n, attrs) };
  }, [eggs, version, base, shadowBase]);
  useEffect(() => () => (geom.dispose(), shadowGeom.dispose()), [geom, shadowGeom]);

  const syncFrogs = () => {
    const s = synced.current;
    if (s.geom === geom && s.hatch === frogWorld.hatchVersion && s.occ === occupancy.version) return;
    synced.current = { geom, hatch: frogWorld.hatchVersion, occ: occupancy.version };
    const hide = geom.getAttribute('aHide').array as Float32Array;
    const back = geom.getAttribute('aBack').array as Float32Array;
    const slot = geom.getAttribute('aSlot').array as Float32Array;
    const slotAnim = geom.getAttribute('aSlotAnim').array as Float32Array;
    const now = sceneNow();
    const visibleEggs = new Set<string>();
    const eggSlots = new Map<string, Slot>();
    eggs.forEach(([x, y], i) => {
      const k = `${x},${y}`;
      const hatched = frogWorld.hatched.has(k);
      hide[i] = hatched ? 1 : 0;
      back[i] = frogWorld.returned.get(k) ?? -100;
      if (!hatched) visibleEggs.add(k);
      const frogs = occupancy.frogs.get(k) ?? 0;
      const target = slotFor(frogs, frogs + 1);
      const prev = slots.current.get(k);
      let cur: SlotAnim = { fx: target.dx, fy: target.dy, fs: target.scale, tx: target.dx, ty: target.dy, ts: target.scale, t0: 0 };
      if (prev) {
        const e = smoothstep(clamp01((now - prev.t0) / SLOT_DUR));
        const at = { x: prev.fx + (prev.tx - prev.fx) * e, y: prev.fy + (prev.ty - prev.fy) * e, s: prev.fs + (prev.ts - prev.fs) * e };
        cur =
          prev.tx === target.dx && prev.ty === target.dy && prev.ts === target.scale
            ? prev
            : { fx: at.x, fy: at.y, fs: at.s, tx: target.dx, ty: target.dy, ts: target.scale, t0: now };
      }
      slots.current.set(k, cur);
      eggSlots.set(k, { dx: cur.tx, dy: cur.ty, scale: cur.ts });
      slot.set([cur.fx, cur.fy, cur.tx, cur.ty], i * 4);
      slotAnim.set([cur.fs, cur.ts, cur.t0], i * 3);
    });
    occupancy.eggs = visibleEggs;
    occupancy.eggSlots = eggSlots;
    for (const g of [geom, shadowGeom]) for (const name of PER_FROG_ATTRS) g.getAttribute(name).needsUpdate = true;
  };

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
        vertexShader: shadowVertex,
        fragmentShader: shadowFragment,
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: material.uniforms.uTime, uMap: { value: getBlobTexture() }, uAppearT0: material.uniforms.uAppearT0, uAppearCenter: material.uniforms.uAppearCenter },
      }),
    [material],
  );
  useFrame(() => {
    syncFrogs();
    material.uniforms.uTime.value = sceneNow();
    updateFade(material.uniforms);
  });
  return (
    <>
      <mesh geometry={shadowGeom} material={shadowMat} frustumCulled={false} renderOrder={2} />
      <mesh geometry={geom} material={material} frustumCulled={false} />
    </>
  );
}
