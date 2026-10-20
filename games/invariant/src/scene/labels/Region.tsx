import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { useGame, type Region, type RegionTile } from '../../game/store';
import { useLingering } from '../../hooks/presence';
import { useExitFade } from './exitFade';
import { useTileWindow } from '../area/AreaLayer';
import { field } from '../area/field';
import { GLSL_HEIGHT, instanced } from '../area/glsl';
import { SLAB_H } from '../constants';
import { after, sceneNow } from '../sceneTime';
import { sfx } from '../../audio/sfx';
import type { TileWindow } from '../../levels/tiles';
import { fadeUniforms, GLSL_FADE, updateFade } from '../shaders/common';
import { ringGeometry, TONE_COLORS, washGeometry } from './TileTag';

const vertex = /* glsl */ `
${GLSL_HEIGHT}
attribute vec3 aColor;
attribute float aDelay;
uniform float uT0;
varying vec3 vColor;
varying vec3 vWorld;
varying float vA;
void main() {
  float a = clamp((uTime - uT0 - aDelay) / 0.24, 0.0, 1.0);
  float s = a <= 0.0 ? 0.6 : 1.0 + 2.2 * pow(a - 1.0, 3.0) + 1.2 * pow(a - 1.0, 2.0);
  s = 0.6 + 0.4 * s;
  vec4 w = modelMatrix * vec4(position * vec3(s, 1.0, s) + vec3(aTile.x, heightNow() * ${SLAB_H.toFixed(3)} + 0.012, -aTile.y), 1.0);
  vWorld = w.xyz;
  vColor = aColor;
  vA = a;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragment = /* glsl */ `
uniform float uAlpha;
uniform float uOut;
varying vec3 vColor;
varying vec3 vWorld;
varying float vA;
${GLSL_FADE}
void main() {
  float far = smoothstep(uFade.x, uFade.y, length(vWorld.xz - uCenter));
  gl_FragColor = vec4(applyFade(vColor, vWorld), uAlpha * vA * uOut * (1.0 - far));
  #include <colorspace_fragment>
}
`;

function regionMaterial(alpha: number) {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: { value: 0 }, uT0: { value: 0 }, uOut: { value: 1 }, uAlpha: { value: alpha }, ...fadeUniforms() },
  });
}

const TICKS = 10;
const TICK_STEP = 0.055;
const TAIL_STEP = 0.025;
const TAIL_MAX = 0.4;

function rippleDelays(tiles: RegionTile[], [cx, cy]: [number, number]): number[] {
  const dist = tiles.map((t) => Math.hypot(t.x - cx, t.y - cy));
  const order = tiles.map((_, i) => i).sort((a, b) => dist[a] - dist[b] || tiles[a].y - tiles[b].y || tiles[a].x - tiles[b].x);
  const delays = new Array<number>(tiles.length);
  const edge = dist[order[Math.min(TICKS, order.length) - 1]] ?? 0;
  order.forEach((i, rank) => {
    delays[i] = rank < TICKS ? rank * TICK_STEP : TICKS * TICK_STEP + Math.min(TAIL_MAX, (dist[i] - edge) * TAIL_STEP);
  });
  return delays;
}

function useTicks(region: Region | null, win: TileWindow) {
  useEffect(() => {
    if (!region?.tick) return;
    const count = Math.min(TICKS, region.tiles(win).length);
    const cancels = Array.from({ length: count }, (_, k) => after(k * TICK_STEP * 1000, () => sfx.tick(k)));
    return () => cancels.forEach((c) => c());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);
}

const COLOR = Object.fromEntries(Object.entries(TONE_COLORS).map(([k, v]) => [k, new THREE.Color(v)]));

export function OutlineRegion() {
  const { value: region, leaving } = useLingering(useGame((s) => s.region));
  const valid = useGame((s) => s.valid);
  const win = useTileWindow();
  const ring = useMemo(() => regionMaterial(0.85), []);
  const wash = useMemo(() => regionMaterial(0.3), []);
  const exit = useExitFade(leaving);
  useTicks(region, win);

  const [shown, setShown] = useState<{ id: string; t0: number } | null>(null);
  if (region && region.id !== shown?.id) setShown({ id: region.id, t0: sceneNow() });
  if (!region && shown) setShown(null);
  const t0 = shown?.t0 ?? 0;
  const geoms = useMemo(() => {
    if (!region) return null;
    const tiles = region.tiles(win);
    const n = tiles.length;
    const tile = new Float32Array(n * 2);
    const anim = new Float32Array(n * 3);
    const color = new Float32Array(n * 3);
    const delay = new Float32Array(n);
    const delays = region.tick ? rippleDelays(tiles, region.center) : null;
    tiles.forEach((t, i) => {
      tile.set([t.x, t.y], i * 2);
      const a = field.anims.get(`${t.x},${t.y}`);
      anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], i * 3);
      const c = COLOR[t.tone];
      color.set([c.r, c.g, c.b], i * 3);
      delay[i] = delays?.[i] ?? 0;
    });
    const attrs = { aTile: [tile, 2], aAnim: [anim, 3], aColor: [color, 3], aDelay: [delay, 1] } as const;
    return { ring: instanced(ringGeometry, n, attrs), wash: instanced(washGeometry, n, attrs) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, win, valid]);
  useEffect(() => () => (geoms?.ring.dispose(), geoms?.wash.dispose()), [geoms]);

  useFrame(() => {
    const out = exit();
    for (const m of [ring, wash]) {
      m.uniforms.uTime.value = sceneNow();
      m.uniforms.uT0.value = t0;
      m.uniforms.uOut.value = out;
      updateFade(m.uniforms);
    }
  });

  if (!geoms) return null;
  return (
    <>
      <mesh geometry={geoms.wash} material={wash} frustumCulled={false} renderOrder={8} />
      <mesh geometry={geoms.ring} material={ring} frustumCulled={false} renderOrder={9} />
    </>
  );
}
