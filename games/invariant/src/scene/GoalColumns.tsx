import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CompiledLevel } from '../levels/level';
import { useGame } from '../store/game';
import { clock, SLAB_H } from './constants';
import { field, RISE_DUR } from './field';
import { goalEvents } from './goalEvents';
import { MAX_EVENTS } from './shaders';
import { tileState } from './tiles';

// A portal-like column over every goal pool, made only of sparks: tiny flames
// rise from the pool's rim, evenly spread around it with a slight swirl, and
// fade out toward the top — together they trace a cylinder of light. When a
// frog lands on a goal, that column speeds up and flares for a moment.

const SPARKS = 64;
const RIM = 0.29;
const HEIGHT = 0.62;

const vertex = /* glsl */ `
attribute vec2 aTile;
attribute vec3 aAnim;
attribute vec2 aSeed;
uniform float uTime;
uniform float uScale;
uniform vec3 uEvents[${MAX_EVENTS}];
varying float vAlpha;
varying float vLife;
float heightNow() {
  float u = clamp((uTime - aAnim.z) / ${RISE_DUR.toFixed(3)}, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  return mix(aAnim.x, aAnim.y, u) * ${SLAB_H.toFixed(3)};
}
void main() {
  // a frog just landed here? the column flares
  float burst = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float age = uTime - e.z;
    if (age < 0.0 || age > 1.2) continue;
    if (abs(e.x - aTile.x) > 0.5 || abs(e.y - aTile.y) > 0.5) continue;
    burst = max(burst, 1.0 - age / 1.2);
  }
  float s1 = aSeed.x; // position around the rim (0..1)
  float s2 = aSeed.y; // random
  float speed = (0.62 + 0.3 * s2) * (1.0 + 1.1 * burst);
  float life = fract(uTime * speed + s2 * 13.7);
  // evenly around the rim, swirling slowly as they rise
  float ang = s1 * 6.28318 + life * 0.7 + uTime * 0.25;
  float rad = ${RIM.toFixed(3)} + 0.012 * sin(life * 17.0 + s2 * 30.0);
  vec3 p = vec3(cos(ang) * rad, 0.015 + life * ${HEIGHT.toFixed(3)} * (1.0 + 0.3 * burst), -sin(ang) * rad);
  vLife = life;
  vAlpha = smoothstep(0.0, 0.07, life) * pow(1.0 - life, 1.15) * (0.9 + 0.3 * burst);
  float size = (0.032 + 0.012 * s2) * (1.0 - 0.45 * life) * (1.0 + 0.3 * burst);
  vec4 mv = modelViewMatrix * vec4(p + vec3(aTile.x, heightNow(), -aTile.y), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / -mv.z;
}
`;

const fragment = /* glsl */ `
varying float vAlpha;
varying float vLife;
void main() {
  // a small teardrop: narrow, pointed at the top
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float taper = mix(1.0, 0.35, clamp(-c.y * 0.5 + 0.5, 0.0, 1.0));
  float d = (c.x * c.x) / (0.3 * taper * taper) + c.y * c.y;
  if (d > 1.0) discard;
  float soft = 1.0 - smoothstep(0.55, 1.0, d);
  // yellow at the rim, deepening to orange as it rises
  vec3 col = mix(vec3(1.0, 0.8, 0.16), vec3(1.0, 0.45, 0.08), smoothstep(0.15, 0.85, vLife));
  col = mix(col, vec3(1.0, 0.95, 0.75), (1.0 - smoothstep(0.0, 0.25, d)) * 0.35);
  gl_FragColor = vec4(col, soft * min(vAlpha, 1.0));
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

  const geom = useMemo(() => {
    const n = tiles.length * SPARKS;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    const seed = new Float32Array(n * 2);
    let k = 0;
    for (const [x, y] of tiles) {
      const a = field.anims.get(`${x},${y}`);
      for (let j = 0; j < SPARKS; j++, k++) {
        tile.set([x, y], k * 2);
        anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], k * 3);
        seed.set([(j + Math.random() * 0.5) / SPARKS, Math.random()], k * 2);
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
  useEffect(() => () => geom.dispose(), [geom]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
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
    material.uniforms.uTime.value = clock.now();
    const g = useGame.getState();
    goalEvents.fill(material.uniforms.uEvents.value as THREE.Vector3[], g.level?.pond ? g.pond : undefined);
    gl.getDrawingBufferSize(size);
    material.uniforms.uScale.value = (size.y * camera.projectionMatrix.elements[5]) / 2;
  });
  return <points geometry={geom} material={material} frustumCulled={false} renderOrder={7} />;
}
