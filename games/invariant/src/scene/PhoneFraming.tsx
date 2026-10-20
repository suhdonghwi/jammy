import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../game/store';

const PHONE = 640;
const FOV = 36;
const MIN_ASPECT = 0.6;
const CAPTION_ROOM = 150;

function gapShift(height: number): number {
  let top = 0;
  let bottom = height;
  for (const el of document.querySelectorAll('[data-frame]')) {
    if (el.getAttribute('data-frame') === 'top') {
      top = Math.max(top, el.getBoundingClientRect().bottom);
      continue;
    }
    const caption = el.querySelector('[data-caption]');
    const edge = caption ? caption.getBoundingClientRect().bottom : el.getBoundingClientRect().top;
    bottom = Math.min(bottom, edge - CAPTION_ROOM);
  }
  return bottom > top ? (top + bottom) / 2 - height / 2 : 0;
}

export function PhoneFraming() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const shift = useRef(0);
  const shown = useRef<unknown>(null);
  const applied = useRef({ fov: FOV, shift: 0, w: 0, h: 0 });
  useFrame((_, dt) => {
    const { mode, level } = useGame.getState();
    const on = size.width < PHONE && mode !== 'menu';
    const aspect = size.width / size.height;
    const fov = on && aspect < MIN_ASPECT ? THREE.MathUtils.radToDeg(2 * Math.atan((Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * MIN_ASPECT) / aspect)) : FOV;
    const goal = on ? gapShift(size.height) : 0;
    const fresh = on && shown.current !== level;
    shown.current = on ? level : null;
    shift.current = fresh ? goal : THREE.MathUtils.damp(shift.current, goal, 6, dt);
    if (Math.abs(shift.current) < 0.25) shift.current = 0;
    const a = applied.current;
    if (a.fov === fov && Math.abs(a.shift - shift.current) < 0.25 && a.w === size.width && a.h === size.height) return;
    applied.current = { fov, shift: shift.current, w: size.width, h: size.height };
    camera.fov = fov;
    if (shift.current) camera.setViewOffset(size.width, size.height, 0, -shift.current, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  });
  return null;
}
