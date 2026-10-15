import type { LevelDef } from './level';

// Every level, in order (the tutorial's program first), getting harder from
// first to last; the level list shows them in three tiers of difficulty.

export const tutorialLevel: LevelDef = {
  id: 'tutorial',
  title: 'Tutorial',
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
    { formula: 'i >= 0', message: 'Real frogs never pass `n` — but your area allows it.' },
  ],
  camera: { x: 2, y: 2, distance: 13 },
};

export interface LevelGroup {
  name: string;
  levels: LevelDef[];
}

export const GROUPS: LevelGroup[] = [
  {
    name: 'Beginner',
    levels: [
      {
        id: 'countdown',
        title: 'Countdown',
        source: `input n;
requires n >= 0;

var i = n;
while (i > 0) {
  i = i - 1;
}

ensures i == 0;`,
        view: { x: 'i', y: 'n' },
        solutions: ['i >= 0', '0 <= i <= n'],
        pitfalls: [
          { formula: 'i <= n', message: 'That bound held in the tutorial — but which way does this frog move?' },
          { formula: 'i == 0 || i == n', message: 'Frogs also pass through the tiles in between.' },
        ],
        intro: 'Same idea, but this frog counts down. Start with an area every egg sits on, and strengthen from there.',
        hints: [
          'Run the frogs. Which way do they hop, and where do they stop?',
          'The loop stops as soon as `i` is no longer above `0`. Your area must rule out stopping anywhere but `0` itself.',
          'One inequality is enough: fence off everything left of `i = 0`.',
        ],
        camera: { x: 2, y: 2, distance: 13 },
      },
      {
        id: 'overshoot',
        title: 'Overshoot',
        source: `input n;
requires n >= 0;

var i = 0;
while (i < n) {
  i = i + 3;
}

ensures n <= i && i < n + 3;`,
        view: { x: 'i', y: 'n' },
        solutions: ['i < n + 3', 'i <= n + 2', '0 <= i < n + 3'],
        pitfalls: [
          { formula: 'i <= n', message: 'Real frogs do pass `n` here: from `i = n - 1`, one hop lands on `n + 2`.' },
          { formula: '0 <= i <= n', message: 'Real frogs do pass `n` here: from `i = n - 1`, one hop lands on `n + 2`.' },
          { formula: 'i >= 0', message: 'A frog on your area could stop far past `n`. How far past can a real one get?' },
        ],
        intro: 'Grab three at a time until you have at least `n`. You may end up past `n` — but by how much?',
        hints: [
          'Run the frogs. How far past `n` does the farthest one stop?',
          'A hop only starts while `i` is below `n`, and adds 3. So where can it land, at most?',
          'Fence it on the right, a little past `n`: `i < n + …`',
        ],
        camera: { x: 3, y: 3, distance: 14 },
      },
      {
        id: 'meet-in-the-middle',
        title: 'Meet in the Middle',
        source: `input n;
requires n >= 0;

var lo = 0;
var hi = n;
while (lo < hi) {
  lo = lo + 1;
  hi = hi - 1;
}

ensures hi <= lo && lo <= hi + 1;`,
        view: { x: 'lo', y: 'hi' },
        planes: { min: 0, max: 20, start: 5 },
        solutions: ['lo <= hi + 1', 'lo + hi == n && lo <= hi + 1'],
        pitfalls: [
          { formula: 'lo <= hi', message: 'When `lo` and `hi` are next to each other, one hop makes them trade places.' },
          { formula: 'lo + hi == n', message: 'That stays true — but which frogs on that line are allowed to stop?' },
        ],
        intro:
          '`n` is an input now: each value of `n` is its own plane, and the slider on the right switches between them. Two ends step toward each other until they meet or cross.',
        hints: [
          'Try an even `n` and an odd `n` with the slider. Where does each frog stop?',
          'The ends can cross, but never by more than one tile. What does that say about `lo` compared with `hi`?',
          'A single fence, parallel to the line `lo = hi` and one tile past it.',
        ],
        camera: { x: 2, y: 3, distance: 13 },
      },
      {
        id: 'step-by-two',
        title: 'Step by Two',
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
          { formula: 'i <= n', message: 'From an odd `i`, a hop of 2 can jump right past `n`.' },
          { formula: '0 <= i <= n', message: 'From an odd `i`, a hop of 2 can jump right past `n`.' },
        ],
        intro: 'Frogs hop two tiles at a time. Only even rows exist.',
        hints: [
          'Real frogs only land on even `i` — but the hand may test any tile your area claims, odd ones too.',
          'From an odd `i` just below `n`, a hop of 2 jumps right past `n`. Leave the odd tiles out.',
          'Join the tutorial’s bound with a fact about `i % 2`.',
        ],
        camera: { x: 2, y: 3, distance: 14 },
      },
      {
        id: 'parity',
        title: 'Parity',
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
          { formula: '(x + y) % 2 == 0', message: 'The hop keeps `x + y` even — but your area also lets `x` go negative.' },
          { formula: 'y % 2 == 0', message: 'That is just the goal. Do all eggs sit there?' },
          { formula: 'x >= 0', message: 'Frogs never go below `x = 0` — but some tiles on your area stop with an odd `y`.' },
        ],
        intro: 'Eggs everywhere on a checkerboard. Every frog hops diagonally until `x` reaches `0`.',
        hints: [
          'Each hop takes one from `x` and gives one to `y`. What happens to `x + y`?',
          '`x + y` never changes, so it stays even. And the loop stops when `x` is no longer above `0` — what keeps it from being negative then?',
          'Two facts joined with `&&`: one about `(x + y) % 2`, and a fence on `x`.',
        ],
        camera: { x: 2, y: 2, distance: 15 },
      },
      {
        id: 'round-up',
        title: 'Round Up',
        source: `input n;
requires n >= 0;

var i = 0;
while (i < n) {
  i = i + 3;
}

ensures i % 3 == 0 && n <= i && i < n + 3;`,
        view: { x: 'i', y: 'n' },
        solutions: ['i % 3 == 0 && i < n + 3', 'i % 3 == 0 && 0 <= i < n + 3'],
        pitfalls: [
          { formula: 'i < n + 3', message: 'Right fence — but the goal also wants a multiple of 3. Does your area promise one?' },
          { formula: 'i % 3 == 0', message: 'Every real frog is on a multiple of 3 — but your area lets one stop far past `n`.' },
          { formula: 'i % 3 == 0 && i <= n', message: 'Real frogs do pass `n` — remember Overshoot?' },
        ],
        intro: 'The frogs from Overshoot again. This time, prove exactly where they land: on the first multiple of 3 at or past `n`.',
        hints: [
          'Two things are true of real frogs: which tiles they land on, and how far past `n` they can get.',
          'The goal has three parts. The loop stopping gives you `n <= i`; your area has to give the other two.',
          'Overshoot’s fence, joined with a fact about `i % 3`.',
        ],
        camera: { x: 3, y: 3, distance: 14 },
      },
    ],
  },
  {
    name: 'Intermediate',
    levels: [
      {
        id: 'transfer',
        title: 'Transfer',
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
        planes: { min: 0, max: 30, start: 4 },
        solutions: ['x + y == n && x >= 0'],
        pitfalls: [
          { formula: 'x + y == n', message: 'Right line — but your area lets `x` go below `0`.' },
          { formula: 'x >= 0', message: '`x` never goes negative — right. But nothing in your area ties `y` to `n`.' },
        ],
        intro: 'Move everything from `x` to `y`, one unit at a time.',
        hints: [
          'Step a frog and add up `x + y` on every tile it visits.',
          '`x + y` stays `n`: that’s a line. But a frog on that line could stop on the wrong tile — which ones?',
          'Your equation, plus a fence that keeps `x` from going negative.',
        ],
        camera: { x: 2, y: 2, distance: 13 },
      },
      {
        id: 'doubling',
        title: 'Doubling',
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
        planes: { min: 0, max: 30, start: 3 },
        solutions: ['y == 2 * x && x <= n', 'y == 2 * x && 0 <= x <= n'],
        pitfalls: [
          { formula: 'y == 2 * x', message: 'Right line — but your area keeps going past `x = n`.' },
          { formula: 'x <= n', message: 'That fences `x` — but says nothing about `y`.' },
        ],
        intro: 'Count `x` up to `n` while `y` runs twice as fast.',
        hints: [
          'Step a frog. How does `y` compare with `x` after each hop?',
          '`y` is always twice `x`. Now: where can a frog on that line stop?',
          'Your equation, plus a bound so the line ends at `x = n`.',
        ],
        camera: { x: 2, y: 3, distance: 14 },
      },
      {
        id: 'divide-by-three',
        title: 'Divide by 3',
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
        planes: { min: 0, max: 40, start: 7 },
        solutions: ['a == 3 * q + r && r >= 0'],
        pitfalls: [
          { formula: 'a == 3 * q + r', message: 'The equation is right — but a remainder must not be negative.' },
          { formula: 'r >= 0', message: 'A remainder is never negative — right. But how do `q` and `r` relate to `a`?' },
        ],
        intro: 'Integer division, the slow way: take 3 away from `r` until you can’t, counting each time in `q`.',
        hints: [
          'Step a frog and work out `3 * q + r` on every tile it visits.',
          '`3 * q + r` stays `a`. The goal also wants `0 <= r < 3`, and the loop stopping gives you half of that.',
          'Your equation, plus a fence that keeps `r` from going negative.',
        ],
        camera: { x: 1, y: 3, distance: 14 },
      },
      {
        id: 'even-out',
        title: 'Even Out',
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
          { formula: 'x >= 0', message: 'When `x` shrinks, what keeps it from dropping below `0`? Look at `y`.' },
          { formula: 'y >= 0', message: 'When `y` shrinks, what keeps it from dropping below `0`? Look at `x`.' },
        ],
        intro: 'Two numbers step toward each other until they meet. The body has an `if` now: your area must survive both branches.',
        hints: [
          'Each hop, only the larger number shrinks. Can it ever drop below the smaller one?',
          'When `x` shrinks, it’s because `x > y`. So if `y` is never negative, neither is the new `x` — and the same the other way round.',
          'Fence both: one inequality for `x`, one for `y`.',
        ],
        camera: { x: 3, y: 3, distance: 15 },
      },
      {
        id: 'absolute-value',
        title: 'Absolute Value',
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
        planes: { min: -15, max: 15, start: 3 },
        solutions: ['y + abs(x) == abs(a)'],
        pitfalls: [
          { formula: 'y == a - x', message: 'That works for frogs hopping left — but some frogs take the else branch.' },
          { formula: 'y >= 0', message: '`y` is never negative — right. But what ties it to `a` when the frog stops?' },
        ],
        intro: 'Walk `x` to `0` from either side, counting the steps in `y`.',
        hints: [
          'Try a negative `a` with the slider too. Whichever way a frog hops, what happens to `abs(x)`? And to `y`?',
          'Each hop, `abs(x)` goes down by one and `y` goes up by one, so their sum never changes.',
          'One equation, with `abs(x)`, `y` and `abs(a)` in it.',
        ],
        camera: { x: 0, y: 2, distance: 14 },
      },
      {
        id: 'catch-up',
        title: 'Catch Up',
        source: `input n;
requires n >= 0;

var a = 0;
var b = n;
while (a < b) {
  a = a + 2;
  b = b + 1;
}

ensures a == b && a == 2 * n;`,
        view: { x: 'a', y: 'b' },
        planes: { min: 0, max: 15, start: 3 },
        solutions: ['a == 2 * (b - n) && a <= b', 'a == 2 * b - 2 * n && a <= b'],
        pitfalls: [
          { formula: 'a == 2 * (b - n)', message: 'Right line — but a frog on it could stop with `a` already past `b`.' },
          { formula: 'a <= b', message: '`a` never passes `b` — right. But nothing in your area ties them to `n`.' },
        ],
        intro: '`a` runs two steps per hop and `b` runs one, but `b` starts `n` ahead. Where does `a` catch up?',
        hints: [
          'Each hop, `a` gains 2 and `b` gains 1. Compare `a` with how far `b` has come from `n`.',
          '`b - n` counts the hops so far, and `a` is always twice that. Where can a frog on that line stop?',
          'An equation linking `a`, `b` and `n`, plus a fence: `a` never passes `b`.',
        ],
        camera: { x: 3, y: 4, distance: 14 },
      },
    ],
  },
  {
    name: 'Advanced',
    levels: [
      {
        id: 'deal-the-cards',
        title: 'Deal the Cards',
        source: `input n;
requires n >= 0;

var a = 0;
var b = 0;
while (a + b < n) {
  if (a <= b) {
    a = a + 1;
  } else {
    b = b + 1;
  }
}

ensures a + b == n && b <= a && a <= b + 1;`,
        view: { x: 'a', y: 'b' },
        planes: { min: 0, max: 20, start: 5 },
        solutions: ['b <= a <= b + 1 && a + b <= n', 'b <= a && a <= b + 1 && a + b <= n'],
        pitfalls: [
          { formula: 'b <= a <= b + 1', message: 'Nobody gets ahead — right. But your area also lets the dealer hand out more than `n` cards.' },
          { formula: 'a + b <= n', message: 'That counts the cards — but what keeps the deal fair?' },
          {
            formula: 'abs(a - b) <= 1 && a + b <= n',
            message: 'Close — but `a` always gets the first card, so `b` is never the one ahead.',
          },
        ],
        intro: 'Deal `n` cards to two players, `a` first, then taking turns. Prove nobody ends up more than one card ahead.',
        hints: [
          'Deal a few cards with Step. After each card, who is ahead, and by how much?',
          '`a` always has as many cards as `b`, or one more. And the dealer never hands out more than `n`.',
          'Fence `a` from both sides in terms of `b`, and bound `a + b`.',
        ],
        camera: { x: 2, y: 2, distance: 12 },
      },
      {
        id: 'count-the-threes',
        title: 'Count the Threes',
        source: `input n;
requires n >= 0;

var i = 0;
var c = 0;
while (i < n) {
  i = i + 1;
  if (i % 3 == 0) {
    c = c + 1;
  }
}

ensures c == n / 3;`,
        view: { x: 'i', y: 'c' },
        planes: { min: 0, max: 30, start: 7 },
        solutions: ['c == i / 3 && i <= n', 'c == i / 3 && 0 <= i <= n', '3 * c <= i && i < 3 * c + 3 && i <= n'],
        pitfalls: [
          { formula: 'c == i / 3', message: 'Right staircase — but it keeps going past `i = n`.' },
          { formula: 'i <= n', message: 'That fences `i`, but says nothing about the tally `c`.' },
        ],
        intro: 'Count `i` up to `n`, tallying every multiple of 3 along the way in `c`.',
        hints: [
          'Step a frog. How does `c` relate to `i` after each hop?',
          '`c` goes up exactly when `i` reaches 3, 6, 9, … That’s `i` divided by 3, rounded down — which is what `/` does.',
          'Your staircase equation, plus a bound so it ends at `i = n`.',
        ],
        camera: { x: 4, y: 1, distance: 13 },
      },
      {
        id: 'odd-squares',
        title: 'Odd Squares',
        source: `input n;
requires n >= 0;

var i = 0;
var s = 0;
while (i < n) {
  s = s + 2 * i + 1;
  i = i + 1;
}

ensures s == n * n;`,
        view: { x: 'i', y: 's' },
        planes: { min: 0, max: 12, start: 3 },
        solutions: ['s == i * i && i <= n', 's == i * i && 0 <= i <= n'],
        pitfalls: [
          { formula: 's == i * i', message: 'Right curve — but your area keeps going past `i = n`.' },
          { formula: 'i <= n', message: 'That fences `i`, but says nothing about the total `s`.' },
        ],
        intro: 'Add up the first `n` odd numbers, `1 + 3 + 5 + …`, and check the total against `n * n`.',
        hints: [
          'Step a frog and write down `s` at each tile: 0, 1, 4, 9, …',
          'Those are squares: `s` is always `i` times `i`.',
          'Your equation, plus a bound so the curve ends at `i = n`.',
        ],
        camera: { x: 2, y: 4, distance: 15 },
      },
      {
        id: 'sum-to-n',
        title: 'Sum to n',
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
        planes: { min: 0, max: 20, start: 4 },
        solutions: ['2 * s == i * (i + 1) && i <= n', '2 * s == i * (i + 1) && 0 <= i <= n'],
        pitfalls: [
          { formula: '2 * s == i * (i + 1)', message: 'Right curve — but your area keeps going past `i = n`.' },
          { formula: 'i <= n', message: 'That fences `i`, but says nothing about the total `s`.' },
        ],
        intro: 'Add `1 + 2 + … + n`. The solver prefers equations without division.',
        hints: [
          'Step a frog and write down `s` at each tile: 0, 1, 3, 6, 10, … Now double each one.',
          '`2 * s` is `i` times the number after `i`.',
          'An equation for `2 * s`, plus a bound so the curve ends at `i = n`.',
        ],
        camera: { x: 2, y: 4, distance: 15 },
      },
      {
        id: 'square-root',
        title: 'Square Root',
        source: `input n;
requires n >= 0;

var r = 0;
while ((r + 1) * (r + 1) <= n) {
  r = r + 1;
}

ensures r * r <= n && n < (r + 1) * (r + 1);`,
        view: { x: 'r', y: 'n' },
        solutions: ['r * r <= n', 'r >= 0 && r * r <= n'],
        pitfalls: [
          { formula: 'r <= n', message: 'Real frogs stay under a curve, not just under the diagonal: at `n = 2`, `r = 2` is too big.' },
          { formula: 'r >= 0', message: 'A frog on your area could stop with `r * r` already past `n`.' },
          { formula: 'n < (r + 1) * (r + 1)', message: 'That half of the goal comes free when the loop stops. Your area needs the half that holds while it runs.' },
        ],
        intro: 'The integer square root: count `r` up while the next square still fits under `n`.',
        hints: [
          'The loop stops when `(r + 1) * (r + 1) > n` — that’s half of the goal already. Which half is left?',
          'A frog only hops when the next square fits under `n`. So after the hop, its square still fits.',
          'Your area can be exactly the other half of the goal.',
        ],
        camera: { x: 2, y: 5, distance: 16 },
      },
    ],
  },
];

export const levels: LevelDef[] = GROUPS.flatMap((g) => g.levels);

export const allLevels = [tutorialLevel, ...levels];

/** A level's place in the whole list, counting from 1 (what the level list and the top bar show). */
export function levelNumber(id: string): number {
  return levels.findIndex((l) => l.id === id) + 1;
}
