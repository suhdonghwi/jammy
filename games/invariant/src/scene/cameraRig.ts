import type { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { tileToWorld } from './constants';

type Controls = CameraControls;

let controls: Controls | null = null;
const tmp = new THREE.Vector3();

/** Fixed viewing angle: slightly isometric, looking "north". */
export const VIEW = { polar: 0.95, azimuth: 0.32 };

export const cameraRig = {
  debug() {
    if (!controls) return null;
    const t = controls.getTarget(new THREE.Vector3());
    return { target: t.toArray(), distance: controls.distance, polar: controls.polarAngle, azimuth: controls.azimuthAngle };
  },
  attach(c: Controls | null) {
    controls = c;
  },
  get controls() {
    return controls;
  },
  target(): THREE.Vector3 {
    if (!controls) return tmp.set(0, 0, 0);
    return controls.getTarget(tmp);
  },
  distance(): number {
    return controls ? controls.distance : 14;
  },
  /** Glide so the given tile is centered. */
  async lookAtTile(x: number, y: number, distance?: number, smooth = true) {
    if (!controls) return;
    const [wx, wz] = tileToWorld(x, y);
    const moves: Promise<void>[] = [controls.moveTo(wx, 0, wz, smooth)];
    if (distance !== undefined) moves.push(controls.dollyTo(distance, smooth));
    await Promise.all(moves);
  },
  async zoomTo(distance: number, smooth = true) {
    if (!controls) return;
    await controls.dollyTo(distance, smooth);
  },
  async resetAngle(smooth = true) {
    if (!controls) return;
    await controls.rotateTo(VIEW.azimuth, VIEW.polar, smooth);
  },
};
