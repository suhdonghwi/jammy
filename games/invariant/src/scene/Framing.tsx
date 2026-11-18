import { useFrame, useThree } from '@react-three/fiber';
import { useGame } from '../game/store';
import { cameraRig } from './cameraRig';

export function Framing() {
  const size = useThree((s) => s.size);
  useFrame(() => {
    cameraRig.tick(size.width, size.height, useGame.getState().mode !== 'menu');
  });
  return null;
}
