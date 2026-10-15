import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { handIn, handOut, pointAt } from '../../director/director';
import type { CompiledLevel } from '../../levels/level';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { COLORS, SLAB_H } from '../constants';
import { field } from '../field';
import { Floor } from '../Floor';
import { Frogs } from '../Frogs';
import { frogWorld, now, yawToward, type FrogSim } from '../frogSim';
import { GoalColumns } from '../GoalColumns';
import { goalEvents } from '../goalEvents';
import { Hand } from '../Hand';
import { handState, resetHand } from '../handState';
import { eggGeometry, Slabs } from '../AreaLayer';
import { tileKey, useArea } from './common';
import { PLAIN, STRIPES } from './decor';

// The home screen's scene: a tidy rectangle of area slabs with frogs hopping
// round and round its edge (they never leave it), dressed differently per
// draft: goal pools to splash in, eggs, a striped zone where the loop would
// stop. Now and then the skeptical hand pokes a frog, which carries on.

export type LoopVariant = 'plain' | 'pools' | 'stripes' | 'garden';

interface Setup {
  /** Floor regions (stripes, boundary, goals): a decorative program. */
  world: CompiledLevel;
  rect: { x0: number; y0: number; w: number; h: number };
  /** Goal pools on slabs of the area (frogs splash in them as they pass). */
  pools: [number, number][];
  eggs: [number, number][];
  frogs: number;
}

const SETUPS: Record<LoopVariant, Setup> = {
  plain: { world: PLAIN, rect: { x0: 3, y0: 3, w: 7, h: 4 }, pools: [], eggs: [], frogs: 4 },
  pools: {
    world: PLAIN,
    rect: { x0: 3, y0: 3, w: 7, h: 4 },
    pools: [
      [9, 6],
      [3, 3],
    ],
    eggs: [
      [5, 5],
      [6, 4],
      [7, 5],
    ],
    frogs: 4,
  },
  stripes: {
    world: STRIPES,
    rect: { x0: 2, y0: 1, w: 6, h: 4 },
    pools: [],
    eggs: [
      [4, 3],
      [5, 2],
    ],
    frogs: 4,
  },
  garden: {
    world: PLAIN,
    rect: { x0: 3, y0: 2, w: 7, h: 5 },
    pools: [[6, 4]],
    eggs: [
      [4, 0],
      [6, 0],
      [8, 0],
      [11, 3],
      [11, 5],
    ],
    frogs: 5,
  },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The rectangle's edge, clockwise as seen from the camera. */
function edgePath({ x0, y0, w, h }: Setup['rect']): [number, number][] {
  const p: [number, number][] = [];
  for (let x = x0; x < x0 + w; x++) p.push([x, y0 + h - 1]);
  for (let y = y0 + h - 2; y >= y0; y--) p.push([x0 + w - 1, y]);
  for (let x = x0 + w - 2; x >= x0; x--) p.push([x, y0]);
  for (let y = y0 + 1; y < y0 + h - 1; y++) p.push([x0, y]);
  return p;
}

/** Eggs sitting on their tiles; now and then one gives a little wobble. */
function Eggs({ tiles }: { tiles: [number, number][] }) {
  const geom = useMemo(() => eggGeometry(), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.egg, roughness: 0.7 }), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    tiles.forEach(([x, y], k) => {
      const m = refs.current[k];
      if (!m) return;
      m.position.set(x, field.heightAt(x, y) * SLAB_H, -y);
      // a short rock every few seconds, each egg at its own time
      const c = (t + k * 2.3) % 7;
      m.rotation.z = c < 0.6 ? Math.sin(c * Math.PI * 5) * 0.16 * (1 - c / 0.6) : 0;
    });
  });
  return (
    <>
      {tiles.map(([x, y], k) => (
        <mesh key={tileKey(x, y)} ref={(el) => void (refs.current[k] = el)} geometry={geom} material={mat} />
      ))}
    </>
  );
}

export function LoopArea({ variant, shift = 1.25 }: { variant: LoopVariant; shift?: number }) {
  const setup = SETUPS[variant];
  const level = setup.world;
  const { rect } = setup;
  const tiles = useMemo(() => {
    const out: [number, number][] = [];
    for (let y = rect.y0; y < rect.y0 + rect.h; y++) for (let x = rect.x0; x < rect.x0 + rect.w; x++) out.push([x, y]);
    return out;
  }, [rect]);
  const poolSet = useMemo(() => new Set(setup.pools.map(([x, y]) => tileKey(x, y))), [setup]);
  const version = useArea(tiles, (x, y) => {
    const pool = poolSet.has(tileKey(x, y));
    return { stop: pool, goal: pool };
  });

  useEffect(() => {
    let alive = true;
    frogWorld.clear();
    const path = edgePath(rect);
    const held = new Set<FrogSim>();
    const pos = Array.from({ length: setup.frogs }, (_, j) => Math.floor((j * path.length) / setup.frogs));
    const t0 = performance.now() / 1000;
    const frogs = pos.map((k, j) => {
      const [x, y] = path[k];
      const f = frogWorld.add(level, 'real', { x: BigInt(x), y: BigInt(y) }, { hatchT0: t0 + 0.3 + j * 0.15 });
      const [nx, ny] = path[(k + 1) % path.length];
      f.face = f.yaw = yawToward(x, y, nx, ny);
      return f;
    });
    const timer = setInterval(() => {
      frogs.forEach((f, j) => {
        if (held.has(f)) return;
        pos[j] = (pos[j] + 1) % path.length;
        const [x, y] = path[pos[j]];
        void frogWorld.hopTo(level, f, { x: BigInt(x), y: BigInt(y) }, 0.45, true).then(() => {
          // a splash and a happy hop in a pool on the way
          if (poolSet.has(tileKey(x, y))) {
            goalEvents.push(x, y, undefined);
            f.cheerT0 = now();
          }
          const [nx, ny] = path[(pos[j] + 1) % path.length];
          f.face = yawToward(x, y, nx, ny);
        });
      });
    }, 950);

    // the hand, now and then, pokes a frog (which then carries on)
    void (async () => {
      await sleep(4000);
      while (alive) {
        const f = frogs[Math.floor(Math.random() * frogs.length)];
        while (alive && f.hop) await sleep(50);
        if (!alive) break;
        held.add(f);
        await handIn(f.x + 0.4, f.y - 1.3, 1.6, { curl: 0.2 });
        if (!alive) break;
        await pointAt(f.x, f.y);
        if (!alive) break;
        await new Promise<void>((res) => gsap.to(handState, { shrug: 1, point: 0, duration: 0.25, onComplete: () => res() }));
        held.delete(f);
        await sleep(650);
        gsap.to(handState, { shrug: 0, duration: 0.2 });
        await handOut();
        await sleep(5000 + Math.random() * 3000);
      }
    })();

    return () => {
      alive = false;
      clearInterval(timer);
      gsap.killTweensOf(handState);
      resetHand();
      frogWorld.clear();
      goalEvents.clear();
    };
  }, [level, rect, setup, poolSet]);

  // camera: beside the copy on wide screens, above it on narrow ones
  const mode = useGame((s) => s.mode);
  const centre = useMemo(() => {
    // frame the whole scene: the rectangle and its eggs (and a bit of the stripes)
    const xs = [rect.x0, rect.x0 + rect.w - 1, ...setup.eggs.map(([x]) => x)];
    const ys = [rect.y0, rect.y0 + rect.h - 1, ...setup.eggs.map(([, y]) => y)];
    if (variant === 'stripes') xs.push(10);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, span: Math.max(...xs) - Math.min(...xs) + 1 };
  }, [rect, setup, variant]);
  useFrame(({ clock, size }) => {
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const t = clock.elapsedTime;
    const aspect = size.width / size.height;
    const sway = Math.sin(t * 0.13) * 0.35;
    const k = Math.max(1, centre.span / 7);
    if (aspect > 1.1) {
      const sx = -shift * Math.min(aspect, 2.2) * 1.2 * k;
      void c.setLookAt(centre.x + sx + sway, 7.6 * k, -centre.y + 11.6 * k, centre.x + sx, 0.2, -centre.y + 0.4, false);
    } else {
      void c.setLookAt(centre.x + sway, 10 * k, -centre.y + 15.5 * k, centre.x, -1.6, -centre.y + 2.4, false);
    }
  });

  const win = useMemo(() => ({ cx: Math.round(centre.x), cy: Math.round(centre.y), R: 16 }), [centre]);
  const showStripes = variant === 'stripes';
  return (
    <group>
      <Floor level={level} pond={0} y={0} opacity={1} showAxes={false} showStop={showStripes} showGoal={showStripes} />
      <Slabs version={version} dim={false} showStop showGoal />
      {(setup.pools.length > 0 || showStripes) && (
        <GoalColumns level={level} pond={0} win={win} version={version} only={showStripes ? undefined : setup.pools} />
      )}
      <Eggs tiles={setup.eggs} />
      <Frogs />
      <Hand />
    </group>
  );
}
