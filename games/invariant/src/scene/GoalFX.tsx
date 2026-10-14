import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { CompiledLevel } from '../levels/level';
import { useGame } from '../store/game';
import { clock, COLORS, SLAB_H } from './constants';
import { field, RISE_DUR } from './field';
import { tileState } from './tiles';

// The 3D half of the 'ripple' goal style: a soft beam of light over each goal.

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

  useEffect(() => () => beams?.dispose(), [beams]);

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
  useFrame(() => {
    beamMat.uniforms.uTime.value = clock.now();
  });

  return (
    <>
      {beams && <mesh geometry={beams} material={beamMat} frustumCulled={false} renderOrder={5} />}
    </>
  );
}
