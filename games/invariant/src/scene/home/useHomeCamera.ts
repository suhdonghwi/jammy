import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { cameraRig, type Shot } from '../cameraRig';
import { easeInOut } from '../easing';
import { sceneNow } from '../sceneTime';

const RING: Shot = { focus: [[1, 8], [7, 8], [1, 12], [7, 12]] };
const ANGLE = { az: 0, po: 0.95 };
const PADDING = 0.15;
const SWAY = 0.025;
const INTRO_SECONDS = 1.6;
const OVERVIEW = new THREE.Vector3(0, 9, 7);
const FALLBACK = { x: 4, y: 10, d: 20 };

const eye = new THREE.Vector3();
const target = new THREE.Vector3();
const sph = new THREE.Spherical();

function restingPose(t: number, size: { width: number; height: number }) {
  const at = cameraRig.fitInto(RING, ANGLE, size, PADDING) ?? FALLBACK;
  target.set(at.x, 0, -at.y);
  eye.setFromSpherical(sph.set(at.d, ANGLE.po, ANGLE.az + Math.sin(t * 0.13) * SWAY)).add(target);
}

export function useHomeCamera() {
  const mode = useGame((s) => s.mode);
  const intro = useRef<{ t0: number; eye: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const t = sceneNow();
    restingPose(t, size);
    intro.current = { t0: t, eye: eye.clone().add(OVERVIEW), target: target.clone() };
    camera.position.copy(intro.current.eye);
    camera.lookAt(intro.current.target);
    void cameraRig.controls?.setLookAt(...intro.current.eye.toArray(), ...intro.current.target.toArray(), false);
  }, []);

  useFrame(({ size, camera }) => {
    if (mode !== 'menu' || !intro.current) return;
    const t = sceneNow();
    restingPose(t, size);
    const u = Math.min(1, (t - intro.current.t0) / INTRO_SECONDS);
    const e = easeInOut(u);
    eye.lerpVectors(intro.current.eye, eye, e);
    target.lerpVectors(intro.current.target, target, e);
    const c = cameraRig.controls;
    if (c) void c.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, false);
    else {
      camera.position.copy(eye);
      camera.lookAt(target);
    }
  });
}
