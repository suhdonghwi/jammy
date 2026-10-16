// Several things can share one tile: frogs that landed on the same state, or a
// frog and an unhatched egg. Occupants of a tile are laid out in slots and
// scaled down a little; more than four frogs show four plus a "×n" badge.

export interface Slot {
  dx: number;
  dy: number;
  scale: number;
}

const LAYOUTS: Slot[][] = [
  [{ dx: 0, dy: 0, scale: 1 }],
  [
    { dx: -0.2, dy: 0.02, scale: 0.78 },
    { dx: 0.2, dy: -0.02, scale: 0.78 },
  ],
  [
    { dx: -0.2, dy: -0.13, scale: 0.7 },
    { dx: 0.2, dy: -0.13, scale: 0.7 },
    { dx: 0, dy: 0.18, scale: 0.7 },
  ],
  [
    { dx: -0.2, dy: 0.19, scale: 0.62 },
    { dx: 0.2, dy: 0.19, scale: 0.62 },
    { dx: -0.2, dy: -0.19, scale: 0.62 },
    { dx: 0.2, dy: -0.19, scale: 0.62 },
  ],
];

export const MAX_SHOWN = 4;

/** Slot for occupant `index` of `count` on one tile (index ≥ 4 is hidden). */
export function slotFor(index: number, count: number): Slot {
  const layout = LAYOUTS[Math.min(count, MAX_SHOWN) - 1] ?? LAYOUTS[0];
  if (index >= MAX_SHOWN) return { dx: 0, dy: 0, scale: 0 };
  return layout[index] ?? LAYOUTS[0][0];
}

/** Frogs on each egg tile in the focused plane (the eggs make room for them), published by the frog renderer. */
export const occupancy = {
  frogs: new Map<string, number>(),
  /** Unhatched eggs on screen (tile keys), published by the egg renderer. */
  eggs: new Set<string>(),
  /** Where each egg sits within its tile, so a hatching frog starts there. */
  eggSlots: new Map<string, Slot>(),
  /** Bumps whenever `frogs` changes. */
  version: 0,
  signature: '',
};
