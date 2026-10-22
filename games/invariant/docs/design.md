# Invariant Frog — Design

What the game teaches, and the rules of its world. Read this before changing
levels, the tutorial, the checker, or anything the learner sees.

See also: [experience.md](experience.md) (how the interface should feel) and
[architecture.md](architecture.md) (how the code is organised).

## The idea

A program's **state space** is an endless plane of tiles; each tile is one
program state. Running the program is a **frog** hopping between tiles, one hop
per loop iteration. The learner writes a formula describing an **area** of the
plane — the loop invariant — and **Check** tests it against three rules:

| Rule | Formal | Learner-facing wording |
|---|---|---|
| **Initialization** | `pre ⇒ Inv` (after the initialisation code) | Every egg is on the area. |
| **Maintenance** | `Inv ∧ guard ⇒ Inv[body]` | Every hop lands on the area. |
| **Termination** | `Inv ∧ ¬guard ⇒ post` | Every stop on the area is a goal. |

The area is a **claim**: every frog is always somewhere on it. Initialization
and Maintenance make the claim true (frogs start on it and no hop leaves it,
even from a tile no frog reaches); Termination makes it strong enough (the
only stops it allows are goals). If all three hold, every frog, for every
input, stops on a goal. That is the loop-invariant proof rule, presented as a
game.

**Audience:** programmers who write loops every day but have never (or only
vaguely) met loop invariants. Nothing beyond boolean expressions is assumed.

**A learner should leave able to:** explain why testing can't prove a loop
correct for all inputs; state the three rules in their own words; explain why
Maintenance must hold even for states real runs never reach; strengthen an
invariant to fix a failing rule; recognise the shape *a preserved equation + a
bound*.

## The world

| Program concept | On screen |
|---|---|
| Program state | A tile |
| One loop iteration | One frog hop (never per statement — the invariant only matters at the loop head) |
| Loop guard false | The **stop** region: striped tiles, with a line along its boundary |
| States the precondition allows (after init code) | **Eggs**; real frogs hatch from them |
| States the precondition rules out | Faint ghost tiles — not possible states |
| Postcondition | **Goal** pools, shown only in the stop region |
| Loop invariant | The learner's **area**, raised as blue slabs |
| An input the loop never changes (an integer or an array) | A **plane** per value, picked in the **inputs** at the foot of the code card |

**Visual language.** Everything the level fixes is quiet grayscale; the
learner's area is the only saturated surface (blue slabs, height). Other
colours are reserved: real frogs green, ghost frogs pale and see-through,
goals amber, and **red only for failures** (and Reset's confirmation).

**Real frogs and ghost frogs.** Real frogs are actual runs: they hatch from
eggs. **Ghost frogs** (유령 개구리) are hypothetical states placed to test the
area's claim: see-through and floating a little above their tile, so they
read as "not really there" without an explanation.

## The narrative: intuition first, then the rules

The game never leads with the rules; each is met as a picture first:

1. **Testing looks convincing** — run the frogs; every one reaches a goal.
2. **Testing can't be enough** — zoom out; the eggs never end.
3. **What an invariant is for, on an example** — a different loop, with a
   fixed area and frogs that keep hopping on it. Bad stopping tiles are off
   the area and the only stops on it are goals, so if the claim is true every
   frog stops on a goal. That argument never followed a frog, which is why it
   survives endless eggs. It takes three things: the three rules.
4. **Each rule on our loop** — the picture (callouts, outlines) and the plain
   sentence, pointing back at the example; then the learner checks their own
   area, and a what-if shows the rule's typical failure. The tutorial doesn't
   translate the rules into code.
5. **Induction, shown with one frog** — it starts on the area, every hop lands
   on it again, so it never leaves; when it stops, is that a goal? That
   question, asked over the outlined tiles a frog can stop on, opens
   Termination.

## Ghost frogs: why unreachable frogs matter

The most common objection is *"that frog could never actually be there!"* The
answer: Check never runs real frogs, because where they go is exactly what
is being proved. The area claims a frog could be on any of its tiles, so
Check asks of every tile: if a frog were here, where would it land, or where
would it stop? A ghost frog acts out that question. If you don't want a frog
there, shrink the claim — that is **strengthening**.

A failure a real frog can reach (from a nearby egg within a few hops) is
acted out by that real frog instead: then the area is simply wrong, while a
ghost frog's failure says the area claims more than real frogs do.

Nothing else stages the scene: tags, outlines, the spotlight, lit code lines
and the camera show where to look.

## Planes and the inputs card

Inputs are a direction frogs never hop in, so the state space is a set of
**independent planes**, one per choice of inputs, and the rules hold for every
input exactly when they hold in every plane. So showing one plane at a time
loses nothing. The **inputs** at the foot of the code card list every input
not on an axis; changing one switches the plane at once. (They used to be
"ponds" stacked in 3D, then a vertical slider; plain controls are what a
programmer expects, and have room for arrays.)

- An integer input is a number with − and + (or the arrow keys; up to nine
  digits typed). An array input is a text field, `[1, 3, 4]` (at most 32
  cells), with a dice that rolls an array the precondition allows; its
  length follows the array and isn't edited.
- **Inputs are never mutated**; programs copy them into loop variables. The
  type checker enforces this.
- **The input-only part of `requires` decides which planes exist**, and Check
  never uses one it rules out. A learner may still type such an input: the
  plane is all ghost tiles, the card says *not a possible input*, and the
  `requires` lines light up amber.
- **Initialisation code decides where the eggs sit** in each plane.
- A level plots two integer names on the axes (`view`). An input can be one
  of them, so its planes lie side by side as rows (the tutorial's `n`, Find
  It's `x`); an array's length can't.
- Hovering a row in the card lights up the input's declaration in the code.
  When a counterexample lives in another plane, the card's values change (and
  pop) before the camera moves.

## The checker

- **A rule passes only if it is proved.** Z3 decides every rule over every
  plane and tile. A large search never silently stands in for a proof — that
  would contradict what the game teaches.
- **On failure, show one concrete frog**, and prefer a nice one: the current
  plane first, then small values, then near the camera. If the only
  counterexample is far away, the camera flies to it: "everything you could
  see looked fine" is not a proof.
- **Three verdicts**, played rule by rule (see experience.md, *Verifying*):
  proved (the level is cleared); a counterexample (acted out by a real frog if
  one can reach it, otherwise a ghost frog); **undecided** (said in the
  caption, the level is *not* cleared). Before giving up, the checker tries
  proving the formula equivalent to a known solution. Ghost frogs only show
  where they would hop: Check asks the question, it doesn't run the frog.
- **One definition, three uses.** The same parsed program and formula drive
  the frogs, the proofs and the floor, so what the learner sees and what is
  proved can't disagree.
- Checks run only when the learner presses **Check** — never live.

## The formula language

The area is one text box. Its language is the expression part of the program
language:

- integers and booleans, strictly typed (a number is not a condition — the
  error says so and suggests a fix);
- `+ - * / %`, comparisons, `&& || !`, `abs`, `min`, `max`;
- **chained comparisons**: `0 <= i <= n` means `0 <= i && i <= n`; only
  `< <= > >=` chain, and `==` or `!=` in a chain is an error asking for
  parentheses (`x >= 0 == y >= 0` would otherwise silently mean something
  else);
- `//` is an error pointing at `/`, which already rounds down (a line comment
  would quietly drop the rest of the formula);
- **mathematical integers**: unbounded, no overflow;
- **`/` and `%` only by positive number literals**; `%` is Euclidean (always
  `0..k-1`) and `/` the matching floor division. This removes division by
  zero and keeps formulas decidable;
- `*` between variables is allowed (sum-style levels need it); it and the
  quantifiers are the sources of *undecided*, and a formula that divides is
  then told to avoid division;
- **arrays** are read-only inputs: `A[k]` is a cell, and **a cell outside the
  array reads as 0**, so a ghost frog past the end sees zeros (the levels say
  so when it matters);
- **`forall 0 <= k < i: A[k] <= m`** and `exists …`: the range is a chain of
  `<` and `<=` around the bound names (`forall 0 <= j <= k < n: A[j] <= A[k]`
  binds two, which is how sortedness is written so the solver needs no
  induction), and the body is one comparison or chain (parenthesise more). A
  bound name may not be one the program already uses. A constant range wider
  than 1000 values is refused; past an evaluation budget a tile simply reads
  as outside the area (the proof still goes to Z3).

While typing, the slabs follow the last valid formula; errors wait for Check.

## Programs and levels

A level is a small program: inputs (`input n;`, or an array `input A[n];`
whose length is an input declared before it), variables (with or without
initial values), `requires`, one `while` loop whose body has assignments and
`if/else`, and `ensures`. No nested loops, no calls, no writing to arrays.
**Eggs are every state satisfying `requires` after the initialisation code** —
one rule that covers a single egg per row, whole egg regions, and one egg per
plane.

Every level carries:

- **solutions** — known-good invariants. After a proof, the caption lists the
  others as answers that also work, so the learner sees that a loop has more
  than one invariant;
- **pitfalls** — the wrong answers learners are expected to try, each verified
  to fail, with a tailored message shown after the counterexample. A formula
  is matched to a pitfall by meaning, not by its text;
- **hints** — three, revealed one at a time: usually what to look at first,
  then the fact that matters, then the shape of the area (an equation plus a
  bound, say). None spells out a solution: turning the last hint into a
  formula is the learner's job.

`pnpm validate` checks every level: it compiles, has starting states, real
frogs from a sample of inputs stop, every solution is proved, every pitfall
fails cleanly (no rule undecided) and is recognised as itself, no hint
quotes a solution, and the Korean text matches the English (same levels,
hints and messages). Run it after touching levels, the language or the
checker; `pnpm build` doesn't.

**Level design principles:**

- each level teaches one idea, and its pitfall is the tempting formula that
  misses it (often the previous level's answer — *don't pattern-match*);
- the usual fix is **strengthening**: add the bound or fact the pitfall forgot;
- programs are loops a programmer might actually write (round up to a
  multiple, deal cards, integer square root), and a level's intro says what
  the loop is *for*, not how to solve it;
- levels are numbered straight through and get harder from first to last.
  Each adds exactly one new thing: a new mechanic (an input to change, `if`,
  products, `forall`) on familiar content, or new content on known
  mechanics, never both. So every tier opens with its mechanic on an easy
  program and ends on its hardest.

The level list groups them in four tiers, each a heading with its count of
cleared levels. A proved level is marked cleared (its number turns green,
with a tick); this is remembered in the browser, and the home screen's Reset
forgets it (two presses within three seconds, so a stray click loses
nothing).

| Tier | What the areas need | Levels |
|---|---|---|
| **Beginner** | one fence read off the guard; a wider one for the overshoot; which tiles frogs land on (`%`); then a fence relative to another moving variable | Countdown, Overshoot, Step by Two, Round Up, Meet in the Middle |
| **Intermediate** | an input to change (on an easy fence), then a preserved equation plus a fence: a sum, a ratio, a coefficient, a non-equation, an offset by `n` | Tag Along (the first level with an input in the card), Transfer, Doubling, Divide by 3, Parity, Catch Up |
| **Advanced** | a fact every branch of an `if` keeps, then one equation across branches, two facts at once, a staircase with `/`; then an equation with a product in it, and the finale where the guard supplies half the goal | Even Out (the first `if`), Absolute Value, Deal the Cards, Count the Threes, Sum to n (Tag Along's loop again), Square Root |
| **Arrays** | the goal with `n` replaced by `i` (`forall`); an input on an axis, with the fence the array's end needs; `exists` for a witness; then binary search, two `forall`s and a chain of fences on a sorted array | Biggest So Far, Find It, One of Them, Sorted Search |

## The tutorial

A scripted story on one program, a counter (`i` from `0` up to `n`), with a
detour through a second, the **example**: frogs hop straight right to a
column of goals, and its area, `0 <= x <= 4`, is an endless strip, so it is as
endless as the loop it stands in for. Both are real levels (`tutorialLevel`,
`exampleLevel`). The steps are in `src/tutorial/steps.ts`, their words in
`src/i18n/`.

- **Progressive reveal:** a bare plane and one frog first; then the code,
  Step, the stop region, eggs (with `requires` and the initialisation code),
  goals (with `ensures`), Run, the example, and finally the formula box with
  the three rule lights, dim until their stage.
- **The example is shown, not solved.** Its area is fixed and its code
  hidden. While the claim is introduced, one frog at a time hatches, runs and
  goes back into its egg; once the captions turn to tiles, the scene is still.
- **An endless region is drawn endless:** outlines of every egg or every stop
  on the area are a layer like the slabs, fading into the horizon wherever
  you look.
- **Any formula is a valid move.** Each of three stages asks for one rule's
  worth of area and checks only the rules introduced so far; the story
  branches on which rule failed, never on what was typed. The learner is
  never asked for "the invariant": it emerges by strengthening.
- **Every failure is witnessed:** by the learner's own formula if it fails,
  or else by a demo of that stage's pitfall, after the learner predicts the
  outcome (yes or no; the caption says if they were right, nothing is
  counted). Initialization's and Maintenance's pitfalls fail on real frogs;
  Termination's (`i >= 0`) on a ghost frog, which is where the objection
  above is answered.
- **One hint per stage:** a sentence that names the fact that matters,
  without giving the formula.
- **Say what things are once, then keep one name each** (below).
- No inputs card: `n` is an axis. It ends with the rules card, then the first
  level.

A learner should also leave having chosen a formula themselves three times,
and knowing the two ways an area fails: Initialization or Maintenance
failing leaves the claim unproved; Termination failing means the claim, true
or not, is too weak.

### Vocabulary

| Concept | English | Korean |
|---|---|---|
| The program, run on one input | a **frog** | 개구리 |
| Program state (its variables' values) | the **tile** a frog sits on | 칸, 프로그램 상태 |
| One loop iteration | a **hop** | 점프 (뛰다, 착지하다) |
| `requires` | the **precondition** | 사전 조건 |
| States a frog can start from | **eggs** | 알 |
| `ensures` | the **postcondition** | 사후 조건 |
| Tiles where the postcondition holds | **goals** | 목표 |
| Loop guard false | the loop **stops** here | 멈춘다 (빗금 친 칸) |
| The learner's formula | the **area** (**invariant area**); it is the **loop invariant** | 영역 (불변식 영역), 루프 불변식 |
| Raised tiles | **slabs** | 블록 |
| A state placed to test the area's claim | a **ghost frog** | 유령 개구리 |
| What an area says | a **claim**: every frog is always on it | 주장 |
| Passes Initialization and Maintenance | an **invariant** | 불변식 |
| Also passes Termination | **strong enough** to prove the postcondition | 사후 조건을 증명하기에 충분히 강한 |
| Fails Termination | **too weak** | 너무 약한 |
| States the precondition rules out | **not a possible state** / **input** | 불가능한 상태 / 입력 |
| The button that proves | **Check** | 검사 |

**Strengthening** (shrinking the area) is these docs' word; the game shows it
rather than naming it.

Rule names are the textbook ones (CLRS): **Initialization**, **Maintenance**,
**Termination**, in Korean 초기화, 유지, 종료. One name each, everywhere,
with no short forms. Termination means *when the loop terminates*, not a
termination proof; the rule's own sentence carries that.

Not used: "run" for a frog, "input" for eggs, and "watching" for testing or
for proving: the point of a proof is that it covers infinitely many inputs
without checking any of them.

## Scope

Out of scope: termination and loop variants, nested loops, function calls,
arrays the loop writes to, progress beyond which levels are cleared (no
accounts, nothing on a server). Read-only arrays fit because an array is an
input, so it is a plane; an array the loop changes would be part of the
frog's state, which no longer fits a grid. A later direction, if ever: the
frog carries its array, and the floor shows the selected frog's slice.
