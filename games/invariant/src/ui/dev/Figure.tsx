import { useEffect } from 'react';
import { clickTile, stepFrogs } from '../../director/controls';
import { useGame } from '../../game/store';
import { levels, tutorialLevel } from '../../levels/catalog';
import type { LevelDef } from '../../levels/level';
import { cameraRig, type Tile } from '../../scene/cameraRig';
import { figureClip, type ClipBox } from '../../scene/figureClip';
import { sceneStarted, sleep } from '../../scene/sceneTime';

/**
 * Development only (`?figure=<name>`): a few tiles of a level as a figure for
 * the paper, on a transparent page with no HUD. scripts/make-figure.ts
 * screenshots it once `__figureReady` is set. Each figure is one of
 * FIGURES; the figures of one group share a box, so their boards line up.
 */
interface FigureDef {
  level: LevelDef;
  box: ClipBox;
  /** The tile whose egg hatches, and how many hops its frog makes. */
  frog?: { tile: Tile; hops: number };
  /** The area. Bounds that keep its slabs inside the box leave it the same there. */
  area?: string;
  /** Hide the eggs, the stop region and the goals. */
  bare?: boolean;
}

const overshoot = levels.find((l) => l.id === 'overshoot')!;

// The tutorial's twelve states (i from 0 to 3, n from 0 to 2), built up in
// three steps: a, the tiles and one frog's run along n = 2; b, a with eggs,
// the stop region and goals; c, b with the area of `i <= n`.
const STATES: ClipBox = { x0: 0, y0: 0, x1: 3, y1: 2 };
const IN_STATES = 'i >= 0 && n <= 2';

// Overshoot's states (i from 0 to 5, n from 0 to 2), one guess after another:
// `i == n` fails Initialization, `i <= n` Maintenance (the frog from the egg
// at n = 2 hops to i = 3), `i <= n + 3` Exit, and `i <= n + 2` passes.
const OVERSHOOT: ClipBox = { x0: 0, y0: 0, x1: 5, y1: 2 };
const IN_OVERSHOOT = 'i >= 0 && i <= 5 && n <= 2';

export const FIGURES: Record<string, FigureDef> = {
  a: { level: tutorialLevel, box: STATES, frog: { tile: [0, 2], hops: 2 }, bare: true },
  b: { level: tutorialLevel, box: STATES, frog: { tile: [0, 2], hops: 2 } },
  c: { level: tutorialLevel, box: STATES, frog: { tile: [0, 2], hops: 2 }, area: `i <= n && ${IN_STATES}` },
  'overshoot-init': { level: overshoot, box: OVERSHOOT, area: `i == n && ${IN_OVERSHOOT}` },
  'overshoot-maint': { level: overshoot, box: OVERSHOOT, frog: { tile: [0, 2], hops: 1 }, area: `i <= n && ${IN_OVERSHOOT}` },
  'overshoot-exit': { level: overshoot, box: OVERSHOOT, area: `i <= n + 3 && ${IN_OVERSHOOT}` },
  'overshoot-pass': { level: overshoot, box: OVERSHOOT, area: `i <= n + 2 && ${IN_OVERSHOOT}` },
};

const SETTLE_MS = 2500;

export function Figure() {
  useEffect(() => {
    const name = new URLSearchParams(location.search).get('figure') || 'c';
    const fig = FIGURES[name];
    if (!fig) throw new Error(`no figure ${name}`);
    figureClip.box = fig.box;
    document.documentElement.style.background = 'transparent';
    useGame.getState().openLevel(fig.level, 'level');
    useGame.getState().setReveal({ hover: false });
    void (async () => {
      while (!sceneStarted()) await sleep(50);
      await sleep(400);
      if (fig.frog) {
        clickTile(...fig.frog.tile);
        await sleep(600);
        for (let k = 0; k < fig.frog.hops; k++) await stepFrogs();
      }
      if (fig.bare) useGame.getState().setReveal({ eggs: false, stop: false, goals: false });
      if (fig.area) useGame.getState().setFormula(fig.area);
      useGame.setState({ caption: null, callouts: [], frogTags: false });
      const { x0, y0, x1, y1 } = fig.box;
      const tiles: Tile[] = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) tiles.push([x, y]);
      await cameraRig.frame({ focus: tiles }, false);
      await sleep(SETTLE_MS);
      Object.assign(window, { __figureReady: true });
    })();
  }, []);
  return null;
}
