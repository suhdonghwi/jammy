import { compileLevel, type CompiledLevel } from '../../levels/level';

// A tiny decorative "program" for the home screen. It is never played: its loop
// condition shapes the striped zone where the loop would stop (with the
// boundary line around it), and its postcondition places goal pools in it.
// Frogs placed in it get the usual goal splash when they land on a pool.

/** The counter's world: stripes below the diagonal, with pools on it near the ring. */
export const DIAGONAL: CompiledLevel = compileLevel({
  id: 'home-diagonal',
  title: 'home',
  chapter: 0,
  source: `var x, y;
while (x < y) {
  x = x + 1;
}
ensures x == y && x >= 2 && x <= 9;`,
  view: { x: 'x', y: 'y' },
  solutions: [],
});
