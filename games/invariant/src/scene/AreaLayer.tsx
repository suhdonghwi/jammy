import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CompiledLevel } from '../levels/level';
import type { FastFn } from '../lang/eval';
import { clock, SLAB_H, TILE } from './constants';
import { field, RISE_DUR, type TileFlags } from './field';
import { cameraRig } from './cameraRig';
import { colorUniform, getBlobTexture, getDigitTexture, GLSL_COMMON, GLSL_DIGITS, GLSL_GOAL, goalUniforms } from './shaders';
import { useGame } from '../store/game';
import { hover } from './hover';
import { frogWorld } from './frogSim';
import { eggsNear, tileState } from './tiles';
import { occupancy, slotFor, type Slot } from './occupancy';
import { goalEvents } from './goalEvents';
import { GoalColumns } from './GoalColumns';
import { after } from './sceneTime';

const HEIGHT_GLSL = /* glsl */ `
attribute vec2 aTile;
attribute vec3 aAnim;
uniform float uTime;
float heightNow() {
  float u = clamp((uTime - aAnim.z) / ${RISE_DUR.toFixed(3)}, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  return mix(aAnim.x, aAnim.y, u);
}
`;

const FADE_GLSL = /* glsl */ `
uniform vec2 uCenter;
uniform vec2 uFade;
uniform vec3 uHorizon;
vec3 applyFade(vec3 col, vec3 world) {
  float r = length(world.xz - uCenter);
  return mix(col, uHorizon, smoothstep(uFade.x, uFade.y, r));
}
`;

// ---------------------------------------------------------------------------
// Slabs: rounded, rising out of the floor.
// ---------------------------------------------------------------------------

const slabVertex = /* glsl */ `
${HEIGHT_GLSL}
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
uniform vec3 uTop, uSide, uStopTop, uHoverCol, uLabelOn;
uniform vec2 uHover;
uniform float uHoverOn;
uniform float uDim;
uniform float uStopAmt;
uniform float uGoalAmt;
${GLSL_COMMON}
${GLSL_DIGITS}
${GLSL_GOAL}
${FADE_GLSL}
void main() {
  vec2 fw = fwidth(vF);
  float fwr = fwidth(length(vF));
  // hover outline: kept on the flat top (the 0.07 bevel starts at 0.38), with
  // corners rounded to match, so it never runs onto the bevel and breaks up
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
    float m = 0.0;
    if (t.y == 0) m = numberMask(vF, t.x);
    else if (t.x == 0) m = numberMask(vF, t.y);
    col = mix(col, uLabelOn, m * 0.85);
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
${HEIGHT_GLSL}
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

// ---------------------------------------------------------------------------
// Eggs
// ---------------------------------------------------------------------------

export function eggGeometry() {
  const pts: THREE.Vector2[] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 bottom → 1 top
    const a = Math.PI * t;
    // egg profile: wider near the bottom
    const r = Math.sin(a) * (0.19 - 0.042 * t);
    const y = (1 - Math.cos(a)) * 0.182;
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  return new THREE.LatheGeometry(pts, 28);
}

// Eggs make room when a frog shares their tile: offset and scale glide from
// (from) to (to) starting at t0.
const SLOT_GLSL = /* glsl */ `
attribute vec4 aSlot;      // from.xy, to.xy
attribute vec3 aSlotAnim;  // from scale, to scale, t0
vec3 slotNow() {
  float u = clamp((uTime - aSlotAnim.z) / 0.3, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  return vec3(mix(aSlot.xy, aSlot.zw, u), mix(aSlotAnim.x, aSlotAnim.y, u));
}
`;

// Eggs pop in when revealed, rippling out from the centre of the view.
const APPEAR_GLSL = /* glsl */ `
uniform float uAppearT0;
uniform vec2 uAppearCenter;
float appearNow() {
  float delay = min(length(aTile - uAppearCenter) * 0.035, 0.7);
  float a = clamp((uTime - uAppearT0 - delay) / 0.38, 0.0, 1.0);
  // ease out with a little overshoot
  float c1 = 1.70158;
  float c3 = c1 + 1.0;
  return a <= 0.0 ? 0.0 : 1.0 + c3 * pow(a - 1.0, 3.0) + c1 * pow(a - 1.0, 2.0);
}
`;

const eggVertex = /* glsl */ `
${HEIGHT_GLSL}
${SLOT_GLSL}
${APPEAR_GLSL}
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
${FADE_GLSL}
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

function fadeUniforms() {
  return {
    uCenter: { value: new THREE.Vector2() },
    uFade: { value: new THREE.Vector2(20, 30) },
    uHorizon: colorUniform('horizon'),
  };
}

function updateFade(u: Record<string, THREE.IUniform>) {
  const t = cameraRig.target();
  const d = cameraRig.distance();
  const R = Math.max(26, d * 2.6);
  (u.uCenter.value as THREE.Vector2).set(t.x, t.z);
  (u.uFade.value as THREE.Vector2).set(R * 0.62, R);
}

// ---------------------------------------------------------------------------

export interface AreaLayerProps {
  level: CompiledLevel;
  pond: number;
  inv: FastFn | null;
  dim: boolean;
  showStop: boolean;
  showGoal: boolean;
  showEggs: boolean;
  showArea: boolean;
}

function useTileWindow() {
  const [win, setWin] = useState({ cx: 0, cy: 0, R: 18 });
  const ref = useRef(win);
  useFrame(() => {
    const t = cameraRig.target();
    const d = cameraRig.distance();
    const cx = Math.round(t.x);
    const cy = Math.round(-t.z);
    const R = Math.min(40, Math.max(16, Math.ceil((d * 1.7) / 4) * 4));
    const c = ref.current;
    if (Math.abs(cx - c.cx) > 3 || Math.abs(cy - c.cy) > 3 || R !== c.R) {
      ref.current = { cx, cy, R };
      setWin(ref.current);
    }
  });
  return win;
}

export function AreaLayer({ level, pond, inv, dim, showStop, showGoal, showEggs, showArea }: AreaLayerProps) {
  const win = useTileWindow();
  const [version, setVersion] = useState(0);
  const last = useRef<{ key: string; inv: FastFn | null; showArea: boolean } | null>(null);

  // Recompute the area for the window. Slabs animate when the formula (or the
  // pond) changes — not when the window merely follows the camera.
  useEffect(() => {
    const key = `${level.id}|${pond}`;
    const prev = last.current;
    if (!prev || prev.key !== key) field.reset();
    const animate = !prev || prev.key !== key || prev.inv !== inv || prev.showArea !== showArea;
    last.current = { key, inv, showArea };
    const tiles: TileFlags[] = [];
    if (inv && showArea) {
      const f = level.fast;
      const { cx, cy, R } = win;
      for (let y = cy - R; y <= cy + R; y++) {
        for (let x = cx - R; x <= cx + R; x++) {
          const s = tileState(level, x, y, pond);
          if (!f.pondReq(s) || inv(s) !== true) continue;
          const stop = f.guard(s) !== true;
          tiles.push({ x, y, stop, goal: stop && f.post(s) === true });
        }
      }
    }
    field.update(tiles, animate);
    setVersion((v) => v + 1);
    return after(RISE_DUR * 1000 + 60, () => field.prune() && setVersion((v) => v + 1));
  }, [level, pond, inv, win, showArea]);

  return (
    <group>
      <Slabs version={version} dim={dim} showStop={showStop} showGoal={showGoal} />
      {showEggs && <Eggs level={level} pond={pond} win={win} version={version} />}
      {showGoal && <GoalColumns level={level} pond={pond} win={win} version={version} />}
    </group>
  );
}

export function Slabs({ version, dim, showStop, showGoal }: { version: number; dim: boolean; showStop: boolean; showGoal: boolean }) {
  const base = useMemo(() => {
    const g = new RoundedBoxGeometry(TILE, SLAB_H, TILE, 3, 0.07);
    g.translate(0, SLAB_H / 2, 0);
    return g;
  }, []);
  const shadowBase = useMemo(() => new THREE.PlaneGeometry(1.45, 1.45).rotateX(-Math.PI / 2), []);

  const { geom, shadowGeom } = useMemo(() => {
    // version 0: this layer's area hasn't been computed yet — draw nothing
    // (the shared field may still hold another scene's slabs for a frame)
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
    const geom = new THREE.InstancedBufferGeometry().copy(base as unknown as THREE.InstancedBufferGeometry);
    geom.instanceCount = n;
    geom.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 2));
    geom.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 3));
    geom.setAttribute('aFlags', new THREE.InstancedBufferAttribute(flags, 2));
    const shadowGeom = new THREE.InstancedBufferGeometry().copy(shadowBase as unknown as THREE.InstancedBufferGeometry);
    shadowGeom.instanceCount = n;
    shadowGeom.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 2));
    shadowGeom.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 3));
    return { geom, shadowGeom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          uHoverCol: colorUniform('hover'),
          uLabelOn: { value: new THREE.Color('#ffffff') },
          uHover: { value: new THREE.Vector2() },
          uHoverOn: { value: 0 },
          uDim: { value: 0 },
          uStopAmt: { value: showStop ? 1 : 0 },
          uGoalAmt: { value: showGoal ? 1 : 0 },
          uDigits: { value: getDigitTexture() },
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
        uniforms: { uTime: { value: 0 }, uMap: { value: getBlobTexture() } },
      }),
    [],
  );
  useFrame((_, frameDt) => {
    // the first frame after the page was hidden carries the whole gap: don't let fades jump
    const dt = Math.min(frameDt, 0.1);
    const t = clock.now();
    material.uniforms.uTime.value = t;
    shadowMat.uniforms.uTime.value = t;
    const g = useGame.getState();
    material.uniforms.uLastEvent.value = goalEvents.fill(material.uniforms.uEvents.value as THREE.Vector3[], g.level?.pond ? g.pond : undefined);
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

function Eggs({ level, pond, win, version }: { level: CompiledLevel; pond: number; win: { cx: number; cy: number; R: number }; version: number }) {
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
    const now = clock.now();
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
        const e = u * u * (3 - 2 * u);
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
          uAppearT0: { value: clock.now() },
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
          ${HEIGHT_GLSL}
          ${SLOT_GLSL}
          ${APPEAR_GLSL}
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
    const t = clock.now();
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


