# Invariant Frog — Design

What the game teaches, and the rules of its world. Read this before changing
levels, the tutorial, the checker, or anything the learner sees.

See also: [experience.md](experience.md) (how the interface should feel) and
[architecture.md](architecture.md) (how the code is organised).

## The idea

A program's **state space** is an endless plane of tiles; each tile is one
program state. Running the program is a **frog** hopping between tiles, one hop
per loop iteration. The learner writes a formula describing an **area** of the
plane — the loop invariant — and a skeptical **hand** checks three rules:

| Rule | Formal | Learner-facing wording |
|---|---|---|
| **Initialization** | `pre ⇒ Inv` (after the initialisation code) | Every egg sits on your area. |
| **Maintenance** | `Inv ∧ guard ⇒ Inv[body]` | A frog on your area that hops lands on your area. |
| **Termination** | `Inv ∧ ¬guard ⇒ post` | A frog that stops on your area is on a goal. |

If all three hold, every frog, for every input, stops on a goal. That is the
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
| An input the loop never changes | A **pond**: one floor in a vertical stack |

**Visual language.** Everything the level fixes is quiet grayscale; the
learner's area is the only saturated surface (blue slabs, height). Other colours
are reserved: real frogs green, the hand's test frogs violet, goals amber, and
**red only for failures**.

**Real frogs vs test frogs.** Real frogs are actual runs: they hatch from eggs.
Test frogs are hypothetical states the hand places to test the area's claim.

## The narrative: earn the rules

The game never leads with the rules; it earns them:

1. **Watching looks convincing** — run the frogs; every one reaches a goal.
2. **Watching can't be enough** — zoom out; the eggs never end.
3. **Draw an area instead** — if one area passes three checks, every frog is
   covered without watching any of them.
4. **Induction, shown with one frog** — it starts on the area (Initialization), every hop
   lands on it again (Maintenance), so it never leaves; when it stops, is that
   enough? (Termination).

## The hand: why unreachable frogs matter

The most common objection is *"that frog could never actually be there!"* The
hand answers it: the area is a **claim** that frogs could be anywhere on it, and
the hand is allowed to test any part of the claim. If you don't want a frog
there, shrink the claim — that is **strengthening**. The hand is the only
adversary; it has no face or name.

## Ponds

Most invariants mention an input (e.g. `n`) that the loop never changes. Inputs
are a direction frogs can never hop in, so the state space is a **stack of
independent ponds**, one per input value, and all three rules hold for every
input exactly when they hold in every pond. Showing one pond at a time loses
nothing.

- **Inputs are never mutated**; programs copy them into loop variables. The
  type checker enforces this.
- **The input-only part of `requires` decides which ponds exist.** The hand can
  never use a pond the precondition rules out.
- **Initialisation code decides where the eggs sit** in each pond.
- A level plots two of its names on the plane's axes (`view`); at most one
  input is left over, and it becomes the pond stack. An input can also go on an
  axis, so its ponds lie side by side as rows (the tutorial's rows are its
  values of `n`).

## The checker

- **A rule passes only if it is proved.** Z3 decides every rule over every pond
  and tile. A large search never silently stands in for a proof — that would
  contradict what the game teaches.
- **On failure, show one concrete frog**, and prefer a nice one: the current
  pond first, then small values, then near the camera. A fast search of the
  states around the camera finds these; the solver finds the rest, starting
  with small bounds so its counterexamples are small too. If the only
  counterexample is far away, the camera flies to it: "everything you could see
  looked fine" is not a proof.
- **Verdicts:** proved (frog rain, level cleared); counterexample (the hand
  demonstrates it); **undecided** (the hand shrugs, the level is *not*
  cleared). Before giving up, the checker tries proving the formula equivalent
  to a known solution.
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
- **chained comparisons**: `0 <= i <= n` means `0 <= i && i <= n`;
- **mathematical integers**: unbounded, no overflow;
- **`/` and `%` only by positive number literals**; `%` is Euclidean (always
  `0..k-1`) and `/` the matching floor division. This removes division by zero
  and keeps formulas decidable;
- `*` between variables is allowed (sum-style levels need it); it is the only
  source of *undecided*, and the hint then is to avoid division.

While typing, the slabs follow the last valid formula; errors appear only once
typing pauses, underlined in place.

## Programs and levels

A level is a small program: inputs, variables (with or without initial
values), `requires`, one `while` loop whose body has assignments and `if/else`,
and `ensures`. No nested loops, no calls. **Eggs are every state satisfying
`requires` after the initialisation code** — one rule that covers a single egg
per row, whole egg regions, and one egg per pond.

Every level carries:

- **solutions** — known-good invariants, all proved at build time;
- **pitfalls** — the wrong answers learners are expected to try, each with a
  tailored message, each verified to fail.

`pnpm validate` checks every level: it compiles, has starting states, every
real frog stops, every solution is proved, every pitfall fails. Run it after
touching levels, the language or the checker.

**Level design principles:**

- each level teaches one idea, and its pitfall is the tempting formula that
  misses that idea (often the previous level's answer — *don't pattern-match*);
- the usual fix is **strengthening**: add the bound or fact the pitfall forgot;
- chapters build up: one plane (the rules alone) → stacked ponds (a preserved
  equation + a bound) → branches (Maintenance must hold on every branch).

## The tutorial

A scripted story on one program, a counter (`i` from `0` up to `n`), built on
the same engine as the levels. It is being rebuilt; the full script, the
vocabulary it introduces and the engine changes it needs are in
[tutorial-plan.md](tutorial-plan.md). In short:

- **Progressive reveal:** a bare plane and one frog first; the code, Step,
  eggs, goals, Run, the assert line, the formula box and the rule lights
  appear only when the story needs them.
- **Any formula is a valid move.** Each of three stages asks for one rule's
  worth of area and checks only the rules introduced so far; the story
  branches on which rule failed, never on which formula was typed.
- **Every failure is witnessed:** by the learner's own formula if it fails,
  or by the hand demonstrating that stage's pitfall if it passes, after the
  learner predicts the outcome.
- Each stage has one hint: a sentence behind a Hint button that names the fact
  that matters, without giving the formula.
- No ponds. It ends with the rules card, then the first level.

## Scope

Out of scope: termination and loop variants, nested loops, function calls,
arrays, more than one leftover input, saving progress. A possible later
direction is arrays, and programs whose state no longer fits a grid.
