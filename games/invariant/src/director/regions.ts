import { useGame, type Region, type RegionTile } from '../game/store';
import { eggsNear, tilesNear } from '../levels/tiles';

export function eggRegion(tone: RegionTile['tone']): Region {
  const { level, inputs } = useGame.getState();
  return { id: `eggs-${tone}`, tiles: (win) => eggsNear(level!, inputs, win.cx, win.cy, win.R).map(([x, y]) => ({ x, y, tone })) };
}

export function endingsRegion(tone: RegionTile['tone']): Region {
  const { level, inputs, valid } = useGame.getState();
  const L = level!;
  return {
    id: 'endings',
    tiles: (win) => tilesNear(L, inputs, win, (s, x, y) => (L.fast.planeReq(s) === true && L.fast.guard(s) !== true && valid?.fast(s) === true ? { x, y, tone } : undefined)),
  };
}
