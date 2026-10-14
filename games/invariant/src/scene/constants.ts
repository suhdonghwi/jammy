import * as THREE from 'three';

// Visual language: everything the level fixes is quiet grayscale; the learner's
// area is the only saturated surface (blue slabs). Goals are amber, real frogs
// green, test frogs violet, failures red.

export const COLORS = {
  horizon: '#e8ecf2',
  gap: '#d3d9e2',
  void: '#e6eaf0',
  tile: '#ffffff',
  stopTile: '#eef0f4',
  stopHatch: '#dde2ea',
  stopEdge: '#6f7b8f',
  hover: '#2f6fe0',
  cross: '#eaf1fd',
  slabTop: '#5c9df5',
  slabSide: '#3a78d8',
  slabStopTop: '#93b2dc',
  goal: '#f2a91f',
  goalGlow: '#ffc94d',
  portalA: '#ff4f8b',
  portalB: '#ffad33',
  egg: '#f8efd9',
  frog: '#52c24a',
  testFrog: '#a77df2',
  fail: '#f04f55',
  glove: '#ffffff',
  outline: '#2a3142',
  label: '#9aa4b4',
  labelStrong: '#5d6878',
};

export const SLAB_H = 0.24;
export const TILE = 0.9;
export const POND_SPACING = 6;

export const color = (c: string) => new THREE.Color(c);

export const clock = {
  /** Seconds since start — used by GPU-side animations. */
  t0: performance.now(),
  now() {
    return (performance.now() - this.t0) / 1000;
  },
};
