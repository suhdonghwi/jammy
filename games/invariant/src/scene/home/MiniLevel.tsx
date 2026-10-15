import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { handIn, handOut, pointAt } from '../../director/director';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { COLORS, SLAB_H } from '../constants';
import { field } from '../field';
import { Floor } from '../Floor';
import { Frogs } from '../Frogs';
import { frogWorld, yawToward, type FrogSim } from '../frogSim';
import { GoalColumns } from '../GoalColumns';
import { Hand } from '../Hand';
import { handState, resetHand } from '../handState';
import { HATCH_EMERGE, HatchShells, hatchFx } from '../Hatch';
import { eggGeometry, Slabs } from '../AreaLayer';
import { useArea, useHomeLevel } from './common';

// A living corner of the tutorial level, for the home screen: the real floor
// (striped tiles where the loop stops, amber goal pools with their light
// columns), the invariant area 0 ≤ i ≤ n as slabs, and eggs that hatch into
// frogs which hop right until they reach the goal. When every frog has
// arrived, the board resets. Now and then the skeptical hand pokes a frog.

export type MiniLevelFraming = 'simple' | 'mini' | 'corner' | 'overview';

/** `plain`: a bare floor, with goals only at the ends of the rows (no stop region, no boundary). */
const SETUPS: Record<MiniLevelFraming, { rows: [number, number]; hopEvery: number; hand: boolean; plain?: boolean }> = {
  simple: { rows: [3, 4], hopEvery: 0.7, hand: true, plain: true },
  mini: { rows: [3, 6], hopEvery: 0.62, hand: true },
  corner: { rows: [4, 5], hopEvery: 0.75, hand: true },
  overview: { rows: [1, 8], hopEvery: 0.5, hand: false },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Plain eggs on the start tiles, each hidden while its frog is out. */
function Eggs({ rows, out }: { rows: number[]; out: React.RefObject<Set<number>> }) {
  const geom = useMemo(() => eggGeometry(), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: COLORS.egg, roughness: 0.7 }), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => {
    rows.forEach((n, k) => {
      const m = refs.current[k];
      if (!m) return;
      const target = out.current.has(n) ? 0 : 1;
      const s = m.scale.x + (target - m.scale.x) * Math.min(1, dt * (target ? 6 : 30));
      m.scale.setScalar(s);
      m.visible = s > 0.02;
      m.position.y = field.heightAt(0, n) * SLAB_H;
    });
  });
  return (
    <>
      {rows.map((n, k) => (
        <mesh key={n} ref={(el) => void (refs.current[k] = el)} geometry={geom} material={mat} position={[0, 0, -n]} scale={0.001} />
      ))}
    </>
  );
}

export function MiniLevel({ framing, shift = 0 }: { framing: MiniLevelFraming; /** Screen-space nudge: the scene drifts toward the right by this much. */ shift?: number }) {
  const level = useHomeLevel();
  const setup = SETUPS[framing];
  const rows = useMemo(() => {
    const out: number[] = [];
    for (let n = setup.rows[0]; n <= setup.rows[1]; n++) out.push(n);
    return out;
  }, [setup]);
  const tiles = useMemo(() => rows.flatMap((n) => Array.from({ length: n + 1 }, (_, i) => [i, n] as [number, number])), [rows]);
  // the counter program: the loop stops where i ≥ n, and i == n is the goal
  const version = useArea(tiles, (i, n) => ({ stop: i >= n, goal: i === n }));
  const out = useRef(new Set<number>());

  useEffect(() => {
    let alive = true;
    const held = new Set<FrogSim>();
    frogWorld.clear();
    out.current.clear();

    // one frog per row: hatch, hop right to the goal, celebrate
    const runRow = async (n: number, delay: number) => {
      await sleep(delay);
      if (!alive) return;
      hatchFx.push({ x: 0, y: n, dx: 0, dy: 0, s: 1 });
      out.current.add(n);
      const f = frogWorld.add(level, 'real', { i: 0n, n: BigInt(n) }, { hatchT0: performance.now() / 1000 + HATCH_EMERGE });
      f.face = f.yaw = yawToward(0, n, 1, n);
      await sleep(900);
      while (alive && f.x < n) {
        while (alive && held.has(f)) await sleep(100);
        if (!alive) return;
        await frogWorld.hopTo(level, f, { i: BigInt(f.x + 1), n: BigInt(n) }, 0.42, true);
        await sleep(setup.hopEvery * 1000 * (0.8 + Math.random() * 0.4));
      }
    };

    const loop = async () => {
      while (alive) {
        frogWorld.clear();
        out.current.clear();
        await sleep(700);
        await Promise.all(rows.map((n, k) => runRow(n, 300 + k * 650 + Math.random() * 400)));
        await sleep(2600);
      }
    };
    void loop();

    // the hand, now and then, pokes a frog that is still on its way
    const handLoop = async () => {
      await sleep(4200);
      while (alive && setup.hand) {
        const busy = frogWorld.frogs.filter((f) => !f.hop && f.x > 0 && f.x < Number(f.state.n) - 1);
        const f = busy[Math.floor(Math.random() * busy.length)];
        if (f) {
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
        }
        await sleep(4500 + Math.random() * 2500);
      }
    };
    void handLoop();

    return () => {
      alive = false;
      gsap.killTweensOf(handState);
      resetHand();
      frogWorld.clear();
      hatchFx.clear();
    };
  }, [level, rows, setup]);

  // camera framing
  const mode = useGame((s) => s.mode);
  const focus = useMemo(() => {
    const [a, b] = setup.rows;
    const mid = (a + b) / 2;
    return { x: mid * 0.55, y: mid, size: b - a + 4 };
  }, [setup]);
  useFrame(({ clock, size }) => {
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const t = clock.elapsedTime;
    const aspect = size.width / size.height;
    const sway = Math.sin(t * 0.13) * 0.35;
    const k = framing === 'corner' ? 0.95 : framing === 'overview' ? 1.6 : framing === 'simple' ? 0.95 : 1.25;
    if (aspect > 1.1) {
      const sx = -shift * Math.min(aspect, 2.2) * k;
      void c.setLookAt(focus.x + sx + sway, 5.4 * k, -focus.y + 8.4 * k, focus.x + sx, 0.2, -focus.y + 0.4, false);
    } else {
      // narrow: well above the copy, which sits at the bottom
      void c.setLookAt(focus.x + sway, 7 * k, -focus.y + 11.2 * k, focus.x, -1.5, -focus.y + 2.5, false);
    }
  });

  const win = useMemo(() => ({ cx: Math.round(focus.x), cy: Math.round(focus.y), R: 14 }), [focus]);
  const goals = useMemo(() => (setup.plain ? rows.map((n) => [n, n] as [number, number]) : undefined), [setup, rows]);
  return (
    <group>
      {setup.plain ? (
        <Floor level={null} pond={0} y={0} opacity={1} showAxes={false} showStop={false} showGoal={false} />
      ) : (
        <Floor level={level} pond={0} y={0} opacity={1} showAxes={false} showStop showGoal />
      )}
      <Slabs version={version} dim={false} showStop showGoal />
      <GoalColumns level={level} pond={0} win={win} version={version} only={goals} />
      <Eggs rows={rows} out={out} />
      <Frogs />
      <HatchShells />
      <Hand />
    </group>
  );
}
