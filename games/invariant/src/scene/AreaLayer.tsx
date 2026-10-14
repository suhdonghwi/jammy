import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CompiledLevel } from '../levels/level';
import type { FastFn } from '../lang/eval';
import { clock, SLAB_H, TILE } from './constants';
import { field, RISE_DUR, type TileFlags } from './field';
import { cameraRig } from './cameraRig';
import { colorUniform, getBlobTexture, getDigitTexture, GLSL_COMMON, GLSL_DIGITS, GLSL_GOAL } from './shaders';
import { hover } from './hover';
import { frogWorld } from './frogSim';
import { eggsNear, tileState } from './tiles';

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
${GLSL_COMMON}
${GLSL_DIGITS}
${GLSL_GOAL}
${FADE_GLSL}
void main() {
  vec2 fw = fwidth(vF);
  float fwr = fwidth(length(vF));
  float ringD = abs(sdRoundBox(vF, vec2(0.42), 0.12)) - 0.03;
  float fwRing = fwidth(ringD);
  vec3 n = normalize(vN);
  float top = step(0.6, n.y);
  bool stop = vFlags.x > 0.5;
  vec3 col;
  if (top > 0.5) {
    col = stop ? uStopTop : uTop;
    if (stop) {
      float s = fract((vF.x - vF.y) * 4.0);
      float hatch = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.42, 0.5, s));
      col = mix(col, col * 0.9, hatch);
    }
    if (vFlags.y > 0.5) col = drawGoal(col, vF, fwr);
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

function eggGeometry() {
  const pts: THREE.Vector2[] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 bottom → 1 top
    const a = Math.PI * t;
    // egg profile: wider near the bottom
    const r = Math.sin(a) * (0.135 - 0.03 * t);
    const y = (1 - Math.cos(a)) * 0.13;
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  return new THREE.LatheGeometry(pts, 28);
}

const eggVertex = /* glsl */ `
${HEIGHT_GLSL}
attribute float aHide;
varying vec3 vN;
varying vec3 vWorld;
varying vec3 vLocal;
void main() {
  float h = heightNow();
  float s = 1.0 - aHide;
  vec3 p = position * s;
  vec4 w = modelMatrix * vec4(p + vec3(aTile.x, h * ${SLAB_H.toFixed(3)}, -aTile.y), 1.0);
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
    const timer = setTimeout(() => field.prune() && setVersion((v) => v + 1), RISE_DUR * 1000 + 60);
    return () => clearTimeout(timer);
  }, [level, pond, inv, win, showArea]);

  return (
    <group>
      <Slabs version={version} dim={dim} showStop={showStop} showGoal={showGoal} />
      {showEggs && <Eggs level={level} pond={pond} win={win} version={version} />}
      {showGoal && <GoalFlags level={level} pond={pond} win={win} version={version} />}
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
    const anims = [...field.anims.values()];
    const n = anims.length;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    const flags = new Float32Array(n * 2);
    anims.forEach((a, i) => {
      tile.set([a.x, a.y], i * 2);
      anim.set([a.from, a.to, a.t0], i * 3);
      flags.set([showStop && a.stop ? 1 : 0, showGoal && a.goal ? 1 : 0], i * 2);
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
  }, [version, showStop, showGoal, base, shadowBase]);
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
          uGoal: colorUniform('goal'),
          uHoverCol: colorUniform('hover'),
          uLabelOn: { value: new THREE.Color('#ffffff') },
          uHover: { value: new THREE.Vector2() },
          uHoverOn: { value: 0 },
          uDim: { value: 0 },
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
  useFrame((_, dt) => {
    const t = clock.now();
    material.uniforms.uTime.value = t;
    shadowMat.uniforms.uTime.value = t;
    const ht = hover.tile;
    material.uniforms.uHoverOn.value = ht ? 1 : 0;
    if (ht) material.uniforms.uHover.value.set(ht[0], ht[1]);
    const k = 1 - Math.exp(-dt * 8);
    material.uniforms.uDim.value += ((dim ? 0.55 : 0) - material.uniforms.uDim.value) * k;
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
  const shadowBase = useMemo(() => new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2), []);
  const [hatchVersion, setHatchVersion] = useState(0);
  useFrame(() => {
    if (frogWorld.hatchVersion !== hatchVersion) setHatchVersion(frogWorld.hatchVersion);
  });

  const eggs = useMemo(() => eggsNear(level, pond, win.cx, win.cy, win.R), [level, pond, win]);

  const { geom, shadowGeom } = useMemo(() => {
    const n = eggs.length;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    const hide = new Float32Array(n);
    eggs.forEach(([x, y], i) => {
      tile.set([x, y], i * 2);
      const a = field.anims.get(`${x},${y}`);
      anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], i * 3);
      hide[i] = frogWorld.hatched.has(`${x},${y}`) ? 1 : 0;
    });
    const geom = new THREE.InstancedBufferGeometry().copy(base as unknown as THREE.InstancedBufferGeometry);
    geom.instanceCount = n;
    geom.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 2));
    geom.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 3));
    geom.setAttribute('aHide', new THREE.InstancedBufferAttribute(hide, 1));
    const shadowGeom = new THREE.InstancedBufferGeometry().copy(shadowBase as unknown as THREE.InstancedBufferGeometry);
    shadowGeom.instanceCount = n;
    shadowGeom.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 2));
    shadowGeom.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 3));
    shadowGeom.setAttribute('aHide', new THREE.InstancedBufferAttribute(hide, 1));
    return { geom, shadowGeom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eggs, version, hatchVersion, base, shadowBase]);
  useEffect(() => () => (geom.dispose(), shadowGeom.dispose()), [geom, shadowGeom]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: eggVertex,
        fragmentShader: eggFragment,
        uniforms: { uTime: { value: 0 }, uEgg: colorUniform('egg'), ...fadeUniforms() },
      }),
    [],
  );
  const shadowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          ${HEIGHT_GLSL}
          attribute float aHide;
          varying vec2 vUv;
          varying float vA;
          void main() {
            vUv = uv;
            vA = 1.0 - aHide;
            vec4 w = modelMatrix * vec4(position + vec3(aTile.x, heightNow() * ${SLAB_H.toFixed(3)} + 0.006, -aTile.y), 1.0);
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          varying float vA;
          uniform sampler2D uMap;
          void main() { vec4 c = texture2D(uMap, vUv); gl_FragColor = vec4(c.rgb, c.a * 0.7 * vA); }`,
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: { value: 0 }, uMap: { value: getBlobTexture() } },
      }),
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


// ---------------------------------------------------------------------------
// Goal flags: a little waving flag on every goal tile (stop region ∧ postcondition).
// ---------------------------------------------------------------------------

function flagGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const part: number[] = [];
  const wave: number[] = [];
  const nrm: number[] = [];
  const push = (g: THREE.BufferGeometry, p: number) => {
    const ng = g.index ? g.toNonIndexed() : g;
    const a = ng.attributes.position.array as ArrayLike<number>;
    const n = ng.attributes.normal.array as ArrayLike<number>;
    for (let i = 0; i < a.length; i += 3) {
      pos.push(a[i], a[i + 1], a[i + 2]);
      nrm.push(n[i], n[i + 1], n[i + 2]);
      part.push(p);
      wave.push(0);
    }
  };
  push(new THREE.CylinderGeometry(0.016, 0.02, 0.5, 10).translate(0, 0.25, 0), 0);
  push(new THREE.SphereGeometry(0.035, 12, 8).translate(0, 0.51, 0), 1);
  // pennant: a triangle subdivided along its length so it can wave
  const N = 10;
  const L = 0.24;
  for (let i = 0; i < N; i++) {
    const a = i / N;
    const b = (i + 1) / N;
    const yt = (u: number) => 0.49 - u * 0.075;
    const yb = (u: number) => 0.33 + u * 0.075;
    const quad = [
      [a * L, yt(a), a],
      [a * L, yb(a), a],
      [b * L, yb(b), b],
      [a * L, yt(a), a],
      [b * L, yb(b), b],
      [b * L, yt(b), b],
    ];
    for (const [x, y, w] of quad) {
      pos.push(x, y, 0);
      nrm.push(0, 0, 1);
      part.push(2);
      wave.push(w);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  g.setAttribute('aWave', new THREE.Float32BufferAttribute(wave, 1));
  return g;
}

const flagVertex = /* glsl */ `
${HEIGHT_GLSL}
attribute float aPart;
attribute float aWave;
varying vec3 vN;
varying vec3 vWorld;
varying float vPart;
varying float vWaveShade;
void main() {
  vec3 p = position;
  float phase = aTile.x * 1.7 + aTile.y * 2.3;
  float w = sin(uTime * 4.2 - aWave * 3.2 + phase);
  p.z += w * 0.045 * aWave;
  p.y += cos(uTime * 4.2 - aWave * 3.2 + phase) * 0.01 * aWave;
  vWaveShade = w * aWave;
  // pole stands at the tile's back-left corner
  vec3 off = vec3(aTile.x - 0.3, heightNow() * ${SLAB_H.toFixed(3)}, -aTile.y - 0.3);
  vec4 world = modelMatrix * vec4(p + off, 1.0);
  vWorld = world.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vPart = aPart;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;
const flagFragment = /* glsl */ `
precision highp float;
varying vec3 vN;
varying vec3 vWorld;
varying float vPart;
varying float vWaveShade;
uniform vec3 uPole, uFlag, uKnob;
${GLSL_COMMON}
${FADE_GLSL}
void main() {
  vec3 col;
  if (vPart < 0.5) col = shadeLit(uPole, normalize(vN));
  else if (vPart < 1.5) col = shadeLit(uKnob, normalize(vN));
  else col = uFlag * (0.92 + 0.14 * vWaveShade) * (gl_FrontFacing ? 1.0 : 0.86);
  col = applyFade(col, vWorld);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function GoalFlags({ level, pond, win, version }: { level: CompiledLevel; pond: number; win: { cx: number; cy: number; R: number }; version: number }) {
  const base = useMemo(() => flagGeometry(), []);
  const tiles = useMemo(() => {
    const out: [number, number][] = [];
    const f = level.fast;
    const R = Math.min(win.R, 26);
    for (let y = win.cy - R; y <= win.cy + R; y++) {
      for (let x = win.cx - R; x <= win.cx + R; x++) {
        const s = tileState(level, x, y, pond);
        if (f.pondReq(s) && f.guard(s) !== true && f.post(s) === true) out.push([x, y]);
      }
    }
    return out;
  }, [level, pond, win]);
  const geom = useMemo(() => {
    const n = tiles.length;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    tiles.forEach(([x, y], i) => {
      tile.set([x, y], i * 2);
      const a = field.anims.get(`${x},${y}`);
      anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], i * 3);
    });
    const g = new THREE.InstancedBufferGeometry().copy(base as unknown as THREE.InstancedBufferGeometry);
    g.instanceCount = n;
    g.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 2));
    g.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, version, base]);
  useEffect(() => () => geom.dispose(), [geom]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: flagVertex,
        fragmentShader: flagFragment,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uPole: { value: new THREE.Color('#7d879a') },
          uFlag: { value: new THREE.Color('#ff7f2a') },
          uKnob: colorUniform('goal'),
          ...fadeUniforms(),
        },
      }),
    [],
  );
  useFrame(() => {
    material.uniforms.uTime.value = clock.now();
    updateFade(material.uniforms);
  });
  return <mesh geometry={geom} material={material} frustumCulled={false} />;
}
