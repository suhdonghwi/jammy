import { defineLevel, type LevelDef } from '../level';

export const tutorialLevel = defineLevel({
  id: 'tutorial',
  title: 'Tutorial',
  chapter: 0,
  source: `input n;
requires n >= 0;

var i = 0;
while (i < n) {
  i = i + 1;
}

ensures i == n;`,
  view: { x: 'i', y: 'n' },
  solutions: ['0 <= i <= n', 'i >= 0 && i <= n', 'i <= n'],
  pitfalls: [
    { formula: 'i == n', message: 'That only covers frogs that are already done.' },
    { formula: 'i == 0 || i == n', message: 'Frogs also pass through the tiles in between.' },
    { formula: 'i >= 0', message: 'Real frogs never pass n — but your area allows it.' },
  ],
  camera: { x: 2, y: 2, distance: 13 },
});

export const levels: LevelDef[] = [
  // ---------------- Chapter 1: One plane ----------------
  defineLevel({
    id: '1-1',
    title: 'Countdown',
    chapter: 1,
    source: `input n;
requires n >= 0;

var i = n;
while (i > 0) {
  i = i - 1;
}

ensures i == 0;`,
    view: { x: 'i', y: 'n' },
    solutions: ['i >= 0', '0 <= i <= n'],
    pitfalls: [{ formula: 'i <= n', message: 'That bound held in the tutorial — but which way does this frog move?' }],
    intro: 'Same idea as the tutorial — but this frog counts down. You are on your own now.',
    camera: { x: 2, y: 2, distance: 13 },
  }),
  defineLevel({
    id: '1-2',
    title: 'Parity',
    chapter: 1,
    source: `var x, y;
requires x >= 0 && (x + y) % 2 == 0;

while (x > 0) {
  x = x - 1;
  y = y + 1;
}

ensures y % 2 == 0;`,
    view: { x: 'x', y: 'y' },
    solutions: ['x >= 0 && (x + y) % 2 == 0'],
    pitfalls: [
      { formula: '(x + y) % 2 == 0', message: 'The hop keeps x + y even — but your area also lets x go negative.' },
      { formula: 'y % 2 == 0', message: 'That is just the goal. Do all eggs sit there?' },
    ],
    intro: 'Eggs everywhere on a checkerboard. Every frog hops diagonally until x reaches 0.',
    camera: { x: 2, y: 2, distance: 15 },
  }),
  defineLevel({
    id: '1-3',
    title: 'Step by Two',
    chapter: 1,
    source: `input n;
requires n >= 0 && n % 2 == 0;

var i = 0;
while (i < n) {
  i = i + 2;
}

ensures i == n;`,
    view: { x: 'i', y: 'n' },
    solutions: ['i <= n && i % 2 == 0', '0 <= i <= n && i % 2 == 0'],
    pitfalls: [
      { formula: 'i <= n', message: 'From an odd i, a hop of 2 can jump right past n.' },
      { formula: '0 <= i <= n', message: 'From an odd i, a hop of 2 can jump right past n.' },
    ],
    intro: 'Frogs hop two tiles at a time. Only even rows exist.',
    camera: { x: 2, y: 3, distance: 14 },
  }),

  // ---------------- Chapter 2: Stacked ponds ----------------
  defineLevel({
    id: '2-1',
    title: 'Doubling',
    chapter: 2,
    source: `input n;
requires n >= 0;

var x = 0;
var y = 0;
while (x < n) {
  x = x + 1;
  y = y + 2;
}

ensures y == 2 * n;`,
    view: { x: 'x', y: 'y' },
    ponds: { min: 0, max: 30, start: 3 },
    solutions: ['y == 2 * x && x <= n', 'y == 2 * x && 0 <= x <= n'],
    pitfalls: [{ formula: 'y == 2 * x', message: 'Right line — but your area keeps going past x = n.' }],
    intro: 'Each input n is now its own pond, stacked like floors. Use the Input panel (or PageUp/PageDown) to ride between them.',
    camera: { x: 2, y: 3, distance: 14 },
    bridge: true,
  }),
  defineLevel({
    id: '2-2',
    title: 'Transfer',
    chapter: 2,
    source: `input n;
requires n >= 0;

var x = n;
var y = 0;
while (x > 0) {
  x = x - 1;
  y = y + 1;
}

ensures y == n;`,
    view: { x: 'x', y: 'y' },
    ponds: { min: 0, max: 30, start: 4 },
    solutions: ['x + y == n && x >= 0'],
    pitfalls: [{ formula: 'x + y == n', message: 'Right line — but your area lets x go below 0.' }],
    intro: 'Move every unit from x to y.',
    camera: { x: 2, y: 2, distance: 13 },
  }),
  defineLevel({
    id: '2-3',
    title: 'Division by 3',
    chapter: 2,
    source: `input a;
requires a >= 0;

var q = 0;
var r = a;
while (r >= 3) {
  r = r - 3;
  q = q + 1;
}

ensures a == 3 * q + r && 0 <= r && r < 3;`,
    view: { x: 'q', y: 'r' },
    ponds: { min: 0, max: 40, start: 7 },
    solutions: ['a == 3 * q + r && r >= 0'],
    pitfalls: [{ formula: 'a == 3 * q + r', message: 'The equation is right — but a remainder must not be negative.' }],
    intro: 'Integer division, the slow way: take away 3 until you can’t.',
    camera: { x: 1, y: 3, distance: 14 },
  }),
  defineLevel({
    id: '2-4',
    title: 'Sum 1..n',
    chapter: 2,
    source: `input n;
requires n >= 0;

var i = 0;
var s = 0;
while (i < n) {
  i = i + 1;
  s = s + i;
}

ensures 2 * s == n * (n + 1);`,
    view: { x: 'i', y: 's' },
    ponds: { min: 0, max: 20, start: 4 },
    solutions: ['2 * s == i * (i + 1) && i <= n', '2 * s == i * (i + 1) && 0 <= i <= n'],
    pitfalls: [{ formula: '2 * s == i * (i + 1)', message: 'Right curve — but your area keeps going past i = n.' }],
    intro: 'Add 1 + 2 + … + n. Solvers prefer formulas without division.',
    camera: { x: 2, y: 4, distance: 15 },
  }),

  // ---------------- Chapter 3: Branches ----------------
  defineLevel({
    id: '3-1',
    title: 'Absolute Value',
    chapter: 3,
    source: `input a;

var x = a;
var y = 0;
while (x != 0) {
  if (x > 0) {
    x = x - 1;
  } else {
    x = x + 1;
  }
  y = y + 1;
}

ensures y == abs(a);`,
    view: { x: 'x', y: 'y' },
    ponds: { min: -15, max: 15, start: 3 },
    solutions: ['y + abs(x) == abs(a)'],
    pitfalls: [{ formula: 'y == a - x', message: 'That works for frogs hopping left — but some frogs take the else branch.' }],
    intro: 'The body has an if. Your area must survive both branches.',
    camera: { x: 0, y: 2, distance: 14 },
  }),
  defineLevel({
    id: '3-2',
    title: 'Even Out',
    chapter: 3,
    source: `var x, y;
requires x >= 0 && y >= 0;

while (x != y) {
  if (x > y) {
    x = x - 1;
  } else {
    y = y - 1;
  }
}

ensures x == y && x >= 0;`,
    view: { x: 'x', y: 'y' },
    solutions: ['x >= 0 && y >= 0', 'min(x, y) >= 0'],
    pitfalls: [
      { formula: 'x >= 0', message: 'When x shrinks, what keeps it from dropping below 0? Look at y.' },
      { formula: 'y >= 0', message: 'When y shrinks, what keeps it from dropping below 0? Look at x.' },
    ],
    intro: 'Two numbers step toward each other until they meet.',
    camera: { x: 3, y: 3, distance: 15 },
  }),
];

export const allLevels = [tutorialLevel, ...levels];

export const CHAPTERS: Record<number, string> = {
  1: 'One plane',
  2: 'Stacked ponds',
  3: 'Branches',
};
