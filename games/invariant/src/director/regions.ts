import { useGame, type Region, type RegionTile } from '../game/store';
import { eggsNear, tilesNear } from '../levels/tiles';
import { cameraRig } from '../scene/cameraRig';

type Center = readonly [number, number, ...number[]];

const viewCenter = (): [number, number] => {
  const t = cameraRig.target();
  return [t.x, -t.z];
};

export function eggRegion(tone: RegionTile['tone'], center: Center = viewCenter()): Region {
  const { level, inputs } = useGame.getState();
  return { center: [center[0], center[1]], tiles: (win) => eggsNear(level!, inputs, win.cx, win.cy, win.R).map(([x, y]) => ({ x, y, tone })) };
}

export function endingsRegion(toneOf: (goal: boolean) => RegionTile['tone'], center: Center = viewCenter()): Region {
  const { level, inputs, valid } = useGame.getState();
  const L = level!;
  return {
    center: [center[0], center[1]],
    tiles: (win) =>
      tilesNear(L, inputs, win, (s, x, y) =>
        L.fast.planeReq(s) === true && L.fast.guard(s) !== true && valid?.fast(s) === true ? { x, y, tone: toneOf(L.fast.post(s) === true) } : undefined,
      ),
  };
}
