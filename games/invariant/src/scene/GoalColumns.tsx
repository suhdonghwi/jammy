import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CompiledLevel } from '../levels/level';
import { useGame } from '../store/game';
import { clock, COLORS, SLAB_H } from './constants';
import { field, RISE_DUR } from './field';
import { goalEvents } from './goalEvents';
import { MAX_EVENTS } from './shaders';
import { tileState } from './tiles';

// A faint column of light over every goal pool, like a checkpoint pad: brighter
// at its edges and fading upward, with tiny flame-like sparks rising quickly
// inside it. When a frog lands on a goal, its sparks flare up for a moment.

const vertex = /* glsl */ `
attribute vec2 aTile;
attribute vec3 aAnim;
uniform float uTime;
varying float vV;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vTile;
float heightNow() {
  float u = clamp((uTime - aAnim.z) / ${RISE_DUR.toFixed(3)}, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  return mix(aAnim.x, aAnim.y, u) * ${SLAB_H.toFixed(3)};
}
void main() {
  vV = uv.y;
  vTile = aTile;
  vec4 w = modelMatrix * vec4(position + vec3(aTile.x, heightNow() + 0.004, -aTile.y), 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uEvents[${MAX_EVENTS}];
varying float vV;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vTile;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  // hologram look: the column is clearest where it's seen edge-on
  float edge = pow(1.0 - abs(dot(normalize(vN), V)), 1.5);
  float fall = pow(1.0 - vV, 2.4);
  float a = fall * 0.16 * (0.55 + 0.6 * edge);
  // the column glows brighter for a moment when a frog lands here
  float burst = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float age = uTime - e.z;
    if (age < 0.0 || age > 0.9) continue;
    if (abs(e.x - vTile.x) > 0.5 || abs(e.y - vTile.y) > 0.5) continue;
    burst = max(burst, 1.0 - age / 0.9);
  }
  a += fall * 0.16 * burst;
  vec3 col = mix(uColor, vec3(1.0, 0.92, 0.7), 0.35 + burst * 0.3);
  gl_FragColor = vec4(col, min(a, 0.9));
  #include <colorspace_fragment>
}
`;

const MOTES = 16;

const moteVertex = /* glsl */ `
attribute vec2 aTile;
attribute vec3 aAnim;
attribute vec2 aSeed;
uniform float uTime;
uniform float uScale;
uniform vec3 uEvents[${MAX_EVENTS}];
varying float vAlpha;
varying float vCore;
varying float vLife;
float heightNow() {
  float u = clamp((uTime - aAnim.z) / ${RISE_DUR.toFixed(3)}, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  return mix(aAnim.x, aAnim.y, u) * ${SLAB_H.toFixed(3)};
}
void main() {
  // a frog just landed here? motes rise faster and brighter for a moment
  float burst = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float age = uTime - e.z;
    if (age < 0.0 || age > 1.2) continue;
    if (abs(e.x - aTile.x) > 0.5 || abs(e.y - aTile.y) > 0.5) continue;
    burst = max(burst, 1.0 - age / 1.2);
  }
  float s1 = aSeed.x;
  float s2 = aSeed.y;
  // short, quick lives — like sparks leaving a flame
  float speed = (1.05 + 0.7 * s2) * (1.0 + 0.9 * burst);
  float life = fract(uTime * speed + s1);
  float rad = 0.16 * sqrt(fract(s2 * 7.13 + s1 * 3.1));
  float ang = s1 * 53.0 + s2 * 11.0;
  float rise = (0.5 + 0.25 * s2) * (1.0 + 0.4 * burst);
  vec3 p = vec3(cos(ang) * rad, 0.02 + rise * life, sin(ang) * rad);
  // flicker sideways as they rise, drawing in a little toward the centre
  p.x += 0.022 * sin(life * 22.0 + s1 * 40.0) * life;
  p.z += 0.022 * cos(life * 19.0 + s2 * 40.0) * life;
  p.xz *= 1.0 - 0.35 * life;
  vLife = life;
  vAlpha = min(1.0, smoothstep(0.0, 0.08, life) * pow(1.0 - life, 1.1) * 1.25);
  vCore = 0.0;
  float size = (0.042 + 0.016 * s2) * (1.0 - 0.4 * life) * (1.0 + 0.35 * burst);
  vec4 mv = modelViewMatrix * vec4(p + vec3(aTile.x, heightNow(), -aTile.y), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / -mv.z;
}
`;

const moteFragment = /* glsl */ `
varying float vAlpha;
varying float vCore;
varying float vLife;
void main() {
  // a small teardrop: narrow, pointed at the top
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float taper = mix(1.0, 0.35, clamp(-c.y * 0.5 + 0.5, 0.0, 1.0));
  float d = (c.x * c.x) / (0.3 * taper * taper) + c.y * c.y;
  if (d > 1.0) discard;
  float soft = 1.0 - smoothstep(0.55, 1.0, d);
  // yellow when born, deepening to orange as it rises (saturated, to read on white)
  vec3 hot = vec3(1.0, 0.8, 0.16);
  vec3 warm = vec3(1.0, 0.45, 0.08);
  vec3 col = mix(hot, warm, smoothstep(0.15, 0.8, vLife));
  col = mix(col, vec3(1.0, 0.95, 0.75), (1.0 - smoothstep(0.0, 0.25, d)) * 0.35);
  gl_FragColor = vec4(col, soft * vAlpha);
  #include <colorspace_fragment>
}
`;

export function GoalColumns({ level, pond, win, version }: { level: CompiledLevel; pond: number; win: { cx: number; cy: number; R: number }; version: number }) {
  const tiles = useMemo(() => {
    const out: [number, number][] = [];
    const f = level.fast;
    const R = Math.min(win.R, 24);
    for (let y = win.cy - R; y <= win.cy + R; y++) {
      for (let x = win.cx - R; x <= win.cx + R; x++) {
        const s = tileState(level, x, y, pond);
        if (f.pondReq(s) && f.guard(s) !== true && f.post(s) === true) out.push([x, y]);
      }
    }
    return out;
  }, [level, pond, win]);

  const base = useMemo(() => new THREE.CylinderGeometry(0.29, 0.29, 0.75, 40, 1, true).translate(0, 0.375, 0), []);
  const geom = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry().copy(base as unknown as THREE.InstancedBufferGeometry);
    const n = tiles.length;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    tiles.forEach(([x, y], i) => {
      tile.set([x, y], i * 2);
      const a = field.anims.get(`${x},${y}`);
      anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], i * 3);
    });
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
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(COLORS.goal) },
          uEvents: { value: Array.from({ length: MAX_EVENTS }, () => new THREE.Vector3(0, 0, -100)) },
        },
      }),
    [],
  );
  const motes = useMemo(() => {
    const n = tiles.length * MOTES;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    const seed = new Float32Array(n * 2);
    let k = 0;
    for (const [x, y] of tiles) {
      const a = field.anims.get(`${x},${y}`);
      for (let j = 0; j < MOTES; j++, k++) {
        tile.set([x, y], k * 2);
        anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], k * 3);
        seed.set([(j + Math.random() * 0.6) / MOTES, Math.random()], k * 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aTile', new THREE.BufferAttribute(tile, 2));
    g.setAttribute('aAnim', new THREE.BufferAttribute(anim, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, version]);
  useEffect(() => () => motes.dispose(), [motes]);
  const moteMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: moteVertex,
        fragmentShader: moteFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 800 },
          uEvents: { value: Array.from({ length: MAX_EVENTS }, () => new THREE.Vector3(0, 0, -100)) },
        },
      }),
    [],
  );
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useMemo(() => new THREE.Vector2(), []);

  useFrame(() => {
    const t = clock.now();
    material.uniforms.uTime.value = t;
    moteMat.uniforms.uTime.value = t;
    const g = useGame.getState();
    const pondKey = g.level?.pond ? g.pond : undefined;
    goalEvents.fill(material.uniforms.uEvents.value as THREE.Vector3[], pondKey);
    goalEvents.fill(moteMat.uniforms.uEvents.value as THREE.Vector3[], pondKey);
    gl.getDrawingBufferSize(size);
    moteMat.uniforms.uScale.value = (size.y * camera.projectionMatrix.elements[5]) / 2;
  });
  return (
    <>
      <mesh geometry={geom} material={material} frustumCulled={false} renderOrder={6} />
      <points geometry={motes} material={moteMat} frustumCulled={false} renderOrder={7} />
    </>
  );
}
