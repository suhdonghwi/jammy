// The hand is driven by GSAP tweens on this plain object and read every frame.
// Positions are in the focused pond's local space (y = 0 is the floor).
export const handState = {
  /** 0 = gone, 1 = fully visible */
  visible: 0,
  x: 0,
  y: 6,
  z: 0,
  /** Finger curl: 0 open, 1 fist. */
  curl: 0.2,
  /** Index finger extension (pointing). */
  point: 0,
  /** Shrug wobble amount. */
  shrug: 0,
  /** Finger-tap animation amount. */
  tap: 0,
  /** Palm tilt (radians). */
  tilt: 0,
  /** Yaw (radians). */
  yaw: 0,
  /** 0 = palm down, 1 = palm up. */
  palmUp: 0,
};

export function resetHand() {
  Object.assign(handState, { visible: 0, x: 0, y: 6, z: 0, curl: 0.2, point: 0, shrug: 0, tap: 0, tilt: 0, yaw: 0, palmUp: 0 });
}
