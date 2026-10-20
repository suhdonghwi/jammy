import type { CameraControls } from '@react-three/drei';
import * as THREE from 'three';

let controls: CameraControls | null = null;
const tmp = new THREE.Vector3();
const onScreen = new THREE.Vector3();

const VIEW = { polar: 0.8, azimuth: 0.26 };

export const cameraRig = {
  attach(c: CameraControls | null) {
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
  inView(x: number, y: number, reach = 1): boolean {
    if (!controls) return true;
    const p = onScreen.set(x, 0, -y).project(controls.camera);
    return Math.abs(p.x) < 0.65 * reach && Math.abs(p.y) < 0.5 * reach;
  },
  async lookAtTile(x: number, y: number, distance?: number, smooth = true) {
    if (!controls) return;
    const moves: Promise<void>[] = [controls.moveTo(x, 0, -y, smooth)];
    if (distance !== undefined) moves.push(controls.dollyTo(distance, smooth));
    await Promise.all(moves);
  },
  async zoomTo(distance: number) {
    if (!controls) return;
    await controls.dollyTo(distance, true);
  },
  async resetAngle(smooth = true) {
    if (!controls) return;
    await controls.rotateTo(VIEW.azimuth, VIEW.polar, smooth);
  },
};
