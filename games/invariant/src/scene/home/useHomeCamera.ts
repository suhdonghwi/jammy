import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../../game/store';
import { cameraRig } from '../cameraRig';
import { sceneNow } from '../sceneTime';

/** What the camera frames: centre tile and width in tiles. */
const FOCUS = { x: 4.6, y: 9, span: 11 };
/** How far left of the focus the camera looks on wide screens (the copy sits on the left). */
const SHIFT = 1.25;
/** The glide into place on arrival (seconds), and where it starts on a fresh page load. */
const INTRO_SECONDS = 1.6;
const OVERVIEW = new THREE.Vector3(0, 9, 7);

let firstArrival = true;
const eye = new THREE.Vector3();
const target = new THREE.Vector3();

/** Where the camera rests (into eye / target), swaying gently over time. */
function restingPose(t: number, aspect: number) {
  const sway = Math.sin(t * 0.13) * 0.35;
  const k = Math.max(0.9, FOCUS.span / 8.5);
  if (aspect > 1.1) {
    // wide: beside the copy
    const sx = -SHIFT * Math.min(aspect, 2.2) * 1.75;
    eye.set(FOCUS.x + sx + sway, 7.6 * k, -FOCUS.y + 11.6 * k);
    target.set(FOCUS.x + sx, 0.2, -FOCUS.y + 0.4);
  } else {
    // narrow: above the copy, far enough back that the scene's width fits the screen
    const kn = Math.max(k, FOCUS.span / (aspect * 13.5));
    eye.set(FOCUS.x + sway, 10 * kn, -FOCUS.y + 15.5 * kn);
    target.set(FOCUS.x, -1.6 * kn, -FOCUS.y + 2.4 * kn);
  }
}

/**
 * The home screen drives the camera itself. On arrival it glides into place:
 * from a high overview when the page loads, or from wherever the camera was (a
 * level) when coming back home.
 */
export function useHomeCamera() {
  const mode = useGame((s) => s.mode);
  const intro = useRef<{ t0: number; eye: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  // Decide where the glide starts before the first frame is drawn, and on a
  // fresh page load put the camera there right away (no default-camera frame).
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    const t = sceneNow();
    restingPose(t, size.width / size.height);
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

  useFrame(({ size, camera }) => {
    if (mode !== 'menu' || !intro.current) return;
    const t = sceneNow();
    restingPose(t, size.width / size.height);
    const u = Math.min(1, (t - intro.current.t0) / INTRO_SECONDS);
    // ease in and out, so the glide neither jerks off nor stops dead
    const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    eye.lerpVectors(intro.current.eye, eye, e);
    target.lerpVectors(intro.current.target, target, e);
    const c = cameraRig.controls;
    if (c) void c.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, false);
    else {
      // before the controls exist (the very first frames), place the camera directly
      camera.position.copy(eye);
      camera.lookAt(target);
    }
  });
}
