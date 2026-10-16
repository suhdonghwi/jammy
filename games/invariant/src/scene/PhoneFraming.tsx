import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useGame } from '../game/store';

// On a phone the HUD covers much of a tall, narrow screen. In a level the view
// widens, part of the way to what a wider screen shows across (all the way
// would leave the tiles too small to tap), and its centre moves into the gap
// between what hangs from the top (the top bar, the program) and what stands
// at the bottom (the caption and controls), so whatever the camera looks at
// isn't under a panel. The HUD marks those parts with data-frame="top" and
// data-frame="bottom", and the caption with data-caption.
//
// The caption gets a fixed allowance rather than its measured height: it
// changes with every step, and the view drifting each time would look like the
// camera moving on its own. Panels opening or folding do move the view, with a
// glide; a level opening puts it in place at once.

/** Tailwind's sm breakpoint: below it the HUD is the phone layout. */
const PHONE = 640;
/** The canvas's vertical field of view, in degrees. */
const FOV = 36;
/** Narrower than this, the view widens to keep this much across. */
const MIN_ASPECT = 0.6;
/** Room (px) kept for the caption above the controls, whatever it says. */
const CAPTION_ROOM = 150;

/** How far (px, down) the middle of the gap the HUD leaves is from the screen's middle. */
function gapShift(height: number): number {
  let top = 0;
  let bottom = height;
  for (const el of document.querySelectorAll('[data-frame]')) {
    if (el.getAttribute('data-frame') === 'top') {
      top = Math.max(top, el.getBoundingClientRect().bottom);
      continue;
    }
    // the controls start where the caption ends (or where it would start, with none showing)
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
    // a level that just opened starts framed; after that a panel opening or folding glides the view
    const fresh = on && shown.current !== level;
    shown.current = on ? level : null;
    shift.current = fresh ? goal : THREE.MathUtils.damp(shift.current, goal, 6, dt);
    if (Math.abs(shift.current) < 0.25) shift.current = 0;
    const a = applied.current;
    if (a.fov === fov && Math.abs(a.shift - shift.current) < 0.25 && a.w === size.width && a.h === size.height) return;
    applied.current = { fov, shift: shift.current, w: size.width, h: size.height };
    camera.fov = fov;
    // a view window moved up shows the scene lower down
    if (shift.current) camera.setViewOffset(size.width, size.height, 0, -shift.current, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  });
  return null;
}
