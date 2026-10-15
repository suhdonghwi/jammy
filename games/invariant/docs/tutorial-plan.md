# Invariant Frog — Tutorial overhaul plan

A new tutorial, from the ground up. **Built:** `src/tutorial/steps.ts` follows
the script below, and `src/tutorial/script.ts` holds the stage, demo and
prediction machinery; this document is the reference for why it is the way it
is. The "The tutorial" section of [design.md](design.md) summarises it; the
rest of design.md (the world, the rules, the hand, the checker) is unchanged.

Playtesting: `?step=N` on the URL starts the tutorial at step N.

See also [experience.md](experience.md) for pacing and motion rules, which
still apply, and [architecture.md](architecture.md) for how steps are written.

## Why

A review of the current tutorial (played end to end, and against the script in
`src/tutorial/steps.ts`) found:

- **The learner never decides anything.** Every attempt accepts exactly one
  formula. Typing `i <= n`, a listed solution for the level, is refused with
  "type exactly `i == n`". The rationale for each formula is given in the
  caption before the attempt, so the learner doesn't form the hypothesis
  either. Then level 1-1 says "you are on your own now".
- **No bridge to what programmers already know.** The program's `requires` and
  `ensures` are never explained; "precondition" and "postcondition" appear
  late and unannounced; the word "invariant" appears only in the last caption.
  Nothing says *an invariant is an assert at the top of the loop that never
  fires*.
- **The ending defines "invariant" wrongly.** It calls `0 <= i <= n` a loop
  invariant by contrast with `i >= 0`. Both are invariants; one is too weak to
  prove the goal. Strengthening, which every later level relies on, only makes
  sense once "true but too weak" is a thing.
- **Metaphors go unexplained.** The purple test frog is never introduced; the
  slabs are never named as the formula drawn on the plane; the axes have no
  variable names; eggs are called "inputs" (wrong from level 1-2 on).
- **Too many names per concept.** Goal / "what we want" / `ensures` /
  postcondition. Area / formula / condition / invariant.

## What a learner should leave with

Design.md's list, plus the two the old tutorial skipped:

- explain why testing can't prove a loop correct for all inputs;
- state the three rules in their own words;
- explain why Preservation must hold even for states real runs never reach;
- strengthen an invariant to fix a failing rule;
- **choose a formula themselves**, having done it three times with feedback;
- **know the shape of the search:** too small fails Init or Preservation, too
  large fails Exit, the invariant sits between.

## Principles

1. **Any formula is a valid move.** The checker runs for real on whatever the
   learner types; the story branches on *which rule failed*, never on which
   formula was typed. There are only four outcomes per attempt, and each has a
   scripted response.
2. **One rule at a time.** Each stage asks a small, concrete question ("an area
   every egg sits on") and checks only the rules introduced so far. The learner
   is never asked for "the invariant"; it emerges by strengthening.
3. **Every failure is witnessed, by the learner or by the hand.** If the
   learner's formula fails the stage's rule, that is the witness. If it passes,
   the hand demonstrates the stage's pitfall formula instead. Every learner sees
   all three failures.
4. **Predict before you see.** Before each hand demo the learner commits to a
   guess (passes / fails, and which rule). A guess costs one click.
5. **Hints are a ladder, not a wall.** A stuck learner can ask for a nudge,
   then for a formula to try, then have it filled in. The old scripted
   formulas become this ladder.
6. **Say what things are, once, with the code word next to the world word.**
   Then keep one name each. See the vocabulary below.
7. **Pacing rules from experience.md still hold:** caption first, then the
   scene change; Next is always clickable; Back always works; only what the
   step asks for is enabled.

## Vocabulary

One name per concept. The "first said" column is the beat where the tutorial
defines it; after that the name is used without explanation.

| Concept | Name in the world | Code word | First said |
|---|---|---|---|
| One run of the program | a **frog** | | 1.1 |
| Program state (its variable values) | the **tile** a frog sits on | | 1.1 |
| One loop iteration | a **hop** | | 1.3 |
| `requires` | the **precondition**: what we assume about the input | `requires` | 1.2b |
| States a run can start from | **eggs**: starting states | | 1.5 |
| `ensures` | the **postcondition**: what must hold when the loop has finished | `ensures` | 1.2b |
| Tiles where the postcondition holds | **goals** | | 1.6 |
| Loop guard false | "the loop **stops** here" (no "striped") | `while (…)` | 1.4 |
| The learner's formula | the **area**; it *is* the **loop invariant** | an assert at the loop head | 1.9 |
| Raised tiles | **slabs**: the tiles where the formula is true | | 1.10 |
| The checker | the **hand** | | 2.1 |
| A hypothetical state the hand places | a **test frog** (purple); real frogs are green | | 2.2 |
| Passes Init and Preservation | "an **invariant**" | | 2.6 |
| Also passes Exit | "**strong enough** to prove the postcondition" | | 2.8 |
| Shrinking the area | **strengthening** | | 2.8 |
| A state that breaks a rule | "a frog that breaks it" | | 2.1 |

Rule names stay **Init**, **Preservation**, **Exit**: all three name *when* the
check happens. Each is expanded once when introduced, and the rules card maps
them to the textbook names (Initialization, Maintenance, Termination) so
readers who met CLRS recognise them.

Dropped: "input" for eggs, "striped", "condition" as a noun for the formula
(the placeholder becomes "a condition on `i` and `n`"), "Show me", "proved the
loop correct" (replaced by "every run that stops, stops on a goal").

## The script

Same program as today: `i` from `0` up to `n`. Four acts, about 12–15
minutes. Captions below are the intended wording; concrete values and
spotlights as in the current script unless noted.

### Act 1 — The world

**1.0 Hello.** Bare plane, nothing else.

> Hi. This is a game about **loop invariants**: the way to prove a loop
> correct for *every* input, not just the ones you happened to try.
>
> In about fifteen minutes you'll write one and have it checked. First, the
> world it lives in.

Button: "Let's go".

**1.1 A frog and its tile.** The axes appear (the numbered row and column as
a band, each named in the corner before its 0; new), and one frog with its
tag.

> This frog is one run of the program. The tile it sits on is its **state**:
> `i = 0, n = 3`. The plane's two axes are the two variables, so where the
> frog sits *is* its values.

The axes stay on for the rest of the tutorial and in levels.

**1.2a The program.** Code panel appears, spotlit.

> Here is the program. The loop runs its body again and again while `i < n`.

**1.2b Two lines you may not have seen.** Spotlight lines 2 and 9 in turn.

> `requires` is the **precondition**: what we assume about the input. Here,
> `n` is never negative.
>
> `ensures` is the **postcondition**: what must be true once the loop has
> finished. Here, `i` must have reached `n`.

**1.3 Step.** As today: press Step once ("one hop = one run of the loop
body"), then until the frog stops.

**1.4 Stops.** As today, with the callout "stops: 3 < 3 is false" and the
hover hint. Caption says "the shaded tiles are where the loop stops", not
"striped".

**1.5 Eggs.**

> Where can a run start? The program sets `i` to `0`, and the precondition
> lets `n` be any number `≥ 0`. Each **egg** is one starting state: a place a
> real run begins.

Callout on one egg: "starting state: i = 0, n = 2".

**1.6 Goals.**

> The amber pools are the **goals**: the tiles where the postcondition
> `i == n` holds. Every run should stop on one.

**1.7 Run.** As today. "Every frog stopped on a goal. Looks correct!"

**1.8 Watching can't be enough.** As today: zoom out, eggs never end, click a
few. "So how can we check them all?"

**1.9 The bridge.** Camera back in. The code panel shows a ghost line at the
top of the loop body: `assert(???);` (new reveal flag). All three rule lights
appear in the top bar, dim.

> If you could prove it instead of watching, you'd want a condition that is
> true every time a run reaches the top of the loop, for every run. An
> `assert` here that never fires.
>
> That condition is called a **loop invariant**. In this world it is an
> **area** of the plane: the tiles where the condition is true. An area has to
> pass three checks; we'll take them one at a time.

**1.10 Draw before you check.** Formula box appears; Check stays disabled.

> Type any condition on `i` and `n`. The tiles where it's true rise as
> **slabs**. Try two or three, and watch the plane.

Next appears after the first valid formula. Hover readout shows "in your
area / outside your area" as today. No suggestion placeholder here; the
placeholder reads "a condition on `i` and `n`".

### Act 2 — The three rules, one at a time

Each stage follows the same shape: **ask → attempt → outcome → witness →
name the rule**. The attempt loop is specified in full under "The attempt
loop" below; the stages here only give the wording and the pitfall.

**2.1 Stage 1: every egg.** The Init light wakes (the other two stay dim).
The hand needs no introduction of its own: it appears at the first failure
or demo, and the captions name it then.

> First rule: every egg must sit on your area, because the assert runs before
> the first hop. Draw an area every egg sits on, then press **Check**.

Check runs **Init** only. Pitfall for the demo: `i == n`.

- *Fails Init:* the hand hatches the egg outside (as today). Caption names the
  frog and the rule, then "Fix your area and Check again." Loop.
- *Passes:* "Every egg sits on it. Before we go on, let me try one that
  doesn't." → predict → demo `i == n` → the counterexample. Then:

> **Rule 1 · Init** (initialization): every egg sits on your area. `i == n`
> only covers the egg at `n = 0`.

**2.2 Stage 2: every hop.** The Preservation light wakes.

> Now the hop. A frog on your area must land on your area, every time.
> Check now runs rules 1 and 2.

Check runs **Init + Preservation**. Pitfall: `i == 0 || i == n`.

- *Fails Init:* "Rule 1 held a moment ago; this change lost it." Replay the
  egg outside. Loop.
- *Fails Preservation:* the hand places a purple frog and hops it out (as
  today). The first time a purple frog appears, a callout rides with it:
  "**test frog**: a state the hand imagines". Caption: "From `…`, one hop
  lands at `…` — outside your area." Loop.
- *Passes:* predict → demo `i == 0 || i == n` → counterexample ("frogs pass
  through the tiles in between").

Then name it:

> **Rule 2 · Preservation**: a frog on your area that hops lands on your area.
> The hand may start the test frog on *any* tile of your area, not only ones a
> real run reaches. Your area is a claim, and the hand tests the claim.

**2.3 Follow one frog.** With the learner's current formula (whatever passed).
As today: hatch at `(0, 3)`, "it starts on your area: that's Init"; step it,
"every hop lands on your area again: that's Preservation"; then:

> So it can never leave your area, no matter how many hops. That makes your
> area an **invariant**: true every time a run reaches the top of the loop.
>
> When the loop stops, the frog is still somewhere on your area. Is that
> enough?

**2.4 Stage 3: stopping on a goal.** The Exit light wakes. No new formula is
asked for first; Check runs all three rules on the current area automatically
(as today).

> Third rule: a frog that stops on your area must be on a goal. Let's check
> yours.

Pitfall: `i >= 0`.

- *Fails Exit:* the hand places a test frog on a stop tile that is not a goal
  (as today), with the objection paragraph:

  > "But `i` never passes `n`!" — Your area doesn't say that. It claims a frog
  > could be anywhere on it, and the hand takes you at your word. To fix it,
  > **shrink** your area so it stops claiming impossible frogs.

  The pitfall line from the level ("Real frogs never pass n — but your area
  allows it") is dropped here; it duplicates the paragraph. Loop: the learner
  edits and Checks again (all three rules).
- *Passes:* predict → demo `i >= 0` → the counterexample with the same
  objection paragraph.

**2.5 Too small, too large.** Once the learner's area passes all three.

> **Rule 3 · Exit**: a frog that stops on your area is on a goal.
>
> Notice the two ways to be wrong. Too **small** an area and an egg or a hop
> falls outside: Init or Preservation fails. Too **large** and it claims frogs
> that stop off a goal: Exit fails. The invariant sits between. Shrinking it
> is called **strengthening**.

Callouts: one egg ("too small: egg outside") and one stop tile off the goals
("too large: stops off a goal"), from the two demos just seen.

### Act 3 — Wrap-up

**3.1 Rain.** As today, on the learner's formula.

**3.2 Recap**, naming their formula:

> Your area `<their formula>` passes all three rules:
>
> - **Init:** every egg sits on it.
> - **Preservation:** no hop leaves it.
> - **Exit:** every frog that stops on it is on a goal.
>
> It is a loop invariant strong enough to prove the postcondition: every run
> that stops, stops on a goal — for every `n`, without watching any of them.

Button: Finish.

**3.3 Rules card.** Updated text (see "UI changes"). Closing it opens level
1-1, whose intro becomes: "Same idea, but this frog counts down. Start with an
area every egg sits on, and strengthen from there."

## The attempt loop

One stage = `stage(gen, { ask, rules, pitfall, hints })`. It replaces
`attempt()` and the `expected` / `tutorialCheck` gate.

**Check** is enabled whenever the stage is waiting. Pressing it compiles the
formula and runs the checker on `rules` (cumulative: stage 1 `['init']`, stage
2 `['init', 'pres']`, stage 3 all three). Outcomes:

| Outcome | Response |
|---|---|
| Parse or type error | As in levels: the box shows the error and shakes; no caption change. |
| A rule fails | The hand plays the counterexample for the *first* failing rule in order. The caption names the frog and the rule. If the failing rule is from an earlier stage, prefix "Rule *k* held a moment ago; this change lost it." Then wait for Check again. |
| Undecided | Cannot happen on this program (no `*` between variables); if it ever does, the hand shrugs and the hint ladder opens at rung 2. |
| All current rules pass | Lights go green. Caption: "Passes. Before we go on, let me try one that doesn't." → `predict` → `demo(pitfall)`. Then the stage ends. |

A stage ends only on a pass. There is no attempt limit; the hint ladder is
how a stuck learner finishes.

**Hint ladder.** A quiet "Hint" button beside Check (replacing "Show me").
Each press climbs one rung; the rung resets each stage.

1. A nudge in words, stage-specific:
   - stage 1: "What do all the eggs have in common? Look at their `i`."
   - stage 2: "Frogs only ever move right. What stays true after `i = i + 1`?"
   - stage 3: "A real frog never passes `n`. Does your area say so?"
2. The stage's reference formula appears as the placeholder (`i >= 0`,
   `i >= 0`, `0 <= i <= n`) with the Tab hint; the button now reads "Fill it
   in".
3. The formula is filled in. Check still has to be pressed by the learner.

The Tab hint is shown only while the box is empty (today it stays while Tab
does nothing).

**Predict.** A caption with two secondary buttons, e.g.:

> The hand will try `i == n`. Does it pass rule 1? **Passes** · **Fails**

After the demo: "Right — …" or "Not quite — …" followed by the rule's
explanation. For stage 3, the question is "Does `i >= 0` pass all three?".
Predictions are never scored or remembered; they exist to make the learner
commit. They are plain buttons, not clicks in the scene, and the demo cannot
be skipped: a learner who passes every stage first try still sees all three
failures, because the demos are where the rules get their names.

**Demo.** `demo(gen, formula, rule)`: the learner's formula is saved; the hand
comes in; the formula box types out `formula` character by character (slabs
follow, as when the learner types); the checker runs; the counterexample plays
with its Replay button; Next restores the learner's formula and slabs. The box
is read-only during a demo.

## UI and engine changes

Scene and HUD:

- **Axes** (`floorShader.ts` and `scene/labels/AxisLabels.tsx`): the floor
  tints the row and the column of numbers as a soft band, and each axis's
  name is written where its numbers are, in the corner of the tile before the
  0, so the row reads "i → 0 1 2 3" and the column "n ↑ 0 1 2 3". Like the
  numbers it hides nothing. Lines were tried and collided with the stop
  boundary, which runs in the same tile gaps; chips covered tiles; chips that
  followed the camera were distracting; a per-tile compass on hover was
  fiddly. On in levels too.
- **Ghost assert line** in the code panel: a reveal flag `assert` draws
  `assert(???);` as the loop body's first line, dimmed; from 1.10 on, `???` is
  replaced by the current formula text (so the code panel and the box always
  agree). Levels show it too once the formula box is open.
- **Rule lights** get a third look besides shown/hidden: *dim* (revealed but
  not yet checked in the tutorial, greyed) and *awake* (the current stage's
  rule and all earlier ones, as today). `reveal.lights`
  stays the list of visible lights; a new `reveal.awake` lists the awake ones.
  Levels show all three awake, as today.
- **Test-frog callout** the first time a purple frog appears in the tutorial.
- **Hint** button and rung state (`hint: number` in the store, reset per
  stage); "Show me" and `suggestion` go away, the placeholder comes from the
  rung.
- **Caption choices**: `Caption.choices?: { label; onClick }[]` rendered as
  secondary buttons, for `predict`.
- **Rules card** text:
  - subtitle: "An area that passes all three is a loop invariant strong enough
    to prove the postcondition: every run that stops, stops on a goal."
  - Init · Initialization: "Every egg sits on your area."
  - Preservation · Maintenance: "A frog on your area that hops lands on your
    area — any frog, not only ones a real run reaches."
  - Exit · Termination (of the loop, not a termination proof): "A frog that
    stops on your area is on a goal."
- Formula placeholder: "a condition on `i` and `n`" (from the level's view
  names).

Tutorial engine (`src/tutorial/`):

- `script.ts`: remove `expected`, `tutorialCheck`'s exact-match gate and
  `suggestion`; add `stage()`, `predict()`, `demo()`, and the hint rung. Check
  in tutorial mode calls the stage's pending resolver with the compiled formula.
- `steps.ts`: the beats above. Each step still declares its starting scene;
  stages declare `formula: 'learner'` meaning "whatever the learner last had",
  stored in the tutorial's own state so Back restores it.
- `director/verdicts.ts`: `playCounterexample` gains an option to suppress the
  level pitfall line (stage 3) and a `prefix` for the regression case.
- Checker: unchanged. `checkFormula` already takes a rule subset.

Levels and docs:

- `catalog.ts`: level 1-1's intro as above. Pitfall messages stay for the
  levels; the tutorial's own explanations replace them in every stage.
- `design.md`: replace "The tutorial" with a pointer to this plan (or fold the
  Principles and Vocabulary sections in once built).

## Decisions

Questions that came up while planning, and the answers this plan goes with:

- **Lights before their stage.** All three lights appear dim at 1.9, when the
  caption says "three checks", so the learner knows what is coming; each wakes
  as its stage begins. (Not: one light per stage, which left the top bar
  changing shape with no explanation.)
- **Experienced learners.** No "skip demo". Passing every stage first try
  takes about three extra minutes for the three demos, and the demos are where
  the rules are named and the test frog is introduced. A learner who already
  knows all this can leave by the back arrow at any time.
- **Prediction by clicking the scene.** Buttons only (Passes / Fails). Clicking
  an egg or a tile to answer "which one is missed?" would be more engaging but
  needs new input handling; revisit after the first version has been played.
- **Stage 2 regressions.** A learner who keeps breaking Init while fixing
  Preservation is not special-cased; the regression prefix names the lost
  rule, and the hint ladder's `i >= 0` fixes both. Watch for it in playtests.
