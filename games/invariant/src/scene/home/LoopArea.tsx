import { useFrame } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useMemo } from 'react';
import { handIn, handOut, pointAt } from '../../director/director';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { Floor } from '../Floor';
import { Frogs } from '../Frogs';
import { frogWorld, yawToward, type FrogSim } from '../frogSim';
import { Hand } from '../Hand';
import { handState, resetHand } from '../handState';
import { Slabs } from '../AreaLayer';
import { useArea, useHomeLevel } from './common';

// The home screen's scene: a tidy rectangle of area slabs with frogs hopping
// round and round its edge. They never leave it. Now and then the skeptical
// hand pokes one, which carries on regardless.

const X0 = 3;
const Y0 = 3;
const W = 7;
const H = 4;

const TILES: [number, number][] = [];
for (let y = Y0; y < Y0 + H; y++) for (let x = X0; x < X0 + W; x++) TILES.push([x, y]);

// the edge, clockwise as seen from the camera
const PATH: [number, number][] = [];
for (let x = X0; x < X0 + W; x++) PATH.push([x, Y0 + H - 1]);
for (let y = Y0 + H - 2; y >= Y0; y--) PATH.push([X0 + W - 1, y]);
for (let x = X0 + W - 2; x >= X0; x--) PATH.push([x, Y0]);
for (let y = Y0 + 1; y < Y0 + H - 1; y++) PATH.push([X0, y]);

const FROGS = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function LoopArea({ shift = 1.25 }: { shift?: number }) {
  const level = useHomeLevel();
  const version = useArea(TILES);

  useEffect(() => {
    let alive = true;
    frogWorld.clear();
    const held = new Set<FrogSim>();
    const pos = Array.from({ length: FROGS }, (_, j) => Math.floor((j * PATH.length) / FROGS));
    const now = performance.now() / 1000;
    const frogs = pos.map((k, j) => {
      const [x, y] = PATH[k];
      const f = frogWorld.add(level, 'real', { i: BigInt(x), n: BigInt(y) }, { hatchT0: now + 0.3 + j * 0.15 });
      const [nx, ny] = PATH[(k + 1) % PATH.length];
      f.face = f.yaw = yawToward(x, y, nx, ny);
      return f;
    });
    const timer = setInterval(() => {
      frogs.forEach((f, j) => {
        if (held.has(f)) return;
        pos[j] = (pos[j] + 1) % PATH.length;
        const [x, y] = PATH[pos[j]];
        void frogWorld.hopTo(level, f, { i: BigInt(x), n: BigInt(y) }, 0.45, true).then(() => {
          const [nx, ny] = PATH[(pos[j] + 1) % PATH.length];
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
    };
  }, [level]);

  // camera: beside the copy on wide screens, above it on narrow ones
  const mode = useGame((s) => s.mode);
  const centre = useMemo(() => ({ x: X0 + (W - 1) / 2, y: Y0 + (H - 1) / 2 }), []);
  useFrame(({ clock, size }) => {
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const t = clock.elapsedTime;
    const aspect = size.width / size.height;
    const sway = Math.sin(t * 0.13) * 0.35;
    if (aspect > 1.1) {
      const sx = -shift * Math.min(aspect, 2.2) * 1.2;
      void c.setLookAt(centre.x + sx + sway, 7.6, -centre.y + 11.6, centre.x + sx, 0.2, -centre.y + 0.4, false);
    } else {
      void c.setLookAt(centre.x + sway, 10, -centre.y + 15.5, centre.x, -1.6, -centre.y + 2.4, false);
    }
  });

  return (
    <group>
      <Floor level={null} pond={0} y={0} opacity={1} showAxes={false} showStop={false} showGoal={false} />
      <Slabs version={version} dim={false} showStop={false} showGoal={false} />
      <Frogs />
      <Hand />
    </group>
  );
}
