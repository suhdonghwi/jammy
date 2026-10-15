import { compileLevel, defineLevel, type CompiledLevel } from '../../levels/level';

// Tiny decorative "programs" for the home screen. They are never played: their
// loop condition shapes the striped zone where the loop would stop (with the
// boundary line around it), and their postcondition places goal pools in it.
// Frogs placed on them get the usual goal splash when they land on a pool.

const decor = (id: string, source: string) =>
  compileLevel(defineLevel({ id, title: id, chapter: 0, source, view: { x: 'x', y: 'y' }, solutions: [] }));

/** Stripes from x = 9 rightward, right at the edge of the area; two pools on that edge. */
export const EDGE: CompiledLevel = decor(
  'home-edge',
  `var x, y;
while (x < 9) {
  x = x + 1;
}
ensures x == 9 && (y == 1 || y == 4);`,
);

/** Stripes from x = 8 rightward, so the area's last column lies in them, with pools there. */
export const THROUGH: CompiledLevel = decor(
  'home-through',
  `var x, y;
while (x < 8) {
  x = x + 1;
}
ensures x == 8 && (y == 1 || y == 4);`,
);

/** A small striped pond (x 5..7, y 3..4) with two pools in it, for a ring of slabs around it. */
export const RING: CompiledLevel = decor(
  'home-ring',
  `var x, y;
while (x < 5 || x > 7 || y < 3 || y > 4) {
  x = x + 1;
}
ensures x == 6 && (y == 3 || y == 4);`,
);

/** The counter's world: stripes below the diagonal, with pools on it near the area. */
export const DIAGONAL: CompiledLevel = decor(
  'home-diagonal',
  `var x, y;
while (x < y) {
  x = x + 1;
}
ensures x == y && x >= 2 && x <= 9;`,
);
