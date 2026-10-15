import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CompiledLevel } from '../levels/level';
import { useGame } from '../store/game';
import { clock, COLORS, SLAB_H } from './constants';
import { field, RISE_DUR } from './field';
import { goalEvents } from './goalEvents';
import { MAX_EVENTS } from './shaders';
import { tileState } from './tiles';

// A column of warm light over every goal pool, like a checkpoint pad: clearest
// at its edges and fading upward. When a frog lands on a goal, its column
// glows brighter for a moment.

const vertex = /* glsl */ `
attribute vec2 aTile;
attribute vec3 aAnim;
uniform float uTime;
uniform vec3 uEvents[${MAX_EVENTS}];
varying float vV;
varying float vBurst;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vTile;
float heightNow() {
  float u = clamp((uTime - aAnim.z) / ${RISE_DUR.toFixed(3)}, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  return mix(aAnim.x, aAnim.y, u) * ${SLAB_H.toFixed(3)};
}
// 1 right after a frog lands on this goal, falling back to 0
float burstNow() {
  float b = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float age = uTime - e.z;
    if (age < 0.0 || age > 1.0) continue;
    if (abs(e.x - aTile.x) > 0.5 || abs(e.y - aTile.y) > 0.5) continue;
    float u = age / 1.0;
    b = max(b, smoothstep(0.0, 0.06, u) * pow(1.0 - u, 1.6));
  }
  return b;
}
void main() {
  vV = uv.y;
  vTile = aTile;
  float burst = burstNow();
  vBurst = burst;
  // shoot up and widen a little on a landing
  vec3 pos = position * vec3(1.0 + 0.25 * burst, 1.0 + 2.2 * burst, 1.0 + 0.25 * burst);
  vec4 w = modelMatrix * vec4(pos + vec3(aTile.x, heightNow() + 0.004, -aTile.y), 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uEvents[${MAX_EVENTS}];
uniform float uAppearT0;
varying float vV;
varying float vBurst;
varying vec3 vN;
varying vec3 vWorld;
varying vec2 vTile;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  // clearest where the column is seen edge-on
  float edge = pow(1.0 - abs(dot(normalize(vN), V)), 1.4);
  float fall = pow(1.0 - vV, 1.6);
  float a = fall * (0.2 + 0.32 * edge);
  // glow brighter for a moment when a frog lands here
  float burst = vBurst;
  a += (0.25 + 0.45 * edge) * burst * pow(1.0 - vV, 0.8);
  // fade in when the goals are revealed
  a *= smoothstep(0.0, 0.7, uTime - uAppearT0);
  vec3 col = mix(uColor, vec3(1.0, 0.93, 0.72), 0.25 + 0.4 * burst);
  gl_FragColor = vec4(col, min(a, 0.92));
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

  const base = useMemo(() => new THREE.CylinderGeometry(0.3, 0.3, 0.4, 40, 1, true).translate(0, 0.2, 0), []);
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
          uAppearT0: { value: clock.now() },
          uEvents: { value: Array.from({ length: MAX_EVENTS }, () => new THREE.Vector3(0, 0, -100)) },
        },
      }),
    [],
  );
  useFrame(() => {
    material.uniforms.uTime.value = clock.now();
    const g = useGame.getState();
    goalEvents.fill(material.uniforms.uEvents.value as THREE.Vector3[], g.level?.pond ? g.pond : undefined);
  });
  return <mesh geometry={geom} material={material} frustumCulled={false} renderOrder={6} />;
}
