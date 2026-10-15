# Levels, redesigned: a ladder that stays "not too hard, not too easy"

The level sequence, and the reasoning behind it. It keeps every program that
already worked, reworks one level, adds one, and reorders the rest so that each
level adds exactly one new thing on top of the last. This is what
`src/levels/catalog.ts` now implements.

## Why the current ladder has a cliff at level 3

Playing the current sequence, levels 1 and 2 are "read the fence off the
guard". Level 3 (Meet in the Middle) then lands four new things at once:

- the **slider** (a third variable, planes), introduced as the level's headline;
- an answer that **does not use `n`**, so the headline is a red herring: the
  natural try `lo + hi == n` is true for every real frog and still fails;
- a fence that is **relative to another moving variable**, and diagonal, where
  levels 1 and 2 were fences against a constant;
- a postcondition (`hi <= lo && lo <= hi + 1`) that is the hardest sentence in
  the beginner tier, hiding the "by at most one" that is the whole point.

Later, two more bumps: Transfer (level 7) is the first preserved equation and
the slider's second appearance, and Even Out (level 10) introduces `if` with an
answer that is the precondition copied, so the new mechanic teaches nothing.

## The two rules the new ladder follows

1. **One new thing per level.** Either a new *mechanic* (slider, `if`,
   products) on content the learner can already do, or new *content* on
   mechanics they already have. Never both. So every tier opens with its
   mechanic on an easy program and ends on its hardest program; the curve is a
   sawtooth, not a ramp, and the "too hard" moments go away without making
   the hard levels easier.
2. **The pitfall is the previous answer.** Each level's tempting wrong formula
   is what worked one or two levels ago, with a message that names what
   changed. That is what makes the levels feel like one course rather than
   seventeen puzzles.

## The ladder

Seventeen levels: Odd Squares was dropped, because it and Sum to n taught the
same thing (a product curve plus a fence) with the same pitfall, and Sum to n
is the one with the callback to Tag Along.

| # | Level | Tier | The one new thing | Answer (shape) | Pitfall (what it reuses) |
|---|---|---|---|---|---|
| 1 | Countdown | Beginner | a fence read off the guard; direction matters | `i >= 0` | tutorial's `i <= n` |
| 2 | Overshoot | Beginner | the fence is guard + step size | `i < n + 3` | `i <= n` |
| 3 | Step by Two | Beginner | ghost frogs: tiles real frogs skip still count; `%` | `i <= n && i % 2 == 0` | `i <= n` (fails from an odd `i`) |
| 4 | Round Up | Beginner | compose two known facts with `&&` | `i % 3 == 0 && i < n + 3` | each half alone |
| 5 | **Meet in the Middle** (reworked) | Beginner | a fence relative to another moving variable, one past the diagonal | `lo <= hi + 1` | `lo <= hi` |
| 6 | **Tag Along** (new) | Intermediate | the slider; the area needs only what the goal mentions | `i <= n` | `i == n`; a true equation about `s` |
| 7 | Transfer | Intermediate | a preserved sum, plus a fence | `x + y == n && x >= 0` | the equation alone |
| 8 | Doubling | Intermediate | the equation relates loop variables; only the fence uses `n` | `y == 2 * x && x <= n` | the equation alone |
| 9 | Divide by 3 | Intermediate | a coefficient; the guard supplies half the goal | `a == 3 * q + r && r >= 0` | the equation alone |
| 10 | Parity | Intermediate | a preserved fact that is not an equation; eggs everywhere, no slider | `x >= 0 && (x + y) % 2 == 0` | the goal `y % 2 == 0` |
| 11 | Catch Up | Intermediate | the equation needs an offset by `n` | `a == 2 * (b - n) && a <= b` | the equation alone |
| 12 | Even Out | Advanced | `if`: a fact each branch keeps (easy on purpose) | `x >= 0 && y >= 0` | one fence only |
| 13 | Absolute Value | Advanced | one equation that survives both branches, with `abs` | `y + abs(x) == abs(a)` | `y == a - x` (one branch only) |
| 14 | Deal the Cards | Advanced | two facts at once across branches | `b <= a <= b + 1 && a + b <= n` | the band alone |
| 15 | Count the Threes | Advanced | `if` inside the body; a staircase with `/` | `c == i / 3 && i <= n` | the staircase alone |
| 16 | Sum to n | Advanced | a product in the equation; Tag Along's loop, now the goal cares about `s` | `2 * s == i * (i + 1) && i <= n` | the curve alone |
| 17 | Square Root | Advanced | the invariant is half the goal; the guard gives the other half | `r * r <= n` | `r <= n` |

Three tiers, as before: Beginner is fences (1–5), Intermediate is equations
and the slider (6–11), Advanced is branches and then products (12–17). The
tier is a difficulty label; the skill ladder inside it is what matters.

### How the difficulty moves

- 1 → 2 → 3 → 4: one fence, a wider fence, a fence plus `%`, both together.
- 5 is the beginner tier's hardest level, and it is now *only* hard for the
  right reason: the fence is relative and diagonal. No slider, no `n`, and the
  postcondition is written as the chain `hi <= lo <= hi + 1`, which reads as
  "`lo` is `hi` or one past it".
- 6 is a breather that exists to teach the slider. The answer is level 1's
  skill. The learner moves the slider and watches the fence move with it.
- 7 → 11: the equation gets one notch harder each time: a sum, a ratio, a
  coefficient, a non-equation, an offset.
- 12 is a breather that exists to teach `if`. 13 → 15 then make branches earn
  their keep.
- 16 → 17: a product in the equation, as the callback to level 6, then the
  finale where the guard does half the work.

## Changed and new levels, in full

### 5 · Meet in the Middle (reworked)

```
var lo, hi;
requires lo <= hi;

while (lo < hi) {
  lo = lo + 1;
  hi = hi - 1;
}

ensures hi <= lo <= hi + 1;
```

- **view**: `lo` on x, `hi` on y. No slider: eggs are the half-plane
  `lo <= hi`, so the learner sees at once that this is Overshoot with both
  ends moving.
- **solutions**: `lo <= hi + 1`, `lo - hi <= 1`.
- **pitfalls**:
  - `lo <= hi` → "When `lo` and `hi` are next to each other, one hop makes them trade places. The fence has to let that one hop through." (fails Maintenance)
  - `lo < hi` → "Some eggs already have `lo` equal to `hi`." (fails Initialization)
  - `lo <= hi + 2` → "Too loose: a frog could stop two past `hi`." (fails Termination)
- **intro**: "Two ends step toward each other until they meet — or cross.
  Overshoot again, but this time both ends move."
- **hints**:
  1. "Step a frog whose gap is even, then one whose gap is odd. Where does each stop?"
  2. "The ends can cross, but only by one tile. Compare `lo` with `hi` after the last hop."
  3. "A single fence, parallel to the line `lo = hi` and one tile past it."

Proved with the checker: all three solutions pass, each pitfall fails the
rule named above.

### 6 · Tag Along (new)

```
input n;
requires n >= 0;

var i = 0;
var s = 0;
while (i < n) {
  i = i + 1;
  s = s + i;
}

ensures i == n;
```

- **view**: `i` on x, `s` on y, `n` on the slider (`planes: 0..20, start 4`).
- **solutions**: `i <= n`, `0 <= i <= n`.
- **pitfalls**:
  - `i == n` → "That only covers frogs that are already done." (fails Initialization)
  - `2 * s == i * (i + 1)` → "True of every real frog — but the goal is about `i`, and nothing here stops `i` past `n`." (fails Termination)
  - `i <= s` → "Nothing in your area mentions `n`, so nothing stops a frog past it." (fails Termination)
  - `i <= n && s >= 0` → "`s >= 0` is true of real frogs, but a ghost frog at a negative `i` makes `s` shrink. The goal doesn't need `s`; leave it out." (fails Maintenance; a sharp ghost-frog lesson for anyone who adds it)
- **intro**: "The goal now depends on `n`. Change `n` with the slider on the
  right — the proof has to hold for every `n`." (The fact that `s` can be
  ignored is left to the hints: said up front it was confusing.)
- **hints**:
  1. "Move the slider. What moves with it?"
  2. "The goal says nothing about `s`, so your area needn't either."
  3. "Level 1's kind of fence, read off the guard."

Proved with the checker as listed. The payoff comes at level 16, whose intro
should say: "Tag Along's loop again. This time the goal cares about `s`."

### 1 · Countdown (text only)

The intro says "strengthen from there", but one fence is the answer, and
"strengthen" nudges the learner toward the tutorial's two-sided bound. Change
the intro to: "Same idea, but this frog counts down. Which way does it hop,
and where does it stop?" Hints can stay.

### 12 · Even Out (keep, but say what it is)

The answer is the precondition. That is fine for the level that introduces
`if`, as long as the intro says so: "The body has an `if` now. Your area must
survive both branches — and here, the facts you start with are enough."

## Camera notes

On the equation levels the area is a line or a curve, not a region, and the
"proved" rain on Sum to n played out entirely off-screen in my run. For the
levels whose area is thin (7, 8, 9, 11, 13, 16), the camera target should
be the midpoint of the real frogs' path on the start plane, and the distance
chosen so the whole path from egg to goal is in frame. Worth checking each
from the level list after the reorder.

## What changed in code

- `src/levels/catalog.ts`: new order and groups; Meet in the Middle's source,
  solutions, pitfalls, intro and hints; the new Tag Along level; the text
  tweaks above.
- `src/levels/catalog.ko.ts`: the same in Korean.
- `docs/design.md`: the tier table.
- `pnpm validate` passes: it proves every solution, checks every pitfall
  fails, and checks hint counts match between languages.
- Cleared-level ids in the browser are by id, so existing progress survives
  the reorder.
