import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { planeKey, type CompiledLevel, type Inputs } from '../../levels/level';
import { tilesNear, type TileWindow } from '../../levels/tiles';
import { COLORS, SLAB_H } from '../constants';
import { goalEvents, MAX_EVENTS } from '../goalEvents';
import { sceneNow } from '../sceneTime';
import { field } from './field';
import { GLSL_HEIGHT, instanced } from './glsl';

const vertex = /* glsl */ `
${GLSL_HEIGHT}
uniform vec3 uEvents[${MAX_EVENTS}];
varying float vV;
varying float vBurst;
varying vec3 vN;
varying vec3 vWorld;
float burstNow() {
  float b = 0.0;
  for (int i = 0; i < ${MAX_EVENTS}; i++) {
    vec3 e = uEvents[i];
    float age = uTime - e.z;
    if (age < 0.0 || age > 1.0) continue;
    if (abs(e.x - aTile.x) > 0.5 || abs(e.y - aTile.y) > 0.5) continue;
    b = max(b, smoothstep(0.0, 0.06, age) * pow(1.0 - age, 1.6));
  }
  return b;
}
void main() {
  vV = uv.y;
  float burst = burstNow();
  vBurst = burst;
  vec3 pos = position * vec3(1.0 + 0.25 * burst, 1.0 + 2.2 * burst, 1.0 + 0.25 * burst);
  vec4 w = modelMatrix * vec4(pos + vec3(aTile.x, heightNow() * ${SLAB_H.toFixed(3)} + 0.004, -aTile.y), 1.0);
  vWorld = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragment = /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
uniform float uAppearT0;
varying float vV;
varying float vBurst;
varying vec3 vN;
varying vec3 vWorld;
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = pow(1.0 - abs(dot(normalize(vN), V)), 1.4);
  float fall = pow(1.0 - vV, 1.6);
  float a = fall * (0.2 + 0.32 * edge);
  a += (0.25 + 0.45 * edge) * vBurst * pow(1.0 - vV, 0.8);
  a *= smoothstep(0.0, 0.7, uTime - uAppearT0);
  vec3 col = mix(uColor, vec3(1.0, 0.93, 0.72), 0.25 + 0.4 * vBurst);
  gl_FragColor = vec4(col, min(a, 0.92));
  #include <colorspace_fragment>
}
`;

export function GoalColumns({
  level,
  inputs,
  win,
  version,
}: {
  level: CompiledLevel;
  inputs: Inputs;
  win: TileWindow;
  version: number;
}) {
  const key = planeKey(inputs);
  const tiles = useMemo(() => {
    const f = level.fast;
    return tilesNear(level, inputs, { ...win, R: Math.min(win.R, 24) }, (s, x, y) => (f.planeReq(s) && f.guard(s) !== true && f.post(s) === true ? [x, y] : undefined));
  }, [level, key, win]);

  const base = useMemo(() => new THREE.CylinderGeometry(0.3, 0.3, 0.4, 40, 1, true).translate(0, 0.2, 0), []);
  const geom = useMemo(() => {
    const n = tiles.length;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    tiles.forEach(([x, y], i) => {
      tile.set([x, y], i * 2);
      const a = field.anims.get(`${x},${y}`);
      anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], i * 3);
    });
    return instanced(base, n, { aTile: [tile, 2], aAnim: [anim, 3] });
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
          uAppearT0: { value: sceneNow() },
          uEvents: goalEvents.uniforms.uEvents,
        },
      }),
    [],
  );
  useFrame(() => {
    material.uniforms.uTime.value = sceneNow();
    goalEvents.sync(planeKey(useGame.getState().inputs));
  });
  return <mesh geometry={geom} material={material} frustumCulled={false} renderOrder={6} />;
}
