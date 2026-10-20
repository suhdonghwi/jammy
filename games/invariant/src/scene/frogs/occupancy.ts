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

export function slotFor(index: number, count: number): Slot {
  const layout = LAYOUTS[Math.min(count, MAX_SHOWN) - 1] ?? LAYOUTS[0];
  if (index >= MAX_SHOWN) return { dx: 0, dy: 0, scale: 0 };
  return layout[index] ?? LAYOUTS[0][0];
}

export const occupancy = {
  frogs: new Map<string, number>(),
  eggs: new Set<string>(),
  eggSlots: new Map<string, Slot>(),
  version: 0,
  signature: '',
};
