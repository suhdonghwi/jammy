import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { Floor } from '../Floor';
import { Frogs } from '../Frogs';
import { tileKey, useHomeLevel, useTitleFont, useWanderers, Word } from './common';

// Draft C: night. A dark grid with glowing goal pools; frogs wander between
// them and every landing on a pool makes it flash and ripple.

const POOLS: [number, number][] = [
  [-6, 0],
  [-3, 5],
  [-1, -1],
  [2, 0],
  [5, 5],
  [6, -2],
  [-8, 5],
  [9, 1],
  [-9, -2],
  [3, -3],
];

// where frogs may roam: a wide patch, minus the band where the title stands
const REGION: [number, number][] = [];
for (let y = -3; y <= 6; y++) for (let x = -10; x <= 10; x++) if (!((y === 2 || y === 3) && Math.abs(x) <= 8)) REGION.push([x, y]);

export const NIGHT_FLOOR = { tile: '#1b2444', gap: '#0f162e', void: '#0d1328', label: '#34416b' };

const poolVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vPos;
void main() {
  vUv = uv;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// the pool's water and the soft glow around it, on one flat quad
const poolFragment = /* glsl */ `
uniform float uTime;
uniform float uHit;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0; // the quad spans 2.4 tiles: r = 1 is 1.2 tiles
  float r = length(p) * 1.2;
  float flash = uHit > 0.0 ? exp(-(uTime - uHit) * 3.0) : 0.0;
  // water
  float water = 1.0 - smoothstep(0.31, 0.33, r);
  vec3 deep = vec3(0.98, 0.62, 0.16);
  vec3 light = vec3(1.0, 0.92, 0.66);
  vec3 col = mix(light, deep, smoothstep(0.0, 0.32, r));
  col = mix(col, vec3(1.0, 0.98, 0.9), flash * 0.7);
  // glow beyond the rim, breathing slowly
  float breathe = 0.85 + 0.15 * sin(uTime * 1.3 + vUv.x * 3.0);
  float glow = exp(-max(r - 0.3, 0.0) * 4.0) * (0.5 * breathe + 0.6 * flash);
  // a ripple running out after a landing
  float age = uTime - uHit;
  float ring = uHit > 0.0 && age < 1.2 ? exp(-pow((r - (0.33 + age * 0.8)) / 0.03, 2.0)) * (1.0 - age / 1.2) : 0.0;
  vec3 outCol = mix(vec3(1.0, 0.72, 0.3), vec3(1.0, 0.9, 0.6), ring);
  float a = max(water, glow + ring * 0.8);
  gl_FragColor = vec4(water > 0.5 ? col : outCol, a);
  #include <colorspace_fragment>
}`;

const columnFragment = /* glsl */ `
uniform float uTime;
uniform float uHit;
varying vec2 vUv;
void main() {
  float flash = uHit > 0.0 ? exp(-(uTime - uHit) * 2.4) : 0.0;
  float fall = pow(1.0 - vUv.y, 1.8);
  float a = fall * (0.16 + 0.5 * flash);
  gl_FragColor = vec4(mix(vec3(1.0, 0.75, 0.3), vec3(1.0, 0.95, 0.8), flash), a);
  #include <colorspace_fragment>
}`;

function Pool({ x, y, hits }: { x: number; y: number; hits: Map<string, number> }) {
  const column = useRef<THREE.Mesh>(null);
  const mats = useMemo(() => {
    const uniforms = { uTime: { value: 0 }, uHit: { value: -100 } };
    return {
      uniforms,
      pool: new THREE.ShaderMaterial({ vertexShader: poolVertex, fragmentShader: poolFragment, uniforms, transparent: true, depthWrite: false }),
      column: new THREE.ShaderMaterial({
        vertexShader: poolVertex,
        fragmentShader: columnFragment,
        uniforms,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    };
  }, []);
  const geoms = useMemo(
    () => ({
      quad: new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2),
      column: new THREE.CylinderGeometry(0.33, 0.33, 1, 40, 1, true).translate(0, 0.5, 0),
    }),
    [],
  );
  useFrame(() => {
    const t = performance.now() / 1000;
    mats.uniforms.uTime.value = t;
    mats.uniforms.uHit.value = hits.get(tileKey(x, y)) ?? -100;
    const flash = Math.exp(-(t - mats.uniforms.uHit.value) * 2.4);
    column.current?.scale.set(1, 0.9 + 1.6 * flash, 1);
  });
  return (
    <group position={[x, 0.004, -y]}>
      <mesh geometry={geoms.quad} material={mats.pool} renderOrder={2} />
      <mesh ref={column} geometry={geoms.column} material={mats.column} renderOrder={6} />
    </group>
  );
}

export function NightPondHome() {
  const font = useTitleFont();
  const level = useHomeLevel();
  const hits = useRef(new Map<string, number>()).current;
  const pools = useMemo(() => new Set(POOLS.map(([x, y]) => tileKey(x, y))), []);
  useWanderers(level, {
    tiles: REGION,
    count: 9,
    every: 0.9,
    straight: 0.55,
    onLand: (_f, x, y) => {
      if (pools.has(tileKey(x, y))) hits.set(tileKey(x, y), performance.now() / 1000);
    },
  });

  useEffect(() => {
    void cameraRig.controls?.setLookAt(0, 6, 12, 0, 0.8, -1, false);
  }, []);
  const mode = useGame((s) => s.mode);
  useFrame(({ clock, size }) => {
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const t = clock.elapsedTime;
    const fit = Math.max(1, 1.3 / Math.max(0.5, size.width / size.height));
    void c.setLookAt(Math.sin(t * 0.1) * 1.6, 4.8 + fit * 0.6, 12.5 * fit, 0, 0.9, -1.2, false);
  });

  return (
    <group>
      <Floor level={null} pond={0} y={0} opacity={1} showAxes={false} showStop={false} showGoal={false} palette={NIGHT_FLOOR} />
      {POOLS.map(([x, y]) => (
        <Pool key={tileKey(x, y)} x={x} y={y} hits={hits} />
      ))}
      {POOLS.slice(0, 4).map(([x, y]) => (
        <pointLight key={tileKey(x, y)} position={[x, 0.6, -y]} color="#ffb347" intensity={2.2} distance={3.2} decay={2} />
      ))}
      <Frogs />
      {font && (
        <>
          <Word font={font} text="Invariant" size={1.2} position={[0, 2.6, -2.6]} face="#fff3d6" side="#c99a43" emissive={0.18} outlineColor="#0b1022" />
          <Word font={font} text="Frog" size={1.5} position={[0, 0.65, -2.4]} face="#7be06f" side="#2f8a2a" emissive={0.12} outlineColor="#0b1022" phase={1.4} />
        </>
      )}
    </group>
  );
}
