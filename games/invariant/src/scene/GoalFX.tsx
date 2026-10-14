import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CompiledLevel } from '../levels/level';
import { useGame } from '../store/game';
import { clock, COLORS, SLAB_H } from './constants';
import { field, RISE_DUR } from './field';
import { tileState } from './tiles';

// The 3D half of the goal styles being explored: motes orbiting a portal,
// sparks rising from a glowing pad, or a soft beam of light over a ripple.

const HEIGHT = /* glsl */ `
attribute vec2 aTile;
attribute vec3 aAnim;
uniform float uTime;
float heightNow() {
  float u = clamp((uTime - aAnim.z) / ${RISE_DUR.toFixed(3)}, 0.0, 1.0);
  u = u * u * (3.0 - 2.0 * u);
  return mix(aAnim.x, aAnim.y, u) * ${SLAB_H.toFixed(3)};
}
`;

const pointsVertex = /* glsl */ `
${HEIGHT}
attribute vec2 aSeed;
uniform int uMode;
uniform float uScale;
varying float vAlpha;
varying float vCore;
void main() {
  float s1 = aSeed.x;
  float s2 = aSeed.y;
  vec3 p;
  float size;
  if (uMode == 0) {
    // motes orbiting the portal's rim
    float ang = uTime * (1.2 + 0.6 * s2) + s1 * 6.283;
    float rad = 0.31 + 0.03 * sin(uTime * 2.0 + s2 * 6.283);
    p = vec3(cos(ang) * rad, 0.07 + 0.06 * sin(uTime * 2.6 + s2 * 6.283), -sin(ang) * rad);
    vAlpha = 0.85;
    vCore = 0.6;
    size = 0.065 + 0.02 * s2;
  } else {
    // sparks drifting up from the pad
    float life = fract(uTime * (0.32 + 0.18 * s2) + s1);
    float rad = 0.2 * sqrt(s2);
    float ang = s1 * 40.0;
    p = vec3(cos(ang) * rad + 0.04 * sin(life * 6.283 + s2 * 9.0), 0.04 + life * 0.95, sin(ang) * rad);
    vAlpha = sin(life * 3.14159);
    vCore = 1.0 - life;
    size = 0.085 * (1.0 - 0.55 * life);
  }
  vec4 mv = modelViewMatrix * vec4(p + vec3(aTile.x, heightNow(), -aTile.y), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uScale / -mv.z;
}
`;

const pointsFragment = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vCore;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float soft = exp(-d * 3.2);
  vec3 col = mix(uColor, vec3(1.0, 0.98, 0.92), exp(-d * 10.0) * (0.5 + 0.5 * vCore));
  gl_FragColor = vec4(col, soft * vAlpha);
  #include <colorspace_fragment>
}
`;

const beamVertex = /* glsl */ `
${HEIGHT}
varying float vV;
varying float vSeed;
void main() {
  vV = uv.y;
  vSeed = fract(sin(dot(aTile, vec2(12.9898, 78.233))) * 43758.5453);
  vec4 w = modelMatrix * vec4(position + vec3(aTile.x, heightNow(), -aTile.y), 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying float vV;
varying float vSeed;
void main() {
  float pulse = 0.6 + 0.4 * sin(uTime * 2.0 + vSeed * 6.283);
  float a = pow(1.0 - vV, 2.2) * 0.32 * pulse;
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}
`;

export function GoalFX({ level, pond, win, version }: { level: CompiledLevel; pond: number; win: { cx: number; cy: number; R: number }; version: number }) {
  const style = useGame((s) => s.goalStyle);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  const tiles = useMemo(() => {
    const out: [number, number][] = [];
    const f = level.fast;
    const R = Math.min(win.R, 22);
    for (let y = win.cy - R; y <= win.cy + R; y++) {
      for (let x = win.cx - R; x <= win.cx + R; x++) {
        const s = tileState(level, x, y, pond);
        if (f.pondReq(s) && f.guard(s) !== true && f.post(s) === true) out.push([x, y]);
      }
    }
    return out;
  }, [level, pond, win]);

  const perTile = style === 'portal' ? 6 : style === 'sparkle' ? 7 : 0;

  const points = useMemo(() => {
    if (!perTile) return null;
    const n = tiles.length * perTile;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    const seed = new Float32Array(n * 2);
    let k = 0;
    for (const [x, y] of tiles) {
      const a = field.anims.get(`${x},${y}`);
      for (let j = 0; j < perTile; j++, k++) {
        tile.set([x, y], k * 2);
        anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], k * 3);
        seed.set([(j + Math.random() * 0.5) / perTile, Math.random()], k * 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aTile', new THREE.BufferAttribute(tile, 2));
    g.setAttribute('aAnim', new THREE.BufferAttribute(anim, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 2));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, perTile, version]);

  const beams = useMemo(() => {
    if (style !== 'ripple') return null;
    const base = new THREE.CylinderGeometry(0.17, 0.2, 1.15, 28, 1, true).translate(0, 0.575, 0);
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
  }, [tiles, style, version]);

  useEffect(() => () => points?.dispose(), [points]);
  useEffect(() => () => beams?.dispose(), [beams]);

  const pointsMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pointsVertex,
        fragmentShader: pointsFragment,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uMode: { value: 0 },
          uScale: { value: 800 },
          uColor: { value: new THREE.Color(COLORS.portalB) },
        },
      }),
    [],
  );
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(COLORS.goalGlow) } },
      }),
    [],
  );
  const size = useMemo(() => new THREE.Vector2(), []);
  useFrame(() => {
    const t = clock.now();
    pointsMat.uniforms.uTime.value = t;
    beamMat.uniforms.uTime.value = t;
    pointsMat.uniforms.uMode.value = style === 'portal' ? 0 : 1;
    (pointsMat.uniforms.uColor.value as THREE.Color).set(style === 'portal' ? COLORS.portalA : COLORS.goal);
    gl.getDrawingBufferSize(size);
    pointsMat.uniforms.uScale.value = (size.y * camera.projectionMatrix.elements[5]) / 2;
  });

  return (
    <>
      {points && <points geometry={points} material={pointsMat} frustumCulled={false} renderOrder={5} />}
      {beams && <mesh geometry={beams} material={beamMat} frustumCulled={false} renderOrder={5} />}
    </>
  );
}
