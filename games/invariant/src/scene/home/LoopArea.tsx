import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { CompiledLevel } from '../../levels/level';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { COLORS, SLAB_H } from '../constants';
import { field } from '../field';
import { Floor } from '../Floor';
import { Frogs } from '../Frogs';
import { frogWorld, now, yawToward } from '../frogSim';
import { HATCH_EMERGE, HatchShells, hatchFx } from '../Hatch';
import { GoalColumns } from '../GoalColumns';
import { goalEvents } from '../goalEvents';
import { eggGeometry, Slabs } from '../AreaLayer';
import { useArea } from './common';
import { DIAGONAL, EDGE, RING, THROUGH } from './decor';

// The home screen's scene: area slabs with frogs hopping round and round their
// edge (they never leave), beside or around a striped zone where the loop
// would stop, with goal pools in it. Each draft arranges these differently.

export type LoopVariant = 'edge' | 'through' | 'ring' | 'diagonal';

interface Setup {
  /** The striped zone and its goal pools: a decorative program. */
  world: CompiledLevel;
  rect: { x0: number; y0: number; w: number; h: number };
  /** Only the rectangle's edge is slabs (its inside is the striped zone). */
  ring?: boolean;
  frogs: number;
  /** What the camera frames: centre tile and width in tiles. */
  focus: { x: number; y: number; span: number };
}

const SETUPS: Record<LoopVariant, Setup> = {
  edge: { world: EDGE, rect: { x0: 3, y0: 1, w: 6, h: 4 }, frogs: 4, focus: { x: 7, y: 2.5, span: 9 } },
  through: { world: THROUGH, rect: { x0: 3, y0: 1, w: 6, h: 4 }, frogs: 4, focus: { x: 6.5, y: 2.5, span: 8 } },
  ring: { world: RING, rect: { x0: 4, y0: 2, w: 5, h: 4 }, ring: true, frogs: 4, focus: { x: 6, y: 3.5, span: 9.5 } },
  // a ring of slabs (hollow, like 'ring'), wholly above the diagonal: every tile has x < y
  diagonal: { world: DIAGONAL, rect: { x0: 1, y0: 8, w: 7, h: 5 }, ring: true, frogs: 5, focus: { x: 4.6, y: 9, span: 11 } },
};

/** The rectangle's edge, clockwise as seen from the camera. */
function edgePath({ x0, y0, w, h }: Setup['rect']): [number, number][] {
  const p: [number, number][] = [];
  for (let x = x0; x < x0 + w; x++) p.push([x, y0 + h - 1]);
  for (let y = y0 + h - 2; y >= y0; y--) p.push([x0 + w - 1, y]);
  for (let x = x0 + w - 2; x >= x0; x--) p.push([x, y0]);
  for (let y = y0 + 1; y < y0 + h - 1; y++) p.push([x0, y]);
  return p;
}

/** When the eggs appear, how long they sit, and the gap between hatchings (seconds). */
const EGG_IN = 0.25;
const EGG_HOLD = 0.9;
const EGG_STAGGER = 0.3;

interface StartEgg {
  x: number;
  y: number;
  appear: number;
  hatch: number;
}

/** The eggs the frogs come from: they pop up, then vanish as the hatching shells take over. */
function StartEggs({ eggs }: { eggs: React.RefObject<StartEgg[]> }) {
  const geom = useMemo(() => eggGeometry(), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.egg, roughness: 0.7 }), []);
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geom, mat, 16);
    m.frustumCulled = false;
    m.count = 0;
    return m;
  }, [geom, mat]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    const t = now();
    let n = 0;
    for (const e of eggs.current) {
      if (t < e.appear || t >= e.hatch || n >= 16) continue;
      // pop in with a little overshoot
      const u = Math.min(1, (t - e.appear) / 0.32);
      const s = u >= 1 ? 1 : 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2);
      dummy.position.set(e.x, field.heightAt(e.x, e.y) * SLAB_H, -e.y);
      dummy.scale.setScalar(Math.max(0, s));
      dummy.updateMatrix();
      mesh.setMatrixAt(n++, dummy.matrix);
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

export function LoopArea({ variant, shift = 1.25 }: { variant: LoopVariant; shift?: number }) {
  const setup = SETUPS[variant];
  const level = setup.world;
  const { rect } = setup;
  const tiles = useMemo(() => {
    const out: [number, number][] = [];
    for (let y = rect.y0; y < rect.y0 + rect.h; y++)
      for (let x = rect.x0; x < rect.x0 + rect.w; x++) {
        const edge = x === rect.x0 || x === rect.x0 + rect.w - 1 || y === rect.y0 || y === rect.y0 + rect.h - 1;
        if (edge || !setup.ring) out.push([x, y]);
      }
    return out;
  }, [rect, setup]);
  // slabs inside the striped zone are striped too, and carry its pools
  const version = useArea(tiles, (x, y) => {
    const s = { x, y };
    const stop = level.fast.guard(s) !== true;
    return { stop, goal: stop && level.fast.post(s) === true };
  });

  const eggs = useRef<StartEgg[]>([]);
  useEffect(() => {
    frogWorld.clear();
    const path = edgePath(rect);
    const pos = Array.from({ length: setup.frogs }, (_, j) => Math.floor((j * path.length) / setup.frogs));
    // On arrival each frog starts as an egg on its tile: the egg pops up,
    // then (one after another) wobbles, cracks and the frog climbs out.
    const t0 = now();
    const timers: number[] = [];
    eggs.current = [];
    const frogs = pos.map((k, j) => {
      const [x, y] = path[k];
      const appear = t0 + EGG_IN + j * 0.1;
      const hatch = t0 + EGG_IN + EGG_HOLD + j * EGG_STAGGER;
      eggs.current.push({ x, y, appear, hatch });
      timers.push(window.setTimeout(() => hatchFx.push({ x, y, dx: 0, dy: 0, s: 1 }), (hatch - t0) * 1000));
      const f = frogWorld.add(level, 'real', { x: BigInt(x), y: BigInt(y) }, { hatchT0: hatch + HATCH_EMERGE });
      const [nx, ny] = path[(k + 1) % path.length];
      f.face = f.yaw = yawToward(x, y, nx, ny);
      return f;
    });
    // everyone starts hopping together, on the same beat, once the last frog is out
    const lastOut = Math.max(...frogs.map((f) => f.hatchT0 ?? t0)) + 0.6;
    const timer = setInterval(() => {
      if (now() < lastOut) return;
      frogs.forEach((f, j) => {
        pos[j] = (pos[j] + 1) % path.length;
        const [x, y] = path[pos[j]];
        // landing in a pool on the way splashes (hopTo does that, as in a level)
        void frogWorld.hopTo(level, f, { x: BigInt(x), y: BigInt(y) }, 0.45, true).then(() => {
          const [nx, ny] = path[(pos[j] + 1) % path.length];
          f.face = yawToward(x, y, nx, ny);
        });
      });
    }, 950);

    return () => {
      clearInterval(timer);
      timers.forEach((t) => window.clearTimeout(t));
      hatchFx.clear();
      frogWorld.clear();
      goalEvents.clear();
    };
  }, [level, rect, setup]);

  // camera: beside the copy on wide screens, above it on narrow ones
  const mode = useGame((s) => s.mode);
  const centre = setup.focus;
  useFrame(({ clock, size }) => {
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const t = clock.elapsedTime;
    const aspect = size.width / size.height;
    const sway = Math.sin(t * 0.13) * 0.35;
    const k = Math.max(0.9, centre.span / 8.5);
    if (aspect > 1.1) {
      const sx = -shift * Math.min(aspect, 2.2) * 1.75;
      void c.setLookAt(centre.x + sx + sway, 7.6 * k, -centre.y + 11.6 * k, centre.x + sx, 0.2, -centre.y + 0.4, false);
    } else {
      // narrow: far enough back that the scene's width fits the screen
      const kn = Math.max(k, centre.span / (aspect * 13.5));
      void c.setLookAt(centre.x + sway, 10 * kn, -centre.y + 15.5 * kn, centre.x, -1.6 * kn, -centre.y + 2.4 * kn, false);
    }
  });

  const win = useMemo(() => ({ cx: Math.round(centre.x), cy: Math.round(centre.y), R: 16 }), [centre]);
  return (
    <group>
      <Floor level={level} pond={0} y={0} opacity={1} showAxes={false} showStop showGoal />
      <Slabs version={version} dim={false} showStop showGoal />
      <GoalColumns level={level} pond={0} win={win} version={version} />
      <StartEggs eggs={eggs} />
      <Frogs />
      <HatchShells />
    </group>
  );
}
