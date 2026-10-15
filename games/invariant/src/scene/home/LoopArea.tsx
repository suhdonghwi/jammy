import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo } from 'react';
import { handIn, handOut, pointAt } from '../../director/director';
import type { CompiledLevel } from '../../levels/level';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { Floor } from '../Floor';
import { Frogs } from '../Frogs';
import { frogWorld, yawToward, type FrogSim } from '../frogSim';
import { GoalColumns } from '../GoalColumns';
import { goalEvents } from '../goalEvents';
import { Hand } from '../Hand';
import { handState, resetHand } from '../handState';
import { Slabs } from '../AreaLayer';
import { useArea } from './common';
import { DIAGONAL, EDGE, RING, THROUGH } from './decor';

// The home screen's scene: area slabs with frogs hopping round and round their
// edge (they never leave), beside or around a striped zone where the loop
// would stop, with goal pools in it. Each draft arranges these differently.
// Now and then the skeptical hand pokes a frog, which carries on.

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
  diagonal: { world: DIAGONAL, rect: { x0: 1, y0: 7, w: 5, h: 4 }, frogs: 4, focus: { x: 5, y: 7.5, span: 9 } },
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
        // landing in a pool on the way splashes (hopTo does that, as in a level)
        void frogWorld.hopTo(level, f, { x: BigInt(x), y: BigInt(y) }, 0.45, true).then(() => {
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
      void c.setLookAt(centre.x + sway, 10 * k, -centre.y + 15.5 * k, centre.x, -1.6, -centre.y + 2.4, false);
    }
  });

  const win = useMemo(() => ({ cx: Math.round(centre.x), cy: Math.round(centre.y), R: 16 }), [centre]);
  return (
    <group>
      <Floor level={level} pond={0} y={0} opacity={1} showAxes={false} showStop showGoal />
      <Slabs version={version} dim={false} showStop showGoal />
      <GoalColumns level={level} pond={0} win={win} version={version} />
      <Frogs />
      <Hand />
    </group>
  );
}
