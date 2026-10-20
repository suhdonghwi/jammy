import { compileLevel, type CompiledLevel } from '../../levels/level';

export const DIAGONAL: CompiledLevel = compileLevel({
  id: 'home-diagonal',
  title: 'home',
  source: `var x, y;
while (x < y) {
  x = x + 1;
}
ensures x == y && x >= 2 && x <= 9;`,
  view: { x: 'x', y: 'y' },
  solutions: [],
});
