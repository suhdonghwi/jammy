import { useEffect } from 'react';
import { clickTile, stepFrogs } from '../../director/controls';
import { useGame } from '../../game/store';
import { tutorialLevel } from '../../levels/catalog';
import { cameraRig, type Tile } from '../../scene/cameraRig';
import { figureClip } from '../../scene/figureClip';
import { sceneStarted, sleep } from '../../scene/sceneTime';

/**
 * Development only (`?figure=a|b|c`): the tutorial's twelve states (i from 0
 * to 3, n from 0 to 2) as a figure for the paper, on a transparent page with
 * no HUD. scripts/make-figure.ts screenshots it once `__figureReady` is set.
 *
 * a: the tiles and one frog's run along n = 2
 * b: a, with eggs, the stop region and goals
 * c: b, with the area of `i <= n`
 */
const BOX = { x0: 0, y0: 0, x1: 3, y1: 2 };
const SETTLE_MS = 2500;

// The area is `i <= n`; the extra bounds keep its slabs inside the box, where
// it is the same area.
const AREA = 'i <= n && i >= 0 && n <= 2';

export function Figure() {
  useEffect(() => {
    const step = new URLSearchParams(location.search).get('figure') || 'c';
    figureClip.box = BOX;
    document.documentElement.style.background = 'transparent';
    useGame.getState().openLevel(tutorialLevel, 'level');
    useGame.getState().setReveal({ hover: false });
    void (async () => {
      while (!sceneStarted()) await sleep(50);
      await sleep(400);
      clickTile(0, 2);
      await sleep(600);
      await stepFrogs();
      await stepFrogs();
      if (step === 'a') useGame.getState().setReveal({ eggs: false, stop: false, goals: false });
      if (step === 'c') useGame.getState().setFormula(AREA);
      useGame.setState({ caption: null, callouts: [], frogTags: false });
      const tiles: Tile[] = [];
      for (let y = BOX.y0; y <= BOX.y1; y++) for (let x = BOX.x0; x <= BOX.x1; x++) tiles.push([x, y]);
      await cameraRig.frame({ focus: tiles }, false);
      await sleep(SETTLE_MS);
      Object.assign(window, { __figureReady: true });
    })();
  }, []);
  return null;
}
