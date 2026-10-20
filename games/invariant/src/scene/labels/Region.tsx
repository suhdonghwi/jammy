import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useGame, type Region } from '../../game/store';
import { EXIT_MS, useLingering } from '../../hooks/presence';
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

const RIPPLE_STEP = 0.08;
const RIPPLE_MAX = 0.9;
const TICK_REACH = 10;

const rippleDelay = (d: number) => Math.min(RIPPLE_MAX, d * RIPPLE_STEP);

function useTicks(region: Region | null, win: TileWindow) {
  useEffect(() => {
    if (!region?.tick) return;
    const [cx, cy] = region.center;
    const near = region
      .tiles(win)
      .map((t) => Math.hypot(t.x - cx, t.y - cy))
      .filter((d) => d <= TICK_REACH)
      .sort((a, b) => a - b);
    const cancels = near.map((d, k) => after(rippleDelay(d) * 1000, () => sfx.tick(k)));
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
  const leftAt = useRef<number | null>(null);
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
    const [cx, cy] = region.center;
    tiles.forEach((t, i) => {
      tile.set([t.x, t.y], i * 2);
      const a = field.anims.get(`${t.x},${t.y}`);
      anim.set(a ? [a.from, a.to, a.t0] : [0, 0, 0], i * 3);
      const c = COLOR[t.tone];
      color.set([c.r, c.g, c.b], i * 3);
      delay[i] = region.tick ? rippleDelay(Math.hypot(t.x - cx, t.y - cy)) : 0;
    });
    const attrs = { aTile: [tile, 2], aAnim: [anim, 3], aColor: [color, 3], aDelay: [delay, 1] } as const;
    return { ring: instanced(ringGeometry, n, attrs), wash: instanced(washGeometry, n, attrs) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, win, valid]);
  useEffect(() => () => (geoms?.ring.dispose(), geoms?.wash.dispose()), [geoms]);

  useFrame(() => {
    if (leaving && leftAt.current === null) leftAt.current = performance.now();
    if (!leaving) leftAt.current = null;
    const out = leftAt.current === null ? 1 : Math.max(0, 1 - (performance.now() - leftAt.current) / EXIT_MS);
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
