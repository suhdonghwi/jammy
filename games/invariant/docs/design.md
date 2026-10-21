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
| **Initialization** | `pre ⇒ Inv` (after the initialisation code) | Every egg is on your area. |
| **Maintenance** | `Inv ∧ guard ⇒ Inv[body]` | No hop leads off your area. |
| **Termination** | `Inv ∧ ¬guard ⇒ post` | Every striped tile on your area is a goal. |

The area is a **claim**: every frog is always somewhere on it. Initialization
and Maintenance make the claim true (frogs start on it and no hop leaves it);
Termination makes it strong enough (the only stops it allows are goals). If
all three hold, every frog, for every input, stops on a goal. That is the
loop-invariant proof rule, presented as a game.

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
| An input the loop never changes | A **plane** per value, picked in the **inputs** at the foot of the code card |
| An array input | The same: one plane per array, typed into the card or rolled with its dice |

**Visual language.** Everything the level fixes is quiet grayscale; the
learner's area is the only saturated surface (blue slabs, height). Other colours
are reserved: real frogs green, test frogs pale see-through ghosts, goals amber, and
**red only for failures**.

**Real frogs vs test frogs.** Real frogs are actual runs: they hatch from eggs.
Test frogs are hypothetical states placed to test the area's claim. On screen
and in the text they are **ghost frogs** (유령 개구리): see-through and
floating a little above their tile, so they read as "not really there" without
an explanation.

## The narrative: intuition first, then the rules

The game never leads with the rules; it earns them, and each rule is met as
a picture before it is met as a rule:

1. **Testing looks convincing** — run the frogs; every one reaches a goal.
2. **Testing can't be enough** — zoom out; the eggs never end.
3. **What an invariant is for, on an example** — a different loop, with a
   fixed area and frogs that keep hopping on it. The area is a claim that
   every frog is always on it; bad stopping tiles are off it, and the only
   stops on it are goals, so if the claim is true every frog stops on a goal.
   That argument never followed a frog, which is why it survives endless
   eggs. It takes three things, which are the three rules.
4. **Each rule on our loop** — the picture (callouts, outlines) and the plain
   sentence, pointing back at the example; then the learner checks their own
   area, and a what-if shows the rule's typical failure. The tutorial stays
   with the picture: it does not translate the rules into code.
5. **Induction, shown with one frog** — it starts on the area, every hop lands
   on it again, so it never leaves; when it stops, is that a goal? That
   question, asked over the outlined tiles a frog can stop on, opens
   Termination, which then goes like the other two rules.

## Ghost frogs: why unreachable frogs matter

The most common objection is *"that frog could never actually be there!"* The
answer: Check never runs real frogs, because where they go is exactly what
is being proved. All it knows is the area, and the area claims a frog could
be on any of its tiles, so Check asks the question of every tile: if a frog
were here, where would it land, or where would it stop? A ghost frog acts
out that question. If you don't want a frog there, shrink the claim — that
is **strengthening**.

Ghost frogs break up through the slab of the tile they test (chips of slab
fly off), spinning as they rise, to a siren that plays once per wave. A
failure a real frog can reach (from a nearby egg within a few hops) is acted
out by that real frog instead: then the area is simply wrong, while a ghost
frog's failure says the area claims more than real frogs do.

Nothing else stages the scene: tags, outlines, the spotlight, lit code lines
and the camera show where to look.

## Planes and the inputs card

Most invariants mention an input (e.g. `n`) that the loop never changes. Inputs
are a direction frogs can never hop in, so the state space is a set of
**independent planes**, one per choice of inputs, and all three rules hold for
every input exactly when they hold in every plane. Showing one plane at a time
loses nothing: the **inputs**, at the foot of the code card, list every input
that is not on an axis, and changing one switches the plane at once. Folded,
the code card keeps them beside its title (an array on a row of its own). (They used to be
"ponds", floors stacked in 3D with the camera riding between them, and then a
vertical slider; a card of plain controls is what a programmer expects, and it
has room for arrays.)

- An integer input is a number with − and + (type any value; nothing limits
  the range). An array input is a text field, `[1, 3, 4]`, with a dice that
  rolls an array the precondition allows; its length input follows the array
  and is shown under it, not edited.
- **Inputs are never mutated**; programs copy them into loop variables. The
  type checker enforces this.
- **The input-only part of `requires` decides which planes exist.** Check can
  never use a plane the precondition rules out. A learner may still type such
  an input: the plane is then all ghost tiles, the card says *not a possible
  input*, and the `requires` lines in the code light up amber to say why.
- **Initialisation code decides where the eggs sit** in each plane.
- A level plots two of its integer names on the plane's axes (`view`); every
  other input is in the card. An input can also go on an axis, so its planes
  lie side by side as rows (the tutorial's rows are its values of `n`; Find
  It's rows are the values of `x` it looks for).
- Hovering a row in the card lights up the input's declaration in the code.
  When a check's counterexample lives in another plane, the card's values
  change (and pop) before the camera moves.

## The checker

- **A rule passes only if it is proved.** Z3 decides every rule over every plane
  and tile. A large search never silently stands in for a proof — that would
  contradict what the game teaches.
- **On failure, show one concrete frog**, and prefer a nice one: the current
  plane first, then small values, then near the camera. A fast search of the
  states around the camera finds these; the solver finds the rest, starting
  with small bounds so its counterexamples are small too. If the only
  counterexample is far away, the camera flies to it: "everything you could see
  looked fine" is not a proof.
- **Verdicts** are played rule by rule (see experience.md, *Verifying*):
  proved (Maintenance's picture is ghost frogs rising together on tiles of the area
  spread apart enough not to tangle, fading with distance; each shows where it
  would hop, a dashed path to its landing tile (the same one hovering a tile shows), which ticks green, without
  hopping: Check asks the question, it doesn't run the frog; level cleared); counterexample (a real frog acts it
  out if one can reach it, otherwise a ghost frog); **undecided** (said in the
  caption, the lights turn amber, the level is *not* cleared). Before giving up, the checker
  tries proving the formula equivalent to a known solution.
- **One definition, three uses.** The same parsed program and formula drive the
  frogs' animation, the proofs, and the floor's rendering, so what the learner
  sees and what is proved can't disagree.
- Checks run only when the learner presses **Check** — never live.

## The formula language

The area is one text box. Its language is the expression part of the program
language:

- integers and booleans, strictly typed (a number is not a condition — the error
  says so and suggests a fix);
- `+ - * / %`, comparisons, `&& || !`, `abs`, `min`, `max`;
- **chained comparisons**: `0 <= i <= n` means `0 <= i && i <= n`; only
  `< <= > >=` chain, and `==` or `!=` in a chain is an error asking for
  parentheses (`x >= 0 == y >= 0` would otherwise silently mean something
  else);
- `//` is an error pointing at `/`, which already rounds down (a line comment
  would quietly drop the rest of the formula);
- **mathematical integers**: unbounded, no overflow;
- **`/` and `%` only by positive number literals**; `%` is Euclidean (always
  `0..k-1`) and `/` the matching floor division. This removes division by zero
  and keeps formulas decidable;
- `*` between variables is allowed (sum-style levels need it); it and the
  quantifiers are the sources of *undecided*, and the hint then is to avoid
  division;
- **arrays** are read-only inputs: `A[k]` is a cell, and **a cell outside the
  array reads as 0** (so `A[k]` is defined for every `k`, and a ghost frog past
  the end of the array sees zeros; the levels say so when it matters);
- **`forall 0 <= k < i: A[k] <= m`** and `exists …`: the range is a chain of
  comparisons whose inner names are the bound names (`forall 0 <= j <= k < n:
  A[j] <= A[k]` binds two, which is how sortedness is written so the solver
  needs no induction), and the body is one comparison (parenthesise more). A
  bound name may not be a name the program already uses. A range with
  constant bounds wider than 1000 values is refused; any other range is
  evaluated up to a total budget per formula and tile, past which the tile
  simply reads as outside the area (the proof still goes to Z3).

While typing, the slabs follow the last valid formula; errors appear only once
typing pauses, underlined in place.

## Programs and levels

A level is a small program: inputs (`input n;`, or an array `input A[n];`
whose length is an input declared before it), variables (with or without
initial values), `requires`, one `while` loop whose body has assignments and
`if/else`, and `ensures`. No nested loops, no calls, no writing to arrays. **Eggs are every state satisfying
`requires` after the initialisation code** — one rule that covers a single egg
per row, whole egg regions, and one egg per plane.

Every level carries:

- **solutions** — known-good invariants, all proved at build time. After a
  proof, the success caption lists them as other answers that work (leaving
  out the one the learner typed, if they typed one exactly), so the learner
  sees that a loop has more than one invariant;
- **pitfalls** — the wrong answers learners are expected to try, each with a
  tailored message, each verified to fail;
- **hints** — two or three, behind a Hint button, revealed one at a time:
  first what to look at in the real runs, then the fact that matters, then
  the shape of the area (an equation plus a bound, say). None spells out a
  solution: turning the last hint into a formula is the learner's job.

`pnpm validate` checks every level: it compiles, has starting states, every
real frog stops, every solution is proved, every pitfall fails, and no hint
quotes a solution. Run it after
touching levels, the language or the checker.

**Level design principles:**

- each level teaches one idea, and its pitfall is the tempting formula that
  misses that idea (often the previous level's answer — *don't pattern-match*);
- the usual fix is **strengthening**: add the bound or fact the pitfall forgot;
- programs are loops a programmer might actually write (round up to a
  multiple, deal cards, integer square root), and a level's intro says what
  the loop is *for*, not how to solve it;
- levels are numbered straight through and get harder from first to last;
  the level list shows them in four tiers a learner can read at a glance,
  **Beginner**, **Intermediate**, **Advanced** and **Arrays** (with ●○○○ to
  ●●●● beside each). Each level adds exactly one new thing: a new mechanic
  (an input to change, `if`, products, `forall`) on content the learner can
  already do, or new content on known mechanics, never both. So every tier
  opens with its mechanic on an easy program and ends on its hardest. A proved level is
  marked cleared (its number turns green, with a tick, and the list counts
  them); this is remembered in the browser, and Reset beside the language
  switch forgets it (two presses, so a stray click loses nothing):

| Tier | What the areas need | Levels |
|---|---|---|
| **Beginner** | one fence read off the guard; a wider one for the overshoot; which tiles frogs land on (`%`); then a fence relative to another moving variable | Countdown, Overshoot, Step by Two, Round Up, Meet in the Middle |
| **Intermediate** | an input to change (on an easy fence), then a preserved equation plus a fence: a sum, a ratio, a coefficient, a non-equation, an offset by `n` | Tag Along (the first level with an input in the card), Transfer, Doubling, Divide by 3, Parity, Catch Up |
| **Advanced** | a fact every branch of an `if` keeps, then one equation across branches, two facts at once, a staircase with `/`; then an equation with a product in it, and the finale where the guard supplies half the goal | Even Out (the first `if`), Absolute Value, Deal the Cards, Count the Threes, Sum to n (Tag Along's loop again), Square Root |
| **Arrays** | the goal with `n` replaced by `i` (`forall`); an input on an axis, with the fence the array's end needs; `exists` for a witness; then binary search, two `forall`s and a chain of fences on a sorted array | Biggest So Far, Find It, One of Them, Sorted Search |

## The tutorial

A scripted story on one program, a counter (`i` from `0` up to `n`), with a
detour through a second, the **example** (frogs hop straight right to a
column of goals; its area, `0 <= x <= 4`, is an endless strip, so the example
is as endless as the loop it stands in for). Both are real levels on the same engine
(`tutorialLevel`, `exampleLevel`). The steps are `src/tutorial/steps.ts`; their
words are in `src/i18n/en.ts` and `ko.ts`. `?step=N` on the URL starts it at
step N, for playtesting.

- **Progressive reveal:** a bare plane and one frog first; the code, Step,
  eggs (with `requires`), goals (with `ensures`), Run, then the example, then
  the formula box and the rule lights appear only when the story needs them.
- **The example is shown, not solved.** Its area is fixed and its code
  hidden. While the claim is introduced, one frog at a time hatches, runs and
  goes back into its egg; once the captions turn to tiles, the frogs go home
  and the scene is still.
- **An endless region is drawn endless:** outlines of every egg or every stop
  on the area are a layer like the slabs, built around the camera and fading
  into the horizon, so they go on wherever you look.
- **Any formula is a valid move.** Each of three stages asks for one rule's
  worth of area and checks only the rules introduced so far; the story
  branches on which rule failed, never on which formula was typed. The
  learner is never asked for "the invariant": it emerges by strengthening.
- **Every failure is witnessed:** by the learner's own formula if it fails,
  or, if it passes, by a demo of that stage's pitfall after the learner
  predicts the outcome (yes or no; never scored). Initialization's and
  Maintenance's pitfalls fail on real frogs; Termination's (`i >= 0`) on a
  ghost frog, which is where the objection above is answered.
- **One hint per stage:** a sentence behind a Hint button that names the fact
  that matters, without giving the formula.
- **Say what things are once, then keep one name each** (below).
- No inputs card: its input `n` is an axis. It ends with the rules card, then the
  first level.

Besides the list under *The idea*, a learner should leave having chosen a
formula themselves three times, and knowing the shape of the search:
failing Initialization or Maintenance leaves the area's claim unproved
(an egg is off it, or a hop leads off it, even from a tile no frog
reaches); failing Termination means the claim, true or not, is too weak to
prove the postcondition. The area that proves the program passes all three.

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
| The learner's formula | the **area**; it is the **loop invariant** | 영역, 루프 불변식 |
| Raised tiles | **slabs** | 블록 |
| A state placed to test the area's claim | a **ghost frog** | 유령 개구리 |
| What an area says | a **claim**: every frog is always on it | 주장 |
| Passes Initialization and Maintenance | an **invariant** | 불변식 |
| Also passes Termination | **strong enough** to prove the postcondition | 사후 조건을 증명할 만큼 강한 |
| Shrinking the area | **strengthening** | 강화 |

Rule names are the textbook ones (CLRS): **Initialization**, **Maintenance**,
**Termination**, in Korean 초기화, 유지, 종료. One name each, everywhere
(lights, captions, rules card), with no short forms. Termination means *when
the loop terminates*, not a termination proof; the rule's own sentence carries
that.

Not used: "run" for a frog, "input" for eggs, and "watching" for testing or
for proving: the point of a proof is that it covers infinitely many inputs
without checking any of them.

## Scope

Out of scope: termination and loop variants, nested loops, function calls,
arrays the loop writes to, progress beyond which levels are cleared (no
accounts, nothing on a server). Read-only arrays fit the world because an
array is an input, so it is a plane; an array the loop changes would be part
of the frog's state, which no longer fits a grid. A later direction, if ever:
the frog carries its array, and the floor shows the slice for the selected
frog's array.
