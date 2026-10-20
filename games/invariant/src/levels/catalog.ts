import type { LevelDef } from './level';

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

interface LevelGroup {
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
        intro: 'Same idea, but this frog counts down. Which way does it hop, and where does it stop?',
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
          'Real frogs only land on even `i` — but **Check** tests every tile your area claims, odd ones too.',
          'From an odd `i` just below `n`, a hop of 2 jumps right past `n`. Leave the odd tiles out.',
          'Join the tutorial’s bound with a fact about `i % 2`.',
        ],
        camera: { x: 2, y: 3, distance: 14 },
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
      {
        id: 'meet-in-the-middle',
        title: 'Meet in the Middle',
        source: `var lo, hi;
requires lo <= hi;

while (lo < hi) {
  lo = lo + 1;
  hi = hi - 1;
}

ensures hi <= lo <= hi + 1;`,
        view: { x: 'lo', y: 'hi' },
        solutions: ['lo <= hi + 1', 'lo - hi <= 1'],
        pitfalls: [
          {
            formula: 'lo <= hi',
            message: 'When `lo` and `hi` are next to each other, one hop makes them trade places. The fence has to let that one hop through.',
          },
          { formula: 'lo < hi', message: 'Some eggs already have `lo` equal to `hi`.' },
          { formula: 'lo <= hi + 2', message: 'Too loose: a frog on your area could stop two past `hi`.' },
        ],
        intro: 'Two ends step toward each other until they meet — or cross. Overshoot again, but this time both ends move.',
        hints: [
          'Step a frog whose gap is even, then one whose gap is odd. Where does each stop?',
          'The ends can cross, but only by one tile. Compare `lo` with `hi` after the last hop.',
          'A single fence, parallel to the line `lo = hi` and one tile past it.',
        ],
        camera: { x: 2, y: 3, distance: 13 },
      },
    ],
  },
  {
    name: 'Intermediate',
    levels: [
      {
        id: 'tag-along',
        title: 'Tag Along',
        source: `input n;
requires n >= 0;

var i = 0;
var s = 0;
while (i < n) {
  i = i + 1;
  s = s + i;
}

ensures i == n;`,
        view: { x: 'i', y: 's' },
        start: { n: 4 },
        solutions: ['i <= n', '0 <= i <= n'],
        pitfalls: [
          { formula: 'i == n', message: 'That only covers frogs that are already done.' },
          {
            formula: '2 * s == i * (i + 1)',
            message: 'True of every real frog — but the goal is about `i`, and nothing here stops `i` past `n`.',
          },
          { formula: 'i <= s', message: 'Nothing in your area mentions `n`, so nothing stops a frog past it.' },
          {
            formula: 'i <= n && s >= 0',
            message: '`s >= 0` is true of real frogs, but a ghost frog at a negative `i` makes `s` shrink. The goal doesn’t need `s`; leave it out.',
          },
        ],
        intro:
          'The goal now depends on `n`. Change `n` in the inputs under the code — the proof has to hold for every `n`.',
        hints: [
          'Change `n`. What moves with it?',
          'The goal says nothing about `s`, so your area needn’t either.',
          'A fence read off the guard, like the tutorial’s.',
        ],
        camera: { x: 2, y: 4, distance: 15 },
      },
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
        start: { n: 4 },
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
        start: { n: 3 },
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
        start: { a: 7 },
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
        start: { n: 3 },
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
        intro: 'Two numbers step toward each other until they meet. The body has an `if` now: your area must survive both branches — and here, the facts you start with are enough.',
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
        start: { a: 3 },
        solutions: ['y + abs(x) == abs(a)'],
        pitfalls: [
          { formula: 'y == a - x', message: 'That works for frogs hopping left — but some frogs take the else branch.' },
          { formula: 'y >= 0', message: '`y` is never negative — right. But what ties it to `a` when the frog stops?' },
        ],
        intro: 'Walk `x` to `0` from either side, counting the steps in `y`.',
        hints: [
          'Try a negative `a` in the inputs too. Whichever way a frog hops, what happens to `abs(x)`? And to `y`?',
          'Each hop, `abs(x)` goes down by one and `y` goes up by one, so their sum never changes.',
          'One equation, with `abs(x)`, `y` and `abs(a)` in it.',
        ],
        camera: { x: 0, y: 2, distance: 14 },
      },
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
        start: { n: 5 },
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
        start: { n: 7 },
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
        start: { n: 4 },
        solutions: ['2 * s == i * (i + 1) && i <= n', '2 * s == i * (i + 1) && 0 <= i <= n'],
        pitfalls: [
          { formula: '2 * s == i * (i + 1)', message: 'Right curve — but your area keeps going past `i = n`.' },
          { formula: 'i <= n', message: 'That fences `i`, but says nothing about the total `s`.' },
        ],
        intro: 'Tag Along’s loop again — this time the goal cares about `s`. The solver prefers equations without division.',
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
  {
    name: 'Arrays',
    levels: [
      {
        id: 'biggest-so-far',
        title: 'Biggest So Far',
        source: `input n;
input A[n];
requires n >= 1;

var i = 1;
var m = A[0];
while (i < n) {
  if (A[i] > m) {
    m = A[i];
  }
  i = i + 1;
}

ensures forall 0 <= k < n: A[k] <= m;`,
        view: { x: 'i', y: 'm' },
        start: { A: [3, 1, 4, 1, 5] },
        dice: { A: { length: [1, 7], values: [0, 9] } },
        solutions: ['forall 0 <= k < i: A[k] <= m', 'i <= n && forall 0 <= k < i: A[k] <= m', '1 <= i <= n && forall 0 <= k < i: A[k] <= m'],
        pitfalls: [
          {
            formula: 'forall 0 <= k < n: A[k] <= m',
            message: 'That is the goal itself. At the start `m` is only `A[0]`: the cells from `i` on haven’t been looked at yet.',
          },
          { formula: 'm >= A[0]', message: '`m` has seen every cell before `i`, not only the first one.' },
          { formula: 'i <= n', message: 'That fences `i`, but says nothing about `m`.' },
        ],
        intro:
          'The largest cell of `A`: walk `i` along the array, keeping the biggest so far in `m`. `A` is in the inputs under the code — type cells in, or roll the dice. A cell outside `A` (before `0` or past the end) reads as `0`.',
        hints: [
          'Step a frog and watch `m`. After each hop, which cells of `A` is `m` already at least as big as?',
          'The goal talks about every cell before `n`. While the loop runs, `m` only answers for the cells before `i`.',
          'Take the goal and put `i` where `n` is.',
        ],
        camera: { x: 3, y: 4, distance: 15 },
      },
      {
        id: 'find-it',
        title: 'Find It',
        source: `input n;
input A[n];
input x;
requires n >= 0;

var i = 0;
while (i < n && A[i] != x) {
  i = i + 1;
}

ensures 0 <= i <= n;
ensures forall 0 <= k < i: A[k] != x;
ensures i == n || A[i] == x;`,
        view: { x: 'i', y: 'x' },
        start: { A: [2, 5, 1, 4] },
        dice: { A: { length: [1, 7], values: [0, 9] } },
        solutions: ['0 <= i <= n && forall 0 <= k < i: A[k] != x', '0 <= i && i <= n && (forall 0 <= k < i: A[k] != x)'],
        pitfalls: [
          {
            formula: '0 <= i <= n',
            message: 'The fence is right — but a frog that stops at `i = n` claims `x` is nowhere in `A`, and your area never says the cells before `i` were checked.',
          },
          {
            formula: 'forall 0 <= k < i: A[k] != x',
            message: 'That is the fact about the cells — but nothing fences `i`. Outside `A` every cell reads as `0`, so a ghost frog before `0` or past `n` can stop there too.',
          },
          { formula: 'i == n || A[i] == x', message: 'That is where the loop stops, not what holds while it runs.' },
        ],
        intro:
          'Look for `x` in `A`: walk `i` along until a cell equals `x` or the array ends. `x` is on the vertical axis, so each row is one value to look for.',
        hints: [
          'Hover over (or tap) the tiles where the loop stops: for each `x`, where are they, and which of them are goals?',
          'A real frog at `i` has looked at every cell before `i` and found no `x` there. `forall` says that.',
          'Fence `i` between `0` and `n`, and add the `forall` about the cells before `i`.',
        ],
        camera: { x: 2, y: 3, distance: 14 },
      },
      {
        id: 'one-of-them',
        title: 'One of Them',
        source: `input n;
input A[n];
requires n >= 1;

var i = 1;
var m = A[0];
while (i < n) {
  if (A[i] > m) {
    m = A[i];
  }
  i = i + 1;
}

ensures forall 0 <= k < n: A[k] <= m;
ensures exists 0 <= k < n: A[k] == m;`,
        view: { x: 'i', y: 'm' },
        start: { A: [3, 1, 4, 1, 5] },
        dice: { A: { length: [1, 7], values: [0, 9] } },
        solutions: [
          'i <= n && forall 0 <= k < i: A[k] <= m && exists 0 <= k < i: A[k] == m',
          '1 <= i <= n && (forall 0 <= k < i: A[k] <= m) && (exists 0 <= k < i: A[k] == m)',
        ],
        pitfalls: [
          {
            formula: 'forall 0 <= k < i: A[k] <= m',
            message: 'Biggest So Far’s answer says `m` is big enough, but not that `m` is one of the cells: a frog with `m = 100` sits on your area.',
          },
          {
            formula: 'forall 0 <= k < i: A[k] <= m && exists 0 <= k < i: A[k] == m',
            message: 'Beyond the end of `A` every cell reads as `0`, so a ghost frog past `n` can claim `m = 0` is one of them — and when every real cell is negative, `0` even beats them all. Keep `i` inside the array.',
          },
          { formula: 'i <= n && exists 0 <= k < i: A[k] == m', message: '`m` is one of the cells — but is it the biggest? Keep Biggest So Far’s `forall` too.' },
        ],
        intro: 'Biggest So Far again, but now the goal also wants `m` to be one of the cells. There is a word for “some cell”: `exists`.',
        hints: [
          'Biggest So Far’s area passes two rules here. Check it, and see which rule fails.',
          '`m` must be one of the cells seen so far: some `k` before `i` has `A[k] == m`. That is `exists`.',
          'Three facts: a fence on `i`, the `forall` from before, and an `exists` for the cell `m` came from.',
        ],
        camera: { x: 3, y: 4, distance: 15 },
      },
      {
        id: 'sorted-search',
        title: 'Sorted Search',
        source: `input n;
input A[n];
input x;
requires n >= 0;
requires forall 0 <= j <= k < n: A[j] <= A[k];

var lo = 0;
var hi = n;
while (lo < hi) {
  if (A[(lo + hi) / 2] < x) {
    lo = (lo + hi) / 2 + 1;
  } else {
    hi = (lo + hi) / 2;
  }
}

ensures 0 <= lo <= n;
ensures forall 0 <= k < lo: A[k] < x;
ensures forall lo <= k < n: A[k] >= x;`,
        view: { x: 'lo', y: 'hi' },
        start: { A: [1, 3, 4, 4, 8, 9], x: 4 },
        dice: { A: { length: [1, 8], values: [0, 9], sorted: true } },
        solutions: [
          '0 <= lo <= hi <= n && forall 0 <= k < lo: A[k] < x && forall hi <= k < n: A[k] >= x',
          '0 <= lo && lo <= hi && hi <= n && (forall 0 <= k < lo: A[k] < x) && (forall hi <= k < n: A[k] >= x)',
        ],
        pitfalls: [
          {
            formula: '0 <= lo <= hi <= n',
            message: 'The fences are right. But when the ends meet, why is every cell left of `lo` below `x`? Your area has to say so.',
          },
          {
            formula: 'forall 0 <= k < lo: A[k] < x && forall hi <= k < n: A[k] >= x',
            message: 'The two `forall`s are right — but without `0 <= lo <= hi <= n`, a ghost frog can start with the ends crossed or outside the array.',
          },
          {
            formula: '0 <= lo <= hi <= n && forall 0 <= k < lo: A[k] < x',
            message: 'Half of it: the cells from `hi` on need the mirror fact.',
          },
        ],
        intro:
          'Binary search on a sorted `A`: halve the gap between `lo` and `hi` until it closes. The precondition’s `forall` says `A` is sorted, so the dice only roll sorted arrays.',
        hints: [
          'Step a frog on a few arrays. After each hop, which cells are known to be below `x`? Which are known to be `x` or more?',
          'Everything before `lo` is below `x`; everything from `hi` on is `x` or more. And the ends stay in order: `0 <= lo <= hi <= n`.',
          'Two `forall`s, one for each side, plus the chain of fences.',
        ],
        camera: { x: 3, y: 4, distance: 15 },
      },
    ],
  },
];

export const levels: LevelDef[] = GROUPS.flatMap((g) => g.levels);

export const allLevels = [tutorialLevel, ...levels];

export function levelNumber(id: string): number {
  return levels.findIndex((l) => l.id === id) + 1;
}
