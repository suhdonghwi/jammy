import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../game/store';
import { cameraRig } from './cameraRig';

const PHONE = 640;
const FOV = 36;
const MIN_ASPECT = 0.6;

export function Framing() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useFrame(() => {
    const { mode } = useGame.getState();
    const aspect = size.width / size.height;
    const narrow = size.width < PHONE && mode !== 'menu' && aspect < MIN_ASPECT;
    const fov = narrow ? THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * MIN_ASPECT) / aspect)) : FOV;
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    cameraRig.tick(size.width, size.height, mode !== 'menu');
  });
  return null;
}
