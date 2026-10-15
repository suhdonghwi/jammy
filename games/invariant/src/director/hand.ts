import * as THREE from 'three';
import type { State } from '../lang/ast';
import { field } from '../scene/area/field';
import { SLAB_H } from '../scene/constants';
import { frogWorld, type FrogSim } from '../scene/frogs/frogWorld';
import { occupancy } from '../scene/frogs/occupancy';
import { handState } from '../scene/hand/handState';
import { sceneNow } from '../scene/sceneTime';
import { currentLevel, sleep, tween, type Token } from './sequence';

// The skeptical hand's moves. Positions are tiles (x, y) in the focused pond.

type HandPose = Partial<typeof handState>;

/** Bring the hand in over tile (x, y), at height h. */
export async function handIn(x: number, y: number, h = 1.8, pose: HandPose = {}) {
  if (handState.visible < 0.05) {
    Object.assign(handState, { x: x + 1.5, y: h + 5, z: -y - 3, curl: 0.25, point: 0, shrug: 0, tap: 0, yaw: 0, tilt: 0 });
  }
  await tween(handState, { visible: 1, x, y: h, z: -y, duration: 0.7, ease: 'power3.out', ...pose });
}

export async function handOut() {
  await tween(handState, { visible: 0, y: handState.y + 4, z: handState.z - 2, point: 0, shrug: 0, tap: 0, yaw: 0, tilt: 0, palmUp: 0, duration: 0.6, ease: 'power2.in' });
}

const PALM_TOP = 0.125; // palm surface above the hand's origin when palm-up
const SET_DOWN = 0.42; // palm surface height above the tile when releasing
const BEHIND = 0.6; // the palm waits this far behind the tile (away from the camera)

/**
 * The hand brings a test frog sitting in its cupped, upturned palm, lowers it
 * just behind the target tile, and the frog hops forward off the palm — over
 * the curled fingertips — onto the tile. Then the hand withdraws.
 */
export async function placeTestFrog(tok: Token, s: State): Promise<FrogSim | null> {
  const L = currentLevel();
  const x = Number(s[L.view.x]);
  const y = Number(s[L.view.y]);
  const base = field.heightAt(x, y) * SLAB_H;
  // the frog rides on the palm: its height follows the hand
  const f = frogWorld.add(L, 'test', s, { carried: 6, carryOff: { dx: 0, dy: BEHIND } });
  const follow = () => {
    f.carried = handState.y + PALM_TOP - base;
  };
  Object.assign(handState, { x, y: base + 6, z: -y - BEHIND, curl: 0.45, point: 0, shrug: 0, tap: 0, yaw: 0, tilt: 0.3, palmUp: 1, visible: 0 });
  follow();
  await tween(handState, { visible: 1, y: base + SET_DOWN - PALM_TOP + 0.6, duration: 0.65, ease: 'power3.out', onUpdate: follow });
  if (!tok.alive) return null;
  await tween(handState, { y: base + SET_DOWN - PALM_TOP, curl: 0.3, duration: 0.35, ease: 'power2.inOut', onUpdate: follow });
  if (!tok.alive) return null;
  // the frog hops forward and down onto the tile, clearing the fingertips
  f.carried = undefined;
  f.carryOff = undefined;
  f.drop = { t0: sceneNow(), dur: 0.5, from: SET_DOWN, arc: 0.32, dx: 0, dy: BEHIND };
  await sleep(380);
  if (!tok.alive) return null;
  await tween(handState, { palmUp: 0, tilt: 0, curl: 0.15, y: base + 2.2, z: -y - BEHIND - 0.8, duration: 0.45, ease: 'power2.inOut' });
  return f;
}

// The pointing pose (from the tile's right side, so the hand never hides the
// frog), and where the index fingertip sits relative to the hand's origin in
// it. From the glove in Hand.tsx: the index finger's base is at
// (-0.235, -0.01, -0.24), it is splayed out by 0.12 rad, and straight it reaches
// 0.395 further (two segments plus the rounded tip); the glove is drawn at 0.95.
const POINT_POSE = { point: 1, curl: 0.2, tilt: -0.32, yaw: -1.45 };
const INDEX_DIR = new THREE.Vector3(-Math.sin(0.12), 0, -Math.cos(0.12));
const FINGERTIP = new THREE.Vector3(-0.235, -0.01, -0.24).addScaledVector(INDEX_DIR, 0.395).multiplyScalar(0.95);

function fingertipFrame() {
  const e = new THREE.Euler(-0.3 + POINT_POSE.tilt, Math.PI + POINT_POSE.yaw, 0, 'YXZ');
  return { tip: FINGERTIP.clone().applyEuler(e), dir: INDEX_DIR.clone().applyEuler(e) };
}

/**
 * Point at whatever sits on tile (x, y) — an egg or a frog: the fingertip stops
 * just short of it, angled down at its middle, then jabs at it a few times. A
 * hand that is away comes in already pointing, from above and behind.
 */
export async function pointAt(x: number, y: number) {
  const slot = occupancy.eggSlots.get(`${x},${y}`);
  const ground = field.heightAt(x, y) * SLAB_H;
  const target = new THREE.Vector3(x + (slot?.dx ?? 0), ground + 0.2, -y - (slot?.dy ?? 0));
  const { tip, dir } = fingertipFrame();
  // fingertip a little way back from the target's middle, along the finger
  const at = target.clone().addScaledVector(dir, -0.3).sub(tip);
  const back = at.clone().addScaledVector(dir, -0.12);
  const away = handState.visible < 0.05;
  if (away) Object.assign(handState, { x: back.x + 1.5, y: back.y + 5, z: back.z - 3, ...POINT_POSE, shrug: 0, tap: 0, palmUp: 0 });
  await tween(handState, { visible: 1, x: back.x, y: back.y, z: back.z, ...POINT_POSE, duration: away ? 0.7 : 0.5, ease: away ? 'power3.out' : 'power2.out' });
  await tween(handState, { x: at.x, y: at.y, z: at.z, duration: 0.16, yoyo: true, repeat: 3, ease: 'sine.inOut' });
}
