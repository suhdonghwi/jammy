import { compileLevel, defineLevel, type CompiledLevel } from '../../levels/level';

// Tiny decorative "programs" for the home screen. They are never played: their
// loop condition and postcondition just shape the floor (striped zones where
// the loop would stop, the boundary line around them, goal pools), and frogs
// placed on them get the usual goal splash when they land on a pool.

const decor = (id: string, source: string) =>
  compileLevel(defineLevel({ id, title: id, chapter: 0, source, view: { x: 'x', y: 'y' }, solutions: [] }));

/** No stripes, no goals: a plain floor. */
export const PLAIN: CompiledLevel = decor(
  'home-plain',
  `var x, y;
while (true) {
  x = x + 1;
}
ensures false;`,
);

/** A striped stop zone from x = 9 rightward, with a few goal pools on its edge (every third row, near the area). */
export const STRIPES: CompiledLevel = decor(
  'home-stripes',
  `var x, y;
while (x < 9) {
  x = x + 1;
}
ensures x == 9 && y % 3 == 0 && y >= -3 && y <= 6;`,
);

/** The counter's world: stripes below the diagonal, goals on it. */
export const DIAGONAL: CompiledLevel = decor(
  'home-diagonal',
  `var x, y;
while (x < y) {
  x = x + 1;
}
ensures x == y;`,
);
