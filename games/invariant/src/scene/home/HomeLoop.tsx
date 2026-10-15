import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
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
import { DIAGONAL } from './decor';

// The home screen's scene, in the counter program's world: striped tiles below
// a diagonal of goal pools (where the loop would stop), and above it a ring of
// area slabs with frogs hopping round and round it. They never leave. When
// the page opens, each frog first hatches from an egg on its tile.

/** The ring of slabs: wholly above the diagonal (every tile has x < y), off the axes. */
const RING = { x0: 1, y0: 8, w: 7, h: 5 };
const FROGS = 5;
/** What the camera frames: centre tile and width in tiles. */
const FOCUS = { x: 4.6, y: 9, span: 11 };
/** The glide into place on arrival (seconds), and where it starts on a fresh page load. */
const INTRO_SECONDS = 1.6;
const OVERVIEW = new THREE.Vector3(0, 9, 7);
let firstArrival = true;
const eye = new THREE.Vector3();
const target = new THREE.Vector3();

/** The rectangle's edge, clockwise as seen from the camera. */
function edgePath({ x0, y0, w, h }: typeof RING): [number, number][] {
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

export function HomeLoop({ shift = 1.25 }: { shift?: number }) {
  const level = DIAGONAL;
  const rect = RING;
  // the ring: the rectangle's edge only
  const tiles = useMemo(() => edgePath(rect), [rect]);
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
    const pos = Array.from({ length: FROGS }, (_, j) => Math.floor((j * path.length) / FROGS));
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
  }, [level, rect]);

  // Camera: beside the copy on wide screens, above it on narrow ones. On
  // arrival it glides into place: from a high overview when the page loads,
  // or from wherever the camera was (a level) when coming back home.
  const mode = useGame((s) => s.mode);
  const centre = FOCUS;
  const intro = useRef<{ t0: number; eye: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  /** Where the camera rests (into eye / target), swaying gently over time. */
  const pose = (t: number, aspect: number) => {
    const sway = Math.sin(t * 0.13) * 0.35;
    const k = Math.max(0.9, centre.span / 8.5);
    if (aspect > 1.1) {
      const sx = -shift * Math.min(aspect, 2.2) * 1.75;
      eye.set(centre.x + sx + sway, 7.6 * k, -centre.y + 11.6 * k);
      target.set(centre.x + sx, 0.2, -centre.y + 0.4);
    } else {
      // narrow: far enough back that the scene's width fits the screen
      const kn = Math.max(k, centre.span / (aspect * 13.5));
      eye.set(centre.x + sway, 10 * kn, -centre.y + 15.5 * kn);
      target.set(centre.x, -1.6 * kn, -centre.y + 2.4 * kn);
    }
  };

  // Decide where the glide starts before the first frame is drawn, and on a
  // fresh page load put the camera there right away (no default-camera frame).
  const { camera, size, clock } = useThree();
  useLayoutEffect(() => {
    const t = clock.elapsedTime;
    pose(t, size.width / size.height);
    const c = cameraRig.controls;
    if (firstArrival) {
      firstArrival = false;
      intro.current = { t0: t, eye: eye.clone().add(OVERVIEW), target: target.clone() };
      camera.position.copy(intro.current.eye);
      camera.lookAt(intro.current.target);
      void c?.setLookAt(...intro.current.eye.toArray(), ...intro.current.target.toArray(), false);
    } else {
      // where the camera is right now (not where a running camera move is headed)
      intro.current = {
        t0: t,
        eye: c ? c.getPosition(new THREE.Vector3(), false) : camera.position.clone(),
        target: c ? c.getTarget(new THREE.Vector3(), false) : target.clone(),
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(({ clock, size, camera }) => {
    if (mode !== 'menu' || !intro.current) return;
    const c = cameraRig.controls;
    const t = clock.elapsedTime;
    pose(t, size.width / size.height);
    const u = Math.min(1, (t - intro.current.t0) / INTRO_SECONDS);
    // ease in and out, so the glide neither jerks off nor stops dead
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    eye.lerpVectors(intro.current.eye, eye, e);
    target.lerpVectors(intro.current.target, target, e);
    if (c) void c.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, false);
    else {
      // before the controls exist (the very first frames), place the camera directly
      camera.position.copy(eye);
      camera.lookAt(target);
    }
  });

  const win = useMemo(() => ({ cx: Math.round(centre.x), cy: Math.round(centre.y), R: 16 }), [centre]);
  return (
    <group>
      <Floor level={level} pond={0} y={0} opacity={1} initialOpacity={0} fadeSpeed={2.6} showAxes={false} showStop showGoal />
      <Slabs version={version} dim={false} showStop showGoal />
      <GoalColumns level={level} pond={0} win={win} version={version} />
      <StartEggs eggs={eggs} />
      <Frogs />
      <HatchShells />
    </group>
  );
}
