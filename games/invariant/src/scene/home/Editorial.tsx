import { useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { handIn, handOut, pointAt } from '../../director/director';
import { useGame } from '../../store/game';
import { cameraRig } from '../cameraRig';
import { Floor } from '../Floor';
import { Frogs } from '../Frogs';
import { frogWorld, yawToward, type FrogSim } from '../frogSim';
import { Hand } from '../Hand';
import { handState, resetHand } from '../handState';
import { Slabs } from '../AreaLayer';
import { tileKey, useArea, useHomeLevel } from './common';

// Draft E: the scene is a small vignette beside big type. One frog sits on a
// little patch of area and watches your cursor; now and then the skeptical
// hand comes in and pokes it, the frog hops to another tile of the patch (it
// never leaves), and the hand shrugs and goes.

// placed away from the axes, so the slabs carry no axis numbers
const O = [5, 5] as const;
const PATCH: [number, number][] = (
  [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [0, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [2, 0],
  [0, 2],
  ] as [number, number][]
).map(([x, y]) => [x + O[0], y + O[1]]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ray = new THREE.Raycaster();
const hit = new THREE.Vector3();

export function EditorialHome() {
  const level = useHomeLevel();
  const version = useArea(PATCH);
  const frog = useRef<FrogSim | null>(null);
  const pointer = useRef<THREE.Vector2 | null>(null);
  const { camera, gl } = useThree();

  // the frog, and the hand's little routine
  useEffect(() => {
    frogWorld.clear();
    const f = frogWorld.add(level, 'real', { i: BigInt(O[0]), n: BigInt(O[1]) }, { hatchT0: performance.now() / 1000 + 0.4 });
    frog.current = f;
    const set = new Set(PATCH.map(([x, y]) => tileKey(x, y)));
    let alive = true;
    void (async () => {
      await sleep(2600);
      while (alive) {
        await handIn(f.x + 0.4, f.y - 1.3, 1.6, { curl: 0.2 });
        if (!alive) break;
        await pointAt(f.x, f.y);
        if (!alive) break;
        // hop to another tile of the patch: still on the area
        const options = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].filter(([dx, dy]) => set.has(tileKey(f.x + dx, f.y + dy)));
        const [dx, dy] = options[Math.floor(Math.random() * options.length)];
        f.face = yawToward(f.x, f.y, f.x + dx, f.y + dy);
        await frogWorld.hopTo(level, f, { i: BigInt(f.x + dx), n: BigInt(f.y + dy) }, 0.5, true);
        if (!alive) break;
        // the hand gives up
        await new Promise<void>((res) => gsap.to(handState, { shrug: 1, point: 0, duration: 0.25, onComplete: () => res() }));
        await sleep(700);
        gsap.to(handState, { shrug: 0, duration: 0.2 });
        await handOut();
        await sleep(3800);
      }
    })();
    return () => {
      alive = false;
      gsap.killTweensOf(handState);
      resetHand();
      frogWorld.clear();
      frog.current = null;
    };
  }, [level]);

  // the frog watches the cursor
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [gl]);

  useEffect(() => {
    void cameraRig.controls?.setLookAt(O[0] - 3, 5, 9 - O[1], O[0] - 3, 0.4, -O[1], false);
  }, []);
  const mode = useGame((s) => s.mode);
  useFrame(({ clock, size }) => {
    const f = frog.current;
    if (f && !f.hop && pointer.current && handState.visible < 0.05) {
      ray.setFromCamera(pointer.current, camera);
      if (ray.ray.intersectPlane(ground, hit)) {
        const d = Math.hypot(hit.x - f.x, -hit.z - f.y);
        if (d > 0.3) f.face = yawToward(f.x, f.y, hit.x, -hit.z);
      }
    }
    const c = cameraRig.controls;
    if (!c || mode !== 'menu') return;
    const t = clock.elapsedTime;
    const aspect = size.width / size.height;
    const sway = Math.sin(t * 0.15) * 0.4;
    if (aspect > 1.1) {
      // wide: the vignette sits in the right part of the screen, beside the text
      const shift = -1.25 * Math.min(aspect, 2.2);
      void c.setLookAt(O[0] + shift + sway, 4.6, 8.2 - O[1], O[0] + shift, 0.35, 0.2 - O[1], false);
    } else {
      // narrow: above the copy, which sits at the bottom
      void c.setLookAt(O[0] + sway, 5.6, 10.5 - O[1], O[0], -0.6, 1.4 - O[1], false);
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
