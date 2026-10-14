// Visual constants. Everything the level fixes is grayscale; only the
// learner's area uses the accent color and height. Red is for failures only.

export const COLORS = {
  background: '#e9ebef',
  tile: '#fbfbfa',
  stopTile: '#d9dce2',
  stopLine: '#9aa1ad',
  goal: '#5b6472',
  slab: '#7fb2f0',
  slabSide: '#5d95d9',
  egg: '#f3ead2',
  frog: '#5fbf4a',
  testFrog: '#b48cf0',
  fail: '#ef4f4f',
  hand: '#f4f1ec',
  axis: '#b9bfca',
  ghost: '#8a93a3',
  sheet: '#ffffff',
};

export const SLAB_H = 0.22;
export const TILE = 0.94;
export const POND_SPACING = 3.2;

/** Tile (X, Y) → world position. +Y goes away from the camera. */
export function tileToWorld(x: number, y: number): [number, number] {
  return [x, -y];
}

export function worldToTile(wx: number, wz: number): [number, number] {
  return [Math.round(wx), Math.round(-wz)];
}
