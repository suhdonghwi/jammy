import type { CameraControls } from '@react-three/drei';
import * as THREE from 'three';

// The camera, for code outside the canvas: where it looks and gliding it to tiles.

type Controls = CameraControls;

let controls: Controls | null = null;
const tmp = new THREE.Vector3();

/** Default viewing angle: looking "north", slightly from the right, fairly top-down. */
export const VIEW = { polar: 0.8, azimuth: 0.26 };

export const cameraRig = {
  /** World y of the focused pond's floor. */
  layerY: 0,
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
  /** Glide so the given tile (in the focused pond) is centered. */
  async lookAtTile(x: number, y: number, distance?: number, smooth = true) {
    if (!controls) return;
    const moves: Promise<void>[] = [controls.moveTo(x, this.layerY, -y, smooth)];
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
