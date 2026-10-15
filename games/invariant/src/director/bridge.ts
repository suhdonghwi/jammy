import { useGame } from '../game/store';
import { cameraRig } from '../scene/cameraRig';
import { bridgeState } from '../scene/level/BridgeCinematic';
import { begin, caption, currentLevel, sleep, tween } from './sequence';

/** Chapter 2's opening: the tutorial's rows lift apart into a stack of ponds. */
export async function playBridge() {
  const tok = begin();
  useGame.setState({ busy: true, cinematic: true });
  bridgeState.t = 0;
  try {
    // the cinematic lives at y = 0, independent of the level's pond floors
    const c = cameraRig.controls;
    await c?.setLookAt(4.5, 9, 10, 2, -1.2, -2.5, false);
    caption('Remember the tutorial? Each row was one input n.');
    await sleep(2000);
    if (!tok.alive) return;
    caption('Frogs never change rows — so each row is its own world. Let’s lift them apart.');
    void c?.setLookAt(14.5, 11, 13.5, 2, 2.9, -2.5, true);
    await tween(bridgeState, { t: 1, duration: 3, ease: 'power1.inOut' });
    caption('From now on, each input is its own pond, stacked on top of each other.');
    await sleep(1600);
  } finally {
    useGame.setState({ cinematic: false });
    if (tok.alive) {
      useGame.setState({ busy: false });
      const cam = currentLevel().camera ?? { x: 0, y: 0 };
      void cameraRig.resetAngle();
      await cameraRig.lookAtTile(cam.x, cam.y, cam.distance ?? 14);
    }
  }
}
